import { ReactNode, useEffect, useRef, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  type LayoutChangeEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import type { Ack, Card, GameState } from "../lib/types";
import { getSocket } from "../lib/socket";
import { cardTheme, tableTheme } from "../lib/skins";
import { C, DISPLAY } from "../lib/theme";
import { isMuted, setMuted, sfxChip, sfxDeal, sfxFlip, sfxLose, sfxNioufi, sfxWin } from "../lib/sounds";
import PlayingCard from "./PlayingCard";
import TableSurface from "./TableSurface";
import { Chip, Field, GhostButton, GoldButton } from "./ui";

const SEAT_W = 112;

/** Position des sièges autour de la table (toi toujours en bas) */
function seatPosition(index: number, total: number, W: number, H: number) {
  const angle = Math.PI / 2 + (2 * Math.PI * index) / total;
  const x = W / 2 + W * 0.39 * Math.cos(angle);
  const y = H / 2 + H * 0.38 * Math.sin(angle);
  return {
    x: Math.min(W - SEAT_W / 2 - 2, Math.max(SEAT_W / 2 + 2, x)),
    y: Math.min(H - 46, Math.max(46, y)),
  };
}

export default function GameTable({ game, skins, onLeave, onSuggest }: {
  game: GameState;
  skins?: { table: string; cards: string };
  onLeave: () => void;
  onSuggest: () => void;
}) {
  const insets = useSafeAreaInsets();
  const tableCode = skins?.table || "classic";
  const th = tableTheme(tableCode);
  const ct = cardTheme(skins?.cards);
  const socket = getSocket();

  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [ceremonyStep, setCeremonyStep] = useState(-1);
  const [revealStep, setRevealStep] = useState(-1);
  const [peeked, setPeeked] = useState<Record<string, Card>>({});
  const [betInput, setBetInput] = useState("");
  const [betHouse, setBetHouse] = useState<number | null>(null);
  const [cutPos, setCutPos] = useState(20);
  const [nowTs, setNowTs] = useState(Date.now());
  const [toast, setToast] = useState("");
  const [feedOpen, setFeedOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(!isMuted());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const n = game.players.length;
  const gIdx = game.ghostIdx ?? -1;
  type Seat = { name: string; coins: number; connected: boolean; ghost?: boolean };
  const seats: Seat[] = gIdx >= 0
    ? [...game.players, { name: "Maison morte", coins: 0, connected: true, ghost: true }]
    : game.players;
  const total = seats.length;
  const myIdx = game.myIdx;
  const isBank = myIdx === game.bankIdx;

  // Horloge locale pour le compte à rebours
  useEffect(() => {
    const iv = setInterval(() => setNowTs(Date.now()), 1000);
    return () => { clearInterval(iv); timers.current.forEach(clearTimeout); };
  }, []);

  // ── Animation cérémonie (rejouée localement, synchro par timestamp serveur) ──
  useEffect(() => {
    if (game.phase !== "ceremony" || !game.ceremony) return;
    const cer = game.ceremony;
    const compute = () => Math.min(Math.floor((Date.now() - cer.startedAt) / 850), cer.steps.length - 1);
    setCeremonyStep(compute());
    const iv = setInterval(() => {
      const s = compute();
      setCeremonyStep(s);
      if (s >= cer.steps.length - 1) clearInterval(iv);
    }, 200);
    return () => clearInterval(iv);
  }, [game.phase, game.ceremony?.startedAt]);

  // ── Animation retournement ──
  useEffect(() => {
    if (game.phase !== "revealing" || !game.revealAt) { setRevealStep(-1); return; }
    const at = game.revealAt;
    const compute = () => Math.min(Math.floor((Date.now() - at) / 1500), total);
    setRevealStep(compute());
    const iv = setInterval(() => {
      const s = compute();
      setRevealStep(s);
      if (s >= total) clearInterval(iv);
    }, 200);
    return () => clearInterval(iv);
  }, [game.phase, game.revealAt, total]);

  useEffect(() => { setPeeked({}); setBetHouse(null); }, [game.phase]);

  // ── Sons ──
  const totalCards = (game.hands || []).reduce((s, h) => s + h.length, 0);
  const prevCards = useRef(0);
  useEffect(() => {
    if (totalCards > prevCards.current) sfxDeal();
    prevCards.current = totalCards;
  }, [totalCards]);
  useEffect(() => { if (ceremonyStep >= 0) sfxDeal(); }, [ceremonyStep]);
  useEffect(() => {
    if (game.phase === "revealing" && revealStep > 0 && revealStep <= total) sfxFlip();
  }, [revealStep, game.phase, total]);
  const prevBets = useRef(game.bets.length);
  useEffect(() => {
    if (game.bets.length > prevBets.current) sfxChip();
    prevBets.current = game.bets.length;
  }, [game.bets.length]);
  const playedResult = useRef(false);
  useEffect(() => {
    if (game.phase !== "revealing") { playedResult.current = false; return; }
    if (!playedResult.current && revealStep >= total && game.results) {
      playedResult.current = true;
      const mine = game.results[myIdx];
      if (mine?.score === 9) sfxNioufi();
      else if (mine?.role === "bank" ? mine.delta >= 0 : mine?.delta > 0) sfxWin();
      else if (mine && mine.delta < 0) sfxLose();
    }
  }, [revealStep, game.phase, game.results, myIdx, total]);

  const toggleSound = () => { setMuted(soundOn); setSoundOn(!soundOn); };

  const showToast = (msg: string) => {
    setToast(msg);
    timers.current.push(setTimeout(() => setToast(""), 2600));
  };

  // ── Actions ──
  const emit = (event: string, payload?: object) =>
    socket.emit(event, payload || {}, (r: Ack) => { if (!r.ok && r.error) showToast(r.error); });

  const peek = (playerIdx: number, cardIdx: number) => {
    socket.emit("peek", { playerIdx, cardIdx }, (r: Ack) => {
      if (!r.ok) { if (r.error) showToast(r.error); return; }
      sfxFlip();
      const key = `${playerIdx}-${cardIdx}`;
      setPeeked((prev) => ({ ...prev, [key]: r.card! }));
      timers.current.push(setTimeout(() => {
        setPeeked((prev) => { const nx = { ...prev }; delete nx[key]; return nx; });
      }, 2000));
    });
  };

  const canPeek = (playerIdx: number, cardIdx: number) => {
    if (!["betting", "pre_reveal"].includes(game.phase)) return false;
    if (playerIdx === gIdx) return !isBank && cardIdx === 0;
    if (isBank) return playerIdx === game.bankIdx;
    if (playerIdx === game.bankIdx) return false;
    if (playerIdx === myIdx) return true;
    return cardIdx === 0;
  };

  const committed = game.bets.filter((b) => b.bettor === myIdx).reduce((s, b) => s + b.amount, 0);
  const avail = (game.players[myIdx]?.coins ?? 0) - committed;

  const addBet = () => {
    const amount = Math.floor(Number(betInput));
    if (!amount) { showToast("Choisis un montant."); return; }
    emit("placeBet", { house: betHouse ?? myIdx, amount });
    setBetInput("");
  };

  const confirmLeave = () => {
    Alert.alert(
      "Quitter la partie ?",
      "Ton siège restera à la table jusqu'à la fin de la manche.",
      [{ text: "Rester", style: "cancel" }, { text: "Quitter", style: "destructive", onPress: onLeave }],
    );
  };

  // ── Ordre de retournement ──
  const revealOrder: number[] = [];
  if (game.bankIdx !== null) {
    revealOrder.push(game.bankIdx);
    for (let k = 1; k < n; k++) revealOrder.push((game.bankIdx + k) % n);
    if (gIdx >= 0) revealOrder.push(gIdx);
  }
  const isRevealed = (pIdx: number) => game.phase === "revealing" && revealOrder.indexOf(pIdx) < revealStep;
  const allRevealed = game.phase === "revealing" && revealStep >= total;

  // ── Cérémonie : cartes visibles au step courant ──
  const ceremonyCards: (Card | null)[] = Array(n).fill(null);
  if (game.phase === "ceremony" && game.ceremony) {
    for (let i = 0; i <= ceremonyStep && i < game.ceremony.steps.length; i++) {
      const st = game.ceremony.steps[i];
      ceremonyCards[st.pIdx] = st.card;
    }
  }
  const ceremonyDone = game.phase === "ceremony" && !!game.ceremony && ceremonyStep >= game.ceremony.steps.length - 1;
  const lastStep = game.ceremony?.steps[Math.max(0, Math.min(ceremonyStep, (game.ceremony?.steps.length ?? 1) - 1))];
  const pname = (i: number | null | undefined) => (i === gIdx ? "La maison morte" : game.players[i ?? -1]?.name ?? "");

  // ═══ Message central + panneau d'actions selon la phase ═══
  let title = "";
  let msg = "";
  let dim = false;
  let action: ReactNode = null;

  if (game.phase === "ceremony") {
    title = "Désignation de la banque";
    msg = ceremonyStep < 0 ? "Distribution..." :
      ceremonyDone ? `🂡 ${pname(game.bankIdx)} prend la banque ! (${pname(game.cutterIdx)} coupe ✂️)` :
      lastStep?.asNum === 1 ? `🂡 Premier As pour ${pname(lastStep.pIdx)} — il coupera !` :
      `${pname(lastStep?.pIdx ?? 0)} reçoit le ${lastStep?.card.rank}${lastStep?.card.suit}...`;
    if (ceremonyDone) {
      if (isBank) action = <GoldButton label="🂠 Distribuer" onPress={() => emit("startRound")} />;
      else { msg += "\nLa banque va distribuer..."; }
    }
  } else if (game.phase === "cutting") {
    const isCutter = myIdx === game.cutterIdx;
    title = `✂️ Coupe — ${pname(game.cutterIdx)}`;
    msg = isCutter ? "À toi de couper le paquet" : `${pname(game.cutterIdx)} coupe le paquet...`;
    dim = !isCutter;
    if (isCutter) {
      action = (
        <View>
          <View style={st.deck}>
            {Array.from({ length: 40 }, (_, i) => (
              <View key={i} style={{
                width: 5, borderRadius: 1, height: 22 + Math.sin(i * 0.4) * 3,
                backgroundColor: i < cutPos ? "#8d2836" : "#5a1620",
                marginRight: i === cutPos - 1 ? 8 : 1,
                borderRightWidth: i === cutPos - 1 ? 3 : 0, borderRightColor: C.gold,
              }} />
            ))}
          </View>
          <Slider minimumValue={5} maximumValue={35} step={1} value={cutPos}
            onValueChange={(v) => setCutPos(Math.round(v))}
            minimumTrackTintColor={C.gold} maximumTrackTintColor="rgba(255,255,255,.2)" thumbTintColor={C.goldLight} />
          <Text style={st.panelText}>Coupe à la <Text style={{ color: C.gold, fontWeight: "800" }}>{cutPos}</Text>ᵉ carte</Text>
          <GoldButton label="✂️ Couper le paquet" style={{ marginTop: 8 }}
            onPress={() => { sfxFlip(); emit("cutDeck", { pos: cutPos }); }} />
        </View>
      );
    }
  } else if (game.phase === "betting") {
    const isMyTurn = game.betIdx === myIdx;
    title = `Paris — ${pname(game.betIdx)}`;
    msg = isMyTurn ? `À toi de miser ! (${avail} dispo)` : `${pname(game.betIdx)} est en train de miser...`;
    dim = !isMyTurn;
    if (isMyTurn) {
      const houses = game.players.map((p, i) => ({ i, label: i === myIdx ? "🏠 Moi" : p.name }))
        .filter((h) => h.i !== game.bankIdx);
      if (gIdx >= 0) houses.push({ i: gIdx, label: "👻 Maison morte" });
      const target = betHouse ?? myIdx;
      action = (
        <View>
          <Text style={st.panelLabel}>Sur quelle maison ?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.row}>
            {houses.map((h) => <Chip key={h.i} label={h.label} active={target === h.i} onPress={() => setBetHouse(h.i)} />)}
          </ScrollView>
          <Text style={[st.panelLabel, { marginTop: 10 }]}>Combien ? · {avail} 🪙 dispo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.row}>
            {[5, 10, 20, 50, 100].filter((v) => v <= avail).map((v) => (
              <Chip key={v} label={String(v)} active={betInput === String(v)} onPress={() => setBetInput(String(v))} />
            ))}
            {avail > 0 && <Chip label="Tapis" active={betInput === String(avail)} onPress={() => setBetInput(String(avail))} />}
          </ScrollView>
          <View style={[st.row, { marginTop: 10 }]}>
            <Field value={betInput} onChangeText={(t) => setBetInput(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad" placeholder="Montant" maxLength={6}
              grow style={{ textAlign: "center", paddingVertical: 9 }} returnKeyType="done" onSubmitEditing={addBet} />
            <GoldButton small label="Miser" onPress={addBet} />
            <GhostButton small label="Fini ✓" onPress={() => emit("endBettingTurn")} />
          </View>
          <Text style={st.hint}>Tu peux miser plusieurs fois sur plusieurs maisons avant de valider.</Text>
        </View>
      );
    }
  } else if (game.phase === "pre_reveal") {
    title = "Personne ne touche ses cartes";
    msg = isBank ? "À toi de retourner les cartes !" : "La banque va retourner les cartes...";
    dim = !isBank;
    if (isBank) action = <GoldButton label="🔥 Retourner les cartes" onPress={() => emit("reveal")} />;
  } else if (game.phase === "revealing") {
    const bs = game.results?.[game.bankIdx!]?.score;
    const currentIdx = revealStep > 0 && revealStep <= total ? revealOrder[revealStep - 1] : null;
    const cs = currentIdx !== null ? game.results?.[currentIdx]?.score : null;
    title = allRevealed ? "Résultats" : "Retournement...";
    if (!allRevealed && currentIdx !== null) {
      msg = currentIdx === game.bankIdx
        ? `🏦 La banque retourne... ${cs}${cs === 9 ? " !! NIOUFI !" : cs === 0 ? " — bouteille !" : " points. À battre !"}`
        : `${currentIdx === gIdx ? "👻 La maison morte" : pname(currentIdx)}... ${cs}${cs === 9 ? " ⭐ NIOUFI !" : cs === 0 ? " 💀 bouteille" : " pts"}`;
    }
    if (allRevealed) {
      const winners = game.results?.filter((r) => r.win).length ?? 0;
      msg = bs === 9 ? "La banque a fait 9 et rafle tout." :
        winners > 0 ? `${winners} maison(s) bat(tent) la banque !` : "La banque tient bon.";
      if (game.nineWinner === myIdx) {
        action = (
          <View>
            <Text style={st.panelTitle}>⭐ Tu avais misé sur la maison à 9 ! Prendre la banque ?</Text>
            <View style={[st.row, { marginTop: 10 }]}>
              <GoldButton label="Oui, je prends !" style={{ flex: 1 }} onPress={() => emit("decideBank", { takeIt: true })} />
              <GhostButton label="Non" onPress={() => emit("decideBank", { takeIt: false })} />
            </View>
          </View>
        );
      } else if (game.nineWinner >= 0) {
        msg += `\n${pname(game.nineWinner)} décide s'il prend la banque...`;
      } else if (isBank) {
        action = <GoldButton label="🃏 Manche suivante" onPress={() => emit("decideBank", { takeIt: false })} />;
      } else {
        msg += "\nEn attente de la prochaine manche...";
      }
    }
  } else if (game.phase === "between_rounds") {
    title = `${pname(game.bankIdx)} tient la banque`;
    msg = isBank ? "À toi de distribuer !" : "La banque va distribuer...";
    dim = !isBank;
    if (isBank) action = <GoldButton label="🂠 Distribuer" onPress={() => emit("startRound")} />;
  }

  if (!action && ["betting", "pre_reveal"].includes(game.phase)) {
    action = <Text style={st.hint}>👁 Touche une carte dorée pour la regarder (2 s, toi seul la vois)</Text>;
  }

  const remaining = game.deadline ? Math.max(0, Math.ceil((game.deadline - nowTs) / 1000)) : null;
  const showTimer = remaining !== null && ["cutting", "betting", "pre_reveal", "between_rounds"].includes(game.phase);

  const { w: W, h: H } = dims;
  const tw = W * th.widthPct, thh = H * th.heightPct;
  const dark = th.ink === "dark";
  const cardW = total > 8 ? 26 : total > 5 ? 30 : 34;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - W) > 1 || Math.abs(height - H) > 1) setDims({ w: width, h: height });
  };

  // ═══ Rendu ═══
  return (
    <LinearGradient colors={[th.bg1, th.bg2]} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* En-tête */}
        <View style={[st.header, { paddingTop: insets.top + 6 }]}>
          <View>
            <Text style={st.brand}>Nioufi</Text>
            <Text style={st.sub} numberOfLines={1}>
              Table <Text style={st.subGold}>{game.code}</Text> · <Text style={st.subGold}>{game.players[myIdx]?.name}</Text>{isBank ? " 🏦" : ""}
            </Text>
          </View>
          <View style={st.headBtns}>
            <HeadBtn icon={soundOn ? "🔊" : "🔇"} onPress={toggleSound} />
            <HeadBtn icon="💡" onPress={onSuggest} />
            <HeadBtn icon="🚪" onPress={confirmLeave} />
          </View>
        </View>

        {/* Table */}
        <View style={{ flex: 1 }} onLayout={onLayout}>
          {W > 0 && (
            <>
              <View style={{ position: "absolute", left: (W - tw) / 2, top: (H - thh) / 2 }}>
                <TableSurface theme={th} code={tableCode} w={tw} h={thh} />
              </View>

              {/* Centre de la table */}
              <View pointerEvents="none" style={[st.center, { left: (W - tw) / 2, top: (H - thh) / 2, width: tw, height: thh }]}>
                {showTimer && (
                  <View style={[st.timer, remaining! <= 10 && st.timerHot]}>
                    <Text style={[st.timerText, remaining! <= 10 && { color: "#ff9c9c" }]}>⏱ {remaining}s</Text>
                  </View>
                )}
                <View style={[st.centerBox, { maxWidth: Math.min(tw * 0.66, 260) }, th.mat ? { backgroundColor: th.mat } : null]}>
                  {!!title && <Text style={[st.centerTitle, dark && { color: "#6b4d0c" }]} numberOfLines={2}>{title}</Text>}
                  {!!msg && (
                    <Text style={[st.centerMsg,
                      dim ? { color: dark ? "#4f5d4a" : "rgba(125,168,132,.85)" } : { color: dark ? "#2e2e26" : C.cream }]}>
                      {msg}
                    </Text>
                  )}
                </View>
              </View>

              {/* Sièges */}
              {seats.map((p, i) => {
                const pos = seatPosition((i - myIdx + total) % total, total, W, H);
                const isB = i === game.bankIdx;
                const isGhost = i === gIdx;
                const isHi = (game.phase === "betting" && i === game.betIdx) || (game.phase === "cutting" && i === game.cutterIdx);
                const r = (allRevealed || isRevealed(i)) ? game.results?.[i] : null;
                const hand = game.hands?.[i] || [];
                const houseBets = game.bets.filter((b) => b.house === i);
                const houseTotal = houseBets.reduce((s, b) => s + b.amount, 0);
                // Hauteur du bloc siège : cartes + plaque (+ mises, + score) → toujours entièrement visible
                const cardH = Math.round(cardW * 1.45);
                const blockH = cardH + 38 + (houseTotal > 0 ? 34 : 0) + (r ? 18 : 0);
                const top = Math.min(H - blockH - 2, Math.max(2, pos.y - cardH - 6));
                return (
                  <View key={i} style={[st.seat, { left: pos.x - SEAT_W / 2, top }]}>
                    <View style={[st.cards, isHi && st.hiCards]}>
                      {game.phase === "ceremony" && ceremonyCards[i] && (
                        <PlayingCard card={ceremonyCards[i]} faceUp w={cardW} back={ct} highlight={ceremonyCards[i]!.rank === "A"} />
                      )}
                      {game.phase !== "ceremony" && hand.map((card, ci) => {
                        const peekedCard = peeked[`${i}-${ci}`];
                        const shown = card ?? peekedCard ?? null;
                        return (
                          <PlayingCard key={ci} card={shown} w={cardW} back={ct}
                            faceUp={!!shown && (game.phase !== "revealing" || isRevealed(i) || allRevealed || !!peekedCard)}
                            peekable={canPeek(i, ci)} onPeek={() => peek(i, ci)}
                            delayIn={ci * 160} highlight={r?.score === 9} />
                        );
                      })}
                    </View>

                    <View style={[st.plate,
                      isB ? st.plateBank : isGhost ? st.plateGhost : i === myIdx ? st.plateMe : null,
                      !p.connected && { opacity: 0.5 }, isHi && st.plateHi]}>
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[st.plateName, isB && { color: C.gold }, isGhost && st.ghostName]}>
                        {isB ? "🏦 " : ""}{isGhost ? "👻 " : ""}{i === game.cutterIdx && !isB && !isGhost ? "✂️ " : ""}{p.name}{i === myIdx ? " ●" : ""}{!p.connected ? " ⚡" : ""}
                      </Text>
                      {!isGhost && (
                        <Text style={st.plateCoins}>
                          {p.coins} 🪙
                          {r && <Text style={{ color: r.delta >= 0 ? C.green : C.red, fontWeight: "800" }}> {r.delta > 0 ? "+" : ""}{r.delta}</Text>}
                        </Text>
                      )}
                    </View>

                    {houseTotal > 0 && (
                      <View style={{ alignItems: "center" }}>
                        <View style={st.chipBet}><Text style={st.chipBetText}>{houseTotal}</Text></View>
                        <Text style={st.betNames} numberOfLines={2}>
                          {houseBets.map((b, k) => `${b.bettor === i ? "lui" : game.players[b.bettor]?.name.slice(0, 8)} ${b.amount}${k < houseBets.length - 1 ? " · " : ""}`).join("")}
                        </Text>
                      </View>
                    )}

                    {r && (
                      <Text style={[st.score, { color: r.score === 9 ? "#fde047" : r.score === 0 ? C.red : "#d1fae5" }]}>
                        {r.score} pt{r.score > 1 ? "s" : ""}{r.score === 9 ? " ⭐" : r.score === 0 ? " 💀" : ""}
                      </Text>
                    )}
                  </View>
                );
              })}

              {!!toast && (
                <View style={st.toast} pointerEvents="none"><Text style={st.toastText}>{toast}</Text></View>
              )}
            </>
          )}
        </View>

        {/* Fil d'activité */}
        <Pressable onPress={() => setFeedOpen(!feedOpen)} style={st.feed}>
          <View style={st.feedHead}>
            <Text style={st.feedLabel}>AUTOUR DE LA TABLE</Text>
            <Text style={st.feedLabel}>{feedOpen ? "▾" : "▸"}</Text>
          </View>
          {game.feed.length === 0
            ? <Text style={[st.feedLine, { color: "rgba(255,255,255,.25)", fontStyle: "italic" }]}>Rien pour l'instant...</Text>
            : game.feed.slice(0, feedOpen ? 10 : 2).map((e, k) => (
              <Text key={e.t + "-" + k} numberOfLines={feedOpen ? 3 : 1}
                style={[st.feedLine, { color: k === 0 ? C.creamDim : "rgba(255,255,255,.42)" }]}>{e.msg}</Text>
            ))}
        </Pressable>

        {/* Panneau d'actions */}
        {action && (
          <View style={[st.panel, { paddingBottom: Math.max(insets.bottom, 10) + 4 }]}>{action}</View>
        )}
        {!action && <View style={{ height: Math.max(insets.bottom, 8) }} />}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function HeadBtn({ icon, onPress }: { icon: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [st.headBtn, pressed && { opacity: 0.6 }]}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingBottom: 4 },
  brand: { fontFamily: DISPLAY, fontSize: 22, color: C.gold },
  sub: { color: "rgba(110,231,160,.75)", fontSize: 11.5 },
  subGold: { color: C.gold, fontWeight: "700" },
  headBtns: { flexDirection: "row", gap: 6 },
  headBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.3)", borderWidth: 1, borderColor: "rgba(232,201,106,.2)" },

  center: { position: "absolute", alignItems: "center", justifyContent: "center" },
  centerBox: { alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  centerTitle: { fontFamily: DISPLAY, fontSize: 16, color: C.gold, textAlign: "center", marginBottom: 3 },
  centerMsg: { fontFamily: DISPLAY, fontStyle: "italic", fontSize: 13, lineHeight: 18, textAlign: "center" },
  timer: { position: "absolute", top: "10%", paddingHorizontal: 12, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(0,0,0,.42)", borderWidth: 1, borderColor: "rgba(232,201,106,.3)" },
  timerHot: { backgroundColor: "rgba(180,40,40,.4)", borderColor: "rgba(224,80,80,.7)" },
  timerText: { color: C.gold, fontWeight: "800", fontSize: 12.5, fontVariant: ["tabular-nums"] },

  seat: { position: "absolute", width: SEAT_W, alignItems: "center", gap: 2 },
  cards: { flexDirection: "row", gap: 2, alignItems: "flex-end" },
  hiCards: { shadowColor: C.gold, shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  plate: { maxWidth: SEAT_W, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(0,0,0,.62)", borderWidth: 1, borderColor: "rgba(255,255,255,.15)", alignItems: "center" },
  plateBank: { backgroundColor: "#4a3b0c", borderColor: C.gold },
  plateGhost: { backgroundColor: "rgba(0,0,0,.4)", borderStyle: "dashed", borderColor: "rgba(255,255,255,.3)" },
  plateMe: { borderColor: "rgba(232,201,106,.55)" },
  plateHi: { borderColor: C.gold, borderWidth: 2 },
  plateName: { color: "#f3f4f6", fontWeight: "700", fontSize: 11 },
  ghostName: { color: "rgba(255,255,255,.7)", fontStyle: "italic" },
  plateCoins: { color: "rgba(110,231,160,.9)", fontSize: 10 },
  chipBet: { minWidth: 26, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: "#b03434", borderWidth: 2, borderStyle: "dashed", borderColor: "rgba(255,255,255,.6)", alignItems: "center" },
  chipBetText: { color: "#fff", fontWeight: "900", fontSize: 10 },
  betNames: { color: "#c9a86a", fontSize: 8.5, textAlign: "center", maxWidth: SEAT_W },
  score: { fontFamily: DISPLAY, fontWeight: "800", fontSize: 12 },

  toast: { position: "absolute", top: 4, alignSelf: "center", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(127,29,29,.9)", borderWidth: 1, borderColor: "rgba(239,68,68,.5)" },
  toastText: { color: "#fee2e2", fontSize: 12.5 },

  feed: { marginHorizontal: 10, marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "rgba(0,0,0,.38)", borderWidth: 1, borderColor: "rgba(232,201,106,.1)" },
  feedHead: { flexDirection: "row", justifyContent: "space-between" },
  feedLabel: { color: "rgba(110,231,160,.7)", fontSize: 9, letterSpacing: 1.4, marginBottom: 2 },
  feedLine: { fontSize: 12, lineHeight: 17 },

  panel: { paddingHorizontal: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(232,201,106,.2)", backgroundColor: "rgba(6,12,8,.92)" },
  panelLabel: { color: C.gold, fontSize: 10.5, letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 6 },
  panelTitle: { color: C.cream, fontFamily: DISPLAY, fontSize: 15, textAlign: "center" },
  panelText: { color: C.cream, textAlign: "center", fontFamily: DISPLAY, fontStyle: "italic", fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 7 },
  hint: { color: "rgba(255,255,255,.4)", fontSize: 11.5, textAlign: "center", marginTop: 8, marginBottom: 2 },
  deck: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", height: 34, marginBottom: 2 },
});
