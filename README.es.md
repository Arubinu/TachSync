<p align="center">
  <img width="400" height="400" alt="logo" src="https://github.com/user-attachments/assets/2d66e4e6-46ff-4513-9256-6a6dcf14a9e3" />
</p>

**Español · [Français](README.fr.md) · [English](README.md) · [Deutsch](README.de.md) · [Nederlands](README.nl.md) · [Italiano](README.it.md) · [Português](README.pt.md)**

Un tablero de a bordo: los datos del vehículo en un lado de la pantalla, un
avatar animado que reacciona a la conducción en el otro. Inspirado en el monitor
de Suki en *2 Fast 2 Furious*.

Funciona en un navegador, se instala como aplicación y **funciona sin
conexión** — un túnel o una zona sin cobertura no lo detienen.

Una **aplicación Android** se construye desde el mismo código, con Capacitor.

## 📍 Estado

| | |
|---|---|
| Interfaz, cuadrícula, avatares, temas | ✅ |
| Simulador de conducción | ✅ |
| Protocolo ELM327 y fuente OBD | ✅ escrito y probado |
| Transporte Bluetooth | ⏳ a la espera de un adaptador |
| Análisis del estilo de conducción | ✅ |
| Modo de conducción (Eco / Normal / Sport) | ✅ |
| Calibración por vehículo | ✅ |

Por ahora los datos del vehículo los produce un **simulador**. Toda la
aplicación funciona, pero leer un coche real exige un adaptador OBD-II.

## 🛣️ En la carretera

**El código de circulación manda, siempre.** Esta aplicación no justifica ninguna
infracción, y ningún paso de la calibración exige una: todos se hacen dentro de los
límites legales y de las condiciones de tráfico del momento.

La pantalla se lee de un vistazo y no se manipula conduciendo. Durante una captura o una
calibración, deja que lo haga tu acompañante.

## 🚀 Empezar

```bash
npm install
npm run dev
```

| Comando | Efecto |
|---|---|
| `npm run dev` | servidor de desarrollo |
| `npm run build` | comprobación de tipos y compilación |
| `npm test` | la batería de pruebas |
| `npm run android:sync` | compila y copia el resultado en el proyecto Android |
| `npm run android:apk` | compila el APK a partir de la última sincronización |
| `npm run android:install` | sincroniza, compila e instala en un dispositivo conectado |
| `npm run clean` | borra todo lo generado (`clean:all`: también `node_modules`) |

El APK aparece en `android/app/build/outputs/apk/debug/app-debug.apk`. Ejecuta `android:sync` antes
que `android:apk`: `npm run build` por sí solo llena `dist/` y no escribe nada bajo `android/`, así
que Gradle empaquetaría la compilación web anterior, o fallaría directamente tras un `clean`, que
borra las fuentes Gradle generadas junto con lo demás.

La aplicación Android necesita el SDK de Android y dos JDK; consulta
`android/gradle.properties`, que explica por qué.

## 🎨 Personalización

| Qué | Cómo | Formato |
|---|---|---|
| Mosaicos y fondos | catálogo → Importar | JSON, véase `public/tiles/README.md` |
| Imagen de fondo | Ajustes → Apariencia → Importar | `.jpg`, `.png`, `.webp`, `.avif`, `.gif`, `.svg` |
| Avatares | Ajustes → Avatar → Importar | `.riv`, `.glb`, `.gltf` |
| Copia completa | Ajustes → Copia de seguridad | `.tachsync` (un archivo comprimido) |
| Una persona, un vehículo, una apariencia | Importar / Exportar, desde la cabecera | `.tachperson`, `.tachvehicle`, `.tachlook` |

Los avatares importados viven en IndexedDB. La aplicación solo incluye dos,
dibujados por código y de unos pocos kilobytes.

## 🔒 Datos

**Todo permanece en el dispositivo.** Sin cuenta, sin servidor, sin telemetría
enviada a ninguna parte. Como el almacenamiento del navegador está
compartimentado por origen, cambiar de dirección o de dispositivo lo pierde
todo: la copia `.tachsync` es el único puente. Contiene un archivo de ajustes
legible y los avatares.

## 🧱 Arquitectura

```
src/
├── telemetry/    modelo de datos y distribución
├── simulation/   conductor y física del vehículo
├── analysis/     estilo instantáneo y modo de conducción
├── obd/          protocolo ELM327, transporte, descubrimiento
├── board/        cuadrícula, mosaicos, paneles
├── avatar/       registro, representación, importación
├── theme/        manifiestos de tema
└── i18n/         siete idiomas
```

La aplicación está escrita contra una única interfaz `DataSource`: el simulador
y el adaptador real son intercambiables, y conectar el hardware no toca ningún
componente de la interfaz.

## 📄 Licencia

Publicado bajo la [Licencia MIT](LICENSE).
