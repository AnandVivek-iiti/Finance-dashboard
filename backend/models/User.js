const { pool } = require("../db/pool");

const SELECT_FIELDS = `
  id AS "_id",
  google_id AS "googleId",
  email,
  name,
  picture,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function findByGoogleId(googleId) {
  const { rows } = await pool.query(`SELECT ${SELECT_FIELDS} FROM users WHERE google_id = $1`, [googleId]);
  return rows[0] || null;
}

async function findByEmail(email) {
  const { rows } = await pool.query(`SELECT ${SELECT_FIELDS} FROM users WHERE email = $1`, [email]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await pool.query(`SELECT ${SELECT_FIELDS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function create({ googleId, email, name, picture }) {
  const { rows } = await pool.query(
    `INSERT INTO users (google_id, email, name, picture)
     VALUES ($1, $2, $3, $4)
     RETURNING ${SELECT_FIELDS}`,
    [googleId, email, name || "", picture || ""]
  );
  return rows[0];
}

async function updateGoogleProfile(id, { googleId, name, picture }) {
  const { rows } = await pool.query(
    `UPDATE users
     SET google_id = $2, name = $3, picture = $4, updated_at = now()
     WHERE id = $1
     RETURNING ${SELECT_FIELDS}`,
    [id, googleId, name || "", picture || ""]
  );
  return rows[0];
}

module.exports = { findByGoogleId, findByEmail, findById, create, updateGoogleProfile };