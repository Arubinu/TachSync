import { format, type Translation } from '../i18n';
import { normalizeSettings, type AppSettings } from './layout';

/**
 * The settings file, as it appears inside a backup.
 *
 * It is no longer downloaded on its own: it is one entry of the `.tachsync` archive - see
 * `backup.ts`. This module therefore only deals with its shape, writing and reading.
 *
 * The server knows nothing about the user: everything lives in the browser, and browser storage is
 * partitioned by origin. Changing server address, device or browser would lose it all. The backup
 * is the only bridge.
 */

const FORMAT = 'tachsync.settings';
/**
 * Name carried before the rebrand.
 *
 * Still accepted on read: a backup made yesterday is still a valid backup, and refusing it over a
 * name change would lose a whole configuration for a purely cosmetic reason.
 */
const LEGACY_FORMAT = 'car-board.settings';
const VERSION = 1;

interface SettingsFile {
  readonly format: string;
  readonly version: number;
  readonly exportedAt: string;
  readonly settings: AppSettings;
}

export function buildSettingsFile(settings: AppSettings): string {
  const payload: SettingsFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    settings,
  };
  return JSON.stringify(payload, null, 2);
}

export interface SettingsImport {
  readonly settings: AppSettings | null;
  readonly error: string | null;
}

/**
 * Reads a settings file back.
 *
 * Accepts the full envelope as well as a bare settings object: a hand-edited file will happily lose
 * its header, and refusing it for that alone would be tiresome.
 */
export function parseSettingsFile(text: string, t: Translation): SettingsImport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { settings: null, error: t.errors.invalidJson };
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { settings: null, error: t.errors.unexpectedObject };
  }

  const record = data as Record<string, unknown>;
  const declared = record['format'];
  if (typeof declared === 'string' && declared !== FORMAT && declared !== LEGACY_FORMAT) {
    return { settings: null, error: format(t.errors.foreignBackup, { format: declared }) };
  }

  const inner = record['settings'];
  const source = typeof inner === 'object' && inner !== null ? inner : record;

  // Missing or unknown fields fall back to defaults: a backup from an earlier version stays usable.
  return { settings: normalizeSettings(source as Partial<AppSettings>), error: null };
}

