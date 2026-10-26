import { StyleSheet, Text, View } from "react-native";
import { C } from "../../lib/theme";
import { GhostButton, GoldButton, Sheet } from "../ui";

export default function WelcomeModal({ onClose }: { onClose: (openSuggestion: boolean) => void }) {
  return (
    <Sheet title="Bienvenue au Nioufi ! 🃏" onClose={() => onClose(false)} dismissable={false}>
      <View style={{ gap: 9 }}>
        <Text style={s.p}>Le jeu est en <Text style={s.gold}>phase de test</Text> — et c'est toi qui vas le faire grandir.</Text>
        <Text style={s.p}>Joue le jeu à fond avec tes potes, et balance tes retours avec le bouton <Text style={s.gold}>💡</Text> (sur l'accueil et en jeu) :</Text>
        <Text style={s.list}>
          • une règle à améliorer ou qui manque{"\n"}
          • un bug ou un truc pas clair{"\n"}
          • des idées de skins de tables ou de cartes{"\n"}
          • tout ce qui te passe par la tête !
        </Text>
        <Text style={s.p}>On lit chaque message. 🙏</Text>
      </View>
      <GoldButton label="🃏 C'est parti !" onPress={() => onClose(false)} style={{ marginTop: 16 }} />
      <GhostButton label="💡 J'ai déjà une idée" tone="gold" onPress={() => onClose(true)} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  p: { color: "rgba(236,253,245,.88)", fontSize: 14.5, lineHeight: 21 },
  gold: { color: C.gold, fontWeight: "800" },
  list: { color: "rgba(110,231,183,.88)", fontSize: 13.5, lineHeight: 21 },
});
