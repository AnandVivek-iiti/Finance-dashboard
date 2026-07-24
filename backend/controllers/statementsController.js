const Statement = require("../models/Statement");
const ParseError = require("../models/ParseError");

async function listStatements(req, res) {
  const statements = await Statement.listForUser(req.userId);
  res.json({ statements });
}

async function getStatement(req, res) {
  const statement = await Statement.findByIdForUser(req.params.id, req.userId);
  if (!statement) return res.status(404).json({ error: "Statement not found" });
  res.json({ statement });
}

async function getParseErrors(req, res) {
  const errors = await ParseError.listForStatement(req.params.id, req.userId);
  res.json({ parseErrors: errors });
}

async function deleteStatement(req, res) {
  const { id } = req.params;
  const deleted = await Statement.deleteForUser(id, req.userId);
  if (!deleted) return res.status(404).json({ error: "Statement not found" });

  res.json({ deleted: true, statementId: id });
}

module.exports = { listStatements, getStatement, getParseErrors, deleteStatement };