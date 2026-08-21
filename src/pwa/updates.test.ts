import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The registration is a module side effect, so the mock has to be in place before the module under
 * test is imported - hence `vi.resetModules` and a dynamic import in each case.
 */
const reloads: string[] = [];
let needReload: (() => void) | undefined;

/**
 * `onNeedReload`, not `onNeedRefresh`.
 *
 * Under `registerType: 'autoUpdate'` the plugin never calls `onNeedRefresh` and its returned
 * function does nothing: a version of this module built on those reloaded the page regardless of
 * what was held. Mocking the hook the plugin actually calls is what makes these cases mean
 * anything.
 */
vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: { onNeedReload?: () => void }) => {
    needReload = options.onNeedReload;
    return () => Promise.resolve();
  },
}));

async function load(): Promise<{ holdUpdates: (hold: boolean) => void }> {
  vi.resetModules();
  reloads.length = 0;
  needReload = undefined;
  // The module reloads through `globalThis.location`, absent from the test runner: supplied here
  // so the call is observable rather than merely skipped.
  vi.stubGlobal('location', { reload: () => reloads.push('reload') });
  return import('./updates');
}

describe('holdUpdates', () => {
  beforeEach(() => {
    reloads.length = 0;
  });

  it('applies an update straight away when nothing is streaming', async () => {
    await load();
    needReload?.();

    expect(reloads).toEqual(['reload']);
  });

  it('holds an update that arrives during a drive', async () => {
    const { holdUpdates } = await load();
    holdUpdates(true);
    needReload?.();

    // Reloading here would drop the adapter link, which no code can re-establish.
    expect(reloads).toEqual([]);
  });

  it('applies the held update once the drive ends', async () => {
    const { holdUpdates } = await load();
    holdUpdates(true);
    needReload?.();
    holdUpdates(false);

    expect(reloads).toEqual(['reload']);
  });

  it('does not reload when no update is pending', async () => {
    const { holdUpdates } = await load();
    holdUpdates(true);
    holdUpdates(false);

    expect(reloads).toEqual([]);
  });

  it('applies a held update only once', async () => {
    const { holdUpdates } = await load();
    holdUpdates(true);
    needReload?.();
    holdUpdates(false);
    holdUpdates(true);
    holdUpdates(false);

    expect(reloads).toEqual(['reload']);
  });
});
