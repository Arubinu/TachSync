import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RIVE_WASM_URL } from './riveWasm';

/**
 * The shipped Rive runtime must match the installed package.
 *
 * `@rive-app/canvas` fetches its 2 MB runtime from unpkg.com by default, so a local copy is served
 * instead - see `scripts/sync-rive-wasm.mjs`. A copy left behind by a package upgrade would pair a
 * new JavaScript runtime with an old binary, and Rive fails on a version mismatch at load time,
 * which is exactly when nothing can be done about it.
 *
 * Checked against node_modules rather than against the npm registry: this must hold offline and
 * give the same answer twice. Whether the package itself is outdated is a different question, and
 * one for `npm outdated`.
 */

const SHIPPED = 'public/rive/rive.wasm';
const INSTALLED = 'node_modules/@rive-app/canvas/rive.wasm';

const digest = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

describe('Rive runtime shipped with the application', () => {
  it('exists', () => {
    expect(
      existsSync(SHIPPED),
      `${SHIPPED} is missing. Run: node scripts/sync-rive-wasm.mjs`,
    ).toBe(true);
  });

  it('matches the installed package byte for byte', () => {
    expect(
      digest(SHIPPED),
      `${SHIPPED} is out of date. Run: node scripts/sync-rive-wasm.mjs`,
    ).toBe(digest(INSTALLED));
  });

  it('is served from our own origin', () => {
    // The whole point: no unpkg, no jsdelivr, nothing that needs a network at first render.
    expect(RIVE_WASM_URL.startsWith('http')).toBe(false);
    expect(RIVE_WASM_URL).toContain('rive.wasm');
  });

  it('is a WebAssembly module', () => {
    // Guards against a truncated or text file being copied into place unnoticed.
    const head = readFileSync(SHIPPED).subarray(0, 4);
    expect([...head]).toEqual([0x00, 0x61, 0x73, 0x6d]);
    expect(statSync(SHIPPED).size).toBeGreaterThan(500_000);
  });
});
