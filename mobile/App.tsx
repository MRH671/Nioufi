import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import type { Ack, GameState } from "./src/lib/types";
import { API } from "./src/lib/config";
import { getPlayerKey, getSocket, loadPlayerKey } from "./src/lib/socket";
import { store, tokenStore } from "./src/lib/storage";
import { C, DISPLAY } from "./src/lib/theme";
import GameTable from "./src/components/GameTable";
import { ErrorText, Field, GhostButton, GoldButton, Label, Muted, Title } from "./src/components/ui";
import BonusModal, { type BonusInfo } from "./src/components/modals/BonusModal";
import HistoryModal from "./src/components/modals/HistoryModal";
import TutorialModal from "./src/components/modals/TutorialModal";
import FriendsModal from "./src/components/modals/FriendsModal";
import LeaderboardModal from "./src/components/modals/LeaderboardModal";
import ShopModal from "./src/components/modals/ShopModal";
import SuggestionModal from "./src/components/modals/SuggestionModal";
import WelcomeModal from "./src/components/modals/WelcomeModal";

type Rescue = { available: boolean; reason?: string; readyAt?: number; amount?: number };
type Skins = { table: string; cards: string };
type ModalName = "history" | "tutorial" | "friends" | "leaderboard" | "shop" | "suggestion" | "welcome" | null;

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [game, setGame] = useState<GameState | null>(null);
  const [tab, setTab] = useState<"guest" | "account">("guest");
  const [myName, setMyName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [bonusInfo, setBonusInfo] = useState<BonusInfo | null>(null);
  const [rescue, setRescue] = useState<Rescue | null>(null);
  const [rescueMsg, setRescueMsg] = useState("");
  const [modal, setModal] = useState<ModalName>(null);
  const [mySkins, setMySkins] = useState<Skins>({ table: "classic", cards: "cards-classic" });
  const [invite, setInvite] = useState<{ from: string; code: string } | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  // Valeurs lues par les callbacks socket (évite les closures périmées)
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  // ── Démarrage : clé invité, nom, session, message de bienvenue ──
  useEffect(() => {
    (async () => {
      await loadPlayerKey();
      const [savedName, savedToken, welcomed] = await Promise.all([
        store.get("nioufi_name"), tokenStore.get(), store.get("nioufi_welcome"),
      ]);
      if (savedName) setMyName(savedName);
      if (!welcomed) setModal("welcome");
      if (savedToken) {
        setToken(savedToken);
        setTab("account");
        loadProfile(savedToken);
      }
      setReady(true);
    })();
  }, []);

  const loadProfile = (tok: string) => {
    fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${tok}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setUsername(d.username); setBalance(d.balance);
        if (d.bonus?.available) setBonusInfo(d.bonus);
        setRescue(d.rescue || null);
        if (d.skins) setMySkins(d.skins);
      })
      .catch(() => { tokenStore.del(); setToken(null); });
  };

  // ── Socket : état de la table, invitations, reconnexion ──
  const rejoin = useCallback(async () => {
    const savedRoom = await store.get("nioufi_room");
    const tok = tokenRef.current;
    const name = await store.get("nioufi_name");
    const payload = tok ? { token: tok } : name ? { key: getPlayerKey(), name } : null;
    if (!savedRoom || !payload) return;
    getSocket().emit("joinRoom", { ...payload, code: savedRoom }, (r: Ack) => {
      if (!r.ok) { store.del("nioufi_room"); setGame(null); }
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const socket = getSocket();
    const onConnect = () => {
      setConnected(true);
      const tok = tokenRef.current;
      if (tok) socket.emit("identify", { token: tok });
      rejoin(); // retour à la table après une coupure / mise en veille
    };
    const onDisconnect = () => setConnected(false);
    const onState = (s: GameState) => setGame(s);
    const onInvite = (inv: { from: string; code: string }) => setInvite(inv);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("state", onState);
    socket.on("invite", onInvite);
    if (socket.connected) onConnect();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("state", onState);
      socket.off("invite", onInvite);
    };
  }, [ready, rejoin]);

  // Présence en ligne dès qu'on a une session
  useEffect(() => {
    if (token && connected) getSocket().emit("identify", { token });
  }, [token, connected]);

  // ── Compte ──
  const authRequest = async (path: "register" | "login") => {
    setErr(""); setBusy(true);
    try {
      const r = await fetch(`${API}/api/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Erreur."); return; }
      setToken(d.token);
      setBalance(d.balance);
      setUsername(d.username);
      setPassword("");
      if (d.bonus?.available) setBonusInfo(d.bonus);
      await tokenStore.set(d.token);
      loadProfile(d.token);
    } catch {
      setErr("Serveur injoignable.");
    } finally { setBusy(false); }
  };

  const claimRescue = async () => {
    if (!token) return;
    setRescueMsg("");
    try {
      const r = await fetch(`${API}/api/rescue/claim`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (!r.ok) { setRescueMsg(d.error || "Recharge indisponible."); return; }
      setBalance(d.balance);
      setRescue(null);
      setRescueMsg(`🆘 +${d.amount} jetons ! Retourne à la table.`);
    } catch { setRescueMsg("Serveur injoignable."); }
  };

  const openBonus = async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (r.ok && d.bonus) { setBalance(d.balance); setBonusInfo(d.bonus); }
    } catch { /* silencieux */ }
  };

  const logout = () => {
    tokenStore.del();
    setToken(null); setBalance(null); setPassword("");
  };

  // ── Créer / rejoindre / quitter ──
  const identityPayload = () => {
    if (tab === "account" && token) return { token };
    if (tab === "account") { setErr("Connecte-toi d'abord (ou passe en invité)."); return null; }
    if (!myName.trim()) { setErr("Entre ton nom d'abord."); return null; }
    store.set("nioufi_name", myName.trim());
    return { key: getPlayerKey(), name: myName.trim() };
  };

  const create = () => {
    const p = identityPayload();
    if (!p) return;
    setErr("");
    getSocket().emit("createRoom", p, (r: Ack) => {
      if (!r.ok) setErr(r.error || "Erreur inconnue.");
      else if (r.code) store.set("nioufi_room", r.code);
    });
  };

  const join = (codeArg?: string) => {
    const p = identityPayload();
    if (!p) return;
    const code = (codeArg ?? joinCode).trim().toUpperCase();
    if (code.length !== 4) { setErr("Le code fait 4 caractères."); return; }
    setErr("");
    getSocket().emit("joinRoom", { ...p, code }, (r: Ack) => {
      if (!r.ok) setErr(r.error || "Erreur inconnue.");
      else if (r.code) store.set("nioufi_room", r.code);
      setInvite(null);
    });
  };

  const leaveTable = () => {
    getSocket().emit("leaveRoom", {}, () => {});
    store.del("nioufi_room");
    setGame(null);
    if (token) loadProfile(token); // solde à jour après la partie
  };

  const closeWelcome = (openSuggestion: boolean) => {
    store.set("nioufi_welcome", "1");
    setModal(openSuggestion ? "suggestion" : null);
  };

  const onEquipped = useCallback((s: Skins) => setMySkins(s), []);
  const onBalance = useCallback((b: number) => setBalance(b), []);
  const close = () => setModal(null);

  // ── Pop-ups ──
  const modals = (
    <>
      {bonusInfo && token && (
        <BonusModal bonus={bonusInfo} token={token} onClaimed={onBalance} onClose={() => setBonusInfo(null)} />
      )}
      {modal === "welcome" && <WelcomeModal onClose={closeWelcome} />}
      {modal === "history" && token && <HistoryModal token={token} onClose={close} />}
      {modal === "tutorial" && <TutorialModal onClose={close} />}
      {modal === "suggestion" && <SuggestionModal token={token} onClose={close} />}
      {modal === "shop" && token && <ShopModal token={token} onBalance={onBalance} onEquipped={onEquipped} onClose={close} />}
      {modal === "leaderboard" && token && <LeaderboardModal token={token} onClose={close} />}
      {modal === "friends" && token && <FriendsModal token={token} inviteMode={game?.phase === "lobby"} onClose={close} />}
    </>
  );

  const inviteToast = invite && (
    <View style={[s.invite, { bottom: insets.bottom + 16 }]}>
      <Text style={s.inviteText}>🃏 {invite.from} t'invite à sa table !</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <GoldButton small label={`Rejoindre (${invite.code})`} style={{ flex: 1 }} onPress={() => join(invite.code)} />
        <GhostButton small label="Ignorer" onPress={() => setInvite(null)} />
      </View>
    </View>
  );

  if (!ready) return <LinearGradient colors={["#1e3324", C.bg]} style={{ flex: 1 }} />;

  // ── En jeu ──
  if (game && game.phase !== "lobby") {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <GameTable game={game} skins={mySkins} onLeave={leaveTable} onSuggest={() => setModal("suggestion")} />
        {modals}
        {inviteToast}
      </View>
    );
  }

  // ── Lobby ──
  if (game) {
    return (
      <LinearGradient colors={["#1e3324", C.bg]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 30 }]}>
          <Title size={34} style={{ textAlign: "center" }}>Table ouverte</Title>
          <Text style={s.subtitle}>Partage ce code avec les autres joueurs :</Text>
          <View style={s.codeBox}><Text style={s.code}>{game.code}</Text></View>

          <View style={s.card}>
            <Label>Joueurs à table ({game.players.length}/13)</Label>
            {game.players.map((p, i) => (
              <View key={i} style={[s.player, i === game.myIdx && s.playerMe]}>
                <Text style={s.playerName}>{p.name}{i === 0 ? " 👑" : ""}{i === game.myIdx ? " (toi)" : ""}</Text>
                <Text style={s.playerCoins}>{p.coins} 🪙</Text>
              </View>
            ))}
            {game.isHost ? (
              <GoldButton style={{ marginTop: 16 }} disabled={game.players.length < 2}
                label={game.players.length < 2 ? "En attente de joueurs..." : "🂡 Lancer la désignation de la banque"}
                onPress={() => getSocket().emit("startCeremony", {}, (r: Ack) => !r.ok && setErr(r.error || ""))} />
            ) : (
              <Text style={s.waiting}>En attente que {game.players[0]?.name} lance la partie...</Text>
            )}
            {token && <GhostButton tone="gold" label="👥 Inviter des amis" style={{ marginTop: 10 }} onPress={() => setModal("friends")} />}
            <GhostButton tone="muted" label="🚪 Quitter la table" style={{ marginTop: 8 }} onPress={leaveTable} />
            <ErrorText>{err}</ErrorText>
          </View>
        </ScrollView>
        {modals}
        {inviteToast}
      </LinearGradient>
    );
  }

  // ── Accueil ──
  return (
    <LinearGradient colors={["#1e3324", C.bg]} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.screen, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 30 }]}>
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <Text style={s.logo}>Nioufi</Text>
            <Text style={s.tagline}>— chacun son téléphone, une seule table —</Text>
          </View>

          <View style={s.card}>
            <View style={s.tabs}>
              {(["guest", "account"] as const).map((t) => (
                <Pressable key={t} onPress={() => { setTab(t); setErr(""); }} style={[s.tab, tab === t && { backgroundColor: C.gold }]}>
                  <Text style={[s.tabText, { color: tab === t ? C.goldInk : C.gold }]}>{t === "guest" ? "🎭 Invité" : "👤 Compte"}</Text>
                </Pressable>
              ))}
            </View>

            {tab === "guest" && (
              <>
                <Label>Ton nom</Label>
                <Field value={myName} onChangeText={setMyName} maxLength={16} placeholder="Ex : Merah" autoCorrect={false} />
                <Muted style={{ marginTop: 6 }}>100 jetons par partie, non conservés.</Muted>
              </>
            )}

            {tab === "account" && !token && (
              <>
                <Label>Pseudo</Label>
                <Field value={username} onChangeText={setUsername} maxLength={20} placeholder="Pseudo"
                  autoCapitalize="none" autoCorrect={false} textContentType="username" autoComplete="username" />
                <View style={{ height: 12 }} />
                <Label>Mot de passe</Label>
                <Field value={password} onChangeText={setPassword} placeholder="••••••" secureTextEntry
                  textContentType="password" autoComplete="password" returnKeyType="go" onSubmitEditing={() => authRequest("login")} />
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <GoldButton label="Se connecter" busy={busy} style={{ flex: 1 }} onPress={() => authRequest("login")} />
                  <GhostButton label="Créer un compte" disabled={busy} style={{ flex: 1 }} onPress={() => authRequest("register")} />
                </View>
                <Muted style={{ marginTop: 8 }}>500 jetons offerts à l'inscription. Ton solde est conservé.</Muted>
              </>
            )}

            {tab === "account" && token && (
              <>
                <View style={s.account}>
                  <View>
                    <Text style={s.accountName}>👤 {username}</Text>
                    <Text style={s.accountBal}>{balance ?? "..."} 🪙</Text>
                  </View>
                  <Pressable onPress={logout} hitSlop={8}><Text style={s.logout}>Déconnexion</Text></Pressable>
                </View>

                {balance === 0 && rescue && (
                  <View style={s.rescue}>
                    {rescue.available ? (
                      <>
                        <Text style={s.rescueText}>Plus un jeton en poche ?</Text>
                        <GoldButton small label={`🆘 Recharge de secours : +${rescue.amount ?? 100} 🪙`} onPress={claimRescue} />
                      </>
                    ) : rescue.reason === "cooldown" && rescue.readyAt ? (
                      <Text style={s.rescueText}>🆘 Prochaine recharge de secours à <Text style={{ color: C.gold, fontWeight: "800" }}>
                        {new Date(rescue.readyAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</Text></Text>
                    ) : null}
                  </View>
                )}
                {!!rescueMsg && <Text style={s.rescueMsg}>{rescueMsg}</Text>}

                <View style={s.grid}>
                  <GhostButton small tone="gold" label="🎁 Bonus" style={s.gridBtn} onPress={openBonus} />
                  <GhostButton small tone="gold" label="📜 Historique" style={s.gridBtn} onPress={() => setModal("history")} />
                  <GhostButton small tone="gold" label="👥 Amis" style={s.gridBtn} onPress={() => setModal("friends")} />
                  <GhostButton small tone="gold" label="🏆 Classement" style={s.gridBtn} onPress={() => setModal("leaderboard")} />
                </View>
                <GoldButton small label="🛍 Boutique de skins" style={{ marginTop: 8 }} onPress={() => setModal("shop")} />
              </>
            )}

            <GoldButton label="♠ Créer une table" style={{ marginTop: 18 }} onPress={create} />

            <View style={s.or}>
              <View style={s.orLine} /><Text style={s.orText}>OU</Text><View style={s.orLine} />
            </View>

            <Label>Code de la table</Label>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Field value={joinCode} onChangeText={(t) => setJoinCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                maxLength={4} placeholder="ABCD" autoCapitalize="characters" autoCorrect={false}
                grow style={s.codeInput} returnKeyType="go" onSubmitEditing={() => join()} />
              <GhostButton label="Rejoindre" onPress={() => join()} />
            </View>

            <ErrorText>{err}</ErrorText>

            <GhostButton small label="❓ Tutoriel — apprendre les règles" style={{ marginTop: 18 }} onPress={() => setModal("tutorial")} />
            <GhostButton small tone="gold" label="💡 Une idée, un bug ? Dis-nous tout" style={{ marginTop: 8 }} onPress={() => setModal("suggestion")} />

            <View style={[s.status]}>
              <Text style={{ color: connected ? C.green : "#eab308", fontSize: 11.5 }}>
                {connected ? "✓ Connecté au serveur" : "Connexion au serveur..."}
              </Text>
            </View>
          </View>
          <Text style={s.legal}>Jetons 100 % virtuels — aucun argent réel ne peut être misé ni gagné.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
      {modals}
      {inviteToast}
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  screen: { paddingHorizontal: 18, alignItems: "stretch", maxWidth: 460, width: "100%", alignSelf: "center" },
  logo: {
    fontFamily: DISPLAY, color: C.gold, fontSize: 64,
    textShadowColor: "rgba(232,201,106,.35)", textShadowRadius: 22, textShadowOffset: { width: 0, height: 0 },
  },
  tagline: { fontFamily: DISPLAY, fontStyle: "italic", color: "rgba(52,211,153,.85)", fontSize: 14, marginTop: -2 },
  card: { borderRadius: 20, padding: 18, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(232,201,106,.2)" },
  tabs: { flexDirection: "row", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(232,201,106,.25)", marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: "rgba(0,0,0,.3)" },
  tabText: { fontWeight: "800", fontSize: 14 },
  account: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 13, padding: 13, backgroundColor: "rgba(232,201,106,.1)", borderWidth: 1, borderColor: "rgba(232,201,106,.4)" },
  accountName: { color: C.gold, fontWeight: "800", fontSize: 16 },
  accountBal: { color: "rgba(52,211,153,.9)", fontSize: 14, marginTop: 2 },
  logout: { color: "rgba(255,255,255,.5)", fontSize: 12.5, textDecorationLine: "underline" },
  rescue: { marginTop: 9, borderRadius: 13, padding: 12, backgroundColor: "rgba(127,29,29,.2)", borderWidth: 1, borderColor: "rgba(239,68,68,.35)", gap: 8 },
  rescueText: { color: "#fecaca", fontSize: 13, textAlign: "center" },
  rescueMsg: { color: C.gold, fontWeight: "800", textAlign: "center", marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 9 },
  gridBtn: { width: "48%", flexGrow: 1 },
  or: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,.1)" },
  orText: { color: "rgba(52,211,153,.8)", fontSize: 11 },
  codeInput: { textAlign: "center", fontWeight: "900", letterSpacing: 6, fontSize: 18 },
  status: { marginTop: 14, borderRadius: 9, paddingVertical: 7, alignItems: "center", backgroundColor: "rgba(0,0,0,.25)" },
  legal: { color: "rgba(255,255,255,.28)", fontSize: 11, textAlign: "center", marginTop: 16 },
  subtitle: { color: "rgba(52,211,153,.9)", textAlign: "center", marginTop: 4, marginBottom: 14 },
  codeBox: { alignSelf: "center", paddingHorizontal: 28, paddingVertical: 10, borderRadius: 18, backgroundColor: "rgba(0,0,0,.4)", borderWidth: 2, borderColor: "rgba(232,201,106,.4)", marginBottom: 22 },
  code: { fontFamily: DISPLAY, fontSize: 50, fontWeight: "900", color: C.goldLight, letterSpacing: 14, marginRight: -14 },
  player: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 13, borderRadius: 12, marginBottom: 6, backgroundColor: "rgba(255,255,255,.05)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)" },
  playerMe: { backgroundColor: "rgba(232,201,106,.1)", borderColor: "rgba(232,201,106,.4)" },
  playerName: { color: "#f3f4f6", fontSize: 14.5 },
  playerCoins: { color: "rgba(52,211,153,.9)", fontSize: 14 },
  waiting: { color: "rgba(52,211,153,.9)", fontStyle: "italic", textAlign: "center", marginTop: 16 },
  invite: { position: "absolute", left: 16, right: 16, borderRadius: 18, padding: 14, backgroundColor: "#16291b", borderWidth: 1, borderColor: "rgba(232,201,106,.5)", shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 16, elevation: 10 },
  inviteText: { color: C.gold, fontWeight: "800", fontSize: 14.5, marginBottom: 10 },
});
