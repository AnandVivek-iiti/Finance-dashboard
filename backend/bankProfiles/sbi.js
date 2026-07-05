

const { parseAmountToPaise } = require("../utils/money");
const { parseStatementDate } = require("../parsers/dateParser");

const CANONICAL_FIELDS = ["date", "transactionId", "withdrawal", "deposit", "balance", "remarks"];

function cell(row, i) {
  return row && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : "";
}

const HEADER_MATCHERS = {
  date: /date/i,
  remarks: /detail/i,
  transactionId: (h) => /ref/i.test(h) && /no/i.test(h),
  withdrawal: /debit/i,
  deposit: /credit/i,
  balance: /balance/i,
};

function matches(field, text) {
  const matcher = HEADER_MATCHERS[field];
  return typeof matcher === "function" ? matcher(text) : matcher.test(text);
}

function findHeaderRow(rows) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const mapping = {};
    for (let c = 0; c < row.length; c++) {
      const text = cell(row, c);
      if (!text) continue;
      for (const field of CANONICAL_FIELDS) {
        if (mapping[field] === undefined && matches(field, text)) mapping[field] = c;
      }
    }
    if (["date", "withdrawal", "deposit", "balance"].every((f) => mapping[f] !== undefined)) {
      return { headerRowIndex: r, columnMap: mapping };
    }
  }
  return null;
}


function extractMetadata(rows, headerRowIndex) {
  const meta = {
    accountNumber: "",
    accountHolderName: "",
    branchName: "",
    ifscCode: "",
    periodStart: null,
    periodEnd: null,
  };

  const BANK_NAME_RE = /state bank of india/i;
  let bankRowIdx = -1;

  for (let r = 0; r < headerRowIndex; r++) {
    const row = rows[r] || [];

    for (const cellRaw of row) {
      const text = String(cellRaw ?? "").trim();
      if (!text) continue;

      if (bankRowIdx === -1 && BANK_NAME_RE.test(text)) bankRowIdx = r;

      if (!text.includes(":")) continue;
      const idx = text.indexOf(":");
      const label = text.slice(0, idx).trim().toLowerCase();
      const value = text.slice(idx + 1).trim();
      if (!value) continue;

      if (/^account (no|number)\.?$/.test(label)) meta.accountNumber = value;
      else if (/^(ifsc|ifs) code$/.test(label)) meta.ifscCode = value;
      else if (/^branch(\s*name)?$/.test(label)) meta.branchName = value;

      const statementMatch = text.match(/^statement from\s*:\s*(.+?)\s+to\s+(.+)$/i);
      if (statementMatch) {
        meta.periodStart = parseStatementDate(statementMatch[1].trim());
        meta.periodEnd = parseStatementDate(statementMatch[2].trim());
      }
    }
  }

  // Positional fallback: the row naming the bank has the account holder's
  // name in the other cell on that same row.
  if (bankRowIdx !== -1 && !meta.accountHolderName) {
    const bankRowCells = (rows[bankRowIdx] || []).map((c) => String(c ?? "").trim()).filter(Boolean);
    const name = bankRowCells.find((c) => !BANK_NAME_RE.test(c));
    if (name) meta.accountHolderName = name;
  }

  return meta;
}

/** Rows to skip within the transaction table itself. */
function isSkippableRow(row, columnMap) {
  const dateCell = cell(row, columnMap.date).toLowerCase();
  const remarksCell = cell(row, columnMap.remarks).toLowerCase();
  if (!dateCell) return true; // blank trailing rows
  if (/^(opening balance|closing balance|b\/f|brought forward)/.test(remarksCell)) return true;
  return false;
}

function stripCrDrSuffix(raw) {
  if (raw === null || raw === undefined) return raw;
  return String(raw).replace(/\s*(cr|dr)\s*$/i, "");
}

/**
 * SBI-specific balance source, since (unlike Canara) there's no inline
 * Opening/Closing Balance row inside the transaction table to read from.
 * Primary source is the "Statement Summary" block near the end of the
 * sheet; falls back to the "Clear Balance" field near the top if that
 * block is missing or truncated (which has no opening-balance equivalent,
 * so openingBalancePaise stays null in that fallback path).
 *
 * Also reports stopRowIndex so the caller can stop walking rows as
 * transactions once the summary block starts - otherwise its own rows
 * (and the "Statement Summary : ... to ..." label row above it) get
 * treated as unparseable transaction rows and pollute parseErrors with
 * noise that isn't a real parse problem.
 */
function extractBalances(rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = (rows[i] || []).map((c) => (c === undefined || c === null ? "" : String(c).trim()));
    const broughtForwardCol = row.findIndex((c) => /brought forward/i.test(c));
    const closingBalanceCol = row.findIndex((c) => /closing balance/i.test(c));
    if (broughtForwardCol === -1 || closingBalanceCol === -1) continue;

    let stopRowIndex = i;
    const prevRow = rows[i - 1] || [];
    if (prevRow.some((c) => /statement summary/i.test(String(c ?? "")))) {
      stopRowIndex = i - 1;
    }

    for (let j = i + 1; j < rows.length; j++) {
      const valuesRow = rows[j];
      if (!valuesRow || valuesRow.every((c) => String(c ?? "").trim() === "")) continue;

      return {
        openingBalancePaise: parseAmountToPaise(stripCrDrSuffix(valuesRow[broughtForwardCol])),
        closingBalancePaise: parseAmountToPaise(stripCrDrSuffix(valuesRow[closingBalanceCol])),
        stopRowIndex,
      };
    }
    break;
  }

  // Fallback: "Clear Balance : 636.78CR" near the top of the sheet.
  for (let i = 0; i < rows.length; i++) {
    for (const cellRaw of rows[i] || []) {
      const text = String(cellRaw ?? "").trim();
      const m = text.match(/^clear balance\s*:\s*(.+)$/i);
      if (!m) continue;
      return {
        openingBalancePaise: null,
        closingBalancePaise: parseAmountToPaise(stripCrDrSuffix(m[1])),
        stopRowIndex: null,
      };
    }
  }

  return null;
}

module.exports = {
  id: "sbi",
  name: "State Bank of India",
  dateFormat: "DD/MM/YYYY", // e.g. 21/03/2025
  findHeaderRow,
  extractMetadata,
  isSkippableRow,
  extractBalances,
};