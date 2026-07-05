const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const CategoryOverride = require("../models/CategoryOverride");
const { normalizeRemarks, extractMerchant } = require("../parsers/categorizer");

function buildFilter(query) {
  const filter = {};
  if (query.statementIds) {
    const ids = String(query.statementIds).split(",").filter(Boolean).map((id) => new mongoose.Types.ObjectId(id));
    filter.statementId = { $in: ids };
  }
  if (query.category) filter.category = { $in: String(query.category).split(",").filter(Boolean) };
  if (query.type && ["debit", "credit"].includes(query.type)) filter.type = query.type;
  if (query.startDate || query.endDate) {
    filter.date = {};
    if (query.startDate) filter.date.$gte = new Date(query.startDate);
    if (query.endDate) filter.date.$lte = new Date(query.endDate);
  }
  if (query.search) {
    filter.remarks = { $regex: String(query.search), $options: "i" };
  }
  return filter;
}

async function listTransactions(req, res) {
  const filter = buildFilter(req.query);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  const sortField = req.query.sortBy || "date";
  const sortDir = req.query.sortDir === "asc" ? 1 : -1;

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(filter),
  ]);

  res.json({ page, limit, total, transactions });
}

async function updateCategory(req, res) {
  const { id } = req.params;
  const { category, merchantOrSource } = req.body;

  if (!category || typeof category !== "string") {
    return res.status(400).json({ error: "category is required" });
  }

  const txn = await Transaction.findById(id);
  if (!txn) return res.status(404).json({ error: "Transaction not found" });

  txn.category = category;
  if (merchantOrSource) txn.merchantOrSource = merchantOrSource;
  txn.categoryManuallySet = true;
  await txn.save();

  const normalized = normalizeRemarks(txn.remarks);
  await CategoryOverride.findOneAndUpdate(
    { normalizedRemarks: normalized },
    {
      normalizedRemarks: normalized,
      category,
      merchantOrSource: merchantOrSource || extractMerchant(txn.remarks),
      exampleRemarks: txn.remarks,
    },
    { upsert: true, new: true }
  );

  res.json({ transaction: txn });
}

async function listDistinctCategories(req, res) {
  const filter = buildFilter(req.query);
  const categories = await Transaction.distinct("category", filter);
  res.json({ categories: categories.sort() });
}

module.exports = { listTransactions, updateCategory, listDistinctCategories };
