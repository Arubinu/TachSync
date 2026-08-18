import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * One command for the Android development loop: emulator, dev server, live reload.
 *
 * Three things have to line up before `cap run -l` is of any use, and each one
 * fails in its own quiet way when it doesn't:
 *
 *  - a booted emulator, or the run stops on target selection;
 *  - a dev server, since Capacitor points the WebView at it but never starts it;
 *  - `adb reverse`, so the emulator reaches the server through the adb tunnel
 *    rather than a network interface. This machine exposes four of them (two
 *    Hyper-V, one VirtualBox), none of which the emulator can route to, so
 *    letting Capacitor pick one on its own is a coin toss.
 *
 * Run with `--emulator-only` to just boot the emulator and stop there.
 */

const EMULATOR_ONLY = process.argv.includes('--emulator-only');
const BOOT_TIMEOUT_MS = 180_000;
const SERVER_TIMEOUT_MS = 60_000;

/**
 * Windows hardening that keeps `cmd.exe` from looking in the current directory.
 *
 * Capacitor invokes `./gradlew` with no `.bat` variant, so with this set the
 * Gradle step dies on "'gradlew' is not recognized". Clearing it here affects
 * this process and its children only — the machine keeps its setting.
 */
delete process.env['NoDefaultCurrentDirectoryInExePath'];

/**
 * Gradle's launcher JVM. The daemon's is pinned separately, by
 * `org.gradle.java.home` in android/gradle.properties.
 *
 * Set here because the machine declares no JAVA_HOME, which would leave Gradle
 * on whatever the Oracle PATH shim points at — a version it may well refuse.
 * An existing value is left alone.
 */
const BUNDLED_JDK = 'C:\\Program Files\\Android\\Android Studio\\jbr';
if ((process.env['JAVA_HOME'] ?? '') === '' && existsSync(BUNDLED_JDK)) {
  process.env['JAVA_HOME'] = BUNDLED_JDK;
}

/** Reads the SDK path the project already declares, rather than adding a second source of truth. */
function sdkRoot() {
  try {
    const text = readFileSync(join('android', 'local.properties'), 'utf8');
    const line = text.split('\n').find((l) => l.trim().startsWith('sdk.dir='));
    if (line !== undefined) {
      // local.properties escapes both the drive colon and the separators.
      return line.slice(line.indexOf('=') + 1).trim().replace(/\\:/g, ':').replace(/\\\\/g, '\\');
    }
  } catch {
    // Falls through to the environment.
  }
  return process.env['ANDROID_HOME'] ?? process.env['ANDROID_SDK_ROOT'] ?? '';
}

function adb(...args) {
  return spawnSync('adb', args, { encoding: 'utf8' }).stdout?.trim() ?? '';
}

/** An emulator that answers `adb` but hasn't finished booting is not usable yet. */
function bootedTarget() {
  const line = adb('devices')
    .split('\n')
    .slice(1)
    .find((l) => l.trim().endsWith('\tdevice'));
  if (line === undefined) return null;

  const id = line.split('\t')[0];
  return adb('-s', id, 'shell', 'getprop', 'sys.boot_completed') === '1' ? id : null;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureEmulator() {
  const running = bootedTarget();
  if (running !== null) {
    console.log(`[live] emulator already up: ${running}`);
    return running;
  }

  const root = sdkRoot();
  if (root === '') throw new Error('Android SDK not found (android/local.properties, ANDROID_HOME).');

  const emulator = join(root, 'emulator', 'emulator.exe');
  const avds = spawnSync(emulator, ['-list-avds'], { encoding: 'utf8' })
    .stdout.split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');

  const avd = avds.includes('tachsync') ? 'tachsync' : avds[0];
  if (avd === undefined) throw new Error('No AVD defined. Create one with avdmanager.');

  console.log(`[live] starting emulator ${avd}…`);
  // Detached: the emulator outlives this script, so a Ctrl+C here does not
  // cost a two-minute reboot on the next run.
  spawn(emulator, ['-avd', avd], { detached: true, stdio: 'ignore' }).unref();

  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const target = bootedTarget();
    if (target !== null) {
      console.log(`[live] emulator ready: ${target}`);
      return target;
    }
    await wait(3000);
  }
  throw new Error('Emulator did not finish booting in time.');
}

/**
 * Starts the dev server and resolves with the port it actually bound.
 *
 * Read from its output rather than assumed: Vite steps to the next free port
 * when 5173 is taken, and a hard-coded 5173 would then forward to nothing.
 */
function startDevServer() {
  const server = spawn('npm', ['run', 'dev'], { shell: true, stdio: ['ignore', 'pipe', 'inherit'] });

  return new Promise((resolve, reject) => {
    // Killed before rejecting, otherwise a start-up failure leaves Vite holding
    // the port — the next run then drifts to another one, or hangs waiting.
    const giveUp = (message) => {
      stopTree(server);
      reject(new Error(message));
    };

    const timer = setTimeout(() => giveUp('Dev server did not report a URL.'), SERVER_TIMEOUT_MS);

    server.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);

      // Vite colours its banner, and the port sits between escape sequences
      // (`localhost:\x1b[1m5173`) — they have to go before the port can be read.
      // eslint-disable-next-line no-control-regex
      const plain = text.replace(/\x1b\[[0-9;]*m/g, '');
      const match = /Local:\s+https?:\/\/localhost:(\d+)/.exec(plain);
      if (match?.[1] !== undefined) {
        clearTimeout(timer);
        resolve({ server, port: Number(match[1]) });
      }
    });

    server.once('exit', (code) => {
      clearTimeout(timer);
      giveUp(`Dev server stopped (code ${code}).`);
    });
  });
}

/** Kills the whole process tree: on Windows the npm wrapper leaves Vite behind. */
function stopTree(child) {
  if (child.pid === undefined || child.exitCode !== null) return;
  spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
}

async function main() {
  const target = await ensureEmulator();
  if (EMULATOR_ONLY) return;

  const { server, port } = await startDevServer();

  const shutdown = () => stopTree(server);
  process.on('exit', shutdown);
  process.on('SIGINT', () => process.exit(0));

  console.log(`[live] dev server on ${port}, deploying to ${target}…`);

  const run = spawn(
    'npx',
    [
      'cap', 'run', 'android',
      '--target', target,
      '-l', '--host', 'localhost',
      '--port', String(port),
      '--forwardPorts', `${port}:${port}`,
    ],
    { shell: true, stdio: 'inherit' },
  );

  run.on('exit', (code) => {
    stopTree(server);
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(`[live] ${error.message}`);
  process.exit(1);
});
