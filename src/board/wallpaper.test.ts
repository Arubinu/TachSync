import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { DEFAULT_SETTINGS } from './layout';
import { resolveBackground, themeBackgroundId } from './backgrounds';
import { MAX_WALLPAPER_BYTES, readWallpaperFile, WALLPAPER_ID } from './wallpaper';

/** A file of a stated size, without allocating it. */
function file(name: string, type: string, size = 10): File {
  const made = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(made, 'size', { value: size });
  return made;
}

describe('reading an image file', () => {
  it('accepts what the system declares as an image', () => {
    expect(readWallpaperFile(file('sunset.jpg', 'image/jpeg'), en).wallpaper).not.toBeNull();
    expect(readWallpaperFile(file('logo.svg', 'image/svg+xml'), en).wallpaper).not.toBeNull();
  });

  it('falls back to the extension when the system declares nothing', () => {
    // Measured on Android pickers: some hand over a file with an empty `type`. Refusing it would
    // refuse a perfectly ordinary photo for a reason the user cannot see, let alone fix.
    expect(readWallpaperFile(file('sunset.jpg', ''), en).wallpaper).not.toBeNull();
  });

  it('refuses what is not an image, and says so', () => {
    const { wallpaper, error } = readWallpaperFile(file('notes.pdf', 'application/pdf'), en);

    expect(wallpaper).toBeNull();
    expect(error).toBe(en.errors.notAnImage);
  });

  it('refuses a file above the cap', () => {
    const heavy = file('huge.png', 'image/png', MAX_WALLPAPER_BYTES + 1);

    expect(readWallpaperFile(heavy, en).wallpaper).toBeNull();
    expect(readWallpaperFile(file('fine.png', 'image/png', MAX_WALLPAPER_BYTES), en).wallpaper)
      .not.toBeNull();
  });

  it('keeps the file name, which is what names the choice', () => {
    expect(readWallpaperFile(file('mont blanc.jpg', 'image/jpeg'), en).wallpaper?.fileName).toBe(
      'mont blanc.jpg',
    );
  });
});

describe('choosing the image as the background', () => {
  const chosen = { ...DEFAULT_SETTINGS, backgroundId: WALLPAPER_ID };

  it('paints it when it is there', () => {
    expect(resolveBackground(chosen, true).wallpaper).toBe(true);
  });

  it('falls back rather than blanking the screen when it is not', () => {
    // A backup restored without its image, or a deletion made in another tab: the choice outlives
    // the file, and a decor that is gone must leave a background behind, not a hole.
    const resolved = resolveBackground(chosen, false);

    expect(resolved.wallpaper).toBe(false);
    expect(resolved.imported).toBeNull();
    expect(resolved.theme).not.toBeNull();
  });

  it('keeps the look own theme as the reference', () => {
    // A photograph says nothing about what colour a gauge should be. Were it to fall back to the
    // first theme in the catalogue, importing a background would repaint every tile with it.
    const settings = { ...chosen, themeId: 'neon-miami' };

    expect(resolveBackground(settings, true).theme.id).toBe('neon-miami');
  });

  it('leaves every other kind of background alone', () => {
    expect(resolveBackground(DEFAULT_SETTINGS, true).wallpaper).toBe(false);
    expect(
      resolveBackground({ ...DEFAULT_SETTINGS, backgroundId: themeBackgroundId('neon-miami') }, true)
        .wallpaper,
    ).toBe(false);
  });
});
