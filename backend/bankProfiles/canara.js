const { parseStatementDate } = require("../parsers/dateParser");

function cell(row, i) {
  return row && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : "";
}

function identify(rows) {
  for (const row of rows.slice(0, 40)) {
    for (const raw of row || []) {
      if (/canara/i.test(String(raw ?? ""))) return true;
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
  identify,
  extractMetadata,
  isSkippableRow,
};
