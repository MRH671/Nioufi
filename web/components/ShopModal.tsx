"use client";
import { useCallback, useEffect, useState } from "react";
import { TABLE_THEMES, CARD_THEMES } from "@/lib/skins";
import { sfxWin } from "@/lib/sounds";

type Skin = { code: string; type: "table" | "cards"; name: string; price: number };
type ShopData = { skins: Skin[]; owned: string[]; equipped: { table: string; cards: string }; balance: number };

export default function ShopModal({ api, token, onBalance, onEquipped, onClose }: {
  api: string; token: string;
  onBalance: (b: number) => void;
  onEquipped: (skins: { table: string; cards: string }) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<ShopData | null>(null);
  const [tab, setTab] = useState<"table" | "cards">("table");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    fetch(`${api}/api/shop`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setData(d); onEquipped(d.equipped); })
      .catch(() => setErr("Impossible de charger la boutique."));
  }, [api, token, onEquipped]);

  useEffect(() => { load(); }, [load]);

  const post = async (path: string, code: string) => {
    setErr(""); setBusy(code);
    try {
      const r = await fetch(`${api}/api/shop/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Erreur."); return null; }
      return d;
    } catch { setErr("Serveur injoignable."); return null; }
    finally { setBusy(""); }
  };

  const buy = async (code: string) => {
    const d = await post("buy", code);
    if (d) { sfxWin(); if (d.balance !== undefined) onBalance(d.balance); load(); }
  };

  const equip = async (code: string) => {
    if (await post("equip", code)) load();
  };

  const skins = data?.skins.filter((s) => s.type === tab) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-2xl p-5 border border-gold/40 max-h-[85vh] flex flex-col"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #1e3324 0%, #0c1810 90%)" }}>

        <div className="flex items-start justify-between mb-1">
          <div className="font-display text-gold text-[22px]">🛍 Boutique</div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-300/90 font-bold text-[14px]">{data?.balance ?? "..."} 🪙</span>
            <button onClick={onClose} className="text-white/40 text-xl leading-none px-1">×</button>
          </div>
        </div>
        <div className="text-emerald-400/80 text-[12px] mb-3">Échange tes jetons contre du style. Chacun voit la table avec son propre thème.</div>

        {/* Onglets */}
        <div className="flex rounded-xl overflow-hidden border border-gold/25 mb-3">
          {(["table", "cards"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 text-[13px] font-bold ${tab === t ? "bg-gold text-[#241d05]" : "bg-black/30 text-gold"}`}>
              {t === "table" ? "🎨 Tables" : "🂠 Cartes"}
            </button>
          ))}
        </div>

        {err && <div className="text-red-400 text-[12px] mb-2 text-center">{err}</div>}

        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 gap-2.5">
          {skins.map((s) => {
            const owned = s.price === 0 || (data?.owned.includes(s.code) ?? false);
            const equipped = data?.equipped[tab === "table" ? "table" : "cards"] === s.code;
            const canAfford = (data?.balance ?? 0) >= s.price;
            const tt = TABLE_THEMES[s.code];
            const ct = CARD_THEMES[s.code];
            return (
              <div key={s.code} className={`rounded-xl p-2.5 border flex flex-col gap-2
                ${equipped ? "border-gold bg-gold/10" : "border-white/10 bg-white/4"}`}>
                {/* Aperçu */}
                {tt && (
                  <div className="h-16 flex items-center justify-center rounded-lg" style={{ background: "rgba(0,0,0,.25)" }}>
                    <div style={{
                      position: "relative",
                      width: s.code === "boitier" ? "62%" : "84%",
                      height: s.code === "boitier" ? "82%" : "78%",
                      borderRadius: tt.pRadius,
                      background: tt.surface,
                      border: `3px solid ${tt.pBorder}`,
                      overflow: "visible",
                    }}>
                      {s.code === "boitier" && (
                        <>
                          <div style={{ position: "absolute", left: "50%", top: 3, bottom: 3, width: 1.5, background: "rgba(0,0,0,.22)" }} />
                          <div style={{ position: "absolute", top: 2, left: 3, width: 4, height: 4, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #cfccc2, #6e6a5e)" }} />
                          <div style={{ position: "absolute", top: 2, right: 3, width: 4, height: 4, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #cfccc2, #6e6a5e)" }} />
                          <div style={{ position: "absolute", bottom: 2, left: 3, width: 4, height: 4, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #cfccc2, #6e6a5e)" }} />
                          <div style={{ position: "absolute", bottom: 2, right: 3, width: 4, height: 4, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #cfccc2, #6e6a5e)" }} />
                          <div style={{
                            position: "absolute", top: 2, right: 8, width: 14, height: 12,
                            clipPath: "polygon(50% 0, 100% 100%, 0 100%)",
                            background: "linear-gradient(180deg,#f5c916,#dfae0a)",
                            display: "flex", alignItems: "flex-end", justifyContent: "center",
                            fontSize: 6, color: "#15150a",
                          }}>⚡</div>
                          <div style={{
                            position: "absolute", top: "34%", left: "6%",
                            transform: "rotate(-7deg) skewX(-6deg)",
                            fontFamily: "'Segoe Script','Brush Script MT',cursive",
                            fontSize: 8.5, fontWeight: 700, color: "rgba(28,28,110,.75)",
                            whiteSpace: "nowrap",
                          }}>Neuhof 67100</div>
                          <div style={{
                            position: "absolute", left: 5, bottom: 5, width: 22, height: 10, borderRadius: 1,
                            background: "repeating-linear-gradient(180deg, rgba(0,0,0,.35) 0 2px, rgba(255,255,255,.1) 2px 4px)",
                          }} />
                        </>
                      )}
                      {s.code === "camping" && (
                        <>
                          <div style={{ position: "absolute", bottom: -9, left: "16%", width: 5, height: 10, borderRadius: "0 0 2px 2px", background: "linear-gradient(90deg,#fff,#c9ccc6)", boxShadow: "1px 2px 3px rgba(0,0,0,.4)" }} />
                          <div style={{ position: "absolute", bottom: -9, right: "16%", width: 5, height: 10, borderRadius: "0 0 2px 2px", background: "linear-gradient(90deg,#fff,#c9ccc6)", boxShadow: "1px 2px 3px rgba(0,0,0,.4)" }} />
                        </>
                      )}
                    </div>
                  </div>
                )}
                {ct && (
                  <div className="h-14 rounded-lg flex items-center justify-center gap-1.5"
                    style={{ background: "rgba(0,0,0,.25)" }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-7 h-10 rounded-[4px] border flex items-center justify-center"
                        style={{
                          borderColor: ct.border,
                          background: ct.bg || `repeating-linear-gradient(45deg, ${ct.c1} 0 4px, ${ct.c2} 4px 8px)`,
                          transform: `rotate(${(i - 1) * 8}deg)`,
                        }}>
                        {ct.emblem
                          ? <span style={{ color: ct.emblem.color, fontSize: 13, lineHeight: 1 }}>{ct.emblem.char}</span>
                          : !ct.bg && <span style={{ color: ct.accent, fontFamily: "Georgia,serif", fontSize: 9, fontStyle: "italic" }}>N</span>}
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <div className="text-gray-100 text-[12px] font-bold leading-tight">{s.name}</div>
                  <div className="text-emerald-400/70 text-[10.5px]">{s.price === 0 ? "Gratuit" : `${s.price} 🪙`}</div>
                </div>

                {equipped ? (
                  <div className="text-center py-1.5 rounded-lg text-[11px] font-bold text-gold bg-gold/15 border border-gold/40">
                    ✓ Équipé
                  </div>
                ) : owned ? (
                  <button onClick={() => equip(s.code)} disabled={busy === s.code}
                    className="py-1.5 rounded-lg text-[11px] font-bold text-[#241d05] disabled:opacity-50"
                    style={{ background: "linear-gradient(140deg,#caa32f,#eed780)" }}>
                    Équiper
                  </button>
                ) : (
                  <button onClick={() => buy(s.code)} disabled={busy === s.code || !canAfford}
                    className={`py-1.5 rounded-lg text-[11px] font-bold border
                      ${canAfford ? "text-gold bg-gold/10 border-gold/40" : "text-white/30 bg-white/5 border-white/10"}`}>
                    {canAfford ? `Acheter · ${s.price} 🪙` : `${s.price} 🪙 requis`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
