const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

// Neon (and most hosted Postgres) require SSL. Set PGSSL=disable for a local
// Postgres instance that doesn't have SSL configured.
const useSSL = process.env.PGSSL !== "disable";

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  // A client sitting idle in the pool errored out (e.g. connection dropped
  // by the provider) - log it, don't crash the process, pg handles removal.
  console.error("[db] unexpected pool error:", err.message);
});

async function connectDB() {
  if (!connectionString) {
    console.error("[db] DATABASE_URL is not set.");
    process.exit(1);
  }

  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("[db] connected to Postgres");
  } catch (err) {
    console.error("[db] connection failed:", err.message);
    process.exit(1);
  }
}

module.exports = { pool, connectDB };
