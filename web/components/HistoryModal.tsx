"use client";
import { useEffect, useState } from "react";

type Entry = { delta: number; at: string };

export default function HistoryModal({ api, token, onClose }: {
  api: string; token: string; onClose: () => void;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${api}/api/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setEntries(d.entries); setTotal(d.total); })
      .catch(() => setErr("Impossible de charger l'historique."));
  }, [api, token]);

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) +
      " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-2xl p-5 border border-gold/40 max-h-[80vh] flex flex-col"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #1e3324 0%, #0c1810 90%)" }}>

        <div className="flex items-start justify-between mb-3">
          <div className="font-display text-gold text-[22px]">📜 Historique</div>
          <button onClick={onClose} className="text-white/40 text-xl leading-none px-1">×</button>
        </div>

        {/* Bilan */}
        <div className={`rounded-xl px-4 py-3 mb-3 text-center border
          ${total >= 0 ? "bg-emerald-900/25 border-emerald-600/40" : "bg-red-900/25 border-red-600/40"}`}>
          <div className="text-white/50 text-[10px] uppercase tracking-[.14em]">Bilan total</div>
          <div className={`font-extrabold text-[26px] ${total >= 0 ? "text-green-400" : "text-red-400"}`}>
            {total > 0 ? "+" : ""}{total} 🪙
          </div>
          <div className="text-white/40 text-[11px]">{total >= 0 ? "Tu es en gain 📈" : "Tu es en perte 📉"}</div>
        </div>

        {/* Liste des manches */}
        <div className="flex-1 overflow-y-auto pr-1">
          {err && <div className="text-red-400 text-[13px] text-center">{err}</div>}
          {entries === null && !err && <div className="text-white/40 text-[13px] text-center italic">Chargement...</div>}
          {entries?.length === 0 && (
            <div className="text-white/40 text-[13px] text-center italic py-4">
              Aucune manche jouée avec ce compte pour l'instant.
            </div>
          )}
          {entries?.map((e, i) => (
            <div key={i} className="flex justify-between items-center py-1.5 border-b border-white/5 text-[13px]">
              <span className="text-white/45">{fmt(e.at)}</span>
              <span className={`font-bold ${e.delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                {e.delta > 0 ? "+" : ""}{e.delta} 🪙
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
