import { loadSettings, normalizeSettings, saveSettings, type AppSettings } from '../board/layout';
import { readProfileState } from './migrate';
import type { ProfileState } from './state';

/**
 * Profiles are stored beside the settings rather than in their place.
 *
 * Two keys rather than one holding everything: the settings file is what backup exports and what a
 * user can read by eye. Burying the collections in it would make it unreadable, and would stop
 * older versions understanding it - whereas two keys leave the old one intact and ignored.
 *
 * The settings key therefore still exists and carries the resolved state: it stays the exchange
 * format and serves as a complete fallback if profiles disappear.
 */
const PROFILES_KEY = 'car-board.profiles.v1';

export function loadProfileState(): ProfileState {
  const settings = loadSettings();

  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    return readProfileState(raw === null ? null : JSON.parse(raw), settings);
  } catch {
    // Unreadable content: fall back to the flat settings, which survived.
    return readProfileState(null, settings);
  }
}

/**
 * Writes both keys.
 *
 * Resolved settings are rewritten every time, keeping the export and any older version in agreement
 * with what is on screen. The cost is duplication on disk, never in memory.
 */
export function saveProfileState(state: ProfileState, settings: AppSettings): void {
  saveSettings(settings);
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: the application carries on, profiles will not survive a reload.
  }
}

/**
 * Replaces everything with an imported settings file.
 *
 * An import overwrites the whole configuration, as the backup warning says. Profiles follow the
 * same rule: the imported file knows nothing about people, so it restarts from one person and one
 * vehicle.
 */
export function replaceFromSettings(parsed: Partial<AppSettings>): {
  readonly state: ProfileState;
  readonly settings: AppSettings;
} {
  const settings = normalizeSettings(parsed);
  return { state: readProfileState(null, settings), settings };
}
