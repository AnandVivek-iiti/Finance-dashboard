const Statement = require("../models/Statement");
const Transaction = require("../models/Transaction");
const ParseError = require("../models/ParseError");

async function listStatements(req, res) {
  const statements = await Statement.find({}).sort({ uploadedAt: -1 }).lean();
  res.json({ statements });
}

async function getStatement(req, res) {
  const statement = await Statement.findById(req.params.id).lean();
  if (!statement) return res.status(404).json({ error: "Statement not found" });
  res.json({ statement });
}

async function getParseErrors(req, res) {
  const errors = await ParseError.find({ statementId: req.params.id }).sort({ rowIndex: 1 }).lean();
  res.json({ parseErrors: errors });
}

async function deleteStatement(req, res) {
  const { id } = req.params;
  const statement = await Statement.findById(id);
  if (!statement) return res.status(404).json({ error: "Statement not found" });

  await Transaction.deleteMany({ statementId: id });
  await ParseError.deleteMany({ statementId: id });
  await statement.deleteOne();

  res.json({ deleted: true, statementId: id });
}

module.exports = { listStatements, getStatement, getParseErrors, deleteStatement };
