"use client";
import { useEffect, useState } from "react";
import type { GameState, Ack } from "@/lib/types";
import { getSocket, getPlayerKey } from "@/lib/socket";
import GameTable, { GoldBtn, GhostBtn } from "@/components/GameTable";

export default function Home() {
  const [game, setGame] = useState<GameState | null>(null);
  const [myName, setMyName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onState = (s: GameState) => setGame(s);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("state", onState);
    if (socket.connected) setConnected(true);

    const savedName = localStorage.getItem("nioufi_name");
    if (savedName) setMyName(savedName);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("state", onState);
    };
  }, []);

  const create = () => {
    if (!myName.trim()) { setErr("Entre ton nom d'abord."); return; }
    localStorage.setItem("nioufi_name", myName.trim());
    setErr("");
    getSocket().emit("createRoom", { key: getPlayerKey(), name: myName.trim() }, (r: Ack) => {
      if (!r.ok) setErr(r.error || "Erreur inconnue.");
    });
  };

  const join = () => {
    if (!myName.trim()) { setErr("Entre ton nom d'abord."); return; }
    if (joinCode.trim().length !== 4) { setErr("Le code fait 4 caractères."); return; }
    localStorage.setItem("nioufi_name", myName.trim());
    setErr("");
    getSocket().emit("joinRoom", { key: getPlayerKey(), name: myName.trim(), code: joinCode.trim().toUpperCase() }, (r: Ack) => {
      if (!r.ok) setErr(r.error || "Erreur inconnue.");
    });
  };

  // ── Lobby ──
  if (game && game.phase === "lobby") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-5">
        <div className="font-display text-[34px] text-gold mb-1">Table ouverte</div>
        <div className="text-emerald-500/90 mb-4 text-[13px]">Partage ce code avec les autres joueurs :</div>
        <div className="font-display text-[52px] font-extrabold text-gold-light tracking-[.35em] pl-9 pr-6 py-2.5 rounded-2xl bg-black/40 border-2 border-gold/40 mb-6"
          style={{ boxShadow: "0 0 30px rgba(232,201,106,.15)" }}>
          {game.code}
        </div>

        <div className="w-full max-w-[340px]">
          <div className="text-gold text-[11px] uppercase tracking-[.14em] mb-2">
            Joueurs à table ({game.players.length}/13)
          </div>
          <div className="flex flex-col gap-1.5">
            {game.players.map((p, i) => (
              <div key={i} className={`flex justify-between px-3.5 py-2 rounded-xl text-sm text-gray-100
                ${i === game.myIdx ? "bg-gold/10 border border-gold/40" : "bg-white/5 border border-white/10"}`}>
                <span>{p.name}{i === 0 ? " 👑" : ""}{i === game.myIdx ? " (toi)" : ""}</span>
                <span className="text-emerald-400/90">{p.coins} 🪙</span>
              </div>
            ))}
          </div>

          {game.isHost ? (
            <button onClick={() => getSocket().emit("startCeremony", {}, (r: Ack) => !r.ok && setErr(r.error || ""))}
              disabled={game.players.length < 2}
              className="w-full mt-5 py-3 rounded-xl font-extrabold text-[15px] text-[#241d05] disabled:opacity-40"
              style={{ background: "linear-gradient(140deg,#caa32f,#eed780,#caa32f)" }}>
              {game.players.length < 2 ? "En attente de joueurs..." : "🂡 Lancer la désignation de la banque"}
            </button>
          ) : (
            <div className="text-center text-emerald-500/90 mt-5 text-[13px] italic">
              En attente que {game.players[0]?.name} lance la partie...
            </div>
          )}
          {err && <div className="text-red-400 text-[13px] mt-3 text-center">{err}</div>}
        </div>
      </div>
    );
  }

  // ── En jeu ──
  if (game) return <GameTable game={game} />;

  // ── Accueil ──
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5">
      <div className="text-center mb-7">
        <div className="font-display text-gold" style={{ fontSize: "clamp(3rem,11vw,4.5rem)", textShadow: "0 0 30px rgba(232,201,106,.35)" }}>
          Nioufi
        </div>
        <div className="text-emerald-500/90 italic font-display -mt-1">— chacun son téléphone, une seule table —</div>
      </div>

      <div className="w-full max-w-[380px] rounded-2xl p-5 bg-white/5 border border-gold/20">
        <label className="block text-gold text-[11px] uppercase tracking-[.14em] mb-1">Ton nom</label>
        <input value={myName} onChange={(e) => setMyName(e.target.value)} maxLength={16}
          className="w-full rounded-xl px-3 py-2.5 bg-black/35 border border-gold/25 text-white text-[15px] outline-none"
          placeholder="Ex : Merah" />

        <button onClick={create}
          className="w-full mt-4 py-3 rounded-xl font-extrabold text-[15px] text-[#241d05]"
          style={{ background: "linear-gradient(140deg,#caa32f,#eed780,#caa32f)", boxShadow: "0 5px 18px rgba(232,201,106,.3)" }}>
          ♠ Créer une table
        </button>

        <div className="flex items-center gap-2.5 my-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-emerald-500/80 text-[11px]">OU</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <label className="block text-gold text-[11px] uppercase tracking-[.14em] mb-1">Code de la table</label>
        <div className="flex gap-2">
          <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={4}
            className="flex-1 rounded-xl px-3 py-2.5 bg-black/35 border border-gold/25 text-white text-center font-extrabold tracking-[.3em] uppercase outline-none"
            placeholder="ABCD" />
          <button onClick={join} className="px-4 rounded-xl font-bold text-sm text-gray-200 bg-white/10 border border-white/20 whitespace-nowrap">
            Rejoindre
          </button>
        </div>

        {err && <div className="text-red-400 text-[13px] mt-3 text-center">{err}</div>}

        <div className={`mt-4 text-center text-[11px] rounded-lg py-1.5 px-2.5 bg-black/25
          ${connected ? "text-green-400" : "text-yellow-500"}`}>
          {connected ? "✓ Connecté au serveur" : "Connexion au serveur..."}
        </div>
      </div>
    </div>
  );
}
