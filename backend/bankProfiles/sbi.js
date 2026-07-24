const { parseAmountToPaise } = require("../utils/money");
const { parseStatementDate } = require("../parsers/dateParser");
const { stripCrDrSuffix } = require("../utils/signedAmount");

const BANK_NAME_RE = /state bank of india|\bsbi\b/i;

function cell(row, i) {
  return row && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : "";
}

function identify(rows) {
  for (const row of rows.slice(0, 40)) {
    for (const raw of row || []) {
      if (BANK_NAME_RE.test(String(raw ?? ""))) return true;
    }
  }
  return false;
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

  if (bankRowIdx !== -1 && !meta.accountHolderName) {
    const bankRowCells = (rows[bankRowIdx] || []).map((c) => String(c ?? "").trim()).filter(Boolean);
    const name = bankRowCells.find((c) => !BANK_NAME_RE.test(c));
    if (name) meta.accountHolderName = name;
  }

  return meta;
}

function isSkippableRow(row, columnMap) {
  const dateCell = cell(row, columnMap.date).toLowerCase();
  const remarksCell = cell(row, columnMap.remarks).toLowerCase();
  if (!dateCell) return true;
  if (/^(opening balance|closing balance|b\/f|brought forward)/.test(remarksCell)) return true;
  return false;
}

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
  dateFormat: "DD/MM/YYYY",
  identify,
  extractMetadata,
  isSkippableRow,
  extractBalances,
};
