// ═══════════════════════════════════════════════════════════════════════════
//  NIOUFI — Serveur Express + Socket.io + PostgreSQL
// ═══════════════════════════════════════════════════════════════════════════

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { Room } = require("./game");
const { initDb, getUser, setBalance, addHistory } = require("./db");
const { router: authRouter, verifyToken } = require("./auth");

const PORT = process.env.PORT || 5001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const ORIGINS = [CLIENT_URL, "http://localhost:3000", "http://localhost:3001"];

const app = express();
app.use(cors({ origin: ORIGINS }));
app.use(express.json());
app.use("/api", authRouter);
app.get("/", (_req, res) => res.json({ ok: true, service: "nioufi-server" }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ORIGINS, methods: ["GET", "POST"] } });

/** @type {Map<string, Room>} code → Room */
const rooms = new Map();

// Nettoyage des tables mortes (2h sans activité)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const lastActivity = room.feed[0]?.t || room.createdAt;
    if (now - lastActivity > 2 * 60 * 60 * 1000) rooms.delete(code);
  }
}, 10 * 60 * 1000);

function broadcast(room) {
  for (const [, socket] of io.of("/").sockets) {
    if (socket.data.code === room.code && socket.data.key) {
      socket.emit("state", room.serializeFor(socket.data.key));
    }
  }
}

/** Résout l'identité : compte connecté (token) ou invité (clé locale).
 *  Renvoie { key, name, coins, userId } ou { error } */
async function resolveIdentity({ token, key, name }) {
  if (token) {
    const payload = verifyToken(token);
    if (!payload) return { error: "Session expirée, reconnecte-toi." };
    const user = await getUser(payload.uid);
    if (!user) return { error: "Compte introuvable." };
    if (user.balance <= 0) return { error: "Ton solde est à 0 — impossible de rejoindre une table. (Le bonus de recharge arrive bientôt !)" };
    return { key: `user-${user.id}`, name: user.username, coins: user.balance, userId: user.id };
  }
  if (!key || !name?.trim()) return { error: "Nom requis." };
  return { key, name: name.trim().slice(0, 16), coins: 100, userId: null };
}

/** Sauvegarde les soldes des joueurs connectés après une manche */
async function persistBalances(room) {
  for (const p of room.players) {
    if (p.userId) {
      try { await setBalance(p.userId, p.coins); }
      catch (e) { console.error("persist balance failed:", e.message); }
    }
  }
}

io.on("connection", (socket) => {
  socket.on("createRoom", async (payload, cb) => {
    const id = await resolveIdentity(payload || {});
    if (id.error) return cb?.({ ok: false, error: id.error });
    const room = new Room(id.key, id.name, id.coins, id.userId);
    rooms.set(room.code, room);
    socket.data.code = room.code;
    socket.data.key = id.key;
    socket.join(room.code);
    cb?.({ ok: true, code: room.code });
    broadcast(room);
  });

  socket.on("joinRoom", async (payload, cb) => {
    const room = rooms.get(payload?.code?.trim().toUpperCase());
    if (!room) return cb?.({ ok: false, error: "Table introuvable. Vérifie le code." });
    const id = await resolveIdentity(payload || {});
    if (id.error) return cb?.({ ok: false, error: id.error });
    const r = room.join(id.key, id.name, id.coins, id.userId);
    if (!r.ok) return cb?.(r);
    socket.data.code = room.code;
    socket.data.key = id.key;
    socket.join(room.code);
    cb?.({ ok: true, code: room.code });
    broadcast(room);
  });

  const action = (fn) => async (payload, cb) => {
    const room = rooms.get(socket.data.code);
    if (!room) return cb?.({ ok: false, error: "Table fermée." });
    const r = fn(room, payload);
    cb?.(r);
    if (r.ok) broadcast(room);
    return r;
  };

  socket.on("startCeremony", action((room) => room.startCeremony(socket.data.key)));
  socket.on("startRound", action((room) => room.startRound(socket.data.key)));
  socket.on("placeBet", action((room, p) => room.placeBet(socket.data.key, p.house, p.amount)));
  socket.on("endBettingTurn", action((room) => room.endBettingTurn(socket.data.key)));
  socket.on("decideBank", action((room, p) => room.decideBank(socket.data.key, p.takeIt)));

  // reveal : on persiste les soldes juste après le calcul des résultats
  socket.on("reveal", async (payload, cb) => {
    const room = rooms.get(socket.data.code);
    if (!room) return cb?.({ ok: false, error: "Table fermée." });
    const r = room.reveal(socket.data.key);
    cb?.(r);
    if (r.ok) {
      broadcast(room);
      persistBalances(room); // async, pas bloquant
      // Historique des gains/pertes pour les comptes connectés
      room.players.forEach((p, i) => {
        if (p.userId && room.results?.[i]?.delta) addHistory(p.userId, room.results[i].delta);
      });
    }
  });

  socket.on("peek", (payload, cb) => {
    const room = rooms.get(socket.data.code);
    if (!room) return cb?.({ ok: false, error: "Table fermée." });
    const r = room.peek(socket.data.key, payload.playerIdx, payload.cardIdx);
    cb?.(r);
    if (r.ok) broadcast(room);
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.code);
    if (!room) return;
    const idx = room.idx(socket.data.key);
    if (idx !== -1) {
      let stillHere = false;
      for (const [, s] of io.of("/").sockets) {
        if (s.data.code === room.code && s.data.key === socket.data.key) stillHere = true;
      }
      if (!stillHere) {
        room.players[idx].connected = false;
        broadcast(room);
      }
    }
  });
});

initDb()
  .catch((e) => console.error("initDb failed:", e.message))
  .finally(() => {
    server.listen(PORT, () => console.log(`🃏 Nioufi server → http://localhost:${PORT}`));
  });
