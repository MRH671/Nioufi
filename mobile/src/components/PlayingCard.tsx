import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import type { Card } from "../lib/types";
import { cardTheme, type CardTheme } from "../lib/skins";
import CardBack from "./CardBack";

const RED = ["♥", "♦"];

export default function PlayingCard({
  card, faceUp, w = 34, highlight = false, peekable = false, onPeek, delayIn = 0, back,
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
  const h = Math.round(w * 1.45);
  const shown = faceUp && !!card;

  // Retournement 3D : 0 = face visible, 1 = dos
  const flip = useRef(new Animated.Value(shown ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(flip, {
      toValue: shown ? 0 : 1, duration: 520,
      easing: Easing.bezier(0.4, 0.2, 0.2, 1), useNativeDriver: true,
    }).start();
  }, [shown, flip]);

  // Arrivée de la carte (distribution)
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 340, delay: delayIn, useNativeDriver: true }).start();
  }, [enter, delayIn]);

  const frontRot = flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRot = flip.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
  const isRed = card && RED.includes(card.suit);
  const ink = isRed ? "#b3272d" : "#17181f";

  return (
    <Pressable onPress={peekable ? onPeek : undefined} disabled={!peekable} hitSlop={4}>
      <Animated.View style={{
        width: w, height: h,
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
      }}>
        {/* Face */}
        <Animated.View style={[styles.face, {
          borderRadius: Math.max(3, w * 0.13), padding: w * 0.08,
          transform: [{ perspective: 600 }, { rotateY: frontRot }],
        }, highlight && styles.glow]}>
          <Text style={[styles.rank, { color: ink, fontSize: w * 0.34 }]}>{card?.rank}</Text>
          <Text style={[styles.suit, { color: ink, fontSize: w * 0.46 }]}>{card?.suit}</Text>
          <Text style={[styles.rank, styles.rot, { color: ink, fontSize: w * 0.34 }]}>{card?.rank}</Text>
        </Animated.View>
        {/* Dos */}
        <Animated.View style={[styles.back, {
          transform: [{ perspective: 600 }, { rotateY: backRot }],
        }, peekable && styles.peek]}>
          <CardBack theme={bk} w={w} h={h} highlight={peekable} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: "hidden",
    backgroundColor: "#fbfaf3", borderWidth: 1, borderColor: "#b8b3a4",
    justifyContent: "space-between",
    shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  back: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backfaceVisibility: "hidden",
    shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  rank: { fontWeight: "800", lineHeight: undefined, includeFontPadding: false },
  suit: { textAlign: "center", includeFontPadding: false },
  rot: { transform: [{ rotate: "180deg" }], alignSelf: "flex-end" },
  glow: { borderColor: "#ffd75a", shadowColor: "#ffd75a", shadowOpacity: 0.9, shadowRadius: 8 },
  peek: { shadowColor: "#e8c96a", shadowOpacity: 0.7, shadowRadius: 6 },
});
