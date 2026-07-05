const { parseStatementDate } = require("../parsers/dateParser");

const COLUMN_MATCHERS = {
  date: (h) => /date/i.test(h),
  transactionId: (h) => /actio/i.test(h) && /id/i.test(h),
  withdrawal: (h) => /withdrawal/i.test(h),
  deposit: (h) => /deposit/i.test(h),
  balance: (h) => /balance/i.test(h),
  remarks: (h) => /remark/i.test(h),
};
const REQUIRED_HEADER_FIELDS = ["date", "transactionId", "withdrawal", "deposit", "balance", "remarks"];

function cell(row, i) {
  return row && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : "";
}

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map((c) => (c === undefined || c === null ? "" : String(c).trim()));
    const matched = {};
    for (const [field, matcher] of Object.entries(COLUMN_MATCHERS)) {
      const colIdx = row.findIndex((c) => c.length > 0 && matcher(c));
      if (colIdx !== -1) matched[field] = colIdx;
    }
    const allFound = REQUIRED_HEADER_FIELDS.every((f) => f in matched);
    if (allFound) {
      return { headerRowIndex: i, columnMap: matched };
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

  for (let i = 0; i < headerRowIndex; i++) {
    const row = rows[i] || [];
    const c0 = String(row[0] ?? "").trim();
    const c1 = String(row[1] ?? "").trim();
    const c3 = String(row[3] ?? "").trim();
    const c4 = String(row[4] ?? "").trim();

    const assign = (label, value) => {
      if (!value) return;
      if (/^account number$/i.test(label)) meta.accountNumber = value;
      else if (/^name$/i.test(label)) meta.accountHolderName = value;
      else if (/^ifsc code$/i.test(label)) meta.ifscCode = value;
      else if (/^branch name$/i.test(label)) meta.branchName = value;
    };

    assign(c0, c1);
    assign(c3, c4);

    for (const raw of row) {
      const text = String(raw ?? "").trim();
      const m = text.match(/from\s+(.+?)\s+to\s+(.+)$/i);
      if (m) {
        meta.periodStart = parseStatementDate(m[1].trim());
        meta.periodEnd = parseStatementDate(m[2].trim());
      }
    }
  }

  return meta;
}

function isSkippableRow(row, columnMap) {
  const dateCell = cell(row, columnMap.date).toLowerCase();
  const idCell = cell(row, columnMap.transactionId).toLowerCase();
  if (!dateCell) return true;
  if (idCell === "closing balance") return true;
  return false;
}

module.exports = {
  id: "canara",
  name: "Canara Bank",
  dateFormat: "DD-MMM-YYYY",
  findHeaderRow,
  extractMetadata,
  isSkippableRow,
};