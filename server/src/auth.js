// ─── Auth : /api/register, /api/login, /api/me ────────────────────────────────
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool, getUserByName, getUser, createUser, claimDailyBonus } = require("./db");

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

  const bonus = await claimDailyBonus(user.id);
  res.json({
    token: sign(user),
    username: user.username,
    balance: bonus.granted ? bonus.balance : user.balance,
    bonus: bonus.granted ? bonus.amount : 0,
  });
});

router.get("/me", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Token invalide." });
  const user = await getUser(payload.uid);
  if (!user) return res.status(404).json({ error: "Compte introuvable." });

  const bonus = await claimDailyBonus(user.id);
  res.json({
    username: user.username,
    balance: bonus.granted ? bonus.balance : user.balance,
    bonus: bonus.granted ? bonus.amount : 0,
  });
});

module.exports = { router, verifyToken };
