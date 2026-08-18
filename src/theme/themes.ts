import type { GaugeShape } from '../board/tiles';
import type { TileArrangement } from '../board/layout';

/**
 * Theme manifests.
 *
 * A theme is data, never code: adding one must not require changing a component.
 *
 * The grid imposes nothing - it fills the screen edge to edge with no gutter or margin. Each tile
 * decides how much air it wants around it (`tile.margin`), so two neighbours are separated by the
 * sum of what each asks for, and a tile designed to touch its neighbours really does.
 */

export interface ThemeManifest {
  readonly id: string;
  readonly label: string;
  /** Full-screen background: a complete CSS `background` value. */
  readonly background: string;
  readonly colors: {
    /** Colour of highlighted values. */
    readonly accent: string;
    /** Secondary colour, for hot or sporty states. */
    readonly accentAlt: string;
    readonly textPrimary: string;
    readonly textMuted: string;
    readonly tileBackground: string;
    readonly tileBorder: string;
    readonly danger: string;
  };
  readonly tile: {
    readonly radius: string;
    /** Inner padding, keeping content off the tile edge. */
    readonly padding: string;
    /**
     * Air requested around the tile. '0px' means it touches its neighbours and the screen edges.
     * Two adjacent tiles are separated by the sum of their margins - the grid's only spacing
     * mechanism.
     */
    readonly margin: string;
    readonly borderWidth: string;
    /** Bevelled corner, technical HUD look. '0px' gives classic round corners. */
    readonly cornerCut: string;
    /** Tile backdrop blur (glass effect). */
    readonly blur: string;
    /** Halo intensity around highlighted values. */
    readonly glow: string;
    /**
     * Internal tile arrangement.
     *
     * `stacked` piles label, value and gauge - readable at a glance but it needs height. `inline`
     * puts the label left and the value right, which is what makes a wide, low tile usable where
     * stacking would leave the value tiny in the middle of empty space.
     *
     * A theme choice, not a tile one: the coherence of the whole grid is at stake.
     */
    readonly arrangement: TileArrangement;
    /**
     * Gauge shape for tiles.
     *
     * Belongs to the theme rather than the metric: a dial needs a tile tall enough to hold it, and
     * the theme sets the default footprint. The same speed reads as a bar here and a dial
     * elsewhere.
     */
    readonly gauge: GaugeShape;
  };
  /**
   * Theme nature.
   *
   * A theme that is already light escapes derivation: it has its own idea of what light means.
   * Absent, the theme is taken to be dark.
   */
  readonly appearance?: 'dark' | 'light';
  readonly effects: {
    /** CRT-style scan lines. */
    readonly scanlines: boolean;
  };
}

/**
 * Default theme: cyan and magenta neon on deep black, glass tiles with bevelled corners, flush to
 * the edges.
 */
export const NEON_MIAMI: ThemeManifest = {
  id: 'neon-miami',
  label: 'Neon Miami',
  // Two light sources rather than four, plus a vignette. Magenta stays low left under the
  // character, cyan grazes the top right above the tiles.
  background: `
    radial-gradient(52% 40% at 6% 106%, rgba(236, 51, 143, 0.14) 0%, transparent 72%),
    radial-gradient(58% 44% at 96% -6%, rgba(34, 211, 238, 0.13) 0%, transparent 72%),
    radial-gradient(120% 120% at 50% 48%, transparent 38%, rgba(0, 0, 0, 0.62) 100%),
    linear-gradient(168deg, #080a16 0%, #090714 48%, #04050b 100%)
  `,
  colors: {
    accent: '#22d3ee',
    accentAlt: '#ff2d95',
    textPrimary: '#f5f7ff',
    textMuted: 'rgba(226, 232, 255, 0.62)',
    // Lit from above rather than flat: a flat surface on a gradient background reads as a cut-out
    // hole, not a panel laid on top.
    tileBackground: `
      linear-gradient(180deg, rgba(15, 21, 44, 0.34) 0%, rgba(8, 11, 26, 0.2) 100%)
    `,
    // Neutral and very discreet. At 22% cyan every tile drew a luminous outline and the grid read
    // as a spreadsheet.
    tileBorder: 'rgba(160, 196, 255, 0.09)',
    danger: '#fb3b53',
  },
  tile: {
    radius: '4px',
    padding: 'clamp(0.7rem, 2.1vmin, 1.35rem)',
    // None: the bevelled corners are enough to separate the tiles, and the whole reads as one block
    // of instrumentation.
    margin: '0px',
    borderWidth: '1px',
    cornerCut: '18px',
    blur: '16px',
    /**
     * Almost off. A halo only distinguishes if it is rare; applied to every value it left a blurred
     * screen where nothing stood out. What remains lifts the figure off the background.
     */
    glow: '0.16',
    arrangement: 'stacked',
    gauge: 'bar',
  },
  effects: { scanlines: true },
};

