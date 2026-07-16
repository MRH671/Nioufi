// ─── Auth : /api/register, /api/login, /api/me ────────────────────────────────
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool, getUserByName, getUser, createUser } = require("./db");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function sign(user) {
  return jwt.sign({ uid: user.id, username: user.username }, JWT_SECRET, { expiresIn: "30d" });
}

/** Décode un token, renvoie { uid, username } ou null */
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

router.post("/register", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Comptes indisponibles (pas de base de données)." });
  const { username, password } = req.body || {};
  if (!username || !/^[a-zA-Z0-9_-]{3,20}$/.test(username))
    return res.status(400).json({ error: "Pseudo : 3-20 caractères (lettres, chiffres, _ -)." });
  if (!password || password.length < 6)
    return res.status(400).json({ error: "Mot de passe : 6 caractères minimum." });

  if (await getUserByName(username))
    return res.status(409).json({ error: "Ce pseudo est déjà pris." });

  const hash = await bcrypt.hash(password, 10);
  const user = await createUser(username, hash);
  res.json({ token: sign(user), username: user.username, balance: user.balance });
});

router.post("/login", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Comptes indisponibles (pas de base de données)." });
  const { username, password } = req.body || {};
  const user = await getUserByName(username || "");
  if (!user || !(await bcrypt.compare(password || "", user.password_hash)))
    return res.status(401).json({ error: "Pseudo ou mot de passe incorrect." });
  res.json({ token: sign(user), username: user.username, balance: user.balance });
});

router.get("/me", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Token invalide." });
  const user = await getUser(payload.uid);
  if (!user) return res.status(404).json({ error: "Compte introuvable." });
  res.json({ username: user.username, balance: user.balance });
});

module.exports = { router, verifyToken };
