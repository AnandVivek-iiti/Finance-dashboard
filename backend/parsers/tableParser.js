const { parseAmountToPaise } = require("../utils/money");
const { parseStatementDate } = require("./dateParser");
const { categorize } = require("./categorizer");
const { detectProfile } = require("../bankProfiles");

function cell(row, i) {
  if (i === undefined || i === null) return "";
  return row && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : "";
}


function normalizeTable(rows, overridesMap) {
  const detected = detectProfile(rows);
  if (!detected) {
    return {
      error: "Could not locate a recognizable transaction table header (Date/Withdrawal/Deposit/Balance columns). This bank's export format isn't supported yet.",
    };
  }

  const { profile, headerRowIndex, columnMap } = detected;
  const metadata = profile.extractMetadata(rows, headerRowIndex);

  const externalBalances = profile.extractBalances ? profile.extractBalances(rows) : null;
  const lastRowExclusive =
    externalBalances && externalBalances.stopRowIndex != null
      ? Math.min(externalBalances.stopRowIndex, rows.length)
      : rows.length;

  const transactions = [];
  const parseErrors = [];
  let runningBalancePaise = externalBalances ? externalBalances.openingBalancePaise : null;
  let openingBalancePaise = externalBalances ? externalBalances.openingBalancePaise : null;

  for (let r = headerRowIndex + 1; r < lastRowExclusive; r++) {
    const row = rows[r];
    if (!row || row.every((v) => v === null || v === undefined || String(v).trim() === "")) continue;

    const idCell = cell(row, columnMap.transactionId);
    if (idCell.toLowerCase().includes("opening balance")) {
      openingBalancePaise = parseAmountToPaise(cell(row, columnMap.balance));
      runningBalancePaise = openingBalancePaise;
      continue;
    }

    if (profile.isSkippableRow(row, columnMap)) continue;

    const dateRaw = cell(row, columnMap.date);
    const date = parseStatementDate(dateRaw);
    if (!date) {
      parseErrors.push({ rowIndex: r, rawRow: row, errorType: "unparseable_date", reason: `Could not parse date "${dateRaw}"` });
      continue;
    }

    const withdrawalPaise = parseAmountToPaise(cell(row, columnMap.withdrawal));
    const depositPaise = parseAmountToPaise(cell(row, columnMap.deposit));
    const balancePaise = parseAmountToPaise(cell(row, columnMap.balance));

    if (balancePaise === null) {
      parseErrors.push({ rowIndex: r, rawRow: row, errorType: "missing_balance", reason: "Row has no parseable balance value" });
      continue;
    }

    if (withdrawalPaise === null && depositPaise === null) {
      parseErrors.push({ rowIndex: r, rawRow: row, errorType: "unparseable_amount", reason: "Row has neither a withdrawal nor a deposit amount" });
      continue;
    }

    if (withdrawalPaise !== null && depositPaise !== null) {
      parseErrors.push({ rowIndex: r, rawRow: row, errorType: "unparseable_amount", reason: "Row has both a withdrawal and a deposit amount, expected exactly one" });
      continue;
    }

    const type = depositPaise !== null ? "credit" : "debit";
    const remarks = cell(row, columnMap.remarks);

    let reconciled = true;
    if (runningBalancePaise !== null) {
      const expected = type === "credit" ? runningBalancePaise + depositPaise : runningBalancePaise - withdrawalPaise;
      if (expected !== balancePaise) {
        reconciled = false;
        parseErrors.push({
          rowIndex: r,
          rawRow: row,
          errorType: "reconciliation_mismatch",
          reason: `Expected balance ${expected / 100} but statement shows ${balancePaise / 100}`,
        });
      }
    }
    runningBalancePaise = balancePaise; // always trust the statement's own column going forward

    const { category, merchantOrSource } = categorize(remarks, type, overridesMap);

    transactions.push({
      date,
      transactionId: idCell,
      withdrawalPaise,
      depositPaise,
      balancePaise,
      remarks,
      type,
      category,
      merchantOrSource,
      categoryManuallySet: false,
      reconciled,
      rawRowIndex: r,
    });
  }

  return {
    metadata,
    transactions,
    parseErrors,
    openingBalancePaise,
    closingBalancePaise: transactions.length
      ? transactions[transactions.length - 1].balancePaise
      : externalBalances
      ? externalBalances.closingBalancePaise
      : null,
    bankProfileId: profile.id,
  };
}

module.exports = { normalizeTable };