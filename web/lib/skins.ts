// ─── Thèmes visuels des skins ────────────────────────────────────────────────
// Les codes correspondent au catalogue serveur (source de vérité des prix).

export type TableTheme = {
  bg1: string; bg2: string;             // fond de la page
  shape: { width: string; height: string; radius: string };
  surface: string;                       // CSS background de la table
  border: string;                        // CSS border de la table
  shadow: string;
  mat?: string;                          // petit tapis posé au centre (tables claires/petites)
  decor?: "camping" | "boitier";         // éléments dessinés en plus (pieds, rivets, stickers...)
  ink?: "dark";                          // texte central sombre (tables claires)
  // Aperçu boutique
  pBorder: string; pRadius: string;
};

export type CardTheme = {
  c1?: string; c2?: string;         // rayures classiques
  bg?: string;                      // fond CSS complet (drapeaux)
  emblem?: { char: string; color: string }; // symbole central (croissant, étoile, roue...)
  border: string;
  accent: string;
};

export const TABLE_THEMES: Record<string, TableTheme> = {
  // 🟢 Le tapis vert d'origine
  classic: {
    bg1: "#182b1c", bg2: "#070d08",
    shape: { width: "min(80%, 700px)", height: "min(66%, 430px)", radius: "50%" },
    surface: "radial-gradient(ellipse at 50% 42%, #2c6b3f 0%, #1c4a2b 55%, #123420 100%)",
    border: "12px solid #3d2417",
    shadow: "inset 0 0 60px rgba(0,0,0,.55), 0 18px 50px rgba(0,0,0,.6), inset 0 0 0 3px rgba(232,201,106,.15)",
    pBorder: "#3d2417", pRadius: "50%",
  },

  // 🚬 Arrière-salle enfumée : feutre usé, halo de lampe, bois sombre
  clandestin: {
    bg1: "#1a130d", bg2: "#080503",
    shape: { width: "min(82%, 700px)", height: "min(64%, 420px)", radius: "22px" },
    surface: [
      "radial-gradient(ellipse 60% 45% at 50% 18%, rgba(255,190,90,.16) 0%, rgba(255,190,90,0) 70%)",
      "radial-gradient(circle at 24% 72%, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 22%)",
      "radial-gradient(circle at 78% 30%, rgba(0,0,0,.28) 0%, rgba(0,0,0,0) 18%)",
      "radial-gradient(ellipse at 50% 45%, #33422a 0%, #232e1d 55%, #151c12 100%)",
    ].join(","),
    border: "10px solid #241a12",
    shadow: "inset 0 0 80px rgba(0,0,0,.75), 0 14px 40px rgba(0,0,0,.7)",
    pBorder: "#241a12", pRadius: "8px",
  },

  // ⛺ La vraie table de jardin en plastique blanc : plateau très arrondi,
  //    rebord lisse, lattes au centre, pieds qui dépassent dessous
  camping: {
    bg1: "#26361f", bg2: "#0c130a",
    shape: { width: "min(82%, 700px)", height: "min(64%, 420px)", radius: "46px" },
    surface: [
      "linear-gradient(165deg, rgba(255,255,255,.6) 0%, rgba(255,255,255,0) 30%)",              // reflet plastique
      "repeating-linear-gradient(90deg, #f5f5f1 0 42px, #e8e8e2 42px 46px) center / 74% 62% no-repeat", // lattes au centre
      "linear-gradient(180deg, #fbfbf8 0%, #ecece6 100%)",                                            // rebord lisse
    ].join(","),
    border: "2px solid #d7d9d3",
    shadow: "inset 0 -8px 16px rgba(0,0,0,.10), inset 0 2px 4px rgba(255,255,255,.8), 0 18px 34px rgba(0,0,0,.55)",
    decor: "camping",
    ink: "dark",
    pBorder: "#d7d9d3", pRadius: "14px",
  },

  // ⚡ Le boîtier électrique de rue : caisson vert patiné, jointure des portes,
  //    rivets, grilles d'aération, sticker danger — on joue serré dessus
  boitier: {
    bg1: "#1c1e1b", bg2: "#070807",
    shape: { width: "min(62%, 430px)", height: "min(50%, 290px)", radius: "10px" },
    surface: [
      "linear-gradient(180deg, rgba(255,255,255,.5) 0%, rgba(255,255,255,0) 22%)",              // lumière du haut
      "radial-gradient(circle at 85% 88%, rgba(120,70,25,.5) 0%, rgba(120,70,25,0) 24%)",       // coulure de rouille
      "radial-gradient(circle at 10% 18%, rgba(60,55,40,.3) 0%, rgba(60,55,40,0) 32%)",          // crasse
      "radial-gradient(ellipse at 60% 70%, rgba(120,110,80,.22) 0%, rgba(120,110,80,0) 40%)",    // jaunissement
      "repeating-linear-gradient(0deg, rgba(0,0,0,.04) 0 3px, rgba(255,255,255,.05) 3px 6px)",   // tôle
      "linear-gradient(180deg, #e8e5dc 0%, #d6d2c6 100%)",
    ].join(","),
    border: "5px solid #b0aca0",
    shadow: "inset 0 0 26px rgba(0,0,0,.28), 0 12px 28px rgba(0,0,0,.65)",
    mat: "rgba(0,0,0,.55)",
    decor: "boitier",
    pBorder: "#b0aca0", pRadius: "4px",
  },

  // 🎩 Casino privé : feutre noir profond, liseré or appuyé
  casino: {
    bg1: "#141414", bg2: "#030303",
    shape: { width: "min(80%, 700px)", height: "min(66%, 430px)", radius: "50%" },
    surface: "radial-gradient(ellipse at 50% 42%, #2b2b2e 0%, #1a1a1d 55%, #0e0e10 100%)",
    border: "12px solid #2a2118",
    shadow: "inset 0 0 60px rgba(0,0,0,.7), 0 18px 50px rgba(0,0,0,.75), inset 0 0 0 3px rgba(232,201,106,.4)",
    pBorder: "#2a2118", pRadius: "50%",
  },
};

