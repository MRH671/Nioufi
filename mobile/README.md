# Nioufi — appli mobile (iOS + Android)

Appli React Native / Expo. Elle se branche sur le **même serveur** que le site
(Railway) : mêmes comptes, mêmes soldes, mêmes tables. Un joueur sur l'appli
peut jouer à la même table qu'un joueur sur le site.

## Tester sur ton téléphone (Expo Go)

1. Installe **Expo Go** sur ton téléphone (App Store / Play Store)
2. Sur ton PC :
   ```bash
   cd mobile
   npm install
   npm run tunnel
   ```
3. Scanne le QR code (appareil photo sur iPhone, Expo Go sur Android)

`npm run tunnel` passe par Internet : ça marche même depuis WSL, et ton
téléphone n'a pas besoin d'être sur le même Wi-Fi.

## Installer l'appli sans Expo Go

- **Android (APK à partager)** : `npx eas-cli@latest build -p android --profile preview`
  (compte Expo gratuit). EAS envoie un lien de téléchargement de l'APK.
- **iPhone (TestFlight / App Store)** : nécessite le compte Apple Developer (99 $/an),
  puis `npx eas-cli@latest build -p ios --profile production` et
  `npx eas-cli@latest submit -p ios`.

## Structure

```
mobile/
├── App.tsx                  Accueil, compte, lobby, navigation
├── app.json                 Nom, icône, identifiants (com.mrh671.nioufi)
├── eas.json                 Profils de build (preview = APK, production = stores)
├── assets/                  Icône, splash, sons, drapeaux officiels
└── src/
    ├── lib/                 Socket, stockage sécurisé, sons + vibrations, skins
    └── components/          Table de jeu, cartes, tables SVG, pop-ups
```

Le serveur (`EXPO_PUBLIC_SOCKET_URL`) pointe par défaut sur la prod Railway.
