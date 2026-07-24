const { pool } = require("../db/pool");

const SELECT_FIELDS = `
  id AS "_id",
  user_id AS "userId",
  normalized_remarks AS "normalizedRemarks",
  category,
  merchant_or_source AS "merchantOrSource",
  example_remarks AS "exampleRemarks",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function listForUser(userId) {
  const { rows } = await pool.query(`SELECT ${SELECT_FIELDS} FROM category_overrides WHERE user_id = $1`, [userId]);
  return rows;
}

async function upsert({ userId, normalizedRemarks, category, merchantOrSource, exampleRemarks }) {
  const { rows } = await pool.query(
    `INSERT INTO category_overrides (user_id, normalized_remarks, category, merchant_or_source, example_remarks)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, normalized_remarks)
     DO UPDATE SET
       category = EXCLUDED.category,
       merchant_or_source = EXCLUDED.merchant_or_source,
       example_remarks = EXCLUDED.example_remarks,
       updated_at = now()
     RETURNING ${SELECT_FIELDS}`,
    [userId, normalizedRemarks, category, merchantOrSource || "", exampleRemarks || ""]
  );
  return rows[0];
}

module.exports = { listForUser, upsert };