# Nioufi 🃏

Jeu de cartes Nioufi en ligne — chacun sur son téléphone, une seule table.

## Architecture

```
nioufi/
├── server/    Express + Socket.io (port 5001) — autorité du jeu, anti-triche
└── web/       Next.js 14 App Router + TypeScript + Tailwind (port 3000)
```

Le serveur est la **source de vérité** : les cartes ne quittent jamais le serveur
tant qu'un joueur n'a pas le droit de les voir. Impossible de tricher en
inspectant le trafic réseau.

## Lancer en local

**Terminal 1 — serveur :**
```bash
cd server
npm install
npm run dev
```

**Terminal 2 — front :**
```bash
cd web
npm install
cp .env.local.example .env.local
npm run dev
```

Ouvre http://localhost:3000

## Tester à plusieurs sur le même réseau Wi-Fi

1. Trouve ton IP locale : `ip addr` (WSL) ou `ipconfig` (Windows)
2. Dans `web/.env.local` : `NEXT_PUBLIC_SOCKET_URL=http://TON_IP:5001`
3. Lance le front avec `npm run dev -- -H 0.0.0.0`
4. Les autres ouvrent `http://TON_IP:3000` sur leur téléphone

⚠️ Depuis WSL il faut rediriger les ports vers Windows :
```powershell
# PowerShell admin
netsh interface portproxy add v4tov4 listenport=3000 connectaddress=localhost connectport=3000
netsh interface portproxy add v4tov4 listenport=5001 connectaddress=localhost connectport=5001
```

## Déployer (pour jouer hors du même Wi-Fi)

- **Serveur** : Railway / Render / Fly.io (gratuit pour commencer).
  Définis la variable `CLIENT_URL` avec l'URL de ton front.
- **Front** : Vercel. Définis `NEXT_PUBLIC_SOCKET_URL` avec l'URL du serveur.

## Règles du Nioufi (rappel)

- 40 cartes (jeu de 52 sans les 8, 9, 10), 2 à 13 joueurs
- As = 1, cartes 2-7 = valeur faciale, images (V/D/R) = 0
- Score = total modulo 10 → faire 10/20 = « bouteille » (on retire la dizaine)
- Meilleur score : **9** (le Nioufi)
- Désignation de la banque : distribution carte par carte, 1er As coupe, 2e As = banque
- 1 carte cachée → paris (on peut miser sur sa maison ou celle des autres) →
  la banque couvre → 2 cartes de plus → retournement, banque en premier
- La banque gagne les égalités. Si la banque fait 9, tout le monde perd.
- La banque change si elle est ruinée, ou si un joueur fait 9 et accepte de la prendre.

## À faire ensuite

- [ ] Thèmes de tables
- [ ] Sons (cartes, jetons)
- [ ] Reconnexion améliorée en pleine manche
- [ ] Comptes joueurs + historique (PostgreSQL)
- [ ] Version appli (React Native — la logique Socket.io se réutilise telle quelle)
