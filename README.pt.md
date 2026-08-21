<p align="center">
  <img width="400" height="400" alt="logo" src="https://github.com/user-attachments/assets/2d66e4e6-46ff-4513-9256-6a6dcf14a9e3" />
</p>

**Português · [Français](README.fr.md) · [English](README.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Nederlands](README.nl.md) · [Italiano](README.it.md)**

Um painel de bordo: os dados do veículo de um lado do ecrã, um avatar animado
que reage à condução do outro. Inspirado no monitor da Suki em *2 Fast 2
Furious*.

Funciona num navegador, instala-se como aplicação e **funciona sem rede** — um
túnel ou uma zona sem cobertura não o travam.

Uma **aplicação Android** é construída a partir do mesmo código, com Capacitor.

## 📍 Estado

| | |
|---|---|
| Interface, grelha, avatares, temas | ✅ |
| Simulador de condução | ✅ |
| Protocolo ELM327 e fonte OBD | ✅ escrito e testado |
| Transporte Bluetooth | ⏳ à espera de um adaptador |
| Análise do estilo de condução | ✅ |
| Modo de condução (Eco / Normal / Sport) | ✅ |
| Calibração por veículo | ✅ |

Os dados do veículo vêm por agora de um **simulador**. Toda a aplicação
funciona, mas ler um carro real exige um adaptador OBD-II.

## 🛣️ Na estrada

**O código da estrada vem sempre primeiro.** Esta aplicação não justifica qualquer
infração, e nenhum passo da calibração a exige: todos decorrem dentro dos limites legais
e das condições de trânsito do momento.

O ecrã lê-se de relance e não se manipula a conduzir. Durante uma captura ou uma
calibração, deixa o teu passageiro fazê-lo.

## 🚀 Começar

```bash
npm install
npm run dev
```

| Comando | Efeito |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | verificação de tipos e compilação |
| `npm test` | o conjunto de testes |
| `npm run android:sync` | compila e copia o resultado para o projeto Android |
| `npm run android:apk` | compila o APK a partir da última sincronização |
| `npm run android:install` | sincroniza, compila e instala num dispositivo ligado |
| `npm run clean` | apaga tudo o que é gerado (`clean:all`: também `node_modules`) |

O APK fica em `android/app/build/outputs/apk/debug/app-debug.apk`. Corre `android:sync` antes de
`android:apk`: `npm run build` sozinho enche `dist/` e não escreve nada em `android/`, pelo que o
Gradle empacotaria a compilação web anterior — ou falharia mesmo após um `clean`, que apaga as
fontes Gradle geradas juntamente com o resto.

A aplicação Android exige o SDK Android e dois JDK; ver
`android/gradle.properties`, que explica porquê.

## 🎨 Personalização

| O quê | Como | Formato |
|---|---|---|
| Mosaicos e fundos | catálogo → Importar | JSON, ver `public/tiles/README.md` |
| Imagem de fundo | Definições → Aparência → Importar | `.jpg`, `.png`, `.webp`, `.avif`, `.gif`, `.svg` |
| Avatares | Definições → Avatar → Importar | `.riv`, `.glb`, `.gltf` |
| Cópia completa | Definições → Cópia de segurança | `.tachsync` (um arquivo) |
| Uma pessoa, um veículo, uma aparência | Importar / Exportar, a partir do cabeçalho | `.tachperson`, `.tachvehicle`, `.tachlook` |

Os avatares importados vivem no IndexedDB. A aplicação só traz dois, desenhados
por código e com poucos kilobytes.

## 🔒 Dados

**Tudo permanece no dispositivo.** Sem conta, sem servidor, sem telemetria
enviada para lado nenhum. Como o armazenamento do navegador está separado por
origem, mudar de endereço ou de dispositivo perde tudo: a cópia `.tachsync` é a
única ponte. Contém um ficheiro de definições legível e os avatares.

## 🧱 Arquitetura

```
src/
├── telemetry/    modelo de dados e distribuição
├── simulation/   condutor e física do veículo
├── analysis/     estilo instantâneo e modo de condução
├── obd/          protocolo ELM327, transporte, deteção
├── board/        grelha, mosaicos, painéis
├── avatar/       registo, representação, importação
├── theme/        manifestos de tema
└── i18n/         sete idiomas
```

A aplicação está escrita sobre uma única interface `DataSource`: o simulador e o
adaptador real são intermutáveis, e ligar o hardware não toca em nenhum
componente da interface.

## 📄 Licença

Distribuído sob a [licença MIT](LICENSE).
