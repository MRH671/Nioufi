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
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_rescue_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_table TEXT NOT NULL DEFAULT 'classic'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_cards TEXT NOT NULL DEFAULT 'classic'`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_skins (
      user_id INTEGER NOT NULL REFERENCES users(id),
      skin_code TEXT NOT NULL,
      purchased_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, skin_code)
    )
  `);
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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      author TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("🗄️  PostgreSQL prêt (tables users, history, friendships, suggestions).");
}

// ─── Suggestions (période de test) ───────────────────────────────────────────
async function addSuggestion(userId, author, content) {
  if (!pool) return { error: "Indisponible." };
  await pool.query(
    "INSERT INTO suggestions (user_id, author, content) VALUES ($1, $2, $3)",
    [userId, (author || "anonyme").slice(0, 30), content.slice(0, 1000)]
  );
  return { ok: true };
}

// ─── Boutique de skins ────────────────────────────────────────────────────────
// Catalogue côté serveur = source de vérité des prix.
const SKINS = [
  // Thèmes de table
  { code: "classic",    type: "table", name: "Tapis classique",     price: 0 },
  { code: "camping",    type: "table", name: "Table de camping",    price: 500 },
  { code: "clandestin", type: "table", name: "Tripot clandestin",   price: 800 },
  { code: "boitier",    type: "table", name: "Boîtier électrique",  price: 1200 },
  { code: "casino",     type: "table", name: "Casino privé",        price: 2000 },
  // Dos de cartes
  { code: "cards-classic", type: "cards", name: "Rouge classique", price: 0 },
  { code: "cards-azur",    type: "cards", name: "Azur",            price: 300 },
  { code: "cards-emeraude",type: "cards", name: "Émeraude",        price: 800 },
  { code: "cards-or",      type: "cards", name: "Or",              price: 800 },
  { code: "cards-onyx",    type: "cards", name: "Onyx",            price: 1500 },
  // Collection drapeaux
  { code: "cards-fr",    type: "cards", name: "France",    price: 500 },
  { code: "cards-es",    type: "cards", name: "Espagne",   price: 500 },
  { code: "cards-dz",    type: "cards", name: "Algérie",   price: 500 },
  { code: "cards-ma",    type: "cards", name: "Maroc",     price: 500 },
  { code: "cards-tn",    type: "cards", name: "Tunisie",   price: 500 },
  { code: "cards-al",    type: "cards", name: "Albanie",   price: 500 },
  { code: "cards-rs",    type: "cards", name: "Serbie",    price: 500 },
  { code: "cards-ru",    type: "cards", name: "Russie",    price: 500 },
  { code: "cards-it",    type: "cards", name: "Italie",    price: 500 },
  { code: "cards-sn",    type: "cards", name: "Sénégal",   price: 500 },
  { code: "cards-cd",    type: "cards", name: "Congo",     price: 500 },
  { code: "cards-gitan", type: "cards", name: "Gitan",     price: 500 },
];
const skinByCode = (code) => SKINS.find((s) => s.code === code);

/** Boutique : catalogue + possessions + équipés + solde */
async function shopState(uid) {
  if (!pool) return { skins: SKINS, owned: [], equipped: {}, balance: 0 };
  const u = await pool.query("SELECT balance, equipped_table, equipped_cards FROM users WHERE id = $1", [uid]);
  const owned = await pool.query("SELECT skin_code FROM user_skins WHERE user_id = $1", [uid]);
  return {
    skins: SKINS,
    owned: owned.rows.map((r) => r.skin_code),
    equipped: { table: u.rows[0]?.equipped_table || "classic", cards: u.rows[0]?.equipped_cards || "cards-classic" },
    balance: u.rows[0]?.balance ?? 0,
  };
}

