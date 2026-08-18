import { describe, expect, it } from 'vitest';
import { buildSettingsFile, parseSettingsFile } from './settingsFile';
import { DEFAULT_SETTINGS } from './layout';
import { en } from '../i18n/en';

/** The language of the rejection reasons is irrelevant here: English will do. */
const parse = (text: string) => parseSettingsFile(text, en);

describe('settings backup', () => {
  it('reads back exactly what it wrote', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      fontScale: 1.4,
      locked: false,
      avatarId: 'face',
    };

    const result = parse(buildSettingsFile(settings));

    expect(result.error).toBeNull();
    expect(result.settings).toEqual(settings);
  });

  it('accepts a bare settings object, with no envelope', () => {
    const result = parse(JSON.stringify({ fontScale: 2 }));

    expect(result.error).toBeNull();
    expect(result.settings?.fontScale).toBe(2);
    // The rest falls back to defaults rather than to nothing.
    expect(result.settings?.layouts.landscape.columns).toBe(
      DEFAULT_SETTINGS.layouts.landscape.columns,
    );
  });

  it('takes an earlier backup for both orientations', () => {
    // Backups from before the per-orientation split carried only one layout.
    // Losing it would erase a patiently composed arrangement.
    const result = parse(
      JSON.stringify({ layout: { columns: 5, rows: 2, tiles: [] } }),
    );

    expect(result.settings?.layouts.portrait.columns).toBe(5);
    expect(result.settings?.layouts.landscape.columns).toBe(5);
  });

  it('refuses a file that is not JSON', () => {
    const result = parse('{ not json');

    expect(result.settings).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it('refuses the backup of another application', () => {
    const result = parse(
      JSON.stringify({ format: 'other-appli', settings: { fontScale: 3 } }),
    );

    expect(result.settings).toBeNull();
    expect(result.error).toContain('other-appli');
  });

  it('refuses an array', () => {
    expect(parse('[]').settings).toBeNull();
  });

  it('still accepts a backup made under the old name', () => {
    const result = parse(
      JSON.stringify({ format: 'car-board.settings', version: 1, settings: { fontScale: 1.3 } }),
    );

    expect(result.error).toBeNull();
    expect(result.settings?.fontScale).toBe(1.3);
  });
});
