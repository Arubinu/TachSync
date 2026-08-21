import { useCallback, useEffect, useState } from 'react';
import { useTipMessage } from './Tip';
import type { Translation } from '../i18n';
import {
  deleteWallpaper,
  fitWallpaper,
  readWallpaper,
  readWallpaperFile,
  saveWallpaper,
  type StoredWallpaper,
} from './wallpaper';

export interface WallpaperLibrary {
  /** The stored image, or `null` when none was imported. */
  readonly wallpaper: StoredWallpaper | null;
  /** Object URL to paint it with, minted for this session and revoked when it changes. */
  readonly url: string | null;
  /** Why an image was refused. Nothing on success: the chooser is what says it worked. */
  readonly report: string | null;
  /**
   * Bumped on every answer.
   *
   * Two identical refusals are the same string, which React would leave mounted and motionless:
   * the second attempt would look unread.
   */
  readonly reportId: number;
  /** Resolves to whether the image was taken, so the caller can select what it just imported. */
  importFile(file: File): Promise<boolean>;
  remove(): Promise<void>;
}

/**
 * The imported background image, and the URL to paint it with.
 *
 * The blob becomes a URL here and nowhere else: an object URL is a live handle on memory, and one
 * minted per render would leak the whole image on every repaint.
 *
 * The catalogue is handed in, not read from the context: `App` provides that context, so a hook
 * called from its body would read the default one - English - whatever the interface is set to.
 */
export function useWallpaper(t: Translation): WallpaperLibrary {
  const [wallpaper, setWallpaper] = useState<StoredWallpaper | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const { text: report, id: reportId, say: answer } = useTipMessage();

  useEffect(() => {
    void readWallpaper().then(setWallpaper);
  }, []);

  useEffect(() => {
    if (wallpaper === null) {
      setUrl(null);
      return;
    }

    const minted = URL.createObjectURL(wallpaper.data);
    setUrl(minted);
    return () => URL.revokeObjectURL(minted);
  }, [wallpaper]);

  const importFile = useCallback(
    async (file: File): Promise<boolean> => {
      const checked = readWallpaperFile(file, t);
      if (checked.wallpaper === null) {
        answer(checked.error);
        return false;
      }

      try {
        const data = await fitWallpaper(file);
        // Resampling changes the format, so the name has to follow: it is what the backup writes on
        // the archive entry, and a `.png` holding WebP would be a small lie told to a text editor.
        const resampled = data !== (file as Blob);
        const fileName = resampled
          ? `${file.name.replace(/\.[^.]+$/, '')}.webp`
          : checked.wallpaper.fileName;

        const record: StoredWallpaper = {
          ...checked.wallpaper,
          fileName,
          type: resampled ? data.type : checked.wallpaper.type,
          size: data.size,
          data,
        };

        await saveWallpaper(record);
        setWallpaper(record);
        answer(null);
        return true;
      } catch (cause: unknown) {
        // Quota exceeded, private browsing: the reason matters, since the user can do nothing with
        // a bare "failed".
        answer(cause instanceof Error ? cause.message : t.settings.importFailed);
        return false;
      }
    },
    [t, answer],
  );

  const remove = useCallback(async (): Promise<void> => {
    await deleteWallpaper();
    setWallpaper(null);
    answer(null);
  }, [answer]);

  return { wallpaper, url, report, reportId, importFile, remove };
}