/** Sober theme: readable in full sun, no effects, very airy. */
export const STEALTH: ThemeManifest = {
  id: 'stealth',
  label: 'Stealth',
  background: 'linear-gradient(180deg, #14161c 0%, #0b0d11 100%)',
  colors: {
    accent: '#f8fafc',
    accentAlt: '#94a3b8',
    textPrimary: '#f8fafc',
    textMuted: 'rgba(148, 163, 184, 0.75)',
    tileBackground: 'rgba(148, 163, 184, 0.07)',
    tileBorder: 'rgba(148, 163, 184, 0.16)',
    danger: '#ef4444',
  },
  tile: {
    radius: '18px',
    padding: 'clamp(0.6rem, 1.8vmin, 1.1rem)',
    margin: 'clamp(0.3rem, 0.9vmin, 0.55rem)',
    borderWidth: '1px',
    cornerCut: '0px',
    blur: '6px',
    glow: '0',
    arrangement: 'stacked',
    gauge: 'bar',
  },
  effects: { scanlines: false },
};

/** Rally theme: high-contrast amber, sharp angles, tight gutters. */
export const RALLY: ThemeManifest = {
  id: 'rally',
  label: 'Rally',
  background: `
    radial-gradient(100% 70% at 50% 110%, rgba(251, 146, 60, 0.22) 0%, transparent 60%),
    linear-gradient(175deg, #17130c 0%, #0c0a07 100%)
  `,
  colors: {
    accent: '#fbbf24',
    accentAlt: '#f97316',
    textPrimary: '#fffbeb',
    textMuted: 'rgba(253, 230, 138, 0.55)',
    tileBackground: 'rgba(28, 22, 12, 0.5)',
    tileBorder: 'rgba(251, 191, 36, 0.24)',
    danger: '#dc2626',
  },
  tile: {
    radius: '2px',
    padding: 'clamp(0.5rem, 1.6vmin, 1rem)',
    margin: '3px',
    borderWidth: '1px',
    cornerCut: '0px',
    blur: '8px',
    glow: '0.14',
    arrangement: 'stacked',
    gauge: 'bar',
  },
  effects: { scanlines: false },
};

/**
 * Night theme, horizontal tiles.
 *
 * Designed for wide, low grids where stacking leaves the value lost in an empty band: the label
 * holds the left and the value the right, so two stacked tiles form a column and the eye reads down
 * a list instead of scanning a mosaic.
 */
export const MIDNIGHT: ThemeManifest = {
  id: 'midnight',
  label: 'Midnight',
  background: `
    radial-gradient(90% 60% at 50% -10%, rgba(56, 89, 158, 0.22) 0%, transparent 65%),
    radial-gradient(120% 120% at 50% 45%, transparent 40%, rgba(0, 0, 0, 0.55) 100%),
    linear-gradient(180deg, #0d1220 0%, #080b14 60%, #05070d 100%)
  `,
  colors: {
    accent: '#8ab4ff',
    accentAlt: '#5f8fe0',
    textPrimary: '#eaf0fb',
    textMuted: 'rgba(190, 205, 230, 0.6)',
    tileBackground: `
      linear-gradient(180deg, rgba(24, 33, 54, 0.62) 0%, rgba(14, 19, 32, 0.5) 100%)
    `,
    tileBorder: 'rgba(150, 178, 224, 0.1)',
    danger: '#fb3b53',
  },
  tile: {
    radius: '12px',
    padding: 'clamp(0.6rem, 1.9vmin, 1.15rem)',
    margin: 'clamp(0.15rem, 0.5vmin, 0.35rem)',
    borderWidth: '1px',
    cornerCut: '0px',
    blur: '10px',
    glow: '0',
    arrangement: 'inline',
    gauge: 'bar',
  },
  effects: { scanlines: false },
};

/**
 * High-contrast daytime theme, also in horizontal tiles. No halo, no blur, almost no translucency:
 * the only one that stays readable on a windscreen in full sun, where any effect turns into milky
 * veil.
 */
export const DAYLIGHT: ThemeManifest = {
  id: 'daylight',
  label: 'Daylight',
  background: `
    radial-gradient(120% 120% at 50% 40%, transparent 45%, rgba(0, 0, 0, 0.4) 100%),
    linear-gradient(180deg, #1c2027 0%, #12151a 100%)
  `,
  colors: {
    accent: '#ffffff',
    accentAlt: '#cbd5e1',
    textPrimary: '#ffffff',
    textMuted: 'rgba(226, 232, 240, 0.72)',
    tileBackground: 'rgba(255, 255, 255, 0.06)',
    tileBorder: 'rgba(255, 255, 255, 0.14)',
    danger: '#ff4d4d',
  },
  tile: {
    radius: '10px',
    padding: 'clamp(0.55rem, 1.8vmin, 1.1rem)',
    margin: 'clamp(0.15rem, 0.5vmin, 0.35rem)',
    borderWidth: '1px',
    cornerCut: '0px',
    blur: '0px',
    glow: '0',
    arrangement: 'inline',
    gauge: 'bar',
  },
  appearance: 'light',
  effects: { scanlines: false },
};

/**
 * Phosphor green theme, stacked. A workshop instrument screen: monochrome, no glass, one colour
 * carrying everything.
 */
export const PHOSPHOR: ThemeManifest = {
  id: 'phosphor',
  label: 'Phosphor',
  background: `
    radial-gradient(80% 55% at 50% 105%, rgba(34, 197, 94, 0.12) 0%, transparent 70%),
    radial-gradient(120% 120% at 50% 45%, transparent 40%, rgba(0, 0, 0, 0.6) 100%),
    linear-gradient(180deg, #060b08 0%, #030604 100%)
  `,
  colors: {
    accent: '#4ade80',
    accentAlt: '#a3e635',
    textPrimary: '#e6f7ec',
    textMuted: 'rgba(167, 214, 184, 0.6)',
    tileBackground: 'rgba(10, 24, 16, 0.45)',
    tileBorder: 'rgba(74, 222, 128, 0.14)',
    danger: '#fb7185',
  },
  tile: {
    radius: '2px',
    padding: 'clamp(0.65rem, 2vmin, 1.3rem)',
    margin: '0px',
    borderWidth: '1px',
    cornerCut: '10px',
    blur: '8px',
    glow: '0.22',
    arrangement: 'stacked',
    gauge: 'bar',
  },
  effects: { scanlines: true },
};

/**
 * Round dials, like instruments set into a dashboard.
 *
 * Radius alone rounds the tile but does not make it a dial: it also needs a generous margin,
 * without which the discs touch and the gap between them draws diamonds instead of separating them.
 * And centred content, since text aligned left inside a circle runs into the curve.
 */
export const DIAL: ThemeManifest = {
  id: 'dial',
  label: 'Dial',
  background: `
    radial-gradient(85% 60% at 50% -5%, rgba(120, 140, 175, 0.16) 0%, transparent 65%),
    radial-gradient(120% 120% at 50% 45%, transparent 38%, rgba(0, 0, 0, 0.6) 100%),
    linear-gradient(180deg, #14171d 0%, #0a0c10 100%)
  `,
  colors: {
    accent: '#e8eef7',
    accentAlt: '#93a4bd',
    textPrimary: '#f2f5fa',
    textMuted: 'rgba(200, 212, 230, 0.6)',
    tileBackground: `
      radial-gradient(120% 120% at 50% 0%, rgba(46, 55, 72, 0.72) 0%, rgba(16, 20, 27, 0.72) 70%)
    `,
    tileBorder: 'rgba(190, 205, 228, 0.16)',
    danger: '#ff5c6e',
  },
  tile: {
    radius: '999px',
    // Generous: this is what isolates the discs from each other.
    padding: 'clamp(0.9rem, 3vmin, 1.8rem)',
    margin: 'clamp(0.35rem, 1.1vmin, 0.7rem)',
    borderWidth: '1px',
    cornerCut: '0px',
    blur: '12px',
    glow: '0',
    arrangement: 'centered',
    // The only dial theme: its round tiles are made for it.
    gauge: 'dial',
  },
  effects: { scanlines: false },
};

/**
 * No border and no fill: values laid straight onto the background.
 *
 * Nothing delimits the tile, so space must - hence a wide margin, the only one at this scale.
 * Reduce it and the values form an indistinct block again: here the breathing room is the
 * structure, not an ornament.
 *
 * The halo replaces the frame: it is what lifts the figure off the background.
 */
