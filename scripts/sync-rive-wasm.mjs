import { copyFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Copies the Rive WebAssembly runtime out of node_modules and into `public/`.
 *
 * `@rive-app/canvas` ships its 2 MB runtime as a separate file and, by default, fetches it from
 * unpkg.com at first render with a jsdelivr fallback. Measured: loading a Rive avatar issued a live
 * request to `https://unpkg.com/@rive-app/canvas@<version>/rive.wasm`. That makes an avatar
 * unusable offline, tells a third party when the application is opened, and hands the dashboard a
 * runtime dependency on a CDN staying up.
 *
 * Copied rather than committed by hand so the binary cannot drift from the installed package. The
 * copy is checked against this source by `src/avatar/riveWasm.test.ts`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const source = join(root, 'node_modules', '@rive-app', 'canvas', 'rive.wasm');
const target = join(root, 'public', 'rive', 'rive.wasm');

const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

if (!existsSync(source)) {
  console.error('sync-rive-wasm: %s is missing. Run npm install first.', source);
  process.exit(1);
}

if (existsSync(target) && digest(target) === digest(source)) {
  process.exit(0);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log('sync-rive-wasm: refreshed public/rive/rive.wasm from the installed package.');
