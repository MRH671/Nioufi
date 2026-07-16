# 🃏 Nioufi

**Jeu de cartes multijoueur en temps réel — chacun sur son téléphone, une seule table.**

Le Nioufi est un jeu de cartes traditionnel proche du baccara : battez la banque en vous approchant du score parfait, le **9**. Ce projet le porte en ligne avec des tables privées, des comptes joueurs et une économie de jetons persistante.

🎮 **Jouer : [nioufi.vercel.app](https://nioufi.vercel.app)**

---

## ✨ Fonctionnalités

- **Multijoueur temps réel** — tables privées de 2 à 13 joueurs, code à 4 caractères à partager
- **Anti-triche par design** — toute la logique tourne côté serveur ; les cartes cachées ne sont *jamais* envoyées aux clients, même chiffrées
- **Cérémonie des As** — désignation animée de la banque, fidèle au jeu réel
- **Système de "peek"** — regardez vos cartes et la première carte des autres maisons, validé serveur, visible uniquement sur votre écran
- **Paris croisés** — misez sur votre maison ou sur celle des autres, la banque couvre tout (dans la limite de son solde : aucun jeton négatif possible)
- **Comptes joueurs** — JWT + bcrypt, solde conservé entre les sessions, mode invité disponible
- **Bonus quotidien** — calendrier de récompenses sur 7 jours (50 → 500 jetons), série remise à zéro après 48 h d'absence
- **Historique** — bilan gains/pertes et détail des 50 dernières manches
- **Ambiance de table** — sons synthétisés en WebAudio (distribution, retournement, jetons, victoire), fil d'activité en direct, animations de cartes en 3D
- **Anti-abus** — limite d'inscriptions par IP
- **Tutoriel intégré** — les règles complètes accessibles en un clic

## 🎲 Les règles en bref

- 40 cartes (jeu classique sans les 8, 9 et 10) — As = 1, cartes 2-7 = valeur faciale, images = 0
- Score = total des 3 cartes, **modulo 10**. Faire 10 = 0 point : la **bouteille** 💀
- Le meilleur score est **9** : le Nioufi ⭐
- 1 carte cachée → paris → 2 cartes → retournement (banque en premier)
- La banque gagne les égalités ; si elle fait 9, tout le monde perd
- Un joueur qui fait 9 peut prendre la banque

Le tutoriel complet est disponible dans l'application.

## 🏗️ Architecture

```
nioufi/
├── server/          Express + Socket.io + PostgreSQL
│   └── src/
│       ├── game.js      Logique du jeu (classe Room) — source de vérité
│       ├── index.js     Serveur, rooms, diffusion d'état filtré par joueur
│       ├── auth.js      Inscription / connexion / bonus / historique (JWT)
│       └── db.js        PostgreSQL : users, history, bonus quotidien
└── web/             Next.js 14 (App Router) + TypeScript + Tailwind
    ├── app/             Accueil, lobby, authentification
    ├── components/      Table de jeu, cartes, modals (bonus, historique, tutoriel)
    └── lib/             Client Socket.io, sons WebAudio, types
```

**Le principe clé : le serveur est l'unique source de vérité.** Chaque joueur reçoit une version de l'état filtrée selon ses droits — les cartes qu'il n'a pas le droit de voir sont remplacées par `null` avant l'envoi. Inspecter le trafic réseau ne révèle rien.

## 🚀 Lancer en local

Prérequis : Node.js 18+, et optionnellement PostgreSQL (sans BDD, le jeu fonctionne en mode invité uniquement).

**Terminal 1 — serveur :**
```bash
cd server
npm install
npm run dev          # → http://localhost:5001
```

**Terminal 2 — front :**
```bash
cd web
npm install
cp .env.local.example .env.local
npm run dev          # → http://localhost:3000
```

### Variables d'environnement

| Variable | Où | Description |
|---|---|---|
| `PORT` | serveur | Port d'écoute (défaut : 5001) |
| `CLIENT_URL` | serveur | URL du front pour le CORS |
| `DATABASE_URL` | serveur | Connexion PostgreSQL (optionnelle en dev) |
| `JWT_SECRET` | serveur | Clé de signature des tokens — longue et secrète |
| `NEXT_PUBLIC_SOCKET_URL` | front | URL du serveur |

## ☁️ Déploiement

- **Serveur** → [Railway](https://railway.app) : root directory `server`, ajouter un service PostgreSQL et lier `DATABASE_URL`, définir `JWT_SECRET` et `CLIENT_URL`
- **Front** → [Vercel](https://vercel.com) : root directory `web`, définir `NEXT_PUBLIC_SOCKET_URL`

Chaque push sur `main` redéploie automatiquement les deux services.

## 🗺️ Roadmap

- [ ] Thèmes de tables
- [ ] Classement des joueurs
- [ ] Recharge de secours à 0 jeton
- [ ] Application mobile (React Native — le serveur Socket.io se réutilise tel quel)

## 👤 Auteur

**Théo Merah** — étudiant à Epitech
Projet personnel : conception, développement full-stack et déploiement.

---

*Les jetons du Nioufi sont une monnaie purement virtuelle, sans valeur réelle et non convertible.*
