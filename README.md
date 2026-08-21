<p align="center">
  <img width="400" height="400" alt="logo" src="https://github.com/user-attachments/assets/2d66e4e6-46ff-4513-9256-6a6dcf14a9e3" />
</p>

**English · [Français](README.fr.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Nederlands](README.nl.md) · [Italiano](README.it.md) · [Português](README.pt.md)**

An in-car dashboard: vehicle data on one side of the screen, an animated avatar
reacting to your driving on the other. Inspired by Suki's monitor in *2 Fast 2
Furious*.

Runs in a browser, installs as an app, and **works offline** — a tunnel or a
dead zone does not stop it.

An **Android application** is built from the same code, through Capacitor.

## 🛣️ On the road

**The highway code comes first, always.** This application never justifies an infringement,
and no step of the calibration requires one: they all happen within the legal limits and the
traffic conditions of the moment.

The screen is read at a glance and not operated while driving. During a capture or a
calibration, let your passenger do it.

## 📍 Status

| | |
|---|---|
| Interface, grid, avatars, themes | ✅ |
| Driving simulator | ✅ |
| ELM327 protocol and OBD source | ✅ written and tested |
| Bluetooth transport | ⏳ waiting for an adapter |
| Driving-style analysis | ✅ |
| Drive mode (ECO / Normal / Sport) | ✅ |
| Per-vehicle calibration | ✅ |

Vehicle data currently comes from a **simulator**. The whole application works,
but reading a real car needs an OBD-II adapter.

## 🚀 Getting started

```bash
npm install
npm run dev
```

| Command | Effect |
|---|---|
| `npm run dev` | development server |
| `npm run build` | type check, then build |
| `npm test` | the test suite |
| `npm run android:sync` | build, then copy the result into the Android project |
| `npm run android:apk` | build the APK from whatever was last synced |
| `npm run android:install` | sync, build and install on a connected device |
| `npm run clean` | remove everything generated (`clean:all`: `node_modules` too) |

Reached through a reverse proxy, the dev and preview servers answer `Blocked request`: they refuse
a `Host` header they do not recognise, which is what stops another site from pointing a name it owns
at your machine and reading what is served. Name the proxy in `.env.local`, which git ignores and
`npm run clean` spares:

```ini
ALLOWED_HOSTS=board.example.lan
ALLOWED_HOSTS=.example.lan          # a leading dot covers the subdomains
ALLOWED_HOSTS=a.lan,b.lan           # several at once
ALLOWED_HOSTS=any                   # every name, protection off
```

Then start the server as usual — no argument to remember, and nothing shell-dependent. `scripts/serve.mjs`
also accepts `npm start -- --allow-host=…`, but PowerShell swallows the `--` before npm ever sees it,
so the file is the reliable way.

The APK lands in `android/app/build/outputs/apk/debug/app-debug.apk`. Run `android:sync` before
`android:apk`: `npm run build` alone fills `dist/` and writes nothing under `android/`, so Gradle
would package the previous web build — or fail outright after a `clean`, which removes the generated
Gradle sources along with the rest.

The Android app needs the Android SDK and two JDKs; see
`android/gradle.properties`, which explains why.

## 🎨 Customising

| What | How | Format |
|---|---|---|
| Tiles and backgrounds | catalogue → Import | JSON, see `public/tiles/README.md` |
| Background image | Settings → Appearance → Import | `.jpg`, `.png`, `.webp`, `.avif`, `.gif`, `.svg` |
| Avatars | Settings → Avatar → Import | `.riv`, `.glb`, `.gltf` |
| Full backup | Settings → Backup | `.tachsync` (an archive) |
| One person, vehicle or look | Import / Export, from the header | `.tachperson`, `.tachvehicle`, `.tachlook` |

Imported avatars live in IndexedDB. The app ships only two, drawn by code and
weighing a few kilobytes.

## 🔒 Data

**Everything stays on the device.** No account, no server, no telemetry sent
anywhere. Because browser storage is scoped per origin, changing address or
device loses it all: the `.tachsync` backup is the only bridge. It holds every
person, vehicle and look, the trip history and the imported avatars.

## 🧱 Architecture

```
src/
├── telemetry/    data model and distribution
├── simulation/   driver and vehicle physics
├── analysis/     instant style and drive mode
├── obd/          ELM327 protocol, transport, discovery
├── board/        grid, tiles, panels
├── avatar/       registry, rendering, import
├── theme/        theme manifests
└── i18n/         seven languages
```

The application is written against a single `DataSource` interface: the
simulator and the real adapter are interchangeable, and plugging in hardware
touches no UI component.

## 📄 Licence

Released under the [MIT License](LICENSE).
