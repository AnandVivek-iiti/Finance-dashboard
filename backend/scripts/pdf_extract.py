#!/usr/bin/env python
"""
Extracts every table row from every page of a bank statement PDF using
pdfplumber and prints them as a single JSON array of rows (array of arrays)
to stdout, so Node's pdfParser.js can hand it to the same tableParser.js
normalizer used for XLS files.

Usage: python pdf_extract.py <path-to-pdf> [password]

Requires: pip install pdfplumber

WHY there are two extraction strategies below (ruled-line + word-position):
pdfplumber's page.extract_tables() only finds a table when it can detect
ruling lines (or, with the "text" strategy, tightly consistent whitespace
gaps). The overwhelming majority of real-world bank statement PDFs are
plain positioned text with NO drawn table borders -- pdfplumber returns
zero tables for them even though every date/amount is perfectly selectable.
Previously that meant EVERY such statement was misclassified as "needsOcr"
and routed to the AI OCR fallback, even fully text-based PDFs. The
word-position fallback reconstructs columns from each word's actual x0
coordinate (grouped under the header row's column boundaries), which works
regardless of how many spaces separate columns in the underlying text.

WHY _fix_merged_withdrawal_deposit_column exists:
Some banks (Canara's PDF export, specifically) render the "Withdrawal" and
"Deposits" header labels with essentially zero visual gap between them, so
no word-tolerance setting can reliably split them into two columns -- and
since the header row's word positions define every column boundary for the
whole table, BOTH the withdrawal and deposit amounts end up bucketed into
one merged column with no way to tell them apart by position alone.
Rather than guess from remarks text (unreliable -- e.g. "DEBIT CARD ANNUAL
CHARGES" rows carry no CR/DR marker at all), this reconstructs debit vs.
credit from the balance column's row-to-row delta, which is always present
and never garbled, and falls back to a remarks keyword scan only when the
delta itself can't be computed (missing/unparsable balance, or a zero-net
row where the delta genuinely can't tell you anything).
"""
import sys
import json
import re

HEADER_KEYWORDS = re.compile(
    r"^(date|txn|transaction|chq|withdrawal|debit|deposit|credit|balance|"
    r"remarks?|narration|description|particulars|id|no\.?|number|ref)",
    re.IGNORECASE,
)
MIN_HEADER_HITS = 3  # a real header row matches several of these, stray text rarely does


def _group_into_lines(words, y_tolerance=3):
    """Groups words with nearly-equal 'top' into visual lines, left-to-right."""
    lines = []
    for w in words:
        placed = False
        for line in lines:
            if abs(line[0]["top"] - w["top"]) <= y_tolerance:
                line.append(w)
                placed = True
                break
        if not placed:
            lines.append([w])
    for line in lines:
        line.sort(key=lambda w: w["x0"])
    lines.sort(key=lambda line: line[0]["top"])
    return lines


def _is_header_line(line):
    hits = sum(1 for w in line if HEADER_KEYWORDS.match(w["text"]))
    return hits >= MIN_HEADER_HITS


def _bucket_line(line, boundaries):
    """Assigns each word to the rightmost column boundary at or before its x0."""
    cols = [[] for _ in boundaries]
    for w in line:
        idx = 0
        for bi, b in enumerate(boundaries):
            # 5pt slack absorbs minor sub-pixel misalignment between the
            # header word's x0 and a data word's x0 in the same column.
            if w["x0"] >= b - 5:
                idx = bi
        cols[idx].append(w["text"])
    return [" ".join(c) for c in cols]


def extract_rows_by_word_position(pdf):
    """
    Fallback for text-based PDFs with no ruled table lines. Finds the header
    row (by keyword match) on the first page that has one, uses its words'
    x0 positions as column boundaries, and buckets every subsequent line's
    words into those columns -- including on later pages that don't repeat
    the header row, which is the normal case for continuation pages. Column
    boundaries are re-established if a later page *does* show its own header
    line. Returns [] if no page ever shows a recognizable header line.
    """
    all_rows = []
    boundaries = None
    header_found_anywhere = False

    for page in pdf.pages:
        # Tight tolerances reduce (but for some PDFs can't fully eliminate --
        # see _fix_merged_withdrawal_deposit_column) accidental merging of
        # adjacent, tightly-kerned column headers into one "word".
        words = page.extract_words(keep_blank_chars=False, x_tolerance=1, y_tolerance=1)
        if not words:
            continue  # no text on this page at all (likely a scanned page)

        lines = _group_into_lines(words)

        header_idx = None
        for i, line in enumerate(lines):
            if _is_header_line(line):
                header_idx = i
                break

        if header_idx is not None:
            header_found_anywhere = True
            boundaries = [w["x0"] for w in lines[header_idx]]
            start_idx = header_idx
        elif boundaries is not None:
            # Continuation page: no repeated header, reuse the last known
            # column boundaries rather than dropping this page's rows.
            start_idx = 0
        else:
            continue  # no header seen yet anywhere -- nothing to bucket against

        for line in lines[start_idx:]:
            all_rows.append(_bucket_line(line, boundaries))

    return all_rows if header_found_anywhere else []


