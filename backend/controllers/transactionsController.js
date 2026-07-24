const Transaction = require("../models/Transaction");
const CategoryOverride = require("../models/CategoryOverride");
const { normalizeRemarks, extractMerchant } = require("../parsers/categorizer");

async function listTransactions(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  const sortField = req.query.sortBy || "date";
  const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";

  const { transactions, total } = await Transaction.findFilteredPaginated(req.query, req.userId, {
    page,
    limit,
    sortField,
    sortDir,
  });

  res.json({ page, limit, total, transactions });
}

async function updateCategory(req, res) {
  const { id } = req.params;
  const { category, merchantOrSource } = req.body;

  if (!category || typeof category !== "string") {
    return res.status(400).json({ error: "category is required" });
  }

  const txn = await Transaction.updateCategory(id, req.userId, { category, merchantOrSource });
  if (!txn) return res.status(404).json({ error: "Transaction not found" });

  const normalized = normalizeRemarks(txn.remarks);
  await CategoryOverride.upsert({
    userId: req.userId,
    normalizedRemarks: normalized,
    category,
    merchantOrSource: merchantOrSource || extractMerchant(txn.remarks),
    exampleRemarks: txn.remarks,
  });

  res.json({ transaction: txn });
}

async function listDistinctCategories(req, res) {
  const categories = await Transaction.distinctCategories(req.query, req.userId);
  res.json({ categories });
}

module.exports = { listTransactions, updateCategory, listDistinctCategories };