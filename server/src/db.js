// ─── PostgreSQL ───────────────────────────────────────────────────────────────
const { Pool } = require("pg");

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

async function initDb() {
  if (!pool) {
    console.log("⚠️  Pas de DATABASE_URL — mode invité uniquement (soldes non persistants).");
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(20) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 500,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_bonus_at TIMESTAMPTZ`);
  console.log("🗄️  PostgreSQL prêt (table users).");
}

const DAILY_BONUS = 50;

/** Tente de créditer le bonus quotidien (dispo toutes les 20h).
 *  Renvoie { granted, amount, balance } */
async function claimDailyBonus(id) {
  if (!pool) return { granted: false };
  const r = await pool.query(
    `UPDATE users SET balance = balance + $2, last_bonus_at = NOW()
     WHERE id = $1 AND (last_bonus_at IS NULL OR last_bonus_at < NOW() - INTERVAL '20 hours')
     RETURNING balance`,
    [id, DAILY_BONUS]
  );
  if (r.rows.length === 0) return { granted: false };
  return { granted: true, amount: DAILY_BONUS, balance: r.rows[0].balance };
}

async function getUser(id) {
  if (!pool) return null;
  const r = await pool.query("SELECT id, username, balance FROM users WHERE id = $1", [id]);
  return r.rows[0] || null;
}

async function getUserByName(username) {
  if (!pool) return null;
  const r = await pool.query("SELECT * FROM users WHERE LOWER(username) = LOWER($1)", [username]);
  return r.rows[0] || null;
}

async function createUser(username, passwordHash) {
  const r = await pool.query(
    "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, balance",
    [username, passwordHash]
  );
  return r.rows[0];
}

async function setBalance(id, balance) {
  if (!pool) return;
  await pool.query("UPDATE users SET balance = $1 WHERE id = $2", [Math.max(0, balance), id]);
}

module.exports = { pool, initDb, getUser, getUserByName, createUser, setBalance, claimDailyBonus };
