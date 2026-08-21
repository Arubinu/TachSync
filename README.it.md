<p align="center">
  <img width="400" height="400" alt="logo" src="https://github.com/user-attachments/assets/2d66e4e6-46ff-4513-9256-6a6dcf14a9e3" />
</p>

**Italiano · [Français](README.fr.md) · [English](README.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Nederlands](README.nl.md) · [Português](README.pt.md)**

Un cruscotto di bordo: i dati del veicolo su un lato dello schermo, un avatar
animato che reagisce alla guida sull'altro. Ispirato al monitor di Suki in
*2 Fast 2 Furious*.

Funziona in un browser, si installa come applicazione e **funziona senza rete** —
una galleria o una zona senza copertura non lo fermano.

Un’**applicazione Android** viene costruita dallo stesso codice, tramite Capacitor.

## 📍 Stato

| | |
|---|---|
| Interfaccia, griglia, avatar, temi | ✅ |
| Simulatore di guida | ✅ |
| Protocollo ELM327 e sorgente OBD | ✅ scritto e collaudato |
| Trasporto Bluetooth | ⏳ in attesa di un adattatore |
| Analisi dello stile di guida | ✅ |
| Modo di guida (Eco / Normale / Sport) | ✅ |
| Calibrazione per veicolo | ✅ |

I dati del veicolo provengono per ora da un **simulatore**. L'intera
applicazione funziona, ma leggere un'auto vera richiede un adattatore OBD-II.

## 🛣️ Su strada

**Il codice della strada viene sempre prima.** Questa applicazione non giustifica alcuna
infrazione, e nessun passo della calibrazione ne richiede una: avvengono tutti entro i limiti
di legge e le condizioni di traffico del momento.

Lo schermo si legge con un'occhiata e non si manipola guidando. Durante una registrazione o
una calibrazione, lascia fare al tuo passeggero.

## 🚀 Iniziare

```bash
npm install
npm run dev
```

| Comando | Effetto |
|---|---|
| `npm run dev` | server di sviluppo |
| `npm run build` | verifica dei tipi, poi compilazione |
| `npm test` | la suite di test |
| `npm run android:sync` | compila, poi ricopia il risultato nel progetto Android |
| `npm run android:apk` | compila l'APK a partire dall'ultima sincronizzazione |
| `npm run android:install` | sincronizza, compila e installa su un dispositivo collegato |
| `npm run clean` | elimina tutto il generato (`clean:all`: anche `node_modules`) |

L'APK finisce in `android/app/build/outputs/apk/debug/app-debug.apk`. Esegui `android:sync` prima di
`android:apk`: `npm run build` da solo riempie `dist/` e non scrive nulla sotto `android/`, quindi
Gradle impacchetterebbe la compilazione web precedente, o fallirebbe del tutto dopo un `clean`, che
elimina i sorgenti Gradle generati insieme al resto.

L'applicazione Android richiede l'SDK Android e due JDK; vedi
`android/gradle.properties`, dove è spiegato il motivo.

## 🎨 Personalizzazione

| Cosa | Come | Formato |
|---|---|---|
| Riquadri e sfondi | catalogo → Importa | JSON, vedi `public/tiles/README.md` |
| Immagine di sfondo | Impostazioni → Aspetto → Importa | `.jpg`, `.png`, `.webp`, `.avif`, `.gif`, `.svg` |
| Avatar | Impostazioni → Avatar → Importa | `.riv`, `.glb`, `.gltf` |
| Backup completo | Impostazioni → Backup | `.tachsync` (un archivio) |
| Una persona, un veicolo, un aspetto | Importa / Esporta, dall’intestazione | `.tachperson`, `.tachvehicle`, `.tachlook` |

Gli avatar importati risiedono in IndexedDB. L'applicazione ne include solo due,
disegnati dal codice e pesanti pochi kilobyte.

## 🔒 Dati

**Tutto resta sul dispositivo.** Nessun account, nessun server, nessuna
telemetria inviata da nessuna parte. Poiché l'archiviazione del browser è
separata per origine, cambiare indirizzo o dispositivo fa perdere tutto: il
backup `.tachsync` è l'unico ponte. Contiene un file di impostazioni leggibile e
gli avatar.

## 🧱 Architettura

```
src/
├── telemetry/    modello dei dati e distribuzione
├── simulation/   conducente e fisica del veicolo
├── analysis/     stile istantaneo e modo di guida
├── obd/          protocollo ELM327, trasporto, rilevamento
├── board/        griglia, riquadri, pannelli
├── avatar/       registro, rendering, importazione
├── theme/        manifesti dei temi
└── i18n/         sette lingue
```

L'applicazione è scritta su un'unica interfaccia `DataSource`: simulatore e
adattatore reale sono intercambiabili, e collegare l'hardware non tocca alcun
componente dell'interfaccia.

## 📄 Licenza

Distribuito sotto [licenza MIT](LICENSE).
