function cell(row, i) {
  return row && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : "";
}

function extractMetadata() {
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
  extractMetadata,
  isSkippableRow,
};
