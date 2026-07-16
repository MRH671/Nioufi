"use client";
import { useCallback, useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";

type Friend = { id: number; username: string; online?: boolean };
type Incoming = Friend & { request_id: number };

export default function FriendsModal({ api, token, inviteMode = false, onClose }: {
  api: string; token: string;
  /** true = affiché depuis le lobby, avec boutons "Inviter" */
  inviteMode?: boolean;
  onClose: () => void;
}) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [sent, setSent] = useState<Friend[]>([]);
  const [addName, setAddName] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [invited, setInvited] = useState<number[]>([]);

  const load = useCallback(() => {
    fetch(`${api}/api/friends`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setFriends(d.friends); setIncoming(d.incoming); setSent(d.sent); })
      .catch(() => setErr("Impossible de charger tes amis."));
  }, [api, token]);

  useEffect(() => { load(); }, [load]);

  const post = async (path: string, body: object) => {
    setErr(""); setMsg("");
    try {
      const r = await fetch(`${api}/api/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Erreur."); return null; }
      return d;
    } catch { setErr("Serveur injoignable."); return null; }
  };

  const sendRequest = async () => {
    if (!addName.trim()) return;
    const d = await post("friends/request", { username: addName.trim() });
    if (d) {
      setMsg(d.accepted ? `Vous êtes maintenant amis avec ${d.username} !` : `Demande envoyée à ${d.username}.`);
      setAddName("");
      load();
    }
  };

  const respond = async (requestId: number, accept: boolean) => {
    if (await post("friends/respond", { requestId, accept })) load();
  };

  const remove = async (userId: number) => {
    if (await post("friends/remove", { userId })) load();
  };

  const invite = (friendId: number) => {
    getSocket().emit("inviteFriend", { friendId }, (r: { ok: boolean; error?: string }) => {
      if (r.ok) setInvited((prev) => [...prev, friendId]);
      else setErr(r.error || "Invitation impossible.");
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-2xl p-5 border border-gold/40 max-h-[85vh] flex flex-col"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #1e3324 0%, #0c1810 90%)" }}>

        <div className="flex items-start justify-between mb-3">
          <div className="font-display text-gold text-[22px]">👥 Amis</div>
          <button onClick={onClose} className="text-white/40 text-xl leading-none px-1">×</button>
        </div>

        {/* Ajouter un ami */}
        <div className="flex gap-2 mb-3">
          <input value={addName} onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendRequest()}
            maxLength={20} placeholder="Pseudo d'un joueur..."
            className="flex-1 min-w-0 rounded-xl px-3 py-2 bg-black/35 border border-gold/25 text-white text-[13px] outline-none" />
          <button onClick={sendRequest}
            className="shrink-0 px-3 rounded-xl font-bold text-[13px] text-[#241d05]"
            style={{ background: "linear-gradient(140deg,#caa32f,#eed780,#caa32f)" }}>
            Ajouter
          </button>
        </div>

        {msg && <div className="text-green-400 text-[12px] mb-2 text-center">{msg}</div>}
        {err && <div className="text-red-400 text-[12px] mb-2 text-center">{err}</div>}

        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {/* Demandes reçues */}
          {incoming.length > 0 && (
            <div>
              <div className="text-gold text-[10px] uppercase tracking-[.14em] mb-1.5">
                Demandes reçues ({incoming.length})
              </div>
              {incoming.map((f) => (
                <div key={f.request_id} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-gold/8 border border-gold/25 mb-1">
                  <span className="text-gray-100 text-[13px]">{f.username}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => respond(f.request_id, true)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#241d05]"
                      style={{ background: "linear-gradient(140deg,#caa32f,#eed780)" }}>
                      Accepter
                    </button>
                    <button onClick={() => respond(f.request_id, false)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white/60 bg-white/10 border border-white/15">
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Liste d'amis */}
          <div>
            <div className="text-gold text-[10px] uppercase tracking-[.14em] mb-1.5">
              Mes amis ({friends.length})
            </div>
            {friends.length === 0 && (
              <div className="text-white/35 text-[12.5px] italic text-center py-3">
                Aucun ami pour l'instant — ajoute quelqu'un avec son pseudo !
              </div>
            )}
            {friends.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white/5 border border-white/10 mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${f.online ? "bg-green-400" : "bg-white/20"}`}
                    style={f.online ? { boxShadow: "0 0 6px rgba(74,222,128,.8)" } : undefined} />
                  <span className="text-gray-100 text-[13px]">{f.username}</span>
                  <span className="text-white/30 text-[10.5px]">{f.online ? "en ligne" : "hors ligne"}</span>
                </div>
                <div className="flex gap-1.5">
                  {inviteMode && f.online && (
                    invited.includes(f.id) ? (
                      <span className="text-green-400 text-[11px] font-bold px-2 py-1">✓ Invité</span>
                    ) : (
                      <button onClick={() => invite(f.id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[#241d05]"
                        style={{ background: "linear-gradient(140deg,#caa32f,#eed780)" }}>
                        Inviter
                      </button>
                    )
                  )}
                  <button onClick={() => remove(f.id)} title="Supprimer"
                    className="px-2 py-1 rounded-lg text-[11px] text-white/40 bg-white/5 border border-white/10">
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Demandes envoyées */}
          {sent.length > 0 && (
            <div>
              <div className="text-white/40 text-[10px] uppercase tracking-[.14em] mb-1.5">
                En attente ({sent.length})
              </div>
              {sent.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-1 px-2.5 rounded-lg bg-white/3 mb-1">
                  <span className="text-white/50 text-[12.5px]">{f.username}</span>
                  <button onClick={() => remove(f.id)} className="text-white/30 text-[11px] underline">Annuler</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
