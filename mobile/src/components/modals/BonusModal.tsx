import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { API } from "../../lib/config";
import { C } from "../../lib/theme";
import { sfxWin } from "../../lib/sounds";
import { ErrorText, GoldButton, Sheet } from "../ui";

export type BonusInfo = { available: boolean; day: number; rewards: number[] };

export default function BonusModal({ bonus, token, onClaimed, onClose }: {
  bonus: BonusInfo; token: string; onClaimed: (b: number) => void; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [err, setErr] = useState("");
  const rewards = bonus.rewards || [50, 75, 100, 150, 200, 300, 500];

  const claim = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API}/api/bonus/claim`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
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
    <Sheet title="🎁 Récompense quotidienne" onClose={onClose}>
      <Text style={s.intro}>Reviens chaque jour pour faire grimper la récompense. Rate un jour, et la série repart au jour 1 !</Text>
      <View style={s.grid}>
        {rewards.slice(0, 4).map((a, i) => <DayTile key={i} day={i + 1} amount={a} current={bonus.day} claimed={claimed} />)}
      </View>
      <View style={[s.grid, { marginBottom: 14 }]}>
        {rewards.slice(4).map((a, i) => <DayTile key={i + 4} day={i + 5} amount={a} current={bonus.day} claimed={claimed} big={i === 2} />)}
      </View>
      {claimed ? (
        <Text style={s.done}>+{rewards[bonus.day - 1]} 🪙 récupérés !</Text>
      ) : bonus.available ? (
        <GoldButton label={`Récupérer +${rewards[bonus.day - 1]} 🪙`} onPress={claim} busy={busy} />
      ) : (
        <View style={s.already}>
          <Text style={s.alreadyText}>✓ Déjà récupéré — reviens plus tard pour le jour {bonus.day} (+{rewards[bonus.day - 1]} 🪙)</Text>
        </View>
      )}
      <ErrorText>{err}</ErrorText>
    </Sheet>
  );
}

function DayTile({ day, amount, current, claimed, big }: {
  day: number; amount: number; current: number; claimed: boolean; big?: boolean;
}) {
  const isPast = day < current;
  const isCurrent = day === current;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isCurrent || claimed) { pulse.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.55, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isCurrent, claimed, pulse]);
  const check = isPast || (isCurrent && claimed);
  return (
    <Animated.View style={[s.tile,
      isCurrent ? s.tileCur : isPast ? s.tilePast : s.tileFut,
      { opacity: isCurrent ? pulse : isPast ? 0.6 : 0.45 }]}>
      <Text style={[s.day, isCurrent && { color: C.gold }]}>JOUR {day}</Text>
      <Text style={[s.amount, big && { fontSize: 16 }, { color: isCurrent ? C.gold : isPast ? "rgba(52,211,153,.75)" : "rgba(255,255,255,.65)" }]}>
        {check ? "✓" : `${amount} 🪙`}
      </Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  intro: { color: "rgba(52,211,153,.8)", fontSize: 12.5, marginBottom: 14 },
  grid: { flexDirection: "row", gap: 7, marginBottom: 7 },
  tile: { flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: "center", borderWidth: 1 },
  tileCur: { borderColor: C.gold, backgroundColor: "rgba(232,201,106,.15)" },
  tilePast: { borderColor: "rgba(4,120,87,.5)", backgroundColor: "rgba(6,78,59,.2)" },
  tileFut: { borderColor: "rgba(255,255,255,.1)", backgroundColor: "rgba(0,0,0,.25)" },
  day: { fontSize: 9.5, color: "rgba(255,255,255,.5)", letterSpacing: 0.6 },
  amount: { fontWeight: "800", fontSize: 13, marginTop: 2 },
  done: { textAlign: "center", fontWeight: "800", color: C.gold, fontSize: 16, paddingVertical: 8 },
  already: { borderRadius: 12, padding: 12, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)" },
  alreadyText: { textAlign: "center", color: "rgba(255,255,255,.5)", fontWeight: "700", fontSize: 13 },
});
