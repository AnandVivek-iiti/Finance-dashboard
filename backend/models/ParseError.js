const { pool } = require("../db/pool");

const SELECT_FIELDS = `
  id AS "_id",
  user_id AS "userId",
  statement_id AS "statementId",
  row_index AS "rowIndex",
  raw_row AS "rawRow",
  reason,
  error_type AS "errorType",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

const INSERT_BATCH_SIZE = 500;

async function listForStatement(statementId, userId) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM parse_errors
     WHERE statement_id = $1 AND user_id = $2
     ORDER BY row_index ASC NULLS LAST`,
    [statementId, userId]
  );
  return rows;
}

async function insertMany(errors) {
  for (let start = 0; start < errors.length; start += INSERT_BATCH_SIZE) {
    const batch = errors.slice(start, start + INSERT_BATCH_SIZE);
    const values = [];
    const params = [];

    batch.forEach((e, i) => {
      const base = i * 6;
      values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6})`);
      params.push(
        e.userId,
        e.statementId,
        e.rowIndex ?? null,
        e.rawRow !== undefined && e.rawRow !== null ? JSON.stringify(e.rawRow) : null,
        e.reason,
        e.errorType
      );
    });

    await pool.query(
      `INSERT INTO parse_errors (user_id, statement_id, row_index, raw_row, reason, error_type) VALUES ${values.join(",")}`,
      params
    );
  }
}

module.exports = { listForStatement, insertMany };