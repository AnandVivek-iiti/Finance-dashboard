#!/usr/bin/env python
"""
Extracts every table row from every page of a bank statement PDF using
pdfplumber and prints them as a single JSON array of rows (array of arrays)
to stdout, so Node's pdfParser.js can hand it to the same tableParser.js
normalizer used for XLS files.

Usage: python pdf_extract.py <path-to-pdf> [password]

Requires: pip install pdfplumber
"""
import sys
import json

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
            "error": "No tables were detected in this PDF. It may be a scanned/image-only statement, which needs OCR (not currently supported)."
        }))
        sys.exit(1)

    print(json.dumps(all_rows))

if __name__ == "__main__":
    main()