import { findTheme, THEMES, type ThemeManifest } from '../theme/themes';
import type { AppSettings, BackgroundPreset } from './layout';
import { WALLPAPER_ID } from './wallpaper';

/**
 * Screen background resolution.
 *
 * The background is an explicit choice made in the settings, not a consequence of another setting.
 * It used to be derived from the theme, so filtering the catalogue by theme repainted the whole
 * screen - a side effect nothing announced.
 *
 * Each theme offers its own; imports add more, attached to the theme they were designed for. The
 * theme of the selected background also serves as the reference for what cannot vary tile by tile:
 * the grid lattice, and the look of tiles with no theme of their own.
 *
 * An imported image is the third kind, and the only one belonging to no theme at all. It therefore
 * keeps the look's own theme as that reference: a photo says nothing about what colour a gauge
 * should be, and swapping the palette underneath it would make choosing a decor repaint the tiles.
 */

/** Prefix for backgrounds supplied by the themes themselves. */
const THEME_PREFIX = 'theme:';

export function themeBackgroundId(themeId: string): string {
  return `${THEME_PREFIX}${themeId}`;
}

export interface ResolvedBackground {
  /** Reference theme, which paints the background and supplies the defaults. */
  readonly theme: ThemeManifest;
  /** Imported decor to overlay, if any. */
  readonly imported: BackgroundPreset | null;
  /** Whether the imported image is the one to paint. */
  readonly wallpaper: boolean;
}

/**
 * @param hasWallpaper Whether an image is actually in store. A backup restored without its image,
 * or a deletion made from another tab, leaves the choice pointing at nothing - and a choice that
 * resolves to nothing must fall back, not blank the screen.
 */
export function resolveBackground(
  settings: AppSettings,
  hasWallpaper = false,
): ResolvedBackground {
  const id = settings.backgroundId;
  const fallback = THEMES[0] ?? findTheme('');

  if (id === null) return { theme: fallback, imported: null, wallpaper: false };

  /*
   * An imported image has no theme, so it falls back like every other background that has none.
   *
   * It used to take `settings.themeId`, meaning to keep the look's palette. But that field is also
   * where the CATALOGUE stores the theme it was last filtered by - so with an image as background,
   * filtering tiles repainted the whole board. Measured: the accent went from #22d3ee to #4ade80
   * on a change that was supposed to touch a list.
   *
   * That is exactly what the rule above exists to prevent: the reference theme comes from the
   * background, and a background with no theme of its own gets the fallback. No exception.
   */
  if (id === WALLPAPER_ID) {
    return { theme: fallback, imported: null, wallpaper: hasWallpaper };
  }

  if (id.startsWith(THEME_PREFIX)) {
    return { theme: findTheme(id.slice(THEME_PREFIX.length)), imported: null, wallpaper: false };
  }

  const imported = settings.backgrounds.find((background) => background.id === id) ?? null;
  if (imported === null) {
    // Dead reference - a deleted pack, for instance: fall back to a valid background rather than
    // leaving the screen bare.
    return { theme: fallback, imported: null, wallpaper: false };
  }

  return {
    theme: imported.themeId === null ? fallback : findTheme(imported.themeId),
    imported,
    wallpaper: false,
  };
}
