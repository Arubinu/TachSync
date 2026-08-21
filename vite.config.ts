import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/*
 * Where the application will be served from.
 *
 * A GitHub project page lives under `/<repo>/`, not at the root, and every built URL has to carry
 * that prefix - scripts, styles, icons, the service worker and its precache manifest alike. Read
 * from the environment rather than hard-coded so `npm run dev`, an APK and a page deployment share
 * one configuration.
 */
const base = process.env['BASE_PATH'] ?? '/';

/**
 * Host names the dev and preview servers will answer to.
 *
 * Vite refuses a request whose `Host` header it does not recognise, and answers "Blocked request".
 * That is not fussiness: a page on another site can make the browser resolve a name it controls to
 * 127.0.0.1 and then read whatever the dev server serves. Checking the header is what stops it.
 *
 * Behind a reverse proxy the header carries the proxy's name, which the server has no way to guess
 * - hence this list, named when the server is started rather than hard-coded, so a name belonging
 * to one machine does not travel in the repository.
 *
 * Declared in `.env.local`, which is where this project already keeps what belongs to one machine -
 * git ignores `*.local`, and `npm run clean` spares it:
 *
 *   ALLOWED_HOSTS=board.example.lan
 *   ALLOWED_HOSTS=.example.lan          a leading dot covers the subdomains
 *   ALLOWED_HOSTS=a.lan,b.lan           several at once
 *   ALLOWED_HOSTS=any                   every name, protection off
 *
 * A file rather than an argument, because the argument cannot be relied on: PowerShell eats the
 * `--` that separates npm's own options from the script's, so `npm start -- --allow-host=x` reaches
 * npm as a config it does not know - it warns, and the script never sees the flag. `scripts/serve.mjs`
 * still accepts `--allow-host` for the shells where that works, but nothing depends on it.
 *
 * `any` exists because a proxy handing out changing names makes a list unworkable. It gives up the
 * check entirely, so it belongs on a network you trust and nowhere else.
 */
function allowedHosts(declared: string): string[] | true {
  const names = declared
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');

  return names.includes('any') ? true : names;
}

export default defineConfig(({ mode }) => {
  /*
   * Read from the env files as well as the environment.
   *
   * An empty prefix takes every name, not just the `VITE_` ones: this never reaches the browser,
   * it only decides what the server answers to.
   */
  const hosts = allowedHosts(loadEnv(mode, process.cwd(), '')['ALLOWED_HOSTS'] ?? '');

  return {
    base,
    // Both, because a proxy is as likely to sit in front of a production build being checked as in
    // front of the dev server.
    server: { allowedHosts: hosts },
    preview: { allowedHosts: hosts },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        // Lets the offline behaviour be exercised without a production build.
        //
        // `suppressWarnings` silences one warning only, and a correct one: the glob that lists what
        // to precache is run against `dev-dist/`, which holds nothing but the worker and its runtime,
        // both excluded. Nothing matches because in development there is nothing to precache - the
        // assets are served by Vite.
        devOptions: { enabled: true, suppressWarnings: true },
        includeAssets: ['favicon.png', 'apple-touch-icon.png'],
        workbox: {
          // The whole shell is precached, including the avatar engines: they are dynamic imports,
          // and a chunk fetched on demand would fail offline if it were left out.
          //
          // Imported avatars are not here - they live in IndexedDB, outside the service worker
          // cache, and are therefore available offline with no rule needed.
          //
          // `json` covers the example tile packs in `public/tiles/`. Measured without it: importing
          // an example offline failed with a network error, the one hole in an otherwise complete
          // shell.
          // `wasm` covers the Rive runtime served from `public/rive/`; without it an imported
          // vector avatar is the one thing left that needs a network.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,wasm}'],
          // The Rive runtime alone is 2 MB, well past the 2 MiB default.
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        manifest: {
          name: 'TachSync',
          short_name: 'TachSync',
          lang: 'en',
          description: 'Real-time dashboard monitor with a reactive avatar',
          // Logo tint: what the system shows around the splash screen, before the dashboard
          // theme takes over.
          theme_color: '#3E2468',
          background_color: '#3E2468',
          display: 'fullscreen',
          // An in-car monitor is read sitting on the dashboard.
          orientation: 'landscape',
          start_url: '.',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            // A separate variant: a maskable icon can be cropped by the system to fit its own
            // icon shape, and one image serving both uses would lose its edges here or float
            // in the middle there.
            {
              src: 'icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
  };
});
