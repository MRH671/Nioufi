import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { API } from "../../lib/config";
import { CARD_THEMES, TABLE_THEMES } from "../../lib/skins";
import { C } from "../../lib/theme";
import { sfxWin } from "../../lib/sounds";
import CardBack from "../CardBack";
import TableSurface from "../TableSurface";
import { ErrorText, Sheet } from "../ui";

type Skin = { code: string; type: "table" | "cards"; name: string; price: number };
type ShopData = { skins: Skin[]; owned: string[]; equipped: { table: string; cards: string }; balance: number };

export default function ShopModal({ token, onBalance, onEquipped, onClose }: {
  token: string;
  onBalance: (b: number) => void;
  onEquipped: (skins: { table: string; cards: string }) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<ShopData | null>(null);
  const [tab, setTab] = useState<"table" | "cards">("table");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  // ref : évite de recharger la boutique en boucle quand le parent se re-rend
  const equippedCb = useRef(onEquipped);
  equippedCb.current = onEquipped;

  const load = useCallback(() => {
    fetch(`${API}/api/shop`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: ShopData) => { setData(d); equippedCb.current(d.equipped); })
      .catch(() => setErr("Impossible de charger la boutique."));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const post = async (path: string, code: string) => {
    setErr(""); setBusy(code);
    try {
      const r = await fetch(`${API}/api/shop/${path}`, {
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
  const equip = async (code: string) => { if (await post("equip", code)) load(); };

  const skins = data?.skins.filter((x) => x.type === tab) || [];

  return (
    <Sheet title="🛍 Boutique" onClose={onClose}
      right={<Text style={s.balance}>{data?.balance ?? "..."} 🪙</Text>}>
      <Text style={s.intro}>Échange tes jetons contre du style. Chacun voit la table avec son propre thème.</Text>
      <View style={s.tabs}>
        {(["table", "cards"] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && { backgroundColor: C.gold }]}>
            <Text style={[s.tabText, { color: tab === t ? C.goldInk : C.gold }]}>{t === "table" ? "🎨 Tables" : "🂠 Cartes"}</Text>
          </Pressable>
        ))}
      </View>
      <ErrorText>{err}</ErrorText>
      <View style={s.grid}>
        {skins.map((sk) => {
          const owned = sk.price === 0 || (data?.owned.includes(sk.code) ?? false);
          const equipped = data?.equipped[tab] === sk.code;
          const canAfford = (data?.balance ?? 0) >= sk.price;
          const tt = TABLE_THEMES[sk.code];
          const ct = CARD_THEMES[sk.code];
          return (
            <View key={sk.code} style={[s.item, equipped && s.itemOn]}>
              <View style={s.preview}>
                {tt && (
                  <TableSurface theme={tt} code={sk.code}
                    w={sk.code === "boitier" ? 82 : 120} h={sk.code === "boitier" ? 54 : 64} />
                )}
                {ct && (
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {[-8, 0, 8].map((rot, i) => (
                      <View key={i} style={{ transform: [{ rotate: `${rot}deg` }] }}>
                        <CardBack theme={ct} w={30} h={44} />
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <Text style={s.name}>{sk.name}</Text>
              <Text style={s.price}>{sk.price === 0 ? "Gratuit" : `${sk.price} 🪙`}</Text>
              {equipped ? (
                <View style={[s.action, s.actionOn]}><Text style={[s.actionText, { color: C.gold }]}>✓ Équipé</Text></View>
              ) : owned ? (
                <Pressable onPress={() => equip(sk.code)} disabled={busy === sk.code} style={[s.action, { backgroundColor: C.gold }]}>
                  <Text style={[s.actionText, { color: C.goldInk }]}>Équiper</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => buy(sk.code)} disabled={busy === sk.code || !canAfford}
                  style={[s.action, canAfford ? s.actionBuy : s.actionOff]}>
                  <Text style={[s.actionText, { color: canAfford ? C.gold : "rgba(255,255,255,.3)" }]}>
                    {canAfford ? `Acheter · ${sk.price} 🪙` : `${sk.price} 🪙 requis`}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  balance: { color: "rgba(110,231,183,.9)", fontWeight: "800", fontSize: 14 },
  intro: { color: "rgba(52,211,153,.8)", fontSize: 12.5, marginBottom: 12 },
  tabs: { flexDirection: "row", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(232,201,106,.25)", marginBottom: 6 },
  tab: { flex: 1, paddingVertical: 9, alignItems: "center", backgroundColor: "rgba(0,0,0,.3)" },
  tabText: { fontWeight: "800", fontSize: 13.5 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 6 },
  item: { width: "48%", flexGrow: 1, borderRadius: 13, padding: 10, borderWidth: 1, borderColor: "rgba(255,255,255,.1)", backgroundColor: "rgba(255,255,255,.04)", gap: 4 },
  itemOn: { borderColor: C.gold, backgroundColor: "rgba(232,201,106,.1)" },
  preview: { height: 76, borderRadius: 9, backgroundColor: "rgba(0,0,0,.25)", alignItems: "center", justifyContent: "center", marginBottom: 4, overflow: "hidden" },
  name: { color: "#f3f4f6", fontWeight: "800", fontSize: 13 },
  price: { color: "rgba(52,211,153,.75)", fontSize: 11.5 },
  action: { marginTop: 4, borderRadius: 9, paddingVertical: 7, alignItems: "center" },
  actionOn: { backgroundColor: "rgba(232,201,106,.15)", borderWidth: 1, borderColor: "rgba(232,201,106,.4)" },
  actionBuy: { backgroundColor: "rgba(232,201,106,.1)", borderWidth: 1, borderColor: "rgba(232,201,106,.4)" },
  actionOff: { backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)" },
  actionText: { fontWeight: "800", fontSize: 12 },
});