export const CARD_THEMES: Record<string, CardTheme> = {
  "cards-classic":  { c1: "#7a1f2b", c2: "#8d2836", border: "#5a1620", accent: "rgba(240,220,170,.6)" },
  "cards-azur":     { c1: "#1f4b7a", c2: "#28618d", border: "#16385a", accent: "rgba(180,215,245,.65)" },
  "cards-emeraude": { c1: "#1f6b45", c2: "#288d58", border: "#164f32", accent: "rgba(190,240,210,.6)" },
  "cards-or":       { c1: "#8a6a1a", c2: "#a8842a", border: "#6b5010", accent: "rgba(255,240,200,.7)" },
  "cards-onyx":     { c1: "#1e1e22", c2: "#2c2c32", border: "#101014", accent: "rgba(232,201,106,.65)" },
  // ── Collection drapeaux ──
  "cards-fr": {
    bg: "linear-gradient(90deg,#002395 0 33.4%,#f5f5f5 33.4% 66.7%,#ED2939 66.7%)",
    border: "#1a1a2e", accent: "rgba(0,0,0,.18)",
  },
  "cards-es": {
    bg: "linear-gradient(180deg,#AA151B 0 25%,#F1BF00 25% 75%,#AA151B 75%)",
    border: "#6b0d11", accent: "rgba(0,0,0,.18)",
  },
  "cards-dz": {
    bg: "linear-gradient(90deg,#006233 0 50%,#f5f5f5 50%)",
    emblem: { char: "☪", color: "#D21034" },
    border: "#00401f", accent: "rgba(0,0,0,.15)",
  },
  "cards-ma": {
    bg: "#C1272D",
    emblem: { char: "★", color: "#006233" },
    border: "#7a1519", accent: "rgba(0,0,0,.2)",
  },
  "cards-tn": {
    bg: "radial-gradient(circle at 50% 50%, #f5f5f5 0 32%, #E70013 33%)",
    emblem: { char: "☪", color: "#E70013" },
    border: "#96000d", accent: "rgba(0,0,0,.15)",
  },
  "cards-al": {
    bg: "#E41E20",
    emblem: { char: "🦅", color: "#1a1a1a" },
    border: "#8f1012", accent: "rgba(0,0,0,.25)",
  },
  "cards-rs": {
    bg: "linear-gradient(180deg,#C6363C 0 33.4%,#0C4076 33.4% 66.7%,#f5f5f5 66.7%)",
    border: "#08284a", accent: "rgba(0,0,0,.18)",
  },
  "cards-ru": {
    bg: "linear-gradient(180deg,#f5f5f5 0 33.4%,#0039A6 33.4% 66.7%,#D52B1E 66.7%)",
    border: "#00246b", accent: "rgba(0,0,0,.18)",
  },
  "cards-it": {
    bg: "linear-gradient(90deg,#008C45 0 33.4%,#F4F5F0 33.4% 66.7%,#CD212A 66.7%)",
    border: "#00542a", accent: "rgba(0,0,0,.18)",
  },
  "cards-sn": {
    bg: "linear-gradient(90deg,#00853F 0 33.4%,#FDEF42 33.4% 66.7%,#E31B23 66.7%)",
    emblem: { char: "★", color: "#00853F" },
    border: "#005226", accent: "rgba(0,0,0,.18)",
  },
  "cards-cd": {
    bg: "linear-gradient(115deg,#007FFF 0 36%,#F7D618 36% 43%,#CE1021 43% 57%,#F7D618 57% 64%,#007FFF 64%)",
    emblem: { char: "★", color: "#F7D618" },
    border: "#004a94", accent: "rgba(0,0,0,.18)",
  },
  "cards-gitan": {
    bg: "linear-gradient(180deg,#0072CE 0 50%,#009A44 50%)",
    emblem: { char: "☸", color: "#D40000" },
    border: "#00417a", accent: "rgba(255,255,255,.25)",
  },
};

export const tableTheme = (code?: string): TableTheme => TABLE_THEMES[code || "classic"] || TABLE_THEMES.classic;
export const cardTheme = (code?: string): CardTheme => CARD_THEMES[code || "cards-classic"] || CARD_THEMES["cards-classic"];
