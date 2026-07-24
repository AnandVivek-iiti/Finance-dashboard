const { pool } = require("../db/pool");
const { buildTransactionFilter } = require("../utils/sqlFilters");

const SELECT_FIELDS = `
  id AS "_id",
  user_id AS "userId",
  statement_id AS "statementId",
  date,
  transaction_id AS "transactionId",
  withdrawal_paise AS "withdrawalPaise",
  deposit_paise AS "depositPaise",
  balance_paise AS "balancePaise",
  remarks,
  type,
  category,
  merchant_or_source AS "merchantOrSource",
  category_manually_set AS "categoryManuallySet",
  reconciled,
  raw_row_index AS "rawRowIndex",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;
const SORT_COLUMNS = {
  date: "date",
  amount: "GREATEST(COALESCE(withdrawal_paise,0), COALESCE(deposit_paise,0))",
  category: "category",
  merchantOrSource: "merchant_or_source",
  balancePaise: "balance_paise",
  createdAt: "created_at",
};

const INSERT_COLUMNS = [
  "user_id",
  "statement_id",
  "date",
  "transaction_id",
  "withdrawal_paise",
  "deposit_paise",
  "balance_paise",
  "remarks",
  "type",
  "category",
  "merchant_or_source",
  "category_manually_set",
  "reconciled",
  "raw_row_index",
];

const INSERT_BATCH_SIZE = 500;

async function findFiltered(query, userId) {
  const { where, params } = buildTransactionFilter(query, userId);
  const { rows } = await pool.query(`SELECT ${SELECT_FIELDS} FROM transactions WHERE ${where}`, params);
  return rows;
}

async function findFilteredPaginated(query, userId, { page, limit, sortField, sortDir }) {
  const { where, params } = buildTransactionFilter(query, userId);
  const sortCol = SORT_COLUMNS[sortField] || "date";
  const dir = sortDir === "asc" ? "ASC" : "DESC";
  const offset = (page - 1) * limit;

  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;

  const [dataResult, countResult] = await Promise.all([
    pool.query(
      `SELECT ${SELECT_FIELDS} FROM transactions WHERE ${where}
       ORDER BY ${sortCol} ${dir}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, limit, offset]
    ),
    pool.query(`SELECT COUNT(*)::int AS count FROM transactions WHERE ${where}`, params),
  ]);

  return { transactions: dataResult.rows, total: countResult.rows[0].count };
}

async function distinctCategories(query, userId) {
  const { where, params } = buildTransactionFilter(query, userId);
  const { rows } = await pool.query(
    `SELECT DISTINCT category FROM transactions WHERE ${where} ORDER BY category ASC`,
    params
  );
  return rows.map((r) => r.category);
}

async function findByIdForUser(id, userId) {
  const { rows } = await pool.query(`SELECT ${SELECT_FIELDS} FROM transactions WHERE id = $1 AND user_id = $2`, [
    id,
    userId,
  ]);
  return rows[0] || null;
}

async function updateCategory(id, userId, { category, merchantOrSource }) {
  const { rows } = await pool.query(
    `UPDATE transactions
     SET category = $3,
         merchant_or_source = COALESCE(NULLIF($4, ''), merchant_or_source),
         category_manually_set = true,
         updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING ${SELECT_FIELDS}`,
    [id, userId, category, merchantOrSource || ""]
  );
  return rows[0] || null;
}

async function insertMany(transactions) {
  for (let start = 0; start < transactions.length; start += INSERT_BATCH_SIZE) {
    const batch = transactions.slice(start, start + INSERT_BATCH_SIZE);
    const values = [];
    const params = [];

    batch.forEach((t, i) => {
      const base = i * INSERT_COLUMNS.length;
      values.push(`(${INSERT_COLUMNS.map((_, j) => `$${base + j + 1}`).join(",")})`);
      params.push(
        t.userId,
        t.statementId,
        t.date,
        t.transactionId || "",
        t.withdrawalPaise ?? null,
        t.depositPaise ?? null,
        t.balancePaise,
        t.remarks || "",
        t.type,
        t.category || "Uncategorized",
        t.merchantOrSource || "",
        !!t.categoryManuallySet,
        t.reconciled !== false,
        t.rawRowIndex ?? null
      );
    });

    await pool.query(`INSERT INTO transactions (${INSERT_COLUMNS.join(",")}) VALUES ${values.join(",")}`, params);
  }
}

module.exports = {
  findFiltered,
  findFilteredPaginated,
  distinctCategories,
  findByIdForUser,
  updateCategory,
  insertMany,
};