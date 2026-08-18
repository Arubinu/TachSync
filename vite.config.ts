import { defineConfig } from 'vite';
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

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Lets the offline behaviour be exercised without a production build.
      devOptions: { enabled: true },
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
});
