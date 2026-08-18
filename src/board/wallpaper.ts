import { format, type Translation } from '../i18n';
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

/** Beyond this the file is refused outright, before anything tries to decode it. */
export const MAX_WALLPAPER_BYTES = 16 * 1024 * 1024;

/**
 * Longest edge kept, in pixels.
 *
 * The byte cap bounds the file, not the picture: a 16 MB PNG can hold 8000x6000 pixels - 192 MB
 * once decoded, on a phone already running the 3D avatar. At or below this the original file is
 * stored untouched, so an ordinary photo survives a backup byte for byte.
 */
export const MAX_WALLPAPER_EDGE = 2560;

/** Extensions accepted when the system reports no type, which happens on some Android pickers. */
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp', 'svg'];

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

function isImage(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.includes(extension);
}

/**
 * Checks a file and turns it into a record.
 *
 * Separate from the resampling below: what the name and size settle needs no canvas, and stays
 * testable without a browser.
 */
export function readWallpaperFile(file: File, t: Translation): WallpaperImport {
  if (!isImage(file)) {
    return { wallpaper: null, error: t.errors.notAnImage };
  }

  if (file.size > MAX_WALLPAPER_BYTES) {
    const size = Math.round(file.size / 1024 / 1024);
    return { wallpaper: null, error: format(t.errors.imageTooLarge, { size }) };
  }

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

/**
 * Resamples an oversized image, and only an oversized one.
 *
 * Every failure returns the original: storing the picture as it came beats refusing it, and the
 * worst case is the memory cost, not a lost background.
 *
 * SVG is left alone: it has no pixels to lose.
 */
export async function fitWallpaper(file: File): Promise<Blob> {
  if (file.type === 'image/svg+xml') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);

    if (longest <= MAX_WALLPAPER_EDGE) {
      bitmap.close();
      return file;
    }

    const ratio = MAX_WALLPAPER_EDGE / longest;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);

    const context = canvas.getContext('2d');
    if (context === null) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    // WebP rather than JPEG: it keeps transparency, which a PNG background may rely on to let the
    // theme show through underneath.
    const resampled = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', 0.92);
    });

    return resampled ?? file;
  } catch {
    return file;
  }
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
