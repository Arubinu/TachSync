<p align="center">
  <img width="400" height="400" alt="logo" src="https://github.com/user-attachments/assets/2d66e4e6-46ff-4513-9256-6a6dcf14a9e3" />
</p>

**Français · [Español](README.es.md) · [Deutsch](README.de.md) · [Nederlands](README.nl.md) · [Italiano](README.it.md) · [Português](README.pt.md) · [English](README.md)**

Un tableau de bord embarqué : les données du véhicule d'un côté de l'écran, un
avatar animé qui réagit à la conduite de l'autre. Inspiré du moniteur de Suki
dans *2 Fast 2 Furious*.

Fonctionne dans un navigateur, s'installe comme application, et **marche hors
réseau** — un tunnel ou une zone blanche ne l'arrête pas.

Une **application Android** est construite depuis le même code, via Capacitor.

## 🛣️ Sur la route

**Le code de la route prime, tout le temps.** Cette application ne justifie aucune infraction,
et aucune étape de la calibration n'en demande une : elles se font toutes dans les limites
légales et les conditions de circulation du moment.

L'écran se lit d'un coup d'œil et ne se manipule pas en roulant. Pendant une capture ou une
calibration, laisse faire ton passager.

## 📍 État

| | |
|---|---|
| Interface, grille, avatars, thèmes | ✅ |
| Simulateur de conduite | ✅ |
| Protocole ELM327 et source OBD | ✅ écrit et testé |
| Transport Bluetooth | ⏳ en attente d'un adaptateur |
| Analyse du style de conduite | ✅ |
| Mode de conduite (Éco / Normal / Sport) | ✅ |
| Calibration par véhicule | ✅ |

Les données du véhicule sont pour l'instant produites par un **simulateur**.
Toute l'application fonctionne, mais il faut un adaptateur OBD-II pour lire une
vraie voiture.

## 🚀 Démarrer

```bash
npm install
npm run dev
```

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` | vérification de types puis construction |
| `npm test` | la suite de tests |
| `npm run android:apk` | construit l'APK Android |
| `npm run android:install` | construit et installe sur un appareil branché |
| `npm run clean` | supprime tout ce qui est généré (`clean:all` : aussi `node_modules`) |

L'application Android exige le SDK Android et deux JDK ; voir
`android/gradle.properties`, qui explique pourquoi.

## 🎨 Personnalisation

| Quoi | Comment | Format |
|---|---|---|
| Tuiles et fonds | catalogue → Importer | JSON, voir `public/tiles/README.md` |
| Image de fond | Réglages → Apparence → Importer | `.jpg`, `.png`, `.webp`, `.avif`, `.gif`, `.svg` |
| Avatars | Réglages → Avatar → Importer | `.riv`, `.glb`, `.gltf` |
| Sauvegarde complète | Réglages → Sauvegarde | `.tachsync` (archive) |
| Une personne, un véhicule, une apparence | Importer / Exporter, depuis l’en-tête | `.tachperson`, `.tachvehicle`, `.tachlook` |

Les avatars importés vivent dans IndexedDB. L'application n'en livre que deux,
dessinés par le code et pesant quelques kilo-octets.

## 🔒 Données

**Tout reste sur l'appareil.** Aucun compte, aucun serveur, aucune télémétrie
envoyée nulle part. Le stockage d'un navigateur étant cloisonné par origine,
changer d'adresse ou d'appareil fait tout perdre : la sauvegarde `.tachsync` est
la seule passerelle. Elle contient toutes les personnes, tous les véhicules et
toutes les apparences, l’historique des trajets et les avatars importés.

## 🧱 Architecture

```
src/
├── telemetry/    modèle de données et distribution
├── simulation/   conducteur et physique du véhicule
├── analysis/     style instantané et mode de conduite
├── obd/          protocole ELM327, transport, découverte
├── board/        grille, tuiles, panneaux
├── avatar/       registre, rendu, import
├── theme/        manifestes de thème
└── i18n/         sept langues
```

L'application est écrite contre une interface `DataSource` unique : le
simulateur et l'adaptateur réel sont interchangeables, et brancher le matériel
ne touche aucun composant d'interface.

## 📄 Licence

Distribué sous [licence MIT](LICENSE).
