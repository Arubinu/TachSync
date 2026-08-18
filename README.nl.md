<p align="center">
  <img width="400" height="400" alt="logo" src="https://github.com/user-attachments/assets/2d66e4e6-46ff-4513-9256-6a6dcf14a9e3" />
</p>

**Nederlands · [Français](README.fr.md) · [English](README.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Português](README.pt.md)**

Een dashboard voor in de auto: voertuiggegevens aan de ene kant van het scherm,
een geanimeerde avatar die op je rijstijl reageert aan de andere. Geïnspireerd
op de monitor van Suki in *2 Fast 2 Furious*.

Draait in een browser, is als app te installeren en **werkt offline** — een
tunnel of een gebied zonder bereik houdt hem niet tegen.

Een **Android-applicatie** wordt uit dezelfde code gebouwd, via Capacitor.

## 📍 Stand van zaken

| | |
|---|---|
| Interface, raster, avatars, thema's | ✅ |
| Rijsimulator | ✅ |
| ELM327-protocol en OBD-bron | ✅ geschreven en getest |
| Bluetooth-transport | ⏳ wacht op een adapter |
| Analyse van de rijstijl | ✅ |
| Rijmodus (Eco / Normaal / Sport) | ✅ |
| Kalibratie per voertuig | ✅ |

De voertuiggegevens komen voorlopig uit een **simulator**. De hele applicatie
werkt, maar een echte auto uitlezen vergt een OBD-II-adapter.

## 🛣️ Op de weg

**De wegcode gaat altijd voor.** Deze applicatie rechtvaardigt geen enkele overtreding, en
geen enkele stap van de kalibratie vraagt erom: ze gebeuren allemaal binnen de wettelijke
grenzen en de verkeerssituatie van dat moment.

Het scherm lees je in één oogopslag en bedien je niet tijdens het rijden. Laat tijdens een
opname of kalibratie je passagier het doen.

## 🚀 Aan de slag

```bash
npm install
npm run dev
```

| Opdracht | Effect |
|---|---|
| `npm run dev` | ontwikkelserver |
| `npm run build` | typecontrole, daarna bouwen |
| `npm test` | de testsuite |
| `npm run android:apk` | bouwt de Android-APK |
| `npm run android:install` | bouwt en installeert op een aangesloten toestel |
| `npm run clean` | verwijdert alles wat gegenereerd is (`clean:all`: ook `node_modules`) |

De Android-app vereist de Android-SDK en twee JDK's; zie
`android/gradle.properties`, waar de reden staat uitgelegd.

## 🎨 Aanpassen

| Wat | Hoe | Formaat |
|---|---|---|
| Tegels en achtergronden | catalogus → Importeren | JSON, zie `public/tiles/README.md` |
| Achtergrondafbeelding | Instellingen → Uiterlijk → Importeren | `.jpg`, `.png`, `.webp`, `.avif`, `.gif`, `.svg` |
| Avatars | Instellingen → Avatar → Importeren | `.riv`, `.glb`, `.gltf` |
| Volledige reservekopie | Instellingen → Reservekopie | `.tachsync` (een archief) |
| Eén persoon, voertuig of uiterlijk | Importeren / Exporteren, vanuit de kop | `.tachperson`, `.tachvehicle`, `.tachlook` |

Geïmporteerde avatars staan in IndexedDB. De app levert er slechts twee mee,
door code getekend en enkele kilobytes groot.

## 🔒 Gegevens

**Alles blijft op het toestel.** Geen account, geen server, geen telemetrie die
ergens heen gaat. Omdat browseropslag per herkomst gescheiden is, raak je bij
een ander adres of toestel alles kwijt: de `.tachsync`-reservekopie is de enige
brug. Hij bevat een leesbaar instellingenbestand en de avatars.

## 🧱 Architectuur

```
src/
├── telemetry/    datamodel en distributie
├── simulation/   bestuurder en voertuignatuurkunde
├── analysis/     momentane stijl en rijmodus
├── obd/          ELM327-protocol, transport, ontdekking
├── board/        raster, tegels, panelen
├── avatar/       register, weergave, import
├── theme/        themamanifesten
└── i18n/         zeven talen
```

De applicatie is geschreven tegen één `DataSource`-interface: de simulator en de
echte adapter zijn uitwisselbaar, en hardware aansluiten raakt geen enkel
interfaceonderdeel.

## 📄 Licentie

Uitgebracht onder de [MIT-licentie](LICENSE).
