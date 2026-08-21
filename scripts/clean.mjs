import { rmSync, statSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Removes everything the repository does not track.
 *
 * What is left behind is exactly what a fresh clone would hold, which makes a backup of the folder
 * a backup of the project rather than a copy of one machine's build state. Everything removed here
 * comes back from `npm install`, `npm run build` or `cap sync`.
 *
 * Two deliberate survivors, both listed in `.gitignore` and neither regenerable by a build:
 * `*.keystore`, which signs releases and cannot be recreated, and `*.local`, which holds whatever
 * the developer put there. Losing either to a cleanup would be a poor trade for a few kilobytes.
 *
 *   npm run clean       build outputs and generated sources
 *   npm run clean:all   the same, plus node_modules and the machine-specific SDK path
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const all = process.argv.includes('--all');

/** Built by Vite, Gradle, Capacitor or our own pre-scripts. */
const generated = [
  'dist',
  'dist-ssr',
  'dev-dist',
  'public/rive',
  'android/build',
  'android/app/build',
  'android/.gradle',
  'android/capacitor-cordova-android-plugins',
  'android/app/src/main/assets/public',
  'android/app/src/main/assets/capacitor.config.json',
  'android/app/src/main/assets/capacitor.plugins.json',
];

/** Restored by `npm install`, or by opening the project in Android Studio. */
const heavy = ['node_modules', 'android/local.properties'];

function sizeOf(path) {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return 0;
  }
  if (!stat.isDirectory()) return stat.size;

  let total = 0;
  for (const entry of readdirSync(path)) total += sizeOf(join(path, entry));
  return total;
}

/** Loose artefacts that land at the root rather than in a known folder. */
function strays() {
  const found = [];
  for (const entry of readdirSync(root)) {
    if (/\.(apk|aab|log)$/i.test(entry)) found.push(entry);
  }
  return found;
}

const targets = [...generated, ...strays(), ...(all ? heavy : [])];

let freed = 0;
let removed = 0;

for (const target of targets) {
  const path = join(root, target);
  if (!existsSync(path)) continue;

  const size = sizeOf(path);
  rmSync(path, { recursive: true, force: true });
  freed += size;
  removed += 1;
  console.log(`  removed  ${relative(root, path).replace(/\\/g, '/')}  (${mb(size)})`);
}

function mb(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} kB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

if (removed === 0) {
  console.log('Already clean.');
} else {
  console.log(`\n${removed} path(s) removed, ${mb(freed)} freed.`);
  if (all) console.log('Run `npm install` first.');
  // Naming the web build alone would be a trap: Gradle reads generated sources under `android/`
  // that only `cap sync` writes, so a build that skips it fails on a file it cannot find.
  console.log('Then `npm run build` for the web, or `npm run android:sync` for Android.');
}
