// Rendu SVG des tables (classique, tripot, camping, boîtier Neuhof, casino).
// Utilisé en grand sur la table de jeu et en miniature dans la boutique.
import { useId } from "react";
import { View } from "react-native";
import Svg, {
  Circle, Defs, Ellipse, G, Line, LinearGradient, Polygon, RadialGradient, Rect, Stop, Text as SvgText,
} from "react-native-svg";
import type { TableTheme } from "../lib/skins";

const FELT: Record<string, [string, string, string]> = {
  classic: ["#2c6b3f", "#1c4a2b", "#123420"],
  casino: ["#2b2b2e", "#1a1a1d", "#0e0e10"],
  clandestin: ["#33422a", "#232e1d", "#151c12"],
};

export default function TableSurface({ theme, code, w, h }: {
  theme: TableTheme; code: string; w: number; h: number;
}) {
  const uid = "t" + useId().replace(/[^a-zA-Z0-9]/g, "");
  if (w <= 0 || h <= 0) return null;
  const k = Math.min(w, h) / 300;          // échelle des détails
  const bw = Math.max(2, theme.borderWidth * Math.min(1, k * 1.2));

  return (
    <View style={{ width: w, height: h }}>
      {theme.decor === "camping" && <CampingLegs w={w} h={h} k={k} />}
      <Svg width={w} height={h}>
        {theme.shape === "ellipse"
          ? <EllipseTable u={uid} theme={theme} code={code} w={w} h={h} bw={bw} />
          : theme.decor === "clandestin"
            ? <Clandestin u={uid} theme={theme} w={w} h={h} bw={bw} k={k} />
            : theme.decor === "camping"
              ? <Camping u={uid} theme={theme} w={w} h={h} bw={bw} k={k} />
              : <Boitier u={uid} theme={theme} w={w} h={h} bw={bw} k={k} />}
      </Svg>
    </View>
  );
}

// ─── Ovales : tapis classique et casino ───────────────────────────────────────
function EllipseTable({ u, theme, code, w, h, bw }: { u: string; theme: TableTheme; code: string; w: number; h: number; bw: number }) {
  const [c1, c2, c3] = FELT[code] || FELT.classic;
  const cx = w / 2, cy = h / 2;
  return (
    <>
      <Defs>
        <RadialGradient id={u + "felt"} cx="50%" cy="42%" r="60%">
          <Stop offset="0" stopColor={c1} />
          <Stop offset="0.55" stopColor={c2} />
          <Stop offset="1" stopColor={c3} />
        </RadialGradient>
        <RadialGradient id={u + "vig"} cx="50%" cy="50%" r="50%">
          <Stop offset="0.72" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </RadialGradient>
        <LinearGradient id={u + "wood"} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.border} stopOpacity="1" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.9" />
        </LinearGradient>
      </Defs>
      <Ellipse cx={cx} cy={cy + 4} rx={w / 2 - 1} ry={h / 2 - 1} fill="#000" opacity={0.45} />
      <Ellipse cx={cx} cy={cy} rx={w / 2 - 2} ry={h / 2 - 4} fill={theme.border} />
      <Ellipse cx={cx} cy={cy} rx={w / 2 - 2} ry={h / 2 - 4} fill={`url(#${u}wood)`} opacity={0.35} />
      <Ellipse cx={cx} cy={cy} rx={w / 2 - 2 - bw} ry={h / 2 - 4 - bw} fill={`url(#${u}felt)`} />
      <Ellipse cx={cx} cy={cy} rx={w / 2 - 2 - bw} ry={h / 2 - 4 - bw} fill={`url(#${u}vig)`} />
      {theme.ring && (
        <Ellipse cx={cx} cy={cy} rx={w / 2 - 2 - bw * 2.4} ry={h / 2 - 4 - bw * 2.4}
          fill="none" stroke={theme.ring} strokeWidth={1.6} />
      )}
    </>
  );
}

// ─── Tripot clandestin : feutre usé, halo de lampe, taches ───────────────────
function Clandestin({ u, theme, w, h, bw, k }: { u: string; theme: TableTheme; w: number; h: number; bw: number; k: number }) {
  const [c1, c2, c3] = FELT.clandestin;
  const r = theme.radius * k;
  return (
    <>
      <Defs>
        <RadialGradient id={u + "cfelt"} cx="50%" cy="45%" r="62%">
          <Stop offset="0" stopColor={c1} /><Stop offset="0.55" stopColor={c2} /><Stop offset="1" stopColor={c3} />
        </RadialGradient>
        <RadialGradient id={u + "lamp"} cx="50%" cy="15%" rx="40%" ry="30%">
          <Stop offset="0" stopColor="rgb(255,190,90)" stopOpacity="0.22" />
          <Stop offset="1" stopColor="rgb(255,190,90)" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={u + "stain"} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#000" stopOpacity="0.38" /><Stop offset="1" stopColor="#000" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={u + "cvig"} cx="50%" cy="50%" r="70%">
          <Stop offset="0.6" stopColor="#000" stopOpacity="0" /><Stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </RadialGradient>
      </Defs>
      <Rect x={1} y={5} width={w - 2} height={h - 6} rx={r} fill="#000" opacity={0.5} />
      <Rect x={1} y={1} width={w - 2} height={h - 4} rx={r} fill={theme.border} />
      <Rect x={1 + bw} y={1 + bw} width={w - 2 - bw * 2} height={h - 4 - bw * 2} rx={Math.max(2, r - bw)} fill={`url(#${u}cfelt)`} />
      <Circle cx={w * 0.24} cy={h * 0.72} r={Math.min(w, h) * 0.2} fill={`url(#${u}stain)`} />
      <Circle cx={w * 0.78} cy={h * 0.3} r={Math.min(w, h) * 0.15} fill={`url(#${u}stain)`} />
      <Rect x={1 + bw} y={1 + bw} width={w - 2 - bw * 2} height={h - 4 - bw * 2} rx={Math.max(2, r - bw)} fill={`url(#${u}lamp)`} />
      <Rect x={1 + bw} y={1 + bw} width={w - 2 - bw * 2} height={h - 4 - bw * 2} rx={Math.max(2, r - bw)} fill={`url(#${u}cvig)`} />
    </>
  );
}

// ─── Table de camping : plastique blanc, rebord lisse, lattes au centre ──────
function Camping({ u, theme, w, h, bw, k }: { u: string; theme: TableTheme; w: number; h: number; bw: number; k: number }) {
  const r = theme.radius * k;
  const lx = w * 0.13, ly = h * 0.19, lw = w * 0.74, lh = h * 0.62;
  const slat = 42 * k, gap = 4 * k;
  const slats: number[] = [];
  for (let x = lx; x < lx + lw - 1; x += slat + gap) slats.push(x);
  return (
    <>
      <Defs>
        <LinearGradient id={u + "plastic"} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fbfbf8" /><Stop offset="1" stopColor="#e6e6df" />
        </LinearGradient>
        <LinearGradient id={u + "shine"} x1="0" y1="0" x2="0.55" y2="1">
          <Stop offset="0" stopColor="#fff" stopOpacity="0.7" /><Stop offset="0.32" stopColor="#fff" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x={1} y={6} width={w - 2} height={h - 7} rx={r} fill="#000" opacity={0.45} />
      <Rect x={1} y={1} width={w - 2} height={h - 5} rx={r} fill={`url(#${u}plastic)`} stroke={theme.border} strokeWidth={bw} />
      {slats.map((x, i) => (
        <G key={i}>
          <Rect x={x} y={ly} width={Math.min(slat, lx + lw - x)} height={lh} fill="#f3f3ee" />
          <Rect x={x + slat} y={ly} width={gap} height={lh} fill="#dcdcd4" />
        </G>
      ))}
      <Rect x={lx} y={ly} width={lw} height={lh} fill="none" stroke="#dcdcd4" strokeWidth={1} />
      <Rect x={1} y={1} width={w - 2} height={h - 5} rx={r} fill={`url(#${u}shine)`} />
    </>
  );
}

function CampingLegs({ w, h, k }: { w: number; h: number; k: number }) {
  const lw = Math.max(5, 13 * k), lh = Math.max(8, 30 * k);
  return (
    <>
      {[0.14, 0.86].map((p, i) => (
        <View key={i} style={{
          position: "absolute", top: h - 10, left: w * p - lw / 2, width: lw, height: lh + 10,
          backgroundColor: "#e4e6e1", borderBottomLeftRadius: 3, borderBottomRightRadius: 3,
          borderRightWidth: lw * 0.3, borderRightColor: "#c9ccc6",
          shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 4, shadowOffset: { width: 3, height: 4 }, elevation: 2,
        }} />
      ))}
    </>
  );
}

