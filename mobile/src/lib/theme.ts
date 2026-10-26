import { Platform } from "react-native";

export const C = {
  gold: "#e8c96a",
  goldLight: "#eed780",
  goldDark: "#caa32f",
  goldInk: "#241d05",
  bg: "#0c1810",
  bgTop: "#1e3324",
  felt: "#1c4a2b",
  cream: "#f0e6c8",
  creamDim: "#e8dcb8",
  mint: "#7da884",
  mintBright: "#6ee7a0",
  green: "#4ade80",
  red: "#f87171",
  white: "#ffffff",
};

/** Police "affiche" (Georgia sur iOS, serif système sur Android) */
export const DISPLAY = Platform.select({ ios: "Georgia", default: "serif" });

export const GOLD_GRADIENT = ["#caa32f", "#eed780", "#caa32f"] as const;
export const SHEET_GRADIENT = ["#1e3324", "#0c1810"] as const;
