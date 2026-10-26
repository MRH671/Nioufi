import { ReactNode } from "react";
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput,
  type TextInputProps, type TextStyle, View, type ViewStyle, KeyboardAvoidingView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, DISPLAY, GOLD_GRADIENT, SHEET_GRADIENT } from "../lib/theme";
import { tapFeedback } from "../lib/sounds";

// ─── Boutons ──────────────────────────────────────────────────────────────────
export function GoldButton({ label, onPress, disabled, busy, small, style }: {
  label: string; onPress?: () => void; disabled?: boolean; busy?: boolean; small?: boolean; style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPress?.(); }}
      disabled={disabled || busy}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
      <LinearGradient colors={GOLD_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.btn, small && s.btnSmall, s.goldShadow]}>
        {busy
          ? <ActivityIndicator color={C.goldInk} />
          : <Text style={[s.goldLabel, small && { fontSize: 13 }]}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

export function GhostButton({ label, onPress, disabled, small, tone = "neutral", style }: {
  label: string; onPress?: () => void; disabled?: boolean; small?: boolean;
  tone?: "neutral" | "gold" | "muted"; style?: ViewStyle;
}) {
  const t = tone === "gold"
    ? { bg: "rgba(232,201,106,.1)", border: "rgba(232,201,106,.32)", color: C.gold }
    : tone === "muted"
      ? { bg: "rgba(255,255,255,.04)", border: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.5)" }
      : { bg: "rgba(255,255,255,.09)", border: "rgba(255,255,255,.2)", color: "#e5e7eb" };
  return (
    <Pressable
      onPress={() => { tapFeedback(); onPress?.(); }}
      disabled={disabled}
      style={({ pressed }) => [
        s.btn, small && s.btnSmall,
        { backgroundColor: t.bg, borderColor: t.border, borderWidth: 1, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
        style,
      ]}>
      <Text style={[s.ghostLabel, { color: t.color }, small && { fontSize: 12.5 }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Textes ───────────────────────────────────────────────────────────────────
export function Title({ children, size = 22, style }: { children: ReactNode; size?: number; style?: TextStyle }) {
  return <Text style={[{ fontFamily: DISPLAY, color: C.gold, fontSize: size }, style]}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text style={s.error}>{children}</Text>;
}

// ─── Champ de saisie ──────────────────────────────────────────────────────────
export function Field({ grow, ...props }: TextInputProps & { grow?: boolean }) {
  const input = (
    <TextInput
      placeholderTextColor="rgba(255,255,255,.3)"
      selectionColor={C.gold}
      {...props}
      style={[s.input, grow && { width: "100%" }, props.style]}
    />
  );
  // grow : le champ prend la place restante d'une ligne sans pousser les boutons hors écran
  return grow ? <View style={{ flex: 1, minWidth: 0 }}>{input}</View> : input;
}

// ─── Fenêtre modale (même habillage que les pop-ups du site) ─────────────────
export function Sheet({ visible = true, title, right, onClose, children, scroll = true, dismissable = true }: {
  visible?: boolean; title: string; right?: ReactNode; onClose: () => void;
  children: ReactNode; scroll?: boolean; dismissable?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissable ? onClose : undefined} />
        <LinearGradient colors={SHEET_GRADIENT} style={s.sheet}>
          <View style={s.sheetHead}>
            <Title style={{ flexShrink: 1 }}>{title}</Title>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              {right}
              <Pressable onPress={onClose} hitSlop={14}>
                <Text style={s.close}>×</Text>
              </Pressable>
            </View>
          </View>
          {scroll
            ? <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{children}</ScrollView>
            : children}
        </LinearGradient>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={() => { tapFeedback(); onPress(); }}
      style={[s.chip, active ? { backgroundColor: C.gold } : { backgroundColor: "rgba(0,0,0,.35)" }]}>
      <Text style={[s.chipLabel, { color: active ? C.goldInk : C.creamDim }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: { borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  btnSmall: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12 },
  goldShadow: { shadowColor: C.gold, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  goldLabel: { color: C.goldInk, fontWeight: "800", fontSize: 15 },
  ghostLabel: { fontWeight: "700", fontSize: 13.5 },
  label: { color: C.gold, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 },
  muted: { color: "rgba(255,255,255,.35)", fontSize: 11.5 },
  error: { color: C.red, fontSize: 13, textAlign: "center", marginTop: 10 },
  input: {
    borderRadius: 12, paddingHorizontal: 13, paddingVertical: Platform.OS === "ios" ? 12 : 9,
    backgroundColor: "rgba(0,0,0,.35)", borderWidth: 1, borderColor: "rgba(232,201,106,.25)",
    color: "#fff", fontSize: 16,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.75)", justifyContent: "center", padding: 16 },
  sheet: {
    borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(232,201,106,.4)",
    maxHeight: "86%", width: "100%", maxWidth: 440, alignSelf: "center",
  },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 },
  close: { color: "rgba(255,255,255,.45)", fontSize: 28, lineHeight: 28, paddingHorizontal: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: "rgba(232,201,106,.4)" },
  chipLabel: { fontSize: 12.5, fontWeight: "700" },
});
