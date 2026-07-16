"use client";
import { useEffect, useState } from "react";
import type { GameState, Ack } from "@/lib/types";
import { getSocket, getPlayerKey } from "@/lib/socket";
import GameTable from "@/components/GameTable";
import BonusModal, { type BonusInfo } from "@/components/BonusModal";
import HistoryModal from "@/components/HistoryModal";
import TutorialModal from "@/components/TutorialModal";

const API = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5001";

export default function Home() {
  const [game, setGame] = useState<GameState | null>(null);
  const [tab, setTab] = useState<"guest" | "account">("guest");
  const [myName, setMyName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [bonusInfo, setBonusInfo] = useState<BonusInfo | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
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
    const savedToken = localStorage.getItem("nioufi_token");
    if (savedToken) {
      setToken(savedToken);
      setTab("account");
      // Recharge le profil
      fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${savedToken}` } })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          setUsername(d.username); setBalance(d.balance);
          if (d.bonus?.available) setBonusInfo(d.bonus);
        })
        .catch(() => { localStorage.removeItem("nioufi_token"); setToken(null); });
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("state", onState);
    };
  }, []);

  // ── Auth ──
  const authRequest = async (path: "register" | "login") => {
    setErr(""); setBusy(true);
    try {
      const r = await fetch(`${API}/api/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Erreur."); return; }
      setToken(d.token);
      setBalance(d.balance);
      setUsername(d.username);
      setPassword("");
      if (d.bonus?.available) setBonusInfo(d.bonus);
      localStorage.setItem("nioufi_token", d.token);
    } catch {
      setErr("Serveur injoignable.");
    } finally { setBusy(false); }
  };

  const openBonus = async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (r.ok && d.bonus) { setBalance(d.balance); setBonusInfo(d.bonus); }
    } catch { /* silencieux */ }
  };

  const logout = () => {
    localStorage.removeItem("nioufi_token");
    setToken(null); setBalance(null); setPassword("");
  };

  // ── Créer / rejoindre ──
  const identityPayload = () => {
    if (tab === "account" && token) return { token };
    if (!myName.trim()) { setErr("Entre ton nom d'abord."); return null; }
    localStorage.setItem("nioufi_name", myName.trim());
    return { key: getPlayerKey(), name: myName.trim() };
  };

  const create = () => {
    const p = identityPayload();
    if (!p) return;
    setErr("");
    getSocket().emit("createRoom", p, (r: Ack) => { if (!r.ok) setErr(r.error || "Erreur inconnue."); });
  };

  const join = () => {
    const p = identityPayload();
    if (!p) return;
    if (joinCode.trim().length !== 4) { setErr("Le code fait 4 caractères."); return; }
    setErr("");
    getSocket().emit("joinRoom", { ...p, code: joinCode.trim().toUpperCase() }, (r: Ack) => {
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

  // ── Modals ──
  const modals = (
    <>
      {bonusInfo && token && (
        <BonusModal bonus={bonusInfo} api={API} token={token}
          onClaimed={(b) => setBalance(b)}
          onClose={() => setBonusInfo(null)} />
      )}
      {showHistory && token && (
        <HistoryModal api={API} token={token} onClose={() => setShowHistory(false)} />
      )}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
    </>
  );

  // ── Accueil ──
  const inputCls = "w-full rounded-xl px-3 py-2.5 bg-black/35 border border-gold/25 text-white text-[15px] outline-none";
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5">
      {modals}
      <div className="text-center mb-7">
        <div className="font-display text-gold" style={{ fontSize: "clamp(3rem,11vw,4.5rem)", textShadow: "0 0 30px rgba(232,201,106,.35)" }}>
          Nioufi
        </div>
        <div className="text-emerald-500/90 italic font-display -mt-1">— chacun son téléphone, une seule table —</div>
      </div>

      <div className="w-full max-w-[380px] rounded-2xl p-5 bg-white/5 border border-gold/20">
        {/* Onglets */}
        <div className="flex rounded-xl overflow-hidden border border-gold/25 mb-4">
          {(["guest", "account"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setErr(""); }}
              className={`flex-1 py-2 text-[13px] font-bold ${tab === t ? "bg-gold text-[#241d05]" : "bg-black/30 text-gold"}`}>
              {t === "guest" ? "🎭 Invité" : "👤 Compte"}
            </button>
          ))}
        </div>

        {tab === "guest" && (
          <>
            <label className="block text-gold text-[11px] uppercase tracking-[.14em] mb-1">Ton nom</label>
            <input value={myName} onChange={(e) => setMyName(e.target.value)} maxLength={16}
              className={inputCls} placeholder="Ex : Merah" />
            <p className="text-white/30 text-[11px] mt-1.5">100 jetons par partie, non conservés.</p>
          </>
        )}

        {tab === "account" && !token && (
          <>
            <label className="block text-gold text-[11px] uppercase tracking-[.14em] mb-1">Pseudo</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20}
              className={inputCls} placeholder="Pseudo" autoComplete="username" />
            <label className="block text-gold text-[11px] uppercase tracking-[.14em] mb-1 mt-3">Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && authRequest("login")}
              className={inputCls} placeholder="••••••" autoComplete="current-password" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => authRequest("login")} disabled={busy}
                className="flex-1 py-2.5 rounded-xl font-extrabold text-[14px] text-[#241d05] disabled:opacity-50"
                style={{ background: "linear-gradient(140deg,#caa32f,#eed780,#caa32f)" }}>
                Se connecter
              </button>
              <button onClick={() => authRequest("register")} disabled={busy}
                className="flex-1 py-2.5 rounded-xl font-bold text-[13px] text-gray-200 bg-white/10 border border-white/20 disabled:opacity-50">
                Créer un compte
              </button>
            </div>
            <p className="text-white/30 text-[11px] mt-2">500 jetons offerts à l'inscription. Ton solde est conservé.</p>
          </>
        )}

        {tab === "account" && token && (
          <>
            <div className="flex items-center justify-between rounded-xl px-3.5 py-3 bg-gold/10 border border-gold/40">
              <div>
                <div className="text-gold font-bold text-[15px]">👤 {username}</div>
                <div className="text-emerald-400/90 text-[13px]">{balance ?? "..."} 🪙</div>
              </div>
              <button onClick={logout} className="text-white/50 text-[12px] underline">Déconnexion</button>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={openBonus}
                className="flex-1 py-2 rounded-xl text-[12px] font-bold text-gold bg-gold/10 border border-gold/30">
                🎁 Bonus
              </button>
              <button onClick={() => setShowHistory(true)}
                className="flex-1 py-2 rounded-xl text-[12px] font-bold text-gold bg-gold/10 border border-gold/30">
                📜 Historique
              </button>
            </div>
          </>
        )}

        {/* Créer / rejoindre */}
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
            className="flex-1 min-w-0 rounded-xl px-2 py-2.5 bg-black/35 border border-gold/25 text-white text-center font-extrabold tracking-[.25em] uppercase outline-none"
            placeholder="ABCD" />
          <button onClick={join} className="shrink-0 px-3.5 rounded-xl font-bold text-sm text-gray-200 bg-white/10 border border-white/20">
            Rejoindre
          </button>
        </div>

        {err && <div className="text-red-400 text-[13px] mt-3 text-center">{err}</div>}

        <button onClick={() => setShowTutorial(true)}
          className="w-full mt-4 py-2 rounded-xl text-[12.5px] font-bold text-emerald-100 bg-white/5 border border-white/15">
          ❓ Tutoriel — apprendre les règles
        </button>

        <div className={`mt-3 text-center text-[11px] rounded-lg py-1.5 px-2.5 bg-black/25
          ${connected ? "text-green-400" : "text-yellow-500"}`}>
          {connected ? "✓ Connecté au serveur" : "Connexion au serveur..."}
        </div>
      </div>
    </div>
  );
}
