import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { API } from "../../lib/config";
import { getSocket } from "../../lib/socket";
import { C } from "../../lib/theme";
import { ErrorText, Field, GoldButton, Sheet } from "../ui";

type Friend = { id: number; username: string; online?: boolean };
type Incoming = Friend & { request_id: number };

export default function FriendsModal({ token, inviteMode = false, onClose }: {
  token: string; inviteMode?: boolean; onClose: () => void;
}) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<Incoming[]>([]);
  const [sent, setSent] = useState<Friend[]>([]);
  const [addName, setAddName] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [invited, setInvited] = useState<number[]>([]);

  const load = useCallback(() => {
    fetch(`${API}/api/friends`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setFriends(d.friends); setIncoming(d.incoming); setSent(d.sent); })
      .catch(() => setErr("Impossible de charger tes amis."));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const post = async (path: string, body: object) => {
    setErr(""); setMsg("");
    try {
      const r = await fetch(`${API}/api/${path}`, {
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
  const respond = async (requestId: number, accept: boolean) => { if (await post("friends/respond", { requestId, accept })) load(); };
  const remove = async (userId: number) => { if (await post("friends/remove", { userId })) load(); };
  const invite = (friendId: number) => {
    getSocket().emit("inviteFriend", { friendId }, (r: { ok: boolean; error?: string }) => {
      if (r.ok) setInvited((p) => [...p, friendId]);
      else setErr(r.error || "Invitation impossible.");
    });
  };

  return (
    <Sheet title="👥 Amis" onClose={onClose}>
      <View style={s.addRow}>
        <Field value={addName} onChangeText={setAddName} maxLength={20} placeholder="Pseudo d'un joueur..."
          autoCapitalize="none" autoCorrect={false} returnKeyType="send" onSubmitEditing={sendRequest} grow />
        <GoldButton small label="Ajouter" onPress={sendRequest} />
      </View>
      {!!msg && <Text style={s.ok}>{msg}</Text>}
      <ErrorText>{err}</ErrorText>

      {incoming.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={s.section}>DEMANDES REÇUES ({incoming.length})</Text>
          {incoming.map((f) => (
            <View key={f.request_id} style={[s.row, s.rowGold]}>
              <Text style={s.name}>{f.username}</Text>
              <View style={s.btns}>
                <SmallBtn label="Accepter" gold onPress={() => respond(f.request_id, true)} />
                <SmallBtn label="Refuser" onPress={() => respond(f.request_id, false)} />
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ marginTop: 12 }}>
        <Text style={s.section}>MES AMIS ({friends.length})</Text>
        {friends.length === 0 && <Text style={s.empty}>Aucun ami pour l'instant — ajoute quelqu'un avec son pseudo !</Text>}
        {friends.map((f) => (
          <View key={f.id} style={s.row}>
            <View style={s.who}>
              <View style={[s.dot, { backgroundColor: f.online ? C.green : "rgba(255,255,255,.2)" }]} />
              <Text style={s.name} numberOfLines={1}>{f.username}</Text>
              <Text style={s.status}>{f.online ? "en ligne" : "hors ligne"}</Text>
            </View>
            <View style={s.btns}>
              {inviteMode && f.online && (invited.includes(f.id)
                ? <Text style={s.invited}>✓ Invité</Text>
                : <SmallBtn label="Inviter" gold onPress={() => invite(f.id)} />)}
              <SmallBtn label="×" onPress={() => remove(f.id)} />
            </View>
          </View>
        ))}
      </View>

      {sent.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={[s.section, { color: "rgba(255,255,255,.4)" }]}>EN ATTENTE ({sent.length})</Text>
          {sent.map((f) => (
            <View key={f.id} style={[s.row, { backgroundColor: "rgba(255,255,255,.03)" }]}>
              <Text style={[s.name, { color: "rgba(255,255,255,.5)" }]}>{f.username}</Text>
              <Pressable onPress={() => remove(f.id)}><Text style={s.cancel}>Annuler</Text></Pressable>
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}

function SmallBtn({ label, onPress, gold }: { label: string; onPress: () => void; gold?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={6}
      style={({ pressed }) => [s.small, gold ? s.smallGold : s.smallGhost, pressed && { opacity: 0.7 }]}>
      <Text style={[s.smallText, { color: gold ? C.goldInk : "rgba(255,255,255,.6)" }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  ok: { color: C.green, fontSize: 12.5, textAlign: "center", marginTop: 8 },
  section: { color: C.gold, fontSize: 10.5, letterSpacing: 1.4, marginBottom: 6 },
  empty: { color: "rgba(255,255,255,.35)", fontStyle: "italic", textAlign: "center", paddingVertical: 10, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 11, borderRadius: 11, marginBottom: 5, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)" },
  rowGold: { backgroundColor: "rgba(232,201,106,.08)", borderColor: "rgba(232,201,106,.25)" },
  who: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { color: "#f3f4f6", fontSize: 14, flexShrink: 1 },
  status: { color: "rgba(255,255,255,.3)", fontSize: 11 },
  btns: { flexDirection: "row", gap: 6, alignItems: "center" },
  small: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 9 },
  smallGold: { backgroundColor: C.gold },
  smallGhost: { backgroundColor: "rgba(255,255,255,.08)", borderWidth: 1, borderColor: "rgba(255,255,255,.15)" },
  smallText: { fontWeight: "800", fontSize: 12 },
  invited: { color: C.green, fontWeight: "800", fontSize: 12, paddingHorizontal: 6 },
  cancel: { color: "rgba(255,255,255,.35)", textDecorationLine: "underline", fontSize: 12 },
});
