import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The registration is a module side effect, so the mock has to be in place before the module under
 * test is imported - hence `vi.resetModules` and a dynamic import in each case.
 */
const applied: boolean[] = [];
let needRefresh: (() => void) | undefined;

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: { onNeedRefresh?: () => void }) => {
    needRefresh = options.onNeedRefresh;
    return (reload?: boolean) => {
      applied.push(reload === true);
      return Promise.resolve();
    };
  },
}));

async function load(): Promise<{ holdUpdates: (hold: boolean) => void }> {
  vi.resetModules();
  applied.length = 0;
  needRefresh = undefined;
  return import('./updates');
}

describe('holdUpdates', () => {
  beforeEach(() => {
    applied.length = 0;
  });

  it('applies an update straight away when nothing is streaming', async () => {
    await load();
    needRefresh?.();

    expect(applied).toEqual([true]);
  });

  it('holds an update that arrives during a drive', async () => {
    const { holdUpdates } = await load();
    holdUpdates(true);
    needRefresh?.();

    // Reloading here would drop the adapter link, which no code can re-establish.
    expect(applied).toEqual([]);
  });

  it('applies the held update once the drive ends', async () => {
    const { holdUpdates } = await load();
    holdUpdates(true);
    needRefresh?.();
    holdUpdates(false);

    expect(applied).toEqual([true]);
  });

  it('does not reload when no update is pending', async () => {
    const { holdUpdates } = await load();
    holdUpdates(true);
    holdUpdates(false);

    expect(applied).toEqual([]);
  });

  it('applies a held update only once', async () => {
    const { holdUpdates } = await load();
    holdUpdates(true);
    needRefresh?.();
    holdUpdates(false);
    holdUpdates(true);
    holdUpdates(false);

    expect(applied).toEqual([true]);
  });
});
