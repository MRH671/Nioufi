// ─── Auth : /api/register, /api/login, /api/me ────────────────────────────────
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool, getUserByName, getUser, createUser, bonusStatus, claimBonus, getHistory, friendRequest, friendRespond, friendRemove, friendList, friendLeaderboard, rescueStatus, claimRescue, shopState, buySkin, equipSkin } = require("./db");
const presence = require("./presence");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// ── Anti-abus : max 3 inscriptions par IP par 24h (en mémoire) ──
const REGISTER_LIMIT = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000;
/** @type {Map<string, number[]>} ip → timestamps des inscriptions */
const registrations = new Map();

// Purge périodique des vieilles entrées
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [ip, times] of registrations) {
    const recent = times.filter((t) => t > cutoff);
    if (recent.length === 0) registrations.delete(ip);
    else registrations.set(ip, recent);
  }
}, 60 * 60 * 1000);

function clientIp(req) {
  // Derrière Railway/Vercel, la vraie IP est dans x-forwarded-for
  const xff = req.headers["x-forwarded-for"];
  return (typeof xff === "string" ? xff.split(",")[0].trim() : req.ip) || "unknown";
}

function registerAllowed(ip) {
  const cutoff = Date.now() - WINDOW_MS;
  const recent = (registrations.get(ip) || []).filter((t) => t > cutoff);
  return recent.length < REGISTER_LIMIT;
}

function recordRegistration(ip) {
  const list = registrations.get(ip) || [];
  list.push(Date.now());
  registrations.set(ip, list);
}

function sign(user) {
  return jwt.sign({ uid: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
}

/** Décode un token, renvoie { uid, username } ou null */
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

router.post("/register", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Comptes indisponibles (pas de base de données)." });

  const ip = clientIp(req);
  if (!registerAllowed(ip))
    return res.status(429).json({ error: "Trop de comptes créés récemment. Réessaie demain." });

  const { username, password } = req.body || {};
  if (!username || !/^[a-zA-Z0-9_-]{3,20}$/.test(username))
    return res.status(400).json({ error: "Pseudo : 3-20 caractères (lettres, chiffres, _ -)." });
  if (!password || password.length < 6)
    return res.status(400).json({ error: "Mot de passe : 6 caractères minimum." });

  if (await getUserByName(username))
    return res.status(409).json({ error: "Ce pseudo est déjà pris." });

  const hash = await bcrypt.hash(password, 10);
  const user = await createUser(username, hash);
  recordRegistration(ip);
  res.json({ token: sign(user), username: user.username, balance: user.balance });
});

router.post("/login", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Comptes indisponibles (pas de base de données)." });
  const { username, password } = req.body || {};
  const user = await getUserByName(username || "");
  if (!user || !(await bcrypt.compare(password || "", user.password_hash)))
    return res.status(401).json({ error: "Pseudo ou mot de passe incorrect." });

  const bonus = await bonusStatus(user.id);
  res.json({ token: sign(user), username: user.username, balance: user.balance, bonus });
});

router.get("/me", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Token invalide." });
  const user = await getUser(payload.uid);
  if (!user) return res.status(404).json({ error: "Compte introuvable." });

  const bonus = await bonusStatus(user.id);
  const rescue = await rescueStatus(user.id);
  res.json({
    username: user.username, balance: user.balance, bonus, rescue,
    skins: { table: user.equipped_table || "classic", cards: user.equipped_cards || "cards-classic" },
  });
});

// ── Boutique ──
router.get("/shop", async (req, res) => {
  const p = requireAuth(req, res);
  if (!p) return;
  res.json(await shopState(p.uid));
});

router.post("/shop/buy", async (req, res) => {
  const p = requireAuth(req, res);
  if (!p) return;
  const r = await buySkin(p.uid, req.body?.code);
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

router.post("/shop/equip", async (req, res) => {
  const p = requireAuth(req, res);
  if (!p) return;
  const r = await equipSkin(p.uid, req.body?.code);
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

// ── Recharge de secours ──
router.post("/rescue/claim", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Token invalide." });
  const r = await claimRescue(payload.uid);
  if (!r.granted) return res.status(409).json({ error: "Recharge indisponible (solde non nul ou cooldown en cours)." });
  res.json(r);
});

// ── Réclamer le bonus quotidien ──
router.post("/bonus/claim", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Token invalide." });
  const r = await claimBonus(payload.uid);
  if (!r.granted) return res.status(409).json({ error: "Bonus déjà réclamé, reviens plus tard !" });
  res.json(r);
});

// ── Historique des gains/pertes ──
router.get("/history", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Token invalide." });
  res.json(await getHistory(payload.uid));
});

// ── Amis ──
function requireAuth(req, res) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Token invalide." }); return null; }
  return payload;
}

router.get("/friends", async (req, res) => {
  const p = requireAuth(req, res);
  if (!p) return;
  const list = await friendList(p.uid);
  res.json({
    friends: list.friends.map((f) => ({ ...f, online: presence.isOnline(f.id) })),
    incoming: list.incoming,
    sent: list.sent,
  });
});

router.post("/friends/request", async (req, res) => {
  const p = requireAuth(req, res);
  if (!p) return;
  const r = await friendRequest(p.uid, (req.body?.username || "").trim());
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

router.post("/friends/respond", async (req, res) => {
  const p = requireAuth(req, res);
  if (!p) return;
  const r = await friendRespond(p.uid, req.body?.requestId, !!req.body?.accept);
  if (r.error) return res.status(400).json(r);
  res.json(r);
});

router.post("/friends/remove", async (req, res) => {
  const p = requireAuth(req, res);
  if (!p) return;
  res.json(await friendRemove(p.uid, req.body?.userId));
});

// ── Classement entre amis ──
router.get("/leaderboard", async (req, res) => {
  const p = requireAuth(req, res);
  if (!p) return;
  const rows = await friendLeaderboard(p.uid);
  res.json({
    entries: rows.map((r) => ({
      username: r.username,
      balance: r.balance,
      me: r.id === p.uid,
      online: presence.isOnline(r.id),
    })),
  });
});

module.exports = { router, verifyToken };
