const Transaction = require("../models/Transaction");
const { computeMetrics } = require("../services/metricsEngine");

async function getMetrics(req, res) {
  const txns = await Transaction.findFiltered(req.query, req.userId);
  const metrics = computeMetrics(txns);

  let perStatement = null;
  if (req.query.compare === "true" && req.query.statementIds) {
    const ids = String(req.query.statementIds)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length > 1) {
      perStatement = ids.map((id) => ({
        statementId: id,
        metrics: computeMetrics(txns.filter((t) => String(t.statementId) === String(id))),
      }));
    }
  }

  res.json({ metrics, perStatement });
}

module.exports = { getMetrics };