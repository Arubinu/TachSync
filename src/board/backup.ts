import { readAvatarFile } from '../avatar/importAvatar';
import { readWallpaperFile, type StoredWallpaper } from './wallpaper';
import { isImage } from '../storage/image';
import type { VehiclePhoto } from '../profiles/photo';
import { en } from '../i18n/en';
import { format, type Translation } from '../i18n';
import type { ImportedAvatar } from '../avatar/store';
import { ArchiveError, createArchive, readArchive, type ArchiveEntry } from './archive';
import { parseSettingsFile } from './settingsFile';
import type { AppSettings } from './layout';
import type { ProfileState } from '../profiles/state';
import type { TripRecord } from '../trips/types';

/**
 * Full backup: settings AND imported avatars, in one file.
 *
 * An archive rather than several downloads. Chrome interrupts a series of downloads with a
 * permission prompt, and a refusal silently blocks the rest; above all, separate files get lost
 * independently, and one without the other restores nothing.
 *
 * The extension is specific to the application, but the content is an ordinary archive: any system
 * tool opens it once renamed to `.zip`. The settings file inside stays indented JSON, readable by
 * eye.
 */

/** Backup extension. An archive, under a name that says what it holds. */
export const BACKUP_EXTENSION = 'tachsync';

const PROFILES_ENTRY = 'profiles.json';
const TRIPS_ENTRY = 'trips.json';
const SETTINGS_ENTRY = 'settings.json';
const AVATARS_FOLDER = 'avatars/';
const WALLPAPER_FOLDER = 'wallpaper/';
const PHOTOS_FOLDER = 'photos/';

/**
 * Entry names written by earlier versions, still accepted on read.
 *
 * A backup outlives the version that produced it. Renaming the entry would have turned every
 * archive already on disk into an unreadable file, for no gain the user can see.
 */
const LEGACY_SETTINGS_ENTRY = 'reglages.json';

export function backupFileName(): string {
  const day = new Date().toISOString().slice(0, 10);
  return `tachsync-backup-${day}.${BACKUP_EXTENSION}`;
}

export async function createBackup(
  profiles: ProfileState,
  trips: readonly TripRecord[],
  avatars: readonly ImportedAvatar[],
  wallpaper: StoredWallpaper | null,
  photos: readonly VehiclePhoto[],
): Promise<Blob> {
  const encoder = new TextEncoder();
  const entries: ArchiveEntry[] = [
    // Everything the application keeps: every person, every vehicle, every look - not the active
    // one flattened. The earlier backup exported resolved settings, so restoring it rebuilt a
    // single set and quietly dropped the rest.
    { name: PROFILES_ENTRY, data: encoder.encode(JSON.stringify(profiles, null, 2)) },
    { name: TRIPS_ENTRY, data: encoder.encode(JSON.stringify(trips, null, 2)) },
  ];

  for (const avatar of avatars) {
    entries.push({
      name: `${AVATARS_FOLDER}${avatar.fileName}`,
      data: new Uint8Array(await avatar.data.arrayBuffer()),
    });
  }

  if (wallpaper !== null) {
    entries.push({
      name: `${WALLPAPER_FOLDER}${wallpaper.fileName}`,
      data: new Uint8Array(await wallpaper.data.arrayBuffer()),
    });
  }

  /*
   * One folder per car, named by its id.
   *
   * The id is the only thing that says which vehicle a picture belongs to, and a file name never
   * did: two cars photographed from the same phone arrive as `IMG_0042.webp` twice. A folder
   * carries it without constraining what the picture inside may be called.
   */
  for (const photo of photos) {
    entries.push({
      name: `${PHOTOS_FOLDER}${photo.id}/${photo.fileName}`,
      data: new Uint8Array(await photo.data.arrayBuffer()),
    });
  }

  return createArchive(entries);
}

export interface BackupImport {
  /** The whole collection, or `null` when the file predates it and only carried settings. */
  readonly profiles: ProfileState | null;
  /** Present only in a file that predates the collection. */
  readonly settings: AppSettings | null;
  readonly trips: readonly TripRecord[];
  /** Avatars found in the archive, ready to be saved. */
  readonly avatars: readonly File[];
  /** The background image, if the archive carried one. */
  readonly wallpaper: File | null;
  /** Vehicle photographs, each still paired with the id of the car it belongs to. */
  readonly photos: readonly { readonly vehicleId: string; readonly file: File }[];
  readonly error: string | null;
}