def _parse_amount(raw):
    """Best-effort float parse of a cell that might hold a currency amount."""
    if raw is None:
        return None
    s = str(raw).replace(",", "").strip()
    if s == "" or s in ("-", "—"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _fix_merged_withdrawal_deposit_column(rows):
    """
    Detects a header row where 'withdrawal' and 'deposit' text has collapsed
    into one (or two mis-split) adjacent header cells, and redistributes
    each data row's single amount value into the correct one of the two
    columns based on the balance column's delta from the previous row.
    Leaves rows untouched if no such merge is detected.
    """
    if not rows:
        return rows

    header = list(rows[0])
    withdraw_idx = None
    for i, c in enumerate(header):
        if "withdraw" in str(c).lower():
            withdraw_idx = i
            break
    if withdraw_idx is None:
        return rows  # no withdrawal-like header at all -- not this quirk

    pair_idx = withdraw_idx + 1
    if pair_idx >= len(header):
        return rows

    # Confirm this is genuinely a collapsed/mis-split merge (not just two
    # normal, correctly-separated "Withdrawal" | "Deposits" columns) by
    # checking whether "deposit" only shows up once these two cells'
    # text is considered together.
    already_has_deposit_col = "deposit" in str(pair_idx and header[pair_idx]).lower()
    combined = (str(header[withdraw_idx]) + str(header[pair_idx])).lower()
    if "deposit" not in combined:
        return rows  # not this quirk -- leave untouched
    if already_has_deposit_col and "withdraw" not in str(header[withdraw_idx]).lower().replace("withdrawal", ""):
        # header[pair_idx] already cleanly says "Deposits" on its own and
        # header[withdraw_idx] cleanly says "Withdrawal" on its own --
        # already correctly split, nothing to fix.
        pass

    balance_idx = None
    for i, c in enumerate(header):
        if "balance" in str(c).lower():
            balance_idx = i
            break

    remarks_idx = len(header) - 1  # remarks is always the last column here

    header[withdraw_idx] = "Withdrawal"
    header[pair_idx] = "Deposits"
    fixed_rows = [header]

    prev_balance = None
    for row in rows[1:]:
        row = list(row)
        while len(row) < len(header):
            row.append("")

        raw_amount = row[withdraw_idx] if str(row[withdraw_idx]).strip() else row[pair_idx]
        amount = _parse_amount(raw_amount)
        balance = _parse_amount(row[balance_idx]) if balance_idx is not None else None

        row[withdraw_idx] = ""
        row[pair_idx] = ""

        if amount is None:
            # Opening/closing balance rows, blank rows, etc -- nothing to
            # redistribute, but still track balance for the next row's delta.
            fixed_rows.append(row)
            if balance is not None:
                prev_balance = balance
            continue

        is_deposit = None
        if balance is not None and prev_balance is not None:
            if balance > prev_balance + 0.005:
                is_deposit = True
            elif balance < prev_balance - 0.005:
                is_deposit = False
            # equal (net-zero row): leave as None, fall through to remarks

        if is_deposit is None:
            remarks_text = str(row[remarks_idx]).upper() if remarks_idx < len(row) else ""
            if re.search(r"\bCR\b|CREDIT", remarks_text):
                is_deposit = True
            elif re.search(r"\bDR\b|DEBIT", remarks_text):
                is_deposit = False

        if is_deposit is None:
            # Still unresolved -- default to withdrawal. This is a genuine
            # guess; tableParser.js's own balance-reconciliation check will
            # flag the row as a mismatch if the guess is wrong, surfacing it
            # for manual review instead of silently losing it.
            is_deposit = False

        if is_deposit:
            row[pair_idx] = raw_amount
        else:
            row[withdraw_idx] = raw_amount

        if balance is not None:
            prev_balance = balance

        fixed_rows.append(row)

    return fixed_rows


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: pdf_extract.py <path-to-pdf> [password]"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else ""

    try:
        import pdfplumber
    except ImportError:
        print(json.dumps({
            "error": "pdfplumber is not installed. Run: pip install pdfplumber --break-system-packages"
        }))
        sys.exit(1)

    try:
        from pdfminer.pdfdocument import PDFPasswordIncorrect
    except ImportError:
        PDFPasswordIncorrect = Exception  # fallback, shouldn't happen if pdfplumber is installed

    all_rows = []
    try:
        with pdfplumber.open(pdf_path, password=password) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables()
                for table in tables:
                    for row in table:
                        all_rows.append(["" if c is None else c for c in row])

            if not all_rows:
                all_rows = extract_rows_by_word_position(pdf)

            if all_rows:
                all_rows = _fix_merged_withdrawal_deposit_column(all_rows)

    except PDFPasswordIncorrect:
        print(json.dumps({
            "error": "This PDF is password-protected." if not password else "Incorrect password for this PDF.",
            "passwordRequired": True,
            "wrongPassword": bool(password),
        }))
        sys.exit(1)
    except Exception as e:

        is_password_issue = isinstance(e, PDFPasswordIncorrect)
        chain = [getattr(e, "__cause__", None), getattr(e, "__context__", None)] + list(getattr(e, "args", []))
        for link in chain:
            if isinstance(link, PDFPasswordIncorrect):
                is_password_issue = True
            if isinstance(link, str) and ("password" in link.lower() or "decrypt" in link.lower()):
                is_password_issue = True
        if not is_password_issue and ("password" in str(e).lower() or "decrypt" in str(e).lower()):
            is_password_issue = True

        if is_password_issue:
            print(json.dumps({
                "error": "This PDF is password-protected." if not password else "Incorrect password for this PDF.",
                "passwordRequired": True,
                "wrongPassword": bool(password),
            }))
            sys.exit(1)

        print(json.dumps({"error": f"Failed to read PDF: {str(e) or type(e).__name__}"}))
        sys.exit(1)

    if not all_rows:
        print(json.dumps({
            "error": "No tables were detected in this PDF. It appears to be a scanned/image-only statement.",
            "needsOcr": True,
        }))
        sys.exit(1)

    print(json.dumps(all_rows))

if __name__ == "__main__":
    main()