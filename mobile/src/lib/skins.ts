// ─── Thèmes visuels des skins (version native) ───────────────────────────────
// Mêmes codes que le catalogue serveur (source de vérité des prix).
// Le rendu est fait en SVG par <TableSurface> et <CardBack>.

export type TableTheme = {
  bg1: string; bg2: string;          // fond de l'écran (haut → bas)
  shape: "ellipse" | "rect";
  widthPct: number; heightPct: number;
  radius: number;                     // coins (formes rectangulaires)
  border: string; borderWidth: number;
  ring?: string;                      // liseré intérieur
  decor?: "clandestin" | "camping" | "boitier";
  ink?: "dark";                       // texte sombre sur table claire
  mat?: string;                       // pastille sombre derrière le texte central
};

export type CardTheme =
  | { kind: "stripes"; c1: string; c2: string; border: string; accent: string }
  | { kind: "flag"; code: string; border: string }
  | { kind: "gitan"; border: string };

export const TABLE_THEMES: Record<string, TableTheme> = {
  classic: {
    bg1: "#182b1c", bg2: "#070d08", shape: "ellipse", widthPct: 0.8, heightPct: 0.62, radius: 0,
    border: "#3d2417", borderWidth: 11, ring: "rgba(232,201,106,.18)",
  },
  clandestin: {
    bg1: "#1a130d", bg2: "#080503", shape: "rect", widthPct: 0.82, heightPct: 0.6, radius: 20,
    border: "#241a12", borderWidth: 9, decor: "clandestin",
  },
  camping: {
    bg1: "#26361f", bg2: "#0c130a", shape: "rect", widthPct: 0.82, heightPct: 0.6, radius: 40,
    border: "#d7d9d3", borderWidth: 2, decor: "camping", ink: "dark",
  },
  boitier: {
    bg1: "#1c1e1b", bg2: "#070807", shape: "rect", widthPct: 0.64, heightPct: 0.46, radius: 9,
    border: "#b0aca0", borderWidth: 5, decor: "boitier", mat: "rgba(0,0,0,.55)",
  },
  casino: {
    bg1: "#141414", bg2: "#030303", shape: "ellipse", widthPct: 0.8, heightPct: 0.62, radius: 0,
    border: "#2a2118", borderWidth: 11, ring: "rgba(232,201,106,.45)",
  },
};

const stripes = (c1: string, c2: string, border: string, accent: string): CardTheme =>
  ({ kind: "stripes", c1, c2, border, accent });
const flag = (code: string, border: string): CardTheme => ({ kind: "flag", code, border });

export const CARD_THEMES: Record<string, CardTheme> = {
  "cards-classic": stripes("#7a1f2b", "#8d2836", "#5a1620", "rgba(240,220,170,.75)"),
  "cards-azur": stripes("#1f4b7a", "#28618d", "#16385a", "rgba(180,215,245,.8)"),
  "cards-emeraude": stripes("#1f6b45", "#288d58", "#164f32", "rgba(190,240,210,.75)"),
  "cards-or": stripes("#8a6a1a", "#a8842a", "#6b5010", "rgba(255,240,200,.85)"),
  "cards-onyx": stripes("#1e1e22", "#2c2c32", "#101014", "rgba(232,201,106,.8)"),
  "cards-fr": flag("fr", "#1a1a2e"),
  "cards-es": flag("es", "#6b0d11"),
  "cards-dz": flag("dz", "#00401f"),
  "cards-ma": flag("ma", "#7a1519"),
  "cards-tn": flag("tn", "#96000d"),
  "cards-al": flag("al", "#8f1012"),
  "cards-rs": flag("rs", "#08284a"),
  "cards-ru": flag("ru", "#00246b"),
  "cards-it": flag("it", "#00542a"),
  "cards-sn": flag("sn", "#005226"),
  "cards-cd": flag("cd", "#004a94"),
  "cards-cg": flag("cg", "#00602b"),
  "cards-gitan": { kind: "gitan", border: "#00417a" },
};

export const tableTheme = (code?: string): TableTheme => TABLE_THEMES[code || "classic"] || TABLE_THEMES.classic;
export const cardTheme = (code?: string): CardTheme => CARD_THEMES[code || "cards-classic"] || CARD_THEMES["cards-classic"];
/** Drapeaux officiels embarqués dans l'appli (aucun chargement réseau) */
const FLAGS: Record<string, number> = {
  fr: require("../../assets/flags/fr.png"),
  es: require("../../assets/flags/es.png"),
  dz: require("../../assets/flags/dz.png"),
  ma: require("../../assets/flags/ma.png"),
  tn: require("../../assets/flags/tn.png"),
  al: require("../../assets/flags/al.png"),
  rs: require("../../assets/flags/rs.png"),
  ru: require("../../assets/flags/ru.png"),
  it: require("../../assets/flags/it.png"),
  sn: require("../../assets/flags/sn.png"),
  cd: require("../../assets/flags/cd.png"),
  cg: require("../../assets/flags/cg.png"),
};
export const flagSource = (code: string) => FLAGS[code];
