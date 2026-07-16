"use client";

export default function TutorialModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-2xl p-5 border border-gold/40 max-h-[85vh] flex flex-col"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #1e3324 0%, #0c1810 90%)" }}>

        <div className="flex items-start justify-between mb-2">
          <div className="font-display text-gold text-[22px]">🃏 Tutoriel</div>
          <button onClick={onClose} className="text-white/40 text-xl leading-none px-1">×</button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 text-[13px] leading-relaxed text-emerald-50/90 space-y-3">
          <Section title="🎯 Le but">
            Faire un meilleur score que la banque. Le score parfait, c'est <b className="text-gold">9</b> — le fameux <b className="text-gold">Nioufi</b> !
          </Section>

          <Section title="🂡 Les cartes">
            On joue avec 40 cartes (un jeu classique sans les 8, 9 et 10).
            L'<b>As vaut 1</b>, les cartes <b>2 à 7 valent leur chiffre</b>, et les images
            (Valet, Dame, Roi) valent <b>0</b>.
          </Section>

          <Section title="💀 La bouteille">
            Ton score, c'est le total de tes 3 cartes... mais on ne garde que le
            <b> chiffre des unités</b>. Faire 10, c'est faire 0 — c'est la <b className="text-red-400">bouteille</b>,
            le pire score possible. Exemple : 7 + 6 + 5 = 18 → tu as <b>8 points</b>.
          </Section>

          <Section title="🏦 La banque">
            En début de partie, on distribue les cartes une par une : le premier As désigne
            celui qui coupe ✂️, le deuxième As désigne la <b className="text-gold">Banque</b>.
            La banque couvre toutes les mises et <b>gagne les égalités</b>. Et si elle fait 9,
            tout le monde perd direct !
          </Section>

          <Section title="🎲 Une manche">
            1. La banque distribue <b>1 carte cachée</b> à chacun.<br />
            2. Chaque joueur <b>mise</b> — sur sa propre maison ou sur celle des autres !
            Tu peux jeter un œil 👁 à ta carte et à la première carte des autres maisons
            (jamais celle de la banque) pour décider.<br />
            3. La banque distribue <b>2 cartes de plus</b> à chacun.<br />
            4. La banque <b>retourne les cartes</b>, en commençant par les siennes.
            Toute mise sur une maison qui bat la banque est gagnée !
          </Section>

          <Section title="⭐ Faire 9">
            Si tu fais 9 (et pas la banque), tu gagnes ta mise <b>et</b> tu peux choisir
            de <b className="text-gold">prendre la banque</b> pour la manche suivante.
            La banque change aussi si elle est ruinée.
          </Section>

          <Section title="🪙 Les jetons">
            En invité : 100 jetons le temps d'une session. Avec un compte : ton solde est
            <b> conservé</b>, tu touches un <b className="text-gold">bonus quotidien</b> qui grimpe
            jusqu'au jour 7, et ton historique de gains/pertes est enregistré. Impossible de
            miser plus que ce que tu as — et la banque ne peut pas couvrir plus que son solde.
          </Section>
        </div>

        <button onClick={onClose}
          className="mt-3 w-full py-2.5 rounded-xl font-extrabold text-[14px] text-[#241d05]"
          style={{ background: "linear-gradient(140deg,#caa32f,#eed780,#caa32f)" }}>
          C'est parti ! 🃏
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-gold font-bold text-[13px] mb-0.5">{title}</div>
      <div>{children}</div>
    </div>
  );
}
