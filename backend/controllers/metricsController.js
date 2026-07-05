const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const { computeMetrics } = require("../services/metricsEngine");

function buildFilter(query) {
  const filter = {};

  if (query.statementIds) {
    const ids = String(query.statementIds)
      .split(",")
      .filter(Boolean)
      .map((id) => new mongoose.Types.ObjectId(id));
    filter.statementId = { $in: ids };
  }

  if (query.startDate || query.endDate) {
    filter.date = {};
    if (query.startDate) filter.date.$gte = new Date(query.startDate);
    if (query.endDate) filter.date.$lte = new Date(query.endDate);
  }

  if (query.category) {
    filter.category = { $in: String(query.category).split(",").filter(Boolean) };
  }

  if (query.type && ["debit", "credit"].includes(query.type)) {
    filter.type = query.type;
  }

  if (query.minAmount || query.maxAmount) {
    const min = query.minAmount ? Math.round(Number(query.minAmount) * 100) : null;
    const max = query.maxAmount ? Math.round(Number(query.maxAmount) * 100) : null;
    const amountFilter = {};
    if (min !== null) amountFilter.$gte = min;
    if (max !== null) amountFilter.$lte = max;
    filter.$or = [
      { withdrawalPaise: amountFilter },
      { depositPaise: amountFilter },
    ];
  }

  return filter;
}

async function getMetrics(req, res) {
  const filter = buildFilter(req.query);
  const txns = await Transaction.find(filter).lean();
  const metrics = computeMetrics(txns);

  let perStatement = null;
  if (req.query.compare === "true" && filter.statementId && filter.statementId.$in.length > 1) {
    perStatement = [];
    for (const id of filter.statementId.$in) {
      const subTxns = txns.filter((t) => String(t.statementId) === String(id));
      perStatement.push({ statementId: id, metrics: computeMetrics(subTxns) });
    }
  }

  res.json({ metrics, perStatement });
}

module.exports = { getMetrics };