// ─── Boîtier électrique Neuhof : blanc sale, rouille, rivets, tag ────────────
function Boitier({ u, theme, w, h, bw, k }: { u: string; theme: TableTheme; w: number; h: number; bw: number; k: number }) {
  const r = theme.radius * k;
  const ribs: number[] = [];
  for (let y = 4; y < h; y += Math.max(3, 6 * k)) ribs.push(y);
  const rv = Math.max(2, 3.5 * k);
  const inset = Math.max(4, 10 * k);
  const tri = Math.max(10, 32 * k);
  return (
    <>
      <Defs>
        <LinearGradient id={u + "paint"} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#e8e5dc" /><Stop offset="1" stopColor="#d6d2c6" />
        </LinearGradient>
        <LinearGradient id={u + "toplight"} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fff" stopOpacity="0.5" /><Stop offset="0.22" stopColor="#fff" stopOpacity="0" />
        </LinearGradient>
        <RadialGradient id={u + "rust"} cx="85%" cy="88%" r="28%">
          <Stop offset="0" stopColor="rgb(120,70,25)" stopOpacity="0.55" /><Stop offset="1" stopColor="rgb(120,70,25)" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={u + "grime"} cx="10%" cy="18%" r="35%">
          <Stop offset="0" stopColor="rgb(60,55,40)" stopOpacity="0.32" /><Stop offset="1" stopColor="rgb(60,55,40)" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={u + "yellow"} cx="60%" cy="70%" r="42%">
          <Stop offset="0" stopColor="rgb(120,110,80)" stopOpacity="0.24" /><Stop offset="1" stopColor="rgb(120,110,80)" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id={u + "rivet"} cx="35%" cy="30%" r="70%">
          <Stop offset="0" stopColor="#cfccc2" /><Stop offset="1" stopColor="#6e6a5e" />
        </RadialGradient>
        <LinearGradient id={u + "sticker"} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#f5c916" /><Stop offset="1" stopColor="#dfae0a" />
        </LinearGradient>
      </Defs>
      <Rect x={1} y={5} width={w - 2} height={h - 6} rx={r} fill="#000" opacity={0.55} />
      <Rect x={1} y={1} width={w - 2} height={h - 4} rx={r} fill={`url(#${u}paint)`} stroke={theme.border} strokeWidth={bw} />
      {ribs.map((y) => <Line key={y} x1={bw} x2={w - bw} y1={y} y2={y} stroke="#000" strokeOpacity={0.035} strokeWidth={1} />)}
      <Rect x={1} y={1} width={w - 2} height={h - 4} rx={r} fill={`url(#${u}yellow)`} />
      <Rect x={1} y={1} width={w - 2} height={h - 4} rx={r} fill={`url(#${u}grime)`} />
      <Rect x={1} y={1} width={w - 2} height={h - 4} rx={r} fill={`url(#${u}rust)`} />
      <Rect x={1} y={1} width={w - 2} height={h - 4} rx={r} fill={`url(#${u}toplight)`} />
      {/* Jointure des deux portes */}
      <Line x1={w / 2} x2={w / 2} y1={inset} y2={h - inset - 3} stroke="#000" strokeOpacity={0.24} strokeWidth={Math.max(1, 2 * k)} />
      {/* Rivets */}
      {[[inset, inset], [w - inset, inset], [inset, h - inset - 3], [w - inset, h - inset - 3]].map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={rv} fill={`url(#${u}rivet)`} />
      ))}
      {/* Sticker danger */}
      <Polygon
        points={`${w - inset * 2.2 - tri / 2},${inset * 1.1} ${w - inset * 2.2},${inset * 1.1 + tri * 0.88} ${w - inset * 2.2 - tri},${inset * 1.1 + tri * 0.88}`}
        fill={`url(#${u}sticker)`} stroke="#15150a" strokeOpacity={0.5} strokeWidth={Math.max(0.6, k)} />
      <SvgText x={w - inset * 2.2 - tri / 2} y={inset * 1.1 + tri * 0.8} fontSize={tri * 0.42}
        fill="#15150a" textAnchor="middle" fontWeight="bold">⚡</SvgText>
      {/* Tag au marqueur */}
      <G transform={`translate(${w * 0.09}, ${h * 0.27}) rotate(-7) skewX(-8)`}>
        <SvgText x={0} y={0} fontSize={Math.max(7, 21 * k)} fontWeight="bold" fontStyle="italic"
          letterSpacing={2 * k} fill="rgb(28,28,110)" fillOpacity={0.74}>Neuhof 67100</SvgText>
      </G>
      {/* Grille d'aération */}
      <Rect x={inset * 1.6} y={h - inset * 1.4 - 26 * k} width={58 * k} height={26 * k} rx={2} fill="#000" fillOpacity={0.12} />
      {Array.from({ length: 5 }, (_, i) => (
        <Rect key={i} x={inset * 1.6} y={h - inset * 1.4 - 26 * k + i * 5.2 * k} width={58 * k} height={2.6 * k} fill="#000" fillOpacity={0.35} />
      ))}
    </>
  );
}