/** Reads a backup back. Only the application's own archive is accepted. */
export async function readBackup(file: File, t: Translation): Promise<BackupImport> {
  let entries: readonly ArchiveEntry[];
  try {
    entries = await readArchive(file);
  } catch (cause: unknown) {
    const error =
      cause instanceof ArchiveError && cause.code === 'notAnArchive'
        ? t.errors.notABackup
        : t.errors.unreadableArchive;
    return {
      profiles: null,
      settings: null,
      trips: [],
      avatars: [],
      wallpaper: null,
      photos: [],
      error,
    };
  }

  const decoder = new TextDecoder();

  // Only files recognised as avatars are kept: a hand-edited archive can contain anything else.
  const avatars = entries
    .filter((entry) => entry.name.startsWith(AVATARS_FOLDER) && entry.data.length > 0)
    .map((entry) => new File([entry.data as BlobPart], entry.name.slice(AVATARS_FOLDER.length)))
    // Only the extension matters here; the English catalogue is enough since
    // its messages are discarded.
    .filter((candidate) => readAvatarFile(candidate, en).avatar !== null);

  /*
   * The background image, held to the same rule as the avatars.
   *
   * Only the first acceptable entry counts: the store keeps one image, so a hand-edited archive
   * offering several has to resolve to one rather than to whichever happened to be written last.
   */
  const wallpaper =
    entries
      .filter((entry) => entry.name.startsWith(WALLPAPER_FOLDER) && entry.data.length > 0)
      .map((entry) => new File([entry.data as BlobPart], entry.name.slice(WALLPAPER_FOLDER.length)))
      .find((candidate) => readWallpaperFile(candidate, en).wallpaper !== null) ?? null;

  const photos = entries
    .filter((entry) => entry.name.startsWith(PHOTOS_FOLDER) && entry.data.length > 0)
    .flatMap((entry) => {
      const [vehicleId, ...rest] = entry.name.slice(PHOTOS_FOLDER.length).split('/');
      const name = rest.join('/');
      if (vehicleId === undefined || vehicleId === '' || name === '') return [];
      const file = new File([entry.data as BlobPart], name);
      return isImage(file) ? [{ vehicleId, file }] : [];
    });

  const trips = readTrips(entries, decoder);

  /*
   * The collection first, the old flat settings as a fallback.
   *
   * A backup written before this carried `settings.json` alone - the active appearance and the
   * active vehicle's layouts, already resolved. Those files still restore, into a single set,
   * which is all they ever held.
   */
  const collection = entries.find((entry) => entry.name === PROFILES_ENTRY);
  if (collection !== undefined) {
    try {
      const profiles = JSON.parse(decoder.decode(collection.data)) as ProfileState;
      return { profiles, settings: null, trips, avatars, wallpaper, photos, error: null };
    } catch {
      return {
        profiles: null,
        settings: null,
        trips: [],
        avatars: [],
        wallpaper: null,
        photos: [],
        error: t.errors.invalidJson,
      };
    }
  }

  const stored = entries.find(
    (entry) => entry.name === SETTINGS_ENTRY || entry.name === LEGACY_SETTINGS_ENTRY,
  );
  if (stored === undefined) {
    return {
      profiles: null,
      settings: null,
      trips: [],
      avatars: [],
      wallpaper: null,
      photos: [],
      error: format(t.errors.incompleteArchive, { name: PROFILES_ENTRY }),
    };
  }

  const result = parseSettingsFile(decoder.decode(stored.data), t);
  if (result.settings === null) {
    return {
      profiles: null,
      settings: null,
      trips: [],
      avatars: [],
      wallpaper: null,
      photos: [],
      error: result.error,
    };
  }

  return { profiles: null, settings: result.settings, trips, avatars, wallpaper, photos, error: null };
}

export function downloadBackup(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = name;

  // Some browsers ignore a click on an element outside the document.
  document.body.append(link);
  link.click();
  link.remove();

  // Revoking immediately would cut the download before it had started reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}


/**
 * Trips, if the file carries any.
 *
 * Absent from every backup written before they were included, and a missing history is not a
 * broken file - it restores as an empty one rather than refusing the whole archive.
 */
function readTrips(entries: readonly ArchiveEntry[], decoder: TextDecoder): readonly TripRecord[] {
  const found = entries.find((entry) => entry.name === TRIPS_ENTRY);
  if (found === undefined) return [];

  try {
    const parsed: unknown = JSON.parse(decoder.decode(found.data));
    return Array.isArray(parsed) ? (parsed as TripRecord[]) : [];
  } catch {
    return [];
  }
}
