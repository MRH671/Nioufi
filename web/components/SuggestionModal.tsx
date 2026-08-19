"use client";
import { useState } from "react";

export default function SuggestionModal({ api, token, onClose }: {
  api: string; token: string | null; onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    if (content.trim().length < 5) { setErr("Dis-nous en un peu plus !"); return; }
    setBusy(true); setErr("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`${api}/api/suggestions`, {
        method: "POST", headers,
        body: JSON.stringify({ content: content.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Envoi impossible."); return; }
      setSent(true);
      setTimeout(onClose, 1800);
    } catch { setErr("Serveur injoignable."); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-2xl p-5 border border-gold/40"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #1e3324 0%, #0c1810 90%)" }}>

        <div className="flex items-start justify-between mb-1">
          <div className="font-display text-gold text-[22px]">💡 Une idée ?</div>
          <button onClick={onClose} className="text-white/40 text-xl leading-none px-1">×</button>
        </div>

        {sent ? (
          <div className="text-center py-6">
            <div className="text-[34px] mb-2">🙏</div>
            <div className="text-gold font-bold text-[15px]">Merci, c'est noté !</div>
            <div className="text-emerald-400/80 text-[12.5px] mt-1">Chaque retour aide à améliorer le Nioufi.</div>
          </div>
        ) : (
          <>
            <div className="text-emerald-400/80 text-[12.5px] mb-3">
              Le jeu est en phase de test : un bug, une règle qui manque, une idée de skin ?
              Balance tout, on lit chaque message.
            </div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={1000}
              rows={5} placeholder="Ton idée, ton bug, ton avis..."
              className="w-full rounded-xl px-3 py-2.5 bg-black/35 border border-gold/25 text-white text-[14px] outline-none resize-none" />
            <div className="flex items-center justify-between mt-1">
              <span className="text-white/25 text-[10.5px]">{content.length}/1000</span>
              {err && <span className="text-red-400 text-[12px]">{err}</span>}
            </div>
            <button onClick={send} disabled={busy}
              className="w-full mt-2 py-2.5 rounded-xl font-extrabold text-[14px] text-[#241d05] disabled:opacity-50"
              style={{ background: "linear-gradient(140deg,#caa32f,#eed780,#caa32f)" }}>
              Envoyer ma suggestion
            </button>
          </>
        )}
      </div>
    </div>
  );
}
