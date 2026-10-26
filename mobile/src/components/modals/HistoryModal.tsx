import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { API } from "../../lib/config";
import { C } from "../../lib/theme";
import { ErrorText, Sheet } from "../ui";

type Entry = { delta: number; at: string };

const fmt = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function HistoryModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${API}/api/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setEntries(d.entries); setTotal(d.total); })
      .catch(() => setErr("Impossible de charger l'historique."));
  }, [token]);

  const up = total >= 0;
  return (
    <Sheet title="📜 Historique" onClose={onClose}>
      <View style={[s.total, up ? s.totalUp : s.totalDown]}>
        <Text style={s.totalLabel}>BILAN TOTAL</Text>
        <Text style={[s.totalValue, { color: up ? C.green : C.red }]}>{total > 0 ? "+" : ""}{total} 🪙</Text>
        <Text style={s.totalSub}>{up ? "Tu es en gain 📈" : "Tu es en perte 📉"}</Text>
      </View>
      <ErrorText>{err}</ErrorText>
      {entries === null && !err && <Text style={s.empty}>Chargement...</Text>}
      {entries?.length === 0 && <Text style={s.empty}>Aucune manche jouée avec ce compte pour l'instant.</Text>}
      {entries?.map((e, i) => (
        <View key={i} style={s.row}>
          <Text style={s.date}>{fmt(e.at)}</Text>
          <Text style={[s.delta, { color: e.delta >= 0 ? C.green : C.red }]}>{e.delta > 0 ? "+" : ""}{e.delta} 🪙</Text>
        </View>
      ))}
    </Sheet>
  );
}

const s = StyleSheet.create({
  total: { borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1, marginBottom: 10 },
  totalUp: { backgroundColor: "rgba(6,78,59,.25)", borderColor: "rgba(5,150,105,.4)" },
  totalDown: { backgroundColor: "rgba(127,29,29,.25)", borderColor: "rgba(220,38,38,.4)" },
  totalLabel: { color: "rgba(255,255,255,.5)", fontSize: 10, letterSpacing: 1.5 },
  totalValue: { fontWeight: "900", fontSize: 28 },
  totalSub: { color: "rgba(255,255,255,.4)", fontSize: 11.5 },
  empty: { color: "rgba(255,255,255,.4)", fontStyle: "italic", textAlign: "center", paddingVertical: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.05)" },
  date: { color: "rgba(255,255,255,.45)", fontSize: 13.5 },
  delta: { fontWeight: "800", fontSize: 13.5 },
});
