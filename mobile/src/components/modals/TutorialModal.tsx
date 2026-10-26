import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { C } from "../../lib/theme";
import { GoldButton, Sheet } from "../ui";

const B = ({ children, gold, red }: { children: ReactNode; gold?: boolean; red?: boolean }) => (
  <Text style={{ fontWeight: "800", color: gold ? C.gold : red ? C.red : "#ecfdf5" }}>{children}</Text>
);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.h}>{title}</Text>
      <Text style={s.p}>{children}</Text>
    </View>
  );
}

export default function TutorialModal({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="🃏 Tutoriel" onClose={onClose}>
      <Section title="🎯 Le but">
        Faire un meilleur score que la banque. Le score parfait, c'est <B gold>9</B> — le fameux <B gold>Nioufi</B> !
      </Section>
      <Section title="🂡 Les cartes">
        On joue avec 40 cartes (un jeu classique sans les 8, 9 et 10). L'<B>As vaut 1</B>, les cartes <B>2 à 7 valent leur chiffre</B>, et les images (Valet, Dame, Roi) valent <B>0</B>.
      </Section>
      <Section title="💀 La bouteille">
        Ton score, c'est le total de tes 3 cartes... mais on ne garde que le <B>chiffre des unités</B>. Faire 10, c'est faire 0 — c'est la <B red>bouteille</B>, le pire score possible. Exemple : 7 + 6 + 5 = 18 → tu as <B>8 points</B>.
      </Section>
      <Section title="🏦 La banque">
        En début de partie, on distribue les cartes une par une : le premier As désigne celui qui coupe ✂️, le deuxième As désigne la <B gold>Banque</B>. La banque couvre toutes les mises et <B>gagne les égalités</B>. Et si elle fait 9, tout le monde perd direct !
      </Section>
      <Section title="🎲 Une manche">
        1. Le coupeur coupe le paquet, puis la banque distribue <B>1 carte cachée</B> à chacun.{"\n"}
        2. Chaque joueur <B>mise</B> — sur sa propre maison ou sur celle des autres, et tu peux poser plusieurs mises sur plusieurs maisons avant de valider ! Touche une carte dorée 👁 pour regarder ta carte ou la première carte des autres maisons (jamais celle de la banque).{"\n"}
        3. La banque distribue <B>2 cartes de plus</B> à chacun.{"\n"}
        4. La banque <B>retourne les cartes</B>, en commençant par les siennes. Toute mise sur une maison qui bat la banque est gagnée !
      </Section>
      <Section title="⭐ Prendre la banque">
        Quand une maison fait 9 (et pas la banque), ceux qui ont <B>misé dessus</B> peuvent <B gold>prendre la banque</B> — posséder la maison ne suffit pas, il faut avoir parié ! Priorité : le propriétaire s'il a misé sur sa maison, sinon le plus gros parieur, puis les suivants s'il refuse. Si deux maisons font 9, priorité aux parieurs de la première servie — s'ils refusent tous, la main passe à ceux de la deuxième. La banque change aussi si elle est ruinée.
      </Section>
      <Section title="👻 La maison morte">
        À <B>2 joueurs</B>, une main fantôme sans propriétaire rejoint la table : la <B gold>maison morte</B>. Elle reçoit ses cartes comme tout le monde et on peut miser dessus — si elle bat la banque, les parieurs gagnent. Et si elle fait 9, celui qui a misé dessus peut prendre la banque !
      </Section>
      <Section title="🪙 Les jetons">
        En invité : 100 jetons le temps d'une session. Avec un compte : ton solde est <B>conservé</B>, tu touches un <B gold>bonus quotidien</B> qui grimpe jusqu'au jour 7, et ton historique de gains/pertes est enregistré. Les jetons sont 100 % virtuels, sans aucune valeur réelle.
      </Section>
      <GoldButton label="C'est parti ! 🃏" onPress={onClose} style={{ marginTop: 4 }} />
    </Sheet>
  );
}

const s = StyleSheet.create({
  h: { color: C.gold, fontWeight: "800", fontSize: 14, marginBottom: 3 },
  p: { color: "rgba(236,253,245,.9)", fontSize: 14, lineHeight: 21 },
});
