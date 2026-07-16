"use client";
import { useEffect, useState } from "react";

type Entry = { username: string; balance: number; me: boolean; online: boolean };

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardModal({ api, token, onClose }: {
  api: string; token: string; onClose: () => void;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${api}/api/leaderboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setEntries(d.entries))
      .catch(() => setErr("Impossible de charger le classement."));
  }, [api, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-2xl p-5 border border-gold/40 max-h-[80vh] flex flex-col"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #1e3324 0%, #0c1810 90%)" }}>

        <div className="flex items-start justify-between mb-1">
          <div className="font-display text-gold text-[22px]">🏆 Classement</div>
          <button onClick={onClose} className="text-white/40 text-xl leading-none px-1">×</button>
        </div>
        <div className="text-emerald-400/80 text-[12px] mb-3">Toi et tes amis, du plus riche au plus fauché.</div>

        <div className="flex-1 overflow-y-auto pr-1">
          {err && <div className="text-red-400 text-[13px] text-center">{err}</div>}
          {entries === null && !err && <div className="text-white/40 text-[13px] text-center italic">Chargement...</div>}
          {entries?.length === 1 && (
            <div className="text-white/35 text-[12.5px] italic text-center py-2 mb-2">
              Tu es seul au sommet... ajoute des amis pour comparer vos soldes !
            </div>
          )}
          {entries?.map((e, i) => (
            <div key={i} className={`flex items-center justify-between py-2 px-3 rounded-xl mb-1.5 border
              ${e.me ? "bg-gold/12 border-gold/45" : i === 0 ? "bg-gold/6 border-gold/25" : "bg-white/4 border-white/8"}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`shrink-0 text-center ${i < 3 ? "text-[18px] w-7" : "text-[12px] w-7 text-white/40 font-bold"}`}>
                  {i < 3 ? MEDALS[i] : `#${i + 1}`}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.online ? "bg-green-400" : "bg-white/15"}`} />
                <span className={`text-[14px] truncate ${e.me ? "text-gold font-bold" : "text-gray-100"}`}>
                  {e.username}{e.me ? " (toi)" : ""}
                </span>
              </div>
              <span className={`shrink-0 font-extrabold text-[14px] ${i === 0 ? "text-gold" : "text-emerald-300/90"}`}>
                {e.balance.toLocaleString("fr-FR")} 🪙
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
