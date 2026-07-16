// ═══════════════════════════════════════════════════════════════════════════
//  NIOUFI — Serveur Express + Socket.io
//  Port 5001 par défaut (5000 est pris par BM Food ;))
// ═══════════════════════════════════════════════════════════════════════════

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Room } = require("./game");

const PORT = process.env.PORT || 5001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: [CLIENT_URL, "http://localhost:3001"], methods: ["GET", "POST"] },
});

app.get("/", (_req, res) => res.json({ ok: true, service: "nioufi-server" }));

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
  // Chaque joueur reçoit SA version de l'état (cartes masquées selon ses droits)
  for (const [, socket] of io.of("/").sockets) {
    if (socket.data.code === room.code && socket.data.key) {
      socket.emit("state", room.serializeFor(socket.data.key));
    }
  }
}

io.on("connection", (socket) => {
  // ── Créer une table ──
  socket.on("createRoom", ({ key, name }, cb) => {
    if (!key || !name?.trim()) return cb?.({ ok: false, error: "Nom requis." });
    const room = new Room(key, name.trim().slice(0, 16));
    rooms.set(room.code, room);
    socket.data.code = room.code;
    socket.data.key = key;
    socket.join(room.code);
    cb?.({ ok: true, code: room.code });
    broadcast(room);
  });

  // ── Rejoindre ──
  socket.on("joinRoom", ({ key, name, code }, cb) => {
    if (!key || !name?.trim()) return cb?.({ ok: false, error: "Nom requis." });
    const room = rooms.get(code?.trim().toUpperCase());
    if (!room) return cb?.({ ok: false, error: "Table introuvable. Vérifie le code." });
    const r = room.join(key, name.trim().slice(0, 16));
    if (!r.ok) return cb?.(r);
    socket.data.code = room.code;
    socket.data.key = key;
    socket.join(room.code);
    cb?.({ ok: true, code: room.code });
    broadcast(room);
  });

  // ── Actions de jeu : toutes validées par la Room ──
  const action = (fn) => (payload, cb) => {
    const room = rooms.get(socket.data.code);
    if (!room) return cb?.({ ok: false, error: "Table fermée." });
    const r = fn(room, payload);
    cb?.(r);
    if (r.ok) broadcast(room);
  };

  socket.on("startCeremony", action((room) => room.startCeremony(socket.data.key)));
  socket.on("startRound", action((room) => room.startRound(socket.data.key)));
  socket.on("placeBet", action((room, p) => room.placeBet(socket.data.key, p.house, p.amount)));
  socket.on("endBettingTurn", action((room) => room.endBettingTurn(socket.data.key)));
  socket.on("reveal", action((room) => room.reveal(socket.data.key)));
  socket.on("decideBank", action((room, p) => room.decideBank(socket.data.key, p.takeIt)));

  // ── Peek : la carte part UNIQUEMENT au demandeur, l'événement à tout le monde ──
  socket.on("peek", (payload, cb) => {
    const room = rooms.get(socket.data.code);
    if (!room) return cb?.({ ok: false, error: "Table fermée." });
    const r = room.peek(socket.data.key, payload.playerIdx, payload.cardIdx);
    cb?.(r); // contient la carte si ok
    if (r.ok) broadcast(room); // le feed "X regarde..." pour tout le monde
  });

  // ── Déconnexion ──
  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.code);
    if (!room) return;
    const idx = room.idx(socket.data.key);
    if (idx !== -1) {
      // Vérifie qu'aucun autre socket du même joueur n'est connecté
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

server.listen(PORT, () => console.log(`🃏 Nioufi server → http://localhost:${PORT}`));
