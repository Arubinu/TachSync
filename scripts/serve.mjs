import { spawn } from 'node:child_process';

/**
 * Runs Vite, with the host names a reverse proxy may present.
 *
 * Two parsers refuse the flag, which is why this sits between them. Vite's own rejects any option
 * it does not know - `Unknown option` and it exits. And npm's `--flag` config, which does reach a
 * script as `npm_config_flag`, already warns that unknown keys will stop working in its next major
 * version. A wrapper takes our flag out of the line and hands the rest over untouched, owing
 * nothing to either.
 *
 *   npm run dev -- --allow-host=board.example.lan
 *   npm run dev -- --allow-host .example.lan      a leading dot covers the subdomains
 *   npm run dev -- --allow-host a.lan --allow-host b.lan
 *   npm run dev -- --allow-host=any               every name, protection off
 *
 * The value travels on as `ALLOWED_HOSTS`, which `vite.config.ts` reads - the same variable a
 * container or a shell can set directly, so there is one way in and not two.
 */

const args = process.argv.slice(2);
const hosts = [];
const forwarded = [];

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  const attached = /^--allow-host=(.*)$/.exec(arg);

  if (attached !== null) {
    hosts.push(attached[1]);
    continue;
  }

  // The detached form takes the next argument as its value, and must not leave it behind to be
  // read as a Vite option.
  if (arg === '--allow-host') {
    const value = args[index + 1];
    if (value === undefined || value.startsWith('-')) {
      console.error('serve: --allow-host needs a name, for instance --allow-host=board.example.lan');
      process.exit(1);
    }
    hosts.push(value);
    index += 1;
    continue;
  }

  forwarded.push(arg);
}

const declared = [process.env['ALLOWED_HOSTS'], ...hosts].filter(
  (value) => value !== undefined && value !== '',
);

/*
 * Said out loud, and only when something was asked for.
 *
 * Silence was the whole difficulty: a flag that never arrived - swallowed by a missing `--`, or
 * mistyped - looked exactly like a flag that did, right up until the browser answered "Blocked
 * request", which names the problem but not the cause. One line at startup separates the two.
 *
 * Nothing is printed on the ordinary run, where there is nothing to report.
 */
if (declared.length > 0) {
  const names = declared.join(', ');
  console.log(
    names.split(', ').includes('any')
      ? 'serve: answering to every host name - the check is off.'
      : `serve: also answering to ${names}`,
  );
}

/*
 * The variable is set only when something was asked for.
 *
 * Set to an empty string it still counts as set, and a name in `.env.local` was then overridden by
 * that emptiness - the file was read and quietly beaten. Passing nothing leaves the file to speak.
 */
const child = spawn('vite', forwarded, {
  stdio: 'inherit',
  // Windows resolves `vite` from `node_modules/.bin` only through a shell; npm has already put it
  // on the path.
  shell: true,
  env:
    declared.length === 0
      ? process.env
      : { ...process.env, ALLOWED_HOSTS: declared.join(',') },
});

child.on('exit', (code, signal) => {
  // A server stopped by Ctrl+C reports a signal and no code; exiting 0 there keeps npm from
  // printing a failure over a deliberate stop.
  process.exit(signal === null ? (code ?? 0) : 0);
});
