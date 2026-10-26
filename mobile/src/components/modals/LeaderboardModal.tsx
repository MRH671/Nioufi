import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { API } from "../../lib/config";
import { C } from "../../lib/theme";
import { ErrorText, Sheet } from "../ui";

type Entry = { username: string; balance: number; me: boolean; online: boolean };
const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${API}/api/leaderboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setEntries(d.entries))
      .catch(() => setErr("Impossible de charger le classement."));
  }, [token]);

  return (
    <Sheet title="🏆 Classement" onClose={onClose}>
      <Text style={s.intro}>Toi et tes amis, du plus riche au plus fauché.</Text>
      <ErrorText>{err}</ErrorText>
      {entries === null && !err && <Text style={s.empty}>Chargement...</Text>}
      {entries?.length === 1 && <Text style={s.empty}>Tu es seul au sommet... ajoute des amis pour comparer vos soldes !</Text>}
      {entries?.map((e, i) => (
        <View key={i} style={[s.row, e.me ? s.rowMe : i === 0 ? s.rowFirst : null]}>
          <View style={s.left}>
            <Text style={i < 3 ? s.medal : s.rank}>{i < 3 ? MEDALS[i] : `#${i + 1}`}</Text>
            <View style={[s.dot, { backgroundColor: e.online ? C.green : "rgba(255,255,255,.15)" }]} />
            <Text numberOfLines={1} style={[s.name, e.me && { color: C.gold, fontWeight: "800" }]}>
              {e.username}{e.me ? " (toi)" : ""}
            </Text>
          </View>
          <Text style={[s.bal, { color: i === 0 ? C.gold : "rgba(110,231,183,.9)" }]}>{e.balance.toLocaleString("fr-FR")} 🪙</Text>
        </View>
      ))}
    </Sheet>
  );
}

const s = StyleSheet.create({
  intro: { color: "rgba(52,211,153,.8)", fontSize: 12.5, marginBottom: 12 },
  empty: { color: "rgba(255,255,255,.4)", fontStyle: "italic", textAlign: "center", paddingVertical: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: "rgba(255,255,255,.08)", backgroundColor: "rgba(255,255,255,.04)" },
  rowMe: { backgroundColor: "rgba(232,201,106,.12)", borderColor: "rgba(232,201,106,.45)" },
  rowFirst: { backgroundColor: "rgba(232,201,106,.06)", borderColor: "rgba(232,201,106,.25)" },
  left: { flexDirection: "row", alignItems: "center", gap: 9, flexShrink: 1 },
  medal: { fontSize: 19, width: 28, textAlign: "center" },
  rank: { fontSize: 12.5, width: 28, textAlign: "center", color: "rgba(255,255,255,.4)", fontWeight: "700" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  name: { color: "#f3f4f6", fontSize: 14.5, flexShrink: 1 },
  bal: { fontWeight: "900", fontSize: 14.5 },
});
