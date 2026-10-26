// Dos de carte : rayures classiques, drapeau officiel ou drapeau gitan,
// avec la signature "N" dans les deux coins du même côté.
import { useId } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle, Defs, G, Path, Pattern, Rect } from "react-native-svg";
import { flagSource, type CardTheme } from "../lib/skins";
import { DISPLAY } from "../lib/theme";

export default function CardBack({ theme, w, h, highlight }: {
  theme: CardTheme; w: number; h: number; highlight?: boolean;
}) {
  const radius = Math.max(3, w * 0.13);
  const nColor = theme.kind === "stripes" ? theme.accent : "rgba(255,255,255,.93)";
  const nSize = Math.max(7, w * 0.24);
  // id unique par carte : évite les collisions de motifs SVG entre cartes
  const pid = "st" + useId().replace(/[^a-zA-Z0-9]/g, "");

  return (
    <View style={[styles.box, {
      width: w, height: h, borderRadius: radius,
      borderColor: highlight ? "rgba(232,201,106,.9)" : theme.border,
    }]}>
      {theme.kind === "stripes" && (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern id={pid} patternUnits="userSpaceOnUse" width={10} height={10} patternTransform="rotate(45)">
              <Rect width={5} height={10} fill={theme.c1} />
              <Rect x={5} width={5} height={10} fill={theme.c2} />
            </Pattern>
          </Defs>
          <Rect width={w} height={h} fill={`url(#${pid})`} />
          <Rect x={w * 0.15} y={h * 0.11} width={w * 0.7} height={h * 0.78} rx={3}
            fill="none" stroke={theme.accent} strokeOpacity={0.7} strokeWidth={1.3} />
        </Svg>
      )}
      {theme.kind === "flag" && (
        <Image source={flagSource(theme.code)} style={StyleSheet.absoluteFill} contentFit="fill" />
      )}
      {theme.kind === "gitan" && (
        <Svg width={w} height={h} viewBox="0 0 18 26" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <Rect width={18} height={13} fill="#0072CE" />
          <Rect y={13} width={18} height={13} fill="#009A44" />
          <G stroke="#D40000" fill="none">
            <Circle cx={9} cy={13} r={6.2} strokeWidth={1.2} />
            <Path strokeWidth={0.7}
              d="M15.2 13H2.8M14.73 15.37 3.27 10.63M13.38 17.38 4.62 8.62M11.37 18.73 6.63 7.27M9 19.2V6.8M6.63 18.73 11.37 7.27M4.62 17.38 13.38 8.62M3.27 15.37 14.73 10.63" />
          </G>
          <Circle cx={9} cy={13} r={1.15} fill="#D40000" />
        </Svg>
      )}

      {theme.kind === "stripes" && w >= 44 && (
        <Text style={[styles.centerN, { color: theme.accent, fontSize: w * 0.3 }]}>N</Text>
      )}
      {/* Signature N — coins du même côté */}
      <Text style={[styles.n, { top: w * 0.05, left: w * 0.1, fontSize: nSize, color: nColor }]}>N</Text>
      <Text style={[styles.n, styles.flip, { bottom: w * 0.05, left: w * 0.1, fontSize: nSize, color: nColor }]}>N</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: "hidden", borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#111" },
  centerN: { fontFamily: DISPLAY, fontStyle: "italic" },
  n: {
    position: "absolute", fontFamily: DISPLAY, fontStyle: "italic", fontWeight: "700",
    textShadowColor: "rgba(0,0,0,.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
  flip: { transform: [{ rotate: "180deg" }] },
});
