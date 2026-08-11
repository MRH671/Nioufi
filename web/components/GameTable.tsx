"use client";
import { useEffect, useRef, useState } from "react";
import type { GameState, Ack, Card } from "@/lib/types";
import { getSocket } from "@/lib/socket";
import PlayingCard from "./PlayingCard";
import { sfxDeal, sfxFlip, sfxChip, sfxWin, sfxLose, sfxNioufi, setMuted, isMuted } from "@/lib/sounds";
import { tableTheme, cardTheme } from "@/lib/skins";

// ─── Position des sièges (toi toujours en bas) ────────────────────────────────
function seatPosition(index: number, total: number, W: number, H: number) {
  const angle = Math.PI / 2 + (2 * Math.PI * index) / total;
  return { x: W / 2 + W * 0.4 * Math.cos(angle), y: H / 2 + H * 0.38 * Math.sin(angle) };
}

export default function GameTable({ game, skins, onLeave }: { game: GameState; skins?: { table: string; cards: string }; onLeave?: () => void }) {
  const th = tableTheme(skins?.table);
  const ct = cardTheme(skins?.cards);
  const socket = getSocket();
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 400, h: 560 });
  const [ceremonyStep, setCeremonyStep] = useState(-1);
  const [revealStep, setRevealStep] = useState(-1);
  const [peeked, setPeeked] = useState<Record<string, Card>>({});
  const [betInput, setBetInput] = useState("");
  const [betHouse, setBetHouse] = useState<number | null>(null);
  const [cutPos, setCutPos] = useState(20);
  const [nowTs, setNowTs] = useState(Date.now());
  const [toast, setToast] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const n = game.players.length;
  const myIdx = game.myIdx;
  const isBank = myIdx === game.bankIdx;

  // Horloge locale pour le compte à rebours
  useEffect(() => {
    const iv = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const update = () => ref.current && setDims({ w: ref.current.clientWidth, h: ref.current.clientHeight });
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // ── Animation cérémonie (rejouée localement, synchro par timestamp serveur) ──
  useEffect(() => {
    if (game.phase !== "ceremony" || !game.ceremony) return;
    const stepDur = 850;
    const compute = () => Math.min(
      Math.floor((Date.now() - game.ceremony!.startedAt) / stepDur),
      game.ceremony!.steps.length - 1
    );
    setCeremonyStep(compute());
    const iv = setInterval(() => {
      const s = compute();
      setCeremonyStep(s);
      if (s >= game.ceremony!.steps.length - 1) clearInterval(iv);
    }, 200);
    return () => clearInterval(iv);
  }, [game.phase, game.ceremony?.startedAt]);

  // ── Animation retournement ──
  useEffect(() => {
    if (game.phase !== "revealing" || !game.revealAt) { setRevealStep(-1); return; }
    const stepDur = 1500;
    const compute = () => Math.min(Math.floor((Date.now() - game.revealAt!) / stepDur), n);
    setRevealStep(compute());
    const iv = setInterval(() => {
      const s = compute();
      setRevealStep(s);
      if (s >= n) clearInterval(iv);
    }, 200);
    return () => clearInterval(iv);
  }, [game.phase, game.revealAt, n]);

  // Nettoyage des peeks quand on change de phase
  useEffect(() => { setPeeked({}); }, [game.phase]);

  // ── Sons ──
  const [soundOn, setSoundOn] = useState(true);
  const toggleSound = () => { setMuted(soundOn); setSoundOn(!soundOn); };

  // Carte distribuée (nombre total de cartes qui augmente) + cérémonie
  const totalCards = (game.hands || []).reduce((s, h) => s + h.length, 0);
  const prevCards = useRef(0);
  useEffect(() => {
    if (totalCards > prevCards.current && prevCards.current >= 0) sfxDeal();
    prevCards.current = totalCards;
  }, [totalCards]);
  useEffect(() => { if (ceremonyStep >= 0) sfxDeal(); }, [ceremonyStep]);

  // Retournement : un flip par étape de révélation
  useEffect(() => { if (game.phase === "revealing" && revealStep > 0 && revealStep <= n) sfxFlip(); }, [revealStep, game.phase, n]);

  // Mise posée
  const prevBets = useRef(0);
  useEffect(() => {
    if (game.bets.length > prevBets.current) sfxChip();
    prevBets.current = game.bets.length;
  }, [game.bets.length]);

  // Fin de manche : son selon MON résultat
  const playedResult = useRef(false);
  useEffect(() => {
    if (game.phase !== "revealing") { playedResult.current = false; return; }
    if (!playedResult.current && revealStep >= n && game.results) {
      playedResult.current = true;
      const mine = game.results[myIdx];
      if (mine?.score === 9) sfxNioufi();
      else if (mine?.role === "bank" ? mine.delta >= 0 : mine?.win) sfxWin();
      else sfxLose();
    }
  }, [revealStep, game.phase, game.results, myIdx, n]);

  const showToast = (msg: string) => {
    setToast(msg);
    timers.current.push(setTimeout(() => setToast(""), 2500));
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
    if (isBank) return playerIdx === game.bankIdx;
    if (playerIdx === game.bankIdx) return false;
    if (playerIdx === myIdx) return true;
    return cardIdx === 0;
  };

  const addBet = () => {
    const amount = Math.floor(Number(betInput));
    if (!amount) return;
    emit("placeBet", { house: betHouse ?? myIdx, amount });
    setBetInput("");
    setBetHouse(null);
  };

  // ── Ordre de retournement ──
  const revealOrder: number[] = [];
  if (game.bankIdx !== null) {
    revealOrder.push(game.bankIdx);
    for (let k = 1; k < n; k++) revealOrder.push((game.bankIdx + k) % n);
  }
  const isRevealed = (pIdx: number) =>
    game.phase === "revealing" && revealOrder.indexOf(pIdx) < revealStep;
  const allRevealed = game.phase === "revealing" && revealStep >= n;

  // ── Cérémonie : cartes visibles au step courant ──
  const ceremonyCards: (Card | null)[] = Array(n).fill(null);
  if (game.phase === "ceremony" && game.ceremony) {
    for (let i = 0; i <= ceremonyStep && i < game.ceremony.steps.length; i++) {
      const s = game.ceremony.steps[i];
      ceremonyCards[s.pIdx] = s.card;
    }
  }
  const ceremonyDone = game.phase === "ceremony" && game.ceremony
    && ceremonyStep >= game.ceremony.steps.length - 1;
  const lastStep = game.ceremony?.steps[Math.max(0, Math.min(ceremonyStep, (game.ceremony?.steps.length ?? 1) - 1))];

  const { w: W, h: H } = dims;
  const committed = game.bets.filter((b) => b.bettor === myIdx).reduce((s, b) => s + b.amount, 0);
  const avail = (game.players[myIdx]?.coins ?? 0) - committed;

  // ═══ Contenu central selon la phase ═══
  let center: React.ReactNode = null;

  if (game.phase === "ceremony") {
    center = (
      <CenterBox title="Désignation de la banque">
        <Msg>
          {ceremonyStep < 0 ? "Distribution..." :
            ceremonyDone ? `🂡 ${game.players[game.bankIdx!].name} prend la Banque ! (${game.players[game.cutterIdx!].name} coupe ✂️)` :
            lastStep?.asNum === 1 ? `🂡 Premier As pour ${game.players[lastStep.pIdx].name} — il coupera !` :
            `${game.players[lastStep?.pIdx ?? 0]?.name} reçoit le ${lastStep?.card.rank}${lastStep?.card.suit}...`}
        </Msg>
        {ceremonyDone && (isBank
          ? <GoldBtn onClick={() => emit("startRound")}>🂠 Distribuer</GoldBtn>
          : <Msg dim>La banque va distribuer...</Msg>)}
      </CenterBox>
    );
  } else if (game.phase === "cutting") {
    const isCutter = myIdx === game.cutterIdx;
    center = (
      <CenterBox title={`✂️ Coupe — ${game.players[game.cutterIdx!]?.name}`}>
        {isCutter ? (
          <div>
            <Msg>Choisis où couper le paquet</Msg>
            {/* Pile visuelle : 40 segments, le marqueur doré sépare */}
            <div className="flex justify-center items-end gap-px my-3" style={{ height: 44 }}>
              {Array.from({ length: 40 }, (_, i) => (
                <div key={i} style={{
                  width: 5, borderRadius: 1,
                  height: 22 + Math.sin(i * 0.4) * 3,
                  background: i < cutPos ? "#8d2836" : "#5a1620",
                  marginRight: i === cutPos - 1 ? 7 : 0,
                  boxShadow: i === cutPos - 1 ? "3px 0 0 #e8c96a, 5px 0 8px rgba(232,201,106,.6)" : "none",
                  transition: "all .15s",
                }} />
              ))}
            </div>
            <div className="flex items-center gap-2 justify-center mb-2">
              <span className="text-emerald-500/70 text-[10px]">5</span>
              <input type="range" min={5} max={35} value={cutPos}
                onChange={(e) => setCutPos(Number(e.target.value))}
                className="w-40" style={{ accentColor: "#e8c96a" }} />
              <span className="text-emerald-500/70 text-[10px]">35</span>
            </div>
            <div className="text-[12.5px] font-display italic mb-1" style={{ color: "var(--tc-msg, #f0e6c8)" }}>
              Coupe à la <b className="not-italic" style={{ color: "var(--tc-title, #e8c96a)" }}>{cutPos}</b>ᵉ carte
            </div>
            <GoldBtn small onClick={() => { sfxFlip(); emit("cutDeck", { pos: cutPos }); }}>
              ✂️ Couper le paquet
            </GoldBtn>
          </div>
        ) : (
          <Msg dim>{game.players[game.cutterIdx!]?.name} est en train de couper le paquet...</Msg>
        )}
      </CenterBox>
    );
  } else if (game.phase === "betting") {
    const isMyTurn = game.betIdx === myIdx;
    center = (
      <CenterBox title={`Paris — ${game.players[game.betIdx]?.name}`}>
        {isMyTurn ? (
          <div>
            <Msg>À toi de miser ! ({avail} dispo)</Msg>
            <div className="flex gap-1 justify-center flex-wrap my-2">
              {game.players.map((p, i) => i !== game.bankIdx && (
                <button key={i} onClick={() => setBetHouse(i)}
                  className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border border-gold/40
                    ${(betHouse ?? myIdx) === i ? "bg-gold text-[#241d05]" : "bg-black/30 text-emerald-100"}`}>
                  {i === myIdx ? "🏠 Moi" : p.name}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 justify-center flex-wrap mb-1.5">
              {[5, 10, 20, 50].filter((v) => v <= avail).map((v) => (
                <button key={v} onClick={() => setBetInput(String(v))}
                  className={`px-3 py-1 rounded-full text-xs font-bold border border-gold/40
                    ${betInput === String(v) ? "bg-gold text-[#241d05]" : "bg-black/30 text-gold"}`}>
                  {v}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 justify-center">
              <input type="number" value={betInput} onChange={(e) => setBetInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addBet()}
                className="w-16 text-center rounded-lg px-2 py-1.5 bg-black/40 border border-gold/30 text-white text-sm outline-none"
                placeholder="..." />
              <GoldBtn small onClick={addBet}>Miser</GoldBtn>
              <GhostBtn small onClick={() => emit("endBettingTurn")}>Fini ✓</GhostBtn>
            </div>
          </div>
        ) : (
          <Msg dim>{game.players[game.betIdx]?.name} est en train de miser...</Msg>
        )}
      </CenterBox>
    );
  } else if (game.phase === "pre_reveal") {
    center = (
      <CenterBox title="Personne ne touche ses cartes">
        {isBank
          ? <GoldBtn className="animate-pulse-btn" onClick={() => emit("reveal")}>🔥 Retourner les cartes</GoldBtn>
          : <Msg dim>La banque va retourner les cartes...</Msg>}
      </CenterBox>
    );
  } else if (game.phase === "revealing") {
    const bs = game.results?.[game.bankIdx!]?.score;
    const currentIdx = revealStep > 0 && revealStep <= n ? revealOrder[revealStep - 1] : null;
    const cs = currentIdx !== null ? game.results?.[currentIdx]?.score : null;
    center = (
      <CenterBox title={allRevealed ? "Résultats" : "Retournement..."}>
        {!allRevealed && currentIdx !== null && (
          <Msg>
            {currentIdx === game.bankIdx
              ? `🏦 La banque retourne... ${cs}${cs === 9 ? " !! NIOUFI !" : cs === 0 ? " — bouteille !" : " points. À battre !"}`
              : `${game.players[currentIdx].name}... ${cs}${cs === 9 ? " ⭐ NIOUFI !" : cs === 0 ? " 💀 bouteille" : " pts"}`}
          </Msg>
        )}
        {allRevealed && (
          <>
            <Msg>
              {bs === 9 ? "La banque a fait 9 et rafle tout." :
                (game.results?.filter((r) => r.win).length ?? 0) > 0
                  ? `${game.results!.filter((r) => r.win).length} maison(s) bat(tent) la banque !`
                  : "La banque tient bon."}
            </Msg>
            {game.nineWinner === myIdx ? (
              <div className="mt-2">
                <Msg>⭐ Tu as fait 9 ! Prendre la banque ?</Msg>
                <div className="flex gap-2 justify-center mt-2">
                  <GoldBtn small onClick={() => emit("decideBank", { takeIt: true })}>Oui !</GoldBtn>
                  <GhostBtn small onClick={() => emit("decideBank", { takeIt: false })}>Non</GhostBtn>
                </div>
              </div>
            ) : game.nineWinner >= 0 ? (
              <Msg dim>{game.players[game.nineWinner].name} a fait 9... il décide s'il prend la banque.</Msg>
            ) : isBank ? (
              <GoldBtn onClick={() => emit("decideBank", { takeIt: false })}>🃏 Manche suivante</GoldBtn>
            ) : (
              <Msg dim>En attente de la prochaine manche...</Msg>
            )}
          </>
        )}
      </CenterBox>
    );
  } else if (game.phase === "between_rounds") {
    center = (
      <CenterBox title={`${game.players[game.bankIdx!].name} tient la banque`}>
        {isBank
          ? <GoldBtn onClick={() => emit("startRound")}>🂠 Distribuer</GoldBtn>
          : <Msg dim>La banque va distribuer...</Msg>}
      </CenterBox>
    );
  }

  const remaining = game.deadline
    ? Math.max(0, Math.ceil((game.deadline - nowTs) / 1000))
    : null;
  const showTimer = remaining !== null && ["cutting", "betting", "pre_reveal", "between_rounds"].includes(game.phase);

  // ═══ Rendu ═══
  return (
    <div className="min-h-screen flex flex-col overflow-hidden"
      style={{ background: `radial-gradient(ellipse at 50% 20%, ${th.bg1} 0%, ${th.bg2} 80%)` }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 pt-2">
        <span className="font-display text-[22px] text-gold">Nioufi</span>
        <div className="flex items-center gap-2">
          <span className="text-emerald-500/80 text-xs">
            Table <b className="text-gold">{game.code}</b> · <b className="text-gold">{game.players[myIdx]?.name}</b>{isBank ? " 🏦" : ""}
          </span>
          <button onClick={toggleSound} className="text-base leading-none px-1" title={soundOn ? "Couper le son" : "Activer le son"}>
            {soundOn ? "🔊" : "🔇"}
          </button>
          {onLeave && (
            <button onClick={() => { if (window.confirm("Quitter la partie ? Ton siège restera à la table jusqu'à la fin de la manche.")) onLeave(); }}
              className="text-base leading-none px-1" title="Quitter la table">
              🚪
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="mx-auto mt-1 px-3 py-1 rounded-full bg-red-900/70 border border-red-500/40 text-red-100 text-xs">
          {toast}
        </div>
      )}

      {/* Table */}
      <div ref={ref} className="flex-1 relative min-h-[480px]">
        <div style={{
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
          width: th.shape.width, height: th.shape.height, borderRadius: th.shape.radius,
          background: th.surface,
          border: th.border,
          boxShadow: th.shadow,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          ["--tc-title" as never]: th.ink === "dark" ? "#6b4d0c" : "#e8c96a",
          ["--tc-msg" as never]: th.ink === "dark" ? "#2e2e26" : "#f0e6c8",
          ["--tc-dim" as never]: th.ink === "dark" ? "#4f5d4a" : "#7da884cc",
        }}>
          {/* Décorations du thème */}
          {th.decor === "camping" && (
            <>
              {/* Pieds en plastique blanc qui dépassent sous le plateau */}
              {[{ l: "14%" }, { r: "14%" }].map((pos, i) => (
                <div key={i} style={{
                  position: "absolute", bottom: -30, ...(pos.l ? { left: pos.l } : { right: pos.r }),
                  width: 13, height: 34, borderRadius: "0 0 4px 4px",
                  background: "linear-gradient(90deg, #ffffff 0%, #e6e8e3 55%, #c9ccc6 100%)",
                  boxShadow: "3px 4px 8px rgba(0,0,0,.45)", zIndex: 0,
                }} />
              ))}
            </>
          )}
          {th.decor === "boitier" && (
            <>
              {/* Jointure des deux portes */}
              <div style={{ position: "absolute", left: "50%", top: 8, bottom: 8, width: 2, background: "rgba(0,0,0,.3)", transform: "translateX(-1px)" }} />
              {/* Rivets aux coins */}
              {[{ top: 8, left: 10 }, { top: 8, right: 10 }, { bottom: 8, left: 10 }, { bottom: 8, right: 10 }].map((p, i) => (
                <div key={i} style={{
                  position: "absolute", ...p, width: 7, height: 7, borderRadius: "50%",
                  background: "radial-gradient(circle at 35% 30%, #9aa892, #3c4636)",
                  boxShadow: "0 1px 2px rgba(0,0,0,.5)",
                }} />
              ))}
              {/* Sticker danger électrique */}
              <div style={{
                position: "absolute", top: 12, right: 22, width: 34, height: 30,
                clipPath: "polygon(50% 0, 100% 100%, 0 100%)",
                background: "linear-gradient(180deg, #f5c916, #dfae0a)",
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                fontSize: 13, color: "#15150a", paddingBottom: 1,
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,.4))",
              }}>⚡</div>
              {/* Tag au marqueur */}
              <div style={{
                position: "absolute", top: "16%", left: "9%",
                transform: "rotate(-7deg) skewX(-6deg)",
                fontFamily: "'Segoe Script', 'Brush Script MT', cursive",
                fontSize: 21, fontWeight: 700, letterSpacing: 2,
                color: "rgba(28, 28, 110, .72)",
                textShadow: "1px 1px 0 rgba(28,28,110,.22)",
                pointerEvents: "none", whiteSpace: "nowrap", zIndex: 1,
              }}>Neuhof 67100</div>
              {/* Grille d'aération */}
              <div style={{
                position: "absolute", left: 16, bottom: 14, width: 58, height: 26, borderRadius: 3,
                background: "repeating-linear-gradient(180deg, rgba(0,0,0,.4) 0 3px, rgba(255,255,255,.08) 3px 6px)",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,.5)",
              }} />
            </>
          )}
          {showTimer && (
            <div style={{
              position: "absolute", top: "9%", left: "50%", transform: "translateX(-50%)",
              padding: "3px 12px", borderRadius: 999, fontWeight: 800, fontSize: 12.5,
              fontVariantNumeric: "tabular-nums",
              background: remaining <= 10 ? "rgba(180,40,40,.35)" : "rgba(0,0,0,.4)",
              border: remaining <= 10 ? "1px solid rgba(224,80,80,.7)" : "1px solid rgba(232,201,106,.3)",
              color: remaining <= 10 ? "#ff9c9c" : "#e8c96a",
              animation: remaining <= 10 ? "pulse 1s ease-in-out infinite" : "none",
            }}>
              ⏱ {remaining}s
            </div>
          )}
          {th.mat ? (
            <div style={{ background: th.mat, borderRadius: 14, padding: "14px 18px", boxShadow: "0 4px 14px rgba(0,0,0,.35)" }}>
              {center}
            </div>
          ) : center}
        </div>

        {/* Sièges */}
        {game.players.map((p, i) => {
          const pos = seatPosition((i - myIdx + n) % n, n, W, H);
          const isB = i === game.bankIdx;
          const isHi = (game.phase === "betting" && i === game.betIdx) || (game.phase === "cutting" && i === game.cutterIdx);
          const r = (allRevealed || isRevealed(i)) ? game.results?.[i] : null;
          const hand = game.hands?.[i] || [];
          const houseBets = game.bets.filter((b) => b.house === i);
          const houseTotal = houseBets.reduce((s, b) => s + b.amount, 0);
          return (
            <div key={i} style={{
              position: "absolute", left: pos.x, top: pos.y, transform: "translate(-50%,-50%)",
              filter: isHi ? "drop-shadow(0 0 12px rgba(232,201,106,.8))" : "none",
            }} className="flex flex-col items-center gap-0.5 z-10 max-w-[104px]">

              {/* Cartes */}
              <div className="min-h-[50px] flex gap-0.5">
                {game.phase === "ceremony" && ceremonyCards[i] && (
                  <PlayingCard card={ceremonyCards[i]} faceUp w={34} back={ct} highlight={ceremonyCards[i]!.rank === "A"} />
                )}
                {game.phase !== "ceremony" && hand.map((card, ci) => {
                  const peekKey = `${i}-${ci}`;
                  const peekedCard = peeked[peekKey];
                  const publicCard = card; // non-null seulement en phase revealing
                  const shown = publicCard ?? peekedCard ?? null;
                  return (
                    <PlayingCard key={ci} card={shown} w={32} back={ct}
                      faceUp={!!shown && (isRevealed(i) || allRevealed || !!peekedCard)}
                      peekable={canPeek(i, ci)} onPeek={() => peek(i, ci)}
                      delayIn={ci * 180}
                      highlight={r?.score === 9} />
                  );
                })}
              </div>

              {/* Plaque nom */}
              <div className={`px-2.5 py-0.5 rounded-full text-center border
                ${isB ? "bg-gradient-to-br from-[#3a2e08] to-[#57470f] border-gold" :
                  i === myIdx ? "bg-black/60 border-gold/50" : "bg-black/60 border-white/15"}
                ${!p.connected ? "opacity-50" : ""}`}>
                <div className={`font-bold text-[11px] whitespace-nowrap max-w-[90px] overflow-hidden text-ellipsis
                  ${isB ? "text-gold" : "text-gray-100"}`}>
                  {isB ? "🏦 " : ""}{i === game.cutterIdx && !isB ? "✂️ " : ""}{p.name}{i === myIdx ? " ●" : ""}{!p.connected ? " ⚡" : ""}
                </div>
                <div className="text-emerald-400/90 text-[10px]">
                  {p.coins} 🪙
                  {r && <span className={`font-bold ${r.delta >= 0 ? "text-green-400" : "text-red-400"}`}> {r.delta > 0 ? "+" : ""}{r.delta}</span>}
                </div>
              </div>

              {/* Mises sur cette maison */}
              {houseTotal > 0 && (
                <div className="flex flex-col items-center gap-px">
                  <div className="animate-chip-in px-1.5 rounded-full text-white text-[10px] font-extrabold border-2 border-dashed border-white/60"
                    style={{ background: "radial-gradient(circle at 35% 30%, #d94f4f, #8e1e1e)" }}>
                    {houseTotal}
                  </div>
                  <div className="text-[8.5px] text-[#c9a86a] text-center leading-tight max-w-[95px]">
                    {houseBets.map((b, k) => (
                      <span key={k}>{b.bettor === i ? "lui" : game.players[b.bettor].name.slice(0, 8)} {b.amount}{k < houseBets.length - 1 ? " · " : ""}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Score */}
              {r && (
                <div className={`font-display font-extrabold text-xs
                  ${r.score === 9 ? "text-yellow-300" : r.score === 0 ? "text-red-400" : "text-emerald-100"}`}>
                  {r.score} pt{r.score > 1 ? "s" : ""}{r.score === 9 ? " ⭐" : r.score === 0 ? " 💀" : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fil d'activité */}
      <div className="mx-2.5 mb-2.5 rounded-xl px-3 py-2 bg-black/35 border border-gold/10 max-h-[92px] overflow-y-auto">
        <div className="text-emerald-500/80 text-[9px] uppercase tracking-[.14em] mb-0.5">Autour de la table</div>
        {game.feed.length === 0 ? (
          <div className="text-white/25 text-[11.5px] italic">Rien pour l'instant...</div>
        ) : game.feed.map((e, k) => (
          <div key={e.t + "-" + k} className={`text-[11.5px] leading-relaxed ${k === 0 ? "text-[#e8dcb8]" : "text-white/40"}`}>
            {e.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Petits composants ────────────────────────────────────────────────────────
function CenterBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="text-center max-w-[300px]">
      <div className="font-display text-[17px] mb-1" style={{ color: "var(--tc-title, #e8c96a)" }}>{title}</div>
      {children}
    </div>
  );
}
function Msg({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return <div className="text-[13px] leading-relaxed font-display italic min-h-[20px]"
    style={{ color: dim ? "var(--tc-dim, #7da884cc)" : "var(--tc-msg, #f0e6c8)" }}>{children}</div>;
}
export function GoldBtn({ children, onClick, small, className = "" }: { children: React.ReactNode; onClick?: () => void; small?: boolean; className?: string }) {
  return (
    <button onClick={onClick}
      className={`${small ? "px-3.5 py-2 text-[13px]" : "px-5 py-3 text-[15px] mt-3"} rounded-xl font-extrabold text-[#241d05] ${className}`}
      style={{ background: "linear-gradient(140deg,#caa32f,#eed780,#caa32f)", boxShadow: "0 5px 18px rgba(232,201,106,.3)" }}>
      {children}
    </button>
  );
}
export function GhostBtn({ children, onClick, small }: { children: React.ReactNode; onClick?: () => void; small?: boolean }) {
  return (
    <button onClick={onClick}
      className={`${small ? "px-3 py-2 text-xs" : "px-5 py-3 text-sm mt-3"} rounded-xl font-bold text-gray-200 bg-white/10 border border-white/20`}>
      {children}
    </button>
  );
}
