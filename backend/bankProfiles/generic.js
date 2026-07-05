
const CANONICAL_FIELDS = ["date", "transactionId", "withdrawal", "deposit", "balance", "remarks"];

function cell(row, i) {
  return row && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : "";
}

const HEADER_MATCHERS = {
  date: /^(txn\s*)?date$/i,
  transactionId: /^(txn|transaction|chq).{0,3}(id|no|number|ref)/i,
  withdrawal: /withdrawal|debit/i,
  deposit: /deposit|credit/i,
  balance: /balance/i,
  remarks: /remarks?|narration|description|particulars/i,
};

function findHeaderRow(rows) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const mapping = {};
    for (let c = 0; c < row.length; c++) {
      const text = cell(row, c);
      for (const field of CANONICAL_FIELDS) {
        if (mapping[field] === undefined && HEADER_MATCHERS[field].test(text)) mapping[field] = c;
      }
    }
    if (["date", "withdrawal", "deposit", "balance"].every((f) => mapping[f] !== undefined)) {
      return { headerRowIndex: r, columnMap: mapping };
    }
  }
  return null;
}

function extractMetadata(rows, headerRowIndex) {
  return {
    accountNumber: "",
    accountHolderName: "",
    branchName: "",
    ifscCode: "",
    periodStart: null,
    periodEnd: null,
  };
}

function isSkippableRow(row, columnMap) {
  const dateCell = cell(row, columnMap.date).toLowerCase();
  if (!dateCell) return true;
  if (dateCell.includes("opening balance")) return true;
  return false;
}

module.exports = {
  id: "generic",
  name: "Generic / Unrecognized Bank",
  dateFormat: null, 
  findHeaderRow,
  extractMetadata,
  isSkippableRow,
};