export const HALO: ThemeManifest = {
  id: 'halo',
  label: 'Halo',
  background: `
    radial-gradient(75% 55% at 20% 100%, rgba(129, 87, 227, 0.16) 0%, transparent 70%),
    radial-gradient(65% 50% at 88% 0%, rgba(45, 212, 191, 0.14) 0%, transparent 70%),
    linear-gradient(170deg, #0a0912 0%, #06060c 100%)
  `,
  colors: {
    accent: '#5eead4',
    accentAlt: '#a78bfa',
    textPrimary: '#f0f4f8',
    textMuted: 'rgba(203, 213, 225, 0.5)',
    tileBackground: 'transparent',
    tileBorder: 'transparent',
    danger: '#fb7185',
  },
  tile: {
    radius: '0px',
    padding: 'clamp(0.4rem, 1.4vmin, 0.9rem)',
    // Wide, and it is all that separates a tile from its neighbour.
    margin: 'clamp(0.6rem, 2vmin, 1.4rem)',
    borderWidth: '0px',
    cornerCut: '0px',
    blur: '0px',
    glow: '0.45',
    arrangement: 'stacked',
    gauge: 'bar',
  },
  effects: { scanlines: false },
};

export const THEMES: readonly ThemeManifest[] = [
  NEON_MIAMI,
  MIDNIGHT,
  DIAL,
  HALO,
  PHOSPHOR,
  DAYLIGHT,
  STEALTH,
  RALLY,
];

export function findTheme(id: string): ThemeManifest {
  return THEMES.find((theme) => theme.id === id) ?? NEON_MIAMI;
}

/**
 * Per-tile variables.
 *
 * Separate from the global ones because a tile carries its own theme: the grid can mix tiles of
 * different origins, each keeping the look its own theme intends. Set inline on the element, they
 * naturally override those on the root.
 */
/**
 * Arrangements projected into grid tracks.
 *
 * As variables rather than classes: CSS can consume a value but never branch on its content, and a
 * tile already carries its variables inline.
 */
const ARRANGEMENTS: Record<ThemeManifest['tile']['arrangement'], Record<string, string>> = {
  stacked: {
    '--tile-cols': 'minmax(0, 1fr)',
    '--tile-rows': 'auto 1fr auto',
    '--tile-label-self': 'stretch',
    '--tile-value-justify': 'flex-start',
    '--tile-text-align': 'left',
  },
  inline: {
    '--tile-cols': 'auto minmax(0, 1fr)',
    '--tile-rows': 'minmax(0, 1fr)',
    '--tile-label-self': 'center',
    '--tile-value-justify': 'flex-end',
    '--tile-text-align': 'left',
  },
  // Everything converges on the centre: inside a round tile, left-aligned text floats against a
  // curve and reads as a template error.
  centered: {
    '--tile-cols': 'minmax(0, 1fr)',
    '--tile-rows': 'auto 1fr auto',
    '--tile-label-self': 'stretch',
    '--tile-value-justify': 'center',
    '--tile-text-align': 'center',
  },
};

export function themeToTileVariables(theme: ThemeManifest): Record<string, string> {
  return {
    '--accent': theme.colors.accent,
    '--accent-alt': theme.colors.accentAlt,
    '--text-primary': theme.colors.textPrimary,
    '--text-muted': theme.colors.textMuted,
    '--tile-bg': theme.colors.tileBackground,
    '--tile-border': theme.colors.tileBorder,
    '--danger': theme.colors.danger,
    '--tile-radius': theme.tile.radius,
    '--tile-padding': theme.tile.padding,
    '--tile-margin': theme.tile.margin,
    '--tile-border-width': theme.tile.borderWidth,
    '--tile-corner-cut': theme.tile.cornerCut,
    '--tile-blur': theme.tile.blur,
    '--tile-glow': theme.tile.glow,
    // The same value under a second name: the board multiplies it by the driving-mode intensity,
    // which it cannot do on a property that would reference itself. Outside the board - catalogue,
    // previews - the glow stays the theme's, without ambience.
    '--theme-glow': theme.tile.glow,
    // Projected into grid tracks rather than a keyword: CSS can consume a value directly, never
    // branch on its content.
    ...ARRANGEMENTS[theme.tile.arrangement],
  };
}

/**
 * Projects a manifest into CSS variables for the document root.
 *
 * Includes the tile variables, which then act as defaults for tiles that declare none, plus the one
 * thing that can only belong to the whole screen: the background.
 */
export function themeToCssVariables(theme: ThemeManifest): Record<string, string> {
  return {
    ...themeToTileVariables(theme),
    '--bg': theme.background,
  };
}