/** Achat atomique : débit + possession dans une transaction */
async function buySkin(uid, code) {
  const skin = skinByCode(code);
  if (!skin) return { error: "Skin inconnu." };
  if (skin.price === 0) return { error: "Ce skin est gratuit, équipe-le directement." };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query("SELECT 1 FROM user_skins WHERE user_id = $1 AND skin_code = $2", [uid, code]);
    if (owned.rows.length > 0) { await client.query("ROLLBACK"); return { error: "Tu possèdes déjà ce skin." }; }
    const upd = await client.query(
      "UPDATE users SET balance = balance - $2 WHERE id = $1 AND balance >= $2 RETURNING balance",
      [uid, skin.price]
    );
    if (upd.rows.length === 0) { await client.query("ROLLBACK"); return { error: "Pas assez de jetons !" }; }
    await client.query("INSERT INTO user_skins (user_id, skin_code) VALUES ($1, $2)", [uid, code]);
    await client.query("COMMIT");
    return { ok: true, balance: upd.rows[0].balance };
  } catch (e) {
    await client.query("ROLLBACK");
    return { error: "Achat impossible, réessaie." };
  } finally {
    client.release();
  }
}

/** Équiper un skin possédé (ou gratuit) */
async function equipSkin(uid, code) {
  const skin = skinByCode(code);
  if (!skin) return { error: "Skin inconnu." };
  if (skin.price > 0) {
    const owned = await pool.query("SELECT 1 FROM user_skins WHERE user_id = $1 AND skin_code = $2", [uid, code]);
    if (owned.rows.length === 0) return { error: "Tu ne possèdes pas ce skin." };
  }
  const col = skin.type === "table" ? "equipped_table" : "equipped_cards";
  await pool.query(`UPDATE users SET ${col} = $2 WHERE id = $1`, [uid, code]);
  return { ok: true };
}

// ─── Recharge de secours (solde à 0) ─────────────────────────────────────────
const RESCUE_AMOUNT = 100;
const RESCUE_COOLDOWN_H = 4;

/** État de la recharge : dispo ? sinon dans combien de temps ? */
async function rescueStatus(id) {
  if (!pool) return { available: false };
  const r = await pool.query("SELECT balance, last_rescue_at FROM users WHERE id = $1", [id]);
  if (!r.rows[0]) return { available: false };
  const { balance, last_rescue_at } = r.rows[0];
  if (balance > 0) return { available: false, reason: "not_broke" };
  const last = last_rescue_at ? new Date(last_rescue_at).getTime() : null;
  const readyAt = last ? last + RESCUE_COOLDOWN_H * 3600 * 1000 : 0;
  if (readyAt > Date.now()) return { available: false, reason: "cooldown", readyAt, amount: RESCUE_AMOUNT };
  return { available: true, amount: RESCUE_AMOUNT };
}

/** Réclame la recharge (atomique : uniquement si solde = 0 et cooldown passé) */
async function claimRescue(id) {
  if (!pool) return { granted: false };
  const r = await pool.query(
    `UPDATE users SET balance = balance + $2, last_rescue_at = NOW()
     WHERE id = $1 AND balance <= 0
       AND (last_rescue_at IS NULL OR last_rescue_at < NOW() - INTERVAL '${RESCUE_COOLDOWN_H} hours')
     RETURNING balance`,
    [id, RESCUE_AMOUNT]
  );
  if (r.rows.length === 0) return { granted: false };
  return { granted: true, amount: RESCUE_AMOUNT, balance: r.rows[0].balance };
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

/** Classement : moi + mes amis, triés par solde décroissant */
async function friendLeaderboard(uid) {
  if (!pool) return [];
  const r = await pool.query(
    `SELECT u.id, u.username, u.balance FROM users u
     WHERE u.id = $1
        OR u.id IN (
          SELECT CASE WHEN f.requester = $1 THEN f.addressee ELSE f.requester END
          FROM friendships f
          WHERE (f.requester = $1 OR f.addressee = $1) AND f.status = 'accepted'
        )
     ORDER BY u.balance DESC, u.username ASC`,
    [uid]
  );
  return r.rows;
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
  const r = await pool.query("SELECT id, username, balance, equipped_table, equipped_cards FROM users WHERE id = $1", [id]);
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

module.exports = { pool, initDb, getUser, getUserByName, createUser, setBalance, bonusStatus, claimBonus, addHistory, getHistory, friendRequest, friendRespond, friendRemove, friendList, areFriends, friendLeaderboard, rescueStatus, claimRescue, shopState, buySkin, equipSkin, addSuggestion };
