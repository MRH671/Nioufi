"use client";
import { useEffect, useState } from "react";
import type { Card } from "@/lib/types";
import { cardTheme, type CardTheme } from "@/lib/skins";

const RED = ["♥", "♦"];

export default function PlayingCard({
  card, faceUp, w = 36, highlight = false, peekable = false, onPeek, delayIn = 0, back,
}: {
  card: Card | null;
  faceUp: boolean;
  w?: number;
  highlight?: boolean;
  peekable?: boolean;
  onPeek?: () => void;
  delayIn?: number;
  back?: CardTheme;
}) {
  const bk = back || cardTheme();
  const h = w * 1.45;
  const isRed = card && RED.includes(card.suit);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delayIn);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={peekable ? onPeek : undefined}
      className={peekable ? "cursor-pointer" : ""}
      style={{
        width: w, height: h, perspective: 600,
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(-14px)",
        transition: "opacity .35s ease, transform .35s ease",
      }}
    >
      <div style={{
        width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d",
        transition: "transform .55s cubic-bezier(.4,.2,.2,1)",
        transform: faceUp && card ? "rotateY(0deg)" : "rotateY(180deg)",
      }}>
        {/* Face */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden",
          background: "linear-gradient(150deg,#fdfdf8,#f0ede2)", borderRadius: 6,
          border: "1px solid #b8b3a4",
          boxShadow: highlight ? "0 0 14px 3px rgba(255,215,90,.75)" : "0 2px 6px rgba(0,0,0,.45)",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: w * 0.09, color: isRed ? "#b3272d" : "#17181f",
          fontFamily: "Georgia, serif", fontWeight: 700,
        }}>
          <div style={{ fontSize: w * 0.32, lineHeight: 1 }}>{card?.rank}</div>
          <div style={{ fontSize: w * 0.45, textAlign: "center", lineHeight: 1 }}>{card?.suit}</div>
          <div style={{ fontSize: w * 0.32, lineHeight: 1, transform: "rotate(180deg)", alignSelf: "flex-end" }}>{card?.rank}</div>
        </div>
        {/* Dos */}
        <div style={{
          position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)",
          borderRadius: 6,
          border: peekable ? "1px solid rgba(232,201,106,.85)" : `1px solid ${bk.border}`,
          background: bk.bg || `repeating-linear-gradient(45deg,${bk.c1} 0 6px,${bk.c2} 6px 12px)`,
          boxShadow: peekable ? "0 0 8px rgba(232,201,106,.5)" : "0 2px 6px rgba(0,0,0,.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {bk.emblem ? (
            <span style={{
              fontSize: w * 0.48, lineHeight: 1, color: bk.emblem.color,
              textShadow: "0 1px 2px rgba(0,0,0,.35)",
            }}>{bk.emblem.char}</span>
          ) : (
            <div style={{
              width: "70%", height: "78%", borderRadius: 4,
              border: `1.5px solid ${bk.bg ? bk.accent : "rgba(240,220,170,.55)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: bk.bg ? "transparent" : "rgba(240,220,170,.75)", fontFamily: "Georgia,serif",
              fontSize: w * 0.28, fontStyle: "italic",
            }}>{bk.bg ? "" : "N"}</div>
          )}
        </div>
      </div>
    </div>
  );
}
