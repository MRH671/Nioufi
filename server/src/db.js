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
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_day INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      delta INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS friendships (
      id SERIAL PRIMARY KEY,
      requester INTEGER NOT NULL REFERENCES users(id),
      addressee INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(requester, addressee)
    )
  `);
  console.log("🗄️  PostgreSQL prêt (tables users, history, friendships).");
}

// ─── Amis ─────────────────────────────────────────────────────────────────────

/** Envoie une demande d'ami. Si l'autre nous avait déjà demandé → accepte direct. */
async function friendRequest(fromUid, toUsername) {
  const target = await getUserByName(toUsername);
  if (!target) return { error: "Aucun joueur avec ce pseudo." };
  if (target.id === fromUid) return { error: "Tu ne peux pas t'ajouter toi-même 😄" };

  const existing = await pool.query(
    `SELECT * FROM friendships WHERE (requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1)`,
    [fromUid, target.id]
  );
  if (existing.rows.length > 0) {
    const f = existing.rows[0];
    if (f.status === "accepted") return { error: "Vous êtes déjà amis." };
    if (f.requester === fromUid) return { error: "Demande déjà envoyée." };
    // L'autre nous avait demandé → on accepte
    await pool.query("UPDATE friendships SET status = 'accepted' WHERE id = $1", [f.id]);
    return { accepted: true, username: target.username };
  }
  await pool.query("INSERT INTO friendships (requester, addressee) VALUES ($1, $2)", [fromUid, target.id]);
  return { sent: true, username: target.username };
}

/** Accepte ou refuse une demande reçue */
async function friendRespond(uid, requestId, accept) {
  const r = await pool.query(
    "SELECT * FROM friendships WHERE id = $1 AND addressee = $2 AND status = 'pending'",
    [requestId, uid]
  );
  if (!r.rows[0]) return { error: "Demande introuvable." };
  if (accept) await pool.query("UPDATE friendships SET status = 'accepted' WHERE id = $1", [requestId]);
  else await pool.query("DELETE FROM friendships WHERE id = $1", [requestId]);
  return { ok: true };
}

/** Supprime un ami (ou annule une demande) */
async function friendRemove(uid, otherUid) {
  await pool.query(
    `DELETE FROM friendships WHERE (requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1)`,
    [uid, otherUid]
  );
  return { ok: true };
}

/** Liste : amis acceptés, demandes reçues, demandes envoyées */
async function friendList(uid) {
  const friends = await pool.query(
    `SELECT u.id, u.username FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester = $1 THEN f.addressee ELSE f.requester END
     WHERE (f.requester = $1 OR f.addressee = $1) AND f.status = 'accepted'
     ORDER BY u.username`,
    [uid]
  );
  const incoming = await pool.query(
    `SELECT f.id AS request_id, u.id, u.username FROM friendships f
     JOIN users u ON u.id = f.requester
     WHERE f.addressee = $1 AND f.status = 'pending'`,
    [uid]
  );
  const sent = await pool.query(
    `SELECT u.id, u.username FROM friendships f
     JOIN users u ON u.id = f.addressee
     WHERE f.requester = $1 AND f.status = 'pending'`,
    [uid]
  );
  return { friends: friends.rows, incoming: incoming.rows, sent: sent.rows };
}

/** Les deux joueurs sont-ils amis ? */
async function areFriends(a, b) {
  if (!pool) return false;
  const r = await pool.query(
    `SELECT 1 FROM friendships WHERE status = 'accepted'
     AND ((requester = $1 AND addressee = $2) OR (requester = $2 AND addressee = $1))`,
    [a, b]
  );
  return r.rows.length > 0;
}

/** Enregistre un gain/perte de manche */
async function addHistory(userId, delta) {
  if (!pool || !delta) return;
  await pool.query("INSERT INTO history (user_id, delta) VALUES ($1, $2)", [userId, delta]);
}

/** Dernières manches + bilan total */
async function getHistory(userId) {
  if (!pool) return { entries: [], total: 0 };
  const entries = await pool.query(
    "SELECT delta, created_at FROM history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
    [userId]
  );
  const total = await pool.query(
    "SELECT COALESCE(SUM(delta), 0) AS total FROM history WHERE user_id = $1",
    [userId]
  );
  return {
    entries: entries.rows.map((r) => ({ delta: r.delta, at: r.created_at })),
    total: Number(total.rows[0].total),
  };
}

// Récompenses du calendrier : jour 1 → jour 7, puis retour au jour 1
const BONUS_REWARDS = [50, 75, 100, 150, 200, 300, 500];

/** État du bonus : peut-il être réclamé, et quel jour serait-ce ? */
async function bonusStatus(id) {
  if (!pool) return { available: false };
  const r = await pool.query("SELECT last_bonus_at, streak_day FROM users WHERE id = $1", [id]);
  if (!r.rows[0]) return { available: false };
  const { last_bonus_at, streak_day } = r.rows[0];
  const now = Date.now();
  const last = last_bonus_at ? new Date(last_bonus_at).getTime() : null;
  const available = !last || now - last > 20 * 3600 * 1000;
  // Série cassée si plus de 48h sans réclamer → retour au jour 1
  const day = !last || now - last > 48 * 3600 * 1000 ? 1 : (streak_day % 7) + 1;
  return { available, day, rewards: BONUS_REWARDS };
}

/** Réclame le bonus du jour (atomique — impossible de doubler) */
async function claimBonus(id) {
  if (!pool) return { granted: false };
  const r = await pool.query(
    `UPDATE users SET
       streak_day = CASE WHEN last_bonus_at IS NULL OR last_bonus_at < NOW() - INTERVAL '48 hours'
                         THEN 1 ELSE (streak_day % 7) + 1 END,
       balance = balance + (ARRAY[50,75,100,150,200,300,500])[
         CASE WHEN last_bonus_at IS NULL OR last_bonus_at < NOW() - INTERVAL '48 hours'
              THEN 1 ELSE (streak_day % 7) + 1 END],
       last_bonus_at = NOW()
     WHERE id = $1 AND (last_bonus_at IS NULL OR last_bonus_at < NOW() - INTERVAL '20 hours')
     RETURNING balance, streak_day`,
    [id]
  );
  if (r.rows.length === 0) return { granted: false };
  const { balance, streak_day } = r.rows[0];
  return { granted: true, day: streak_day, amount: BONUS_REWARDS[streak_day - 1], balance };
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

module.exports = { pool, initDb, getUser, getUserByName, createUser, setBalance, bonusStatus, claimBonus, addHistory, getHistory, friendRequest, friendRespond, friendRemove, friendList, areFriends };
