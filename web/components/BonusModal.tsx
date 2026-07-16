"use client";
import { useState } from "react";
import { sfxWin } from "@/lib/sounds";

export type BonusInfo = { available: boolean; day: number; rewards: number[] };

export default function BonusModal({
  bonus, api, token, onClaimed, onClose,
}: {
  bonus: BonusInfo;
  api: string;
  token: string;
  onClaimed: (newBalance: number) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [err, setErr] = useState("");
  const rewards = bonus.rewards || [50, 75, 100, 150, 200, 300, 500];

  const claim = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${api}/api/bonus/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Erreur."); return; }
      sfxWin();
      setClaimed(true);
      onClaimed(d.balance);
      setTimeout(onClose, 1400);
    } catch { setErr("Serveur injoignable."); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-2xl p-5 border border-gold/40"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #1e3324 0%, #0c1810 90%)", boxShadow: "0 0 60px rgba(232,201,106,.15)" }}>

        <div className="flex items-start justify-between mb-1">
          <div className="font-display text-gold text-[22px]">🎁 Récompense quotidienne</div>
          <button onClick={onClose} className="text-white/40 text-xl leading-none px-1">×</button>
        </div>
        <div className="text-emerald-400/80 text-[12px] mb-4">
          Reviens chaque jour pour faire grimper la récompense. Rate un jour, et la série repart au jour 1 !
        </div>

        {/* Calendrier 7 jours */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          {rewards.slice(0, 4).map((amount, i) => (
            <DayTile key={i} day={i + 1} amount={amount} current={bonus.day} claimed={claimed} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {rewards.slice(4).map((amount, i) => (
            <DayTile key={i + 4} day={i + 5} amount={amount} current={bonus.day} claimed={claimed} big={i === 2} />
          ))}
        </div>

        {claimed ? (
          <div className="text-center font-bold text-gold text-[16px] py-2 animate-pulse">
            +{rewards[bonus.day - 1]} 🪙 récupérés !
          </div>
        ) : bonus.available ? (
          <button onClick={claim} disabled={busy}
            className="w-full py-3 rounded-xl font-extrabold text-[15px] text-[#241d05] disabled:opacity-50 animate-pulse-btn"
            style={{ background: "linear-gradient(140deg,#caa32f,#eed780,#caa32f)", boxShadow: "0 5px 18px rgba(232,201,106,.35)" }}>
            Récupérer +{rewards[bonus.day - 1]} 🪙
          </button>
        ) : (
          <div className="w-full py-3 rounded-xl text-center font-bold text-[13px] text-white/50 bg-white/5 border border-white/10">
            ✓ Déjà récupéré — reviens plus tard pour le jour {bonus.day} (+{rewards[bonus.day - 1]} 🪙)
          </div>
        )}
        {err && <div className="text-red-400 text-[12px] mt-2 text-center">{err}</div>}
      </div>
    </div>
  );
}

function DayTile({ day, amount, current, claimed, big }: {
  day: number; amount: number; current: number; claimed: boolean; big?: boolean;
}) {
  const isPast = day < current;
  const isCurrent = day === current;
  return (
    <div className={`rounded-xl px-1 py-2 text-center border transition-all
      ${isCurrent
        ? "border-gold bg-gold/15" + (claimed ? "" : " animate-pulse")
        : isPast
          ? "border-emerald-700/50 bg-emerald-900/20 opacity-60"
          : "border-white/10 bg-black/25 opacity-45"}`}
      style={isCurrent ? { boxShadow: "0 0 14px rgba(232,201,106,.35)" } : undefined}>
      <div className={`text-[9.5px] uppercase tracking-wide ${isCurrent ? "text-gold" : "text-white/50"}`}>
        Jour {day}
      </div>
      <div className={`font-extrabold ${big ? "text-[16px]" : "text-[13px]"} ${isCurrent ? "text-gold" : isPast ? "text-emerald-400/70" : "text-white/60"}`}>
        {isPast || (isCurrent && claimed) ? "✓" : `${amount}`}{!isPast && !(isCurrent && claimed) && " 🪙"}
      </div>
    </div>
  );
}
