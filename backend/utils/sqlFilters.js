// Builds a parameterized SQL WHERE clause + params array from the same
// req.query shape the old Mongoose buildFilter() functions consumed.
// Every value is bound as a placeholder - nothing here is ever
// string-interpolated from user input.
function buildTransactionFilter(query, userId) {
  const clauses = ["user_id = $1"];
  const params = [userId];

  function addParam(value) {
    params.push(value);
    return `$${params.length}`;
  }

  if (query.statementIds) {
    const ids = String(query.statementIds)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length) {
      const placeholders = ids.map((id) => addParam(id));
      clauses.push(`statement_id IN (${placeholders.join(",")})`);
    }
  }

  if (query.startDate) clauses.push(`date >= ${addParam(new Date(query.startDate))}`);
  if (query.endDate) clauses.push(`date <= ${addParam(new Date(query.endDate))}`);

  if (query.category) {
    const cats = String(query.category)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (cats.length) {
      const placeholders = cats.map((c) => addParam(c));
      clauses.push(`category IN (${placeholders.join(",")})`);
    }
  }

  if (query.type === "debit" || query.type === "credit") {
    clauses.push(`type = ${addParam(query.type)}`);
  }

  if (query.minAmount || query.maxAmount) {
    const min = query.minAmount ? Math.round(Number(query.minAmount) * 100) : null;
    const max = query.maxAmount ? Math.round(Number(query.maxAmount) * 100) : null;

    // Matches the original Mongo $or: (withdrawalPaise in range) OR (depositPaise in range)
    const amountClauses = [];
    for (const col of ["withdrawal_paise", "deposit_paise"]) {
      const rangeParts = [];
      if (min !== null) rangeParts.push(`${col} >= ${addParam(min)}`);
      if (max !== null) rangeParts.push(`${col} <= ${addParam(max)}`);
      if (rangeParts.length) amountClauses.push(`(${rangeParts.join(" AND ")})`);
    }
    if (amountClauses.length) clauses.push(`(${amountClauses.join(" OR ")})`);
  }

  if (query.search) {
    clauses.push(`remarks ILIKE ${addParam("%" + String(query.search) + "%")}`);
  }

  return { where: clauses.join(" AND "), params };
}

module.exports = { buildTransactionFilter };
