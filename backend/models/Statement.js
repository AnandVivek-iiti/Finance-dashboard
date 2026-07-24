const { pool } = require("../db/pool");

const SELECT_FIELDS = `
  id AS "_id",
  user_id AS "userId",
  filename,
  bank_profile AS "bankProfile",
  account_number AS "accountNumber",
  account_holder_name AS "accountHolderName",
  branch_name AS "branchName",
  ifsc_code AS "ifscCode",
  period_start AS "periodStart",
  period_end AS "periodEnd",
  opening_balance_paise AS "openingBalancePaise",
  closing_balance_paise AS "closingBalancePaise",
  transaction_count AS "transactionCount",
  parse_error_count AS "parseErrorCount",
  status,
  failure_reason AS "failureReason",
  continuity_warning AS "continuityWarning",
  uploaded_at AS "uploadedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function listForUser(userId) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM statements WHERE user_id = $1 ORDER BY uploaded_at DESC`,
    [userId]
  );
  return rows;
}

async function findByIdForUser(id, userId) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM statements WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] || null;
}
async function findLatestBefore(userId, accountNumber, periodStart) {
  const cutoff = periodStart || new Date(8640000000000000);
  const { rows } = await pool.query(
    `SELECT ${SELECT_FIELDS} FROM statements
     WHERE user_id = $1 AND account_number = $2 AND status = 'ready'
       AND period_end IS NOT NULL AND period_end < $3
     ORDER BY period_end DESC
     LIMIT 1`,
    [userId, accountNumber, cutoff]
  );
  return rows[0] || null;
}

async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO statements (
       user_id, filename, status, bank_profile, account_number, account_holder_name,
       branch_name, ifsc_code, period_start, period_end, opening_balance_paise,
       closing_balance_paise, transaction_count, parse_error_count, continuity_warning
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING ${SELECT_FIELDS}`,
    [
      data.userId,
      data.filename,
      data.status || "ready",
      data.bankProfile || "unknown",
      data.accountNumber || "",
      data.accountHolderName || "",
      data.branchName || "",
      data.ifscCode || "",
      data.periodStart || null,
      data.periodEnd || null,
      data.openingBalancePaise,
      data.closingBalancePaise,
      data.transactionCount || 0,
      data.parseErrorCount || 0,
      data.continuityWarning ? JSON.stringify(data.continuityWarning) : null,
    ]
  );
  return rows[0];
}

async function deleteForUser(id, userId) {
  const { rows } = await pool.query(`DELETE FROM statements WHERE id = $1 AND user_id = $2 RETURNING id`, [
    id,
    userId,
  ]);
  return rows.length > 0;
}

module.exports = { listForUser, findByIdForUser, findLatestBefore, create, deleteForUser };