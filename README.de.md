<p align="center">
  <img width="400" height="400" alt="logo" src="https://github.com/user-attachments/assets/2d66e4e6-46ff-4513-9256-6a6dcf14a9e3" />
</p>

**Deutsch · [Français](README.fr.md) · [English](README.md) · [Español](README.es.md) · [Nederlands](README.nl.md) · [Italiano](README.it.md) · [Português](README.pt.md)**

Ein Bordcomputer-Display: Fahrzeugdaten auf der einen Bildschirmhälfte, ein
animierter Avatar, der auf die Fahrweise reagiert, auf der anderen. Inspiriert
von Sukis Monitor in *2 Fast 2 Furious*.

Läuft im Browser, lässt sich als App installieren und **funktioniert offline** —
ein Tunnel oder ein Funkloch hält sie nicht auf.

Eine **Android-Anwendung** entsteht aus demselben Code, über Capacitor.

## 📍 Stand

| | |
|---|---|
| Oberfläche, Raster, Avatare, Themen | ✅ |
| Fahrsimulator | ✅ |
| ELM327-Protokoll und OBD-Quelle | ✅ geschrieben und getestet |
| Bluetooth-Übertragung | ⏳ wartet auf einen Adapter |
| Analyse des Fahrstils | ✅ |
| Fahrmodus (Öko / Normal / Sport) | ✅ |
| Kalibrierung je Fahrzeug | ✅ |

Die Fahrzeugdaten stammen derzeit aus einem **Simulator**. Die gesamte
Anwendung funktioniert, ein echtes Auto auszulesen erfordert aber einen
OBD-II-Adapter.

## 🛣️ Auf der Straße

**Die Straßenverkehrsordnung gilt immer zuerst.** Diese Anwendung rechtfertigt keinen
Verstoß, und kein Schritt der Kalibrierung verlangt einen: alle finden innerhalb der
gesetzlichen Grenzen und der jeweiligen Verkehrslage statt.

Der Bildschirm wird im Vorbeischauen gelesen und nicht während der Fahrt bedient. Während
einer Aufzeichnung oder Kalibrierung lass deinen Beifahrer tippen.

## 🚀 Loslegen

```bash
npm install
npm run dev
```

| Befehl | Wirkung |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Typprüfung, dann Build |
| `npm test` | die Testsuite |
| `npm run android:apk` | baut das Android-APK |
| `npm run android:install` | baut und installiert auf einem angeschlossenen Gerät |
| `npm run clean` | entfernt alles Erzeugte (`clean:all`: auch `node_modules`) |

Die Android-App braucht das Android-SDK und zwei JDKs; siehe
`android/gradle.properties`, wo der Grund erklärt wird.

## 🎨 Anpassen

| Was | Wie | Format |
|---|---|---|
| Kacheln und Hintergründe | Katalog → Importieren | JSON, siehe `public/tiles/README.md` |
| Hintergrundbild | Einstellungen → Erscheinungsbild → Importieren | `.jpg`, `.png`, `.webp`, `.avif`, `.gif`, `.svg` |
| Avatare | Einstellungen → Avatar → Importieren | `.riv`, `.glb`, `.gltf` |
| Vollständige Sicherung | Einstellungen → Sicherung | `.tachsync` (ein Archiv) |
| Eine Person, ein Fahrzeug, ein Erscheinungsbild | Importieren / Exportieren, aus der Kopfzeile | `.tachperson`, `.tachvehicle`, `.tachlook` |

Importierte Avatare liegen in IndexedDB. Die App bringt nur zwei mit, per Code
gezeichnet und wenige Kilobyte groß.

## 🔒 Daten

**Alles bleibt auf dem Gerät.** Kein Konto, kein Server, keine Telemetrie, die
irgendwohin geschickt wird. Da der Browser-Speicher nach Herkunft getrennt ist,
geht beim Wechsel von Adresse oder Gerät alles verloren: die
`.tachsync`-Sicherung ist die einzige Brücke. Sie enthält eine lesbare
Einstellungsdatei und die Avatare.

## 🧱 Architektur

```
src/
├── telemetry/    Datenmodell und Verteilung
├── simulation/   Fahrer und Fahrzeugphysik
├── analysis/     Momentanstil und Fahrmodus
├── obd/          ELM327-Protokoll, Übertragung, Suche
├── board/        Raster, Kacheln, Panels
├── avatar/       Registrierung, Darstellung, Import
├── theme/        Themenmanifeste
└── i18n/         sieben Sprachen
```

Die Anwendung ist gegen eine einzige `DataSource`-Schnittstelle geschrieben:
Simulator und echter Adapter sind austauschbar, und das Anschließen der Hardware
berührt keine Oberflächenkomponente.

## 📄 Lizenz

Veröffentlicht unter der [MIT-Lizenz](LICENSE).
