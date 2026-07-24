const SYNONYMS = {
  date: ["date", "txn date", "transaction date", "value date", "posting date", "effective date"],
  transactionId: [
    "transaction id", "txn id", "txnid", "transactionid", "reference", "reference no",
    "reference number", "ref no", "utr", "instrument id", "cheque no", "chq no", "cheque number",
  ],
  withdrawal: ["withdrawal", "withdrawals", "withdraw", "debit", "dr", "dr amount", "debit amount"],
  deposit: ["deposit", "deposits", "credit", "cr", "cr amount", "credit amount"],
  amount: ["amount", "transaction amount", "txn amount"],
  drCrIndicator: ["dr cr", "cr dr", "dr cr indicator", "type", "transaction type", "indicator"],
  balance: ["balance", "closing balance", "running balance", "available balance", "ledger balance"],
  remarks: ["remarks", "narration", "particulars", "description", "transaction details"],
};

module.exports = { SYNONYMS };
