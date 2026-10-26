import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { API } from "../../lib/config";
import { C } from "../../lib/theme";
import { ErrorText, Field, GoldButton, Sheet } from "../ui";

export default function SuggestionModal({ token, onClose }: { token: string | null; onClose: () => void }) {
  const [content, setContent] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    if (content.trim().length < 5) { setErr("Dis-nous en un peu plus !"); return; }
    setBusy(true); setErr("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`${API}/api/suggestions`, { method: "POST", headers, body: JSON.stringify({ content: content.trim() }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Envoi impossible."); return; }
      setSent(true);
      setTimeout(onClose, 1800);
    } catch { setErr("Serveur injoignable."); }
    finally { setBusy(false); }
  };

  return (
    <Sheet title="💡 Une idée ?" onClose={onClose}>
      {sent ? (
        <View style={{ alignItems: "center", paddingVertical: 22 }}>
          <Text style={{ fontSize: 36, marginBottom: 6 }}>🙏</Text>
          <Text style={{ color: C.gold, fontWeight: "800", fontSize: 16 }}>Merci, c'est noté !</Text>
          <Text style={s.intro}>Chaque retour aide à améliorer le Nioufi.</Text>
        </View>
      ) : (
        <>
          <Text style={s.intro}>Le jeu est en phase de test : un bug, une règle qui manque, une idée de skin ? Balance tout, on lit chaque message.</Text>
          <Field value={content} onChangeText={setContent} maxLength={1000} multiline
            placeholder="Ton idée, ton bug, ton avis..." style={{ minHeight: 120, textAlignVertical: "top", fontSize: 15 }} />
          <Text style={s.count}>{content.length}/1000</Text>
          <ErrorText>{err}</ErrorText>
          <GoldButton label="Envoyer ma suggestion" onPress={send} busy={busy} style={{ marginTop: 8 }} />
        </>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  intro: { color: "rgba(52,211,153,.8)", fontSize: 13, marginBottom: 12, marginTop: 4, textAlign: "left" },
  count: { color: "rgba(255,255,255,.25)", fontSize: 11, marginTop: 4 },
});
