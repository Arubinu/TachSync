import type { Translation } from '../i18n';
import { checkImage, fitImage, MAX_IMAGE_BYTES } from '../storage/image';
import { run, WALLPAPERS } from '../storage/db';

/**
 * The background image the user brings in.
 *
 * A photo, where `BackgroundPreset` wants confined CSS and a declarative layout: the shortcut for
 * whoever will never author one.
 *
 * One image at a time. A second slot would need a name, a list and an order - the theme
 * backgrounds and imported packs already are that library.
 *
 * In IndexedDB rather than `localStorage`, for the reason given in `avatar/store`.
 *
 * Checking and resampling live in `storage/image`: the vehicle photo needs exactly the same, and
 * two copies would have drifted on the first cap anyone changed.
 */

/**
 * Reserved background id.
 *
 * Not a `theme:` id and not an imported preset's: the chooser holds it as a third kind, so nothing
 * has to invent a `BackgroundPreset` around a blob that has neither CSS nor layout.
 */
export const WALLPAPER_ID = 'wallpaper';

/** One key, since there is one image. */
const RECORD_ID = 'current';

/** Kept under its old name: the tests and the settings both speak of the wallpaper's cap. */
export const MAX_WALLPAPER_BYTES = MAX_IMAGE_BYTES;

/** Kept under its old name too - see `storage/image`. */
export const fitWallpaper = fitImage;

export interface StoredWallpaper {
  readonly id: string;
  /** Original file name. It names the entry a backup writes. */
  readonly fileName: string;
  readonly type: string;
  readonly size: number;
  readonly data: Blob;
}

export interface WallpaperImport {
  readonly wallpaper: StoredWallpaper | null;
  readonly error: string | null;
}

/** Checks a file and turns it into a record. */
export function readWallpaperFile(file: File, t: Translation): WallpaperImport {
  const error = checkImage(file, t);
  if (error !== null) return { wallpaper: null, error };

  return {
    wallpaper: {
      id: RECORD_ID,
      fileName: file.name,
      type: file.type,
      size: file.size,
      data: file,
    },
    error: null,
  };
}

export async function readWallpaper(): Promise<StoredWallpaper | null> {
  try {
    const found = await run<StoredWallpaper | undefined>(WALLPAPERS, 'readonly', (store) =>
      store.get(RECORD_ID),
    );
    return found ?? null;
  } catch {
    // Private browsing, quota refused, storage disabled: the board paints its theme background and
    // carries on, rather than refusing to start over a decoration.
    return null;
  }
}

export async function saveWallpaper(wallpaper: StoredWallpaper): Promise<void> {
  await run(WALLPAPERS, 'readwrite', (store) => store.put(wallpaper));
}

export async function deleteWallpaper(): Promise<void> {
  await run(WALLPAPERS, 'readwrite', (store) => store.delete(RECORD_ID));
}
