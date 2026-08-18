/**
 * Grid configuration.
 *
 * Three stacked layers share one lattice of columns and rows. Each tile belongs to a layer,
 * occupies a number of cells, and shows one or more metrics - the first large, the rest as
 * secondary readouts.
 */

import { DEFAULT_AVATAR_ID } from '../avatar/registry';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  detectLanguage,
  type LanguageCode,
  type Translation,
} from '../i18n';
import type { AnyChannel } from '../telemetry/types';

export type MetricId =
  | 'speed'
  | 'rpm'
  | 'gear'
  | 'throttle'
  | 'boost'
  | 'consumption'
  | 'consumptionRate'
  | 'engineLoad'
  | 'coolant'
  | 'maf'
  | 'lateralG'
  | 'longitudinalG'
  | 'tripDistance'
  | 'tripAverage'
  | 'tripDuration'
  | 'avatar';

/** 0 = background, 1 = main, 2 = front. */
export type LayerIndex = 0 | 1 | 2;

export const LAYERS: readonly LayerIndex[] = [0, 1, 2];

/**
 * Layer translation keys. This module describes the grid and does not know the interface language;
 * components translate.
 */
export const LAYER_KEYS: Record<LayerIndex, 'background' | 'main' | 'front'> = {
  0: 'background',
  1: 'main',
  2: 'front',
};

/** What to do when the metric is unavailable on this vehicle. */
export type UnavailableBehaviour = 'hide' | 'show';

/** Board edges, clockwise from the top. */
/**
 * Tile dressing options.
 *
 * Ordered as a progressive stripping: the border goes, then the fill, then the fill fades out
 * towards its edges, then nothing is left.
 */
/**
 * What becomes of the tile's caption.
 *
 * Three states rather than a switch, because hiding a word and reclaiming its room are different
 * wishes. On a grid of many tiles, keeping the space is what holds their values on one line; on a
 * tile of its own, giving that space to the figure is the whole point of hiding the caption.
 */
export const TILE_CAPTIONS = ['show', 'hide', 'spread'] as const;
export type TileCaption = (typeof TILE_CAPTIONS)[number];

export const DEFAULT_CAPTION: TileCaption = 'show';

export function normalizeCaption(raw: unknown): TileCaption {
  return TILE_CAPTIONS.includes(raw as TileCaption) ? (raw as TileCaption) : DEFAULT_CAPTION;
}

export const TILE_CHROMES = ['default', 'borderless', 'unfilled', 'feathered', 'bare'] as const;
export type TileChrome = (typeof TILE_CHROMES)[number];

export const DEFAULT_CHROME: TileChrome = 'default';

export function normalizeChrome(raw: unknown): TileChrome {
  return TILE_CHROMES.includes(raw as TileChrome) ? (raw as TileChrome) : DEFAULT_CHROME;
}

/** Which screen edge the edit toolbar is docked to. */
export type EditBarDock = 'top' | 'bottom';

export const FLUSH_SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type FlushSide = (typeof FLUSH_SIDES)[number];

/** `auto` follows position, `force` asserts contact, `off` suppresses it. */
export type FlushMode = 'auto' | 'force' | 'off';

export type FlushSettings = Readonly<Record<FlushSide, FlushMode>>;

export const DEFAULT_FLUSH: FlushSettings = {
  top: 'auto',
  right: 'auto',
  bottom: 'auto',
  left: 'auto',
};

/**
 * Board edges the tile actually touches, with per-side settings applied.
 *
 * Rendered as a string for the `data-flush` attribute, so a theme or an imported pack can target
 * `[data-flush~="left"]` knowing nothing about the grid.
 */
/** Bounds for per-tile spacing, in pixels. */
export const SPACING_MAX = 32;
export const SPACING_STEP = 2;

/**
 * Next spacing value, wrapping through the theme's own.
 *
 * Going below zero does not give a negative margin but hands control back to the theme - the only
 * way to return to the default without an extra control.
 */
export function stepSpacing(current: number | null, delta: number): number | null {
  if (current === null) return delta > 0 ? 0 : null;
  const next = current + delta * SPACING_STEP;
  if (next < 0) return null;
  return Math.min(SPACING_MAX, next);
}

/** Coerces a setting read from a file back to known values, side by side. */
export function normalizeFlush(raw: unknown): FlushSettings {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const modes = ['auto', 'force', 'off'];

  return Object.fromEntries(
    FLUSH_SIDES.map((side) => [
      side,
      modes.includes(source[side] as string) ? (source[side] as FlushMode) : 'auto',
    ]),
  ) as FlushSettings;
}

export function flushEdges(tile: TileConfig, columns: number, rows: number): string {
  const touches: Record<FlushSide, boolean> = {
    top: tile.rowStart === 1,
    left: tile.colStart === 1,
    right: tile.colStart + tile.colSpan - 1 >= columns,
    bottom: tile.rowStart + tile.rowSpan - 1 >= rows,
  };

  return FLUSH_SIDES.filter((side) => {
    const mode = tile.flush[side];
    return mode === 'force' || (mode === 'auto' && touches[side]);
  }).join(' ');
}

export interface TileConfig {
  readonly id: string;
  readonly layer: LayerIndex;
  /**
   * Explicit 1-indexed position in the grid.
   *
   * Browser auto-placement was abandoned: only the browser knew the real layout, which made it
   * impossible to tell which cells were free - and therefore to add a tile at a chosen spot or
   * preview a move.
   */
  readonly colStart: number;
  readonly rowStart: number;
  readonly colSpan: number;
  readonly rowSpan: number;
  /** Per-tile font size multiplier. */
  readonly fontScale: number;
  /**
   * Declared contact with the board edges, side by side.
   *
   * `auto` follows the real position, `force` declares contact even mid-grid, `off` hides it even
   * where it exists. Both overrides matter: a tile designed to graft onto an edge must be testable
   * elsewhere, and an ordinary tile pushed against an edge must not start bleeding unasked.
   */
  readonly flush: FlushSettings;
  /**
   * Air requested around the tile, in pixels. `null` means the theme's.
   *
   * Set per tile after placement rather than inherited: the tile knows what it needs. Exposed both
   * as an attribute and a custom property - see `SPACING_MAX` and the rendering in `Board`.
   */
  readonly spacing: number | null;
  /**
   * How much of the theme's dressing the tile keeps.
   *
   * The theme still applies - colours, radius, type - and only the surface gives way, which is what
   * allows placing a value straight onto the background without changing theme for every other
   * tile.
   */
  readonly chrome: TileChrome;
  /** Whether the caption shows, hides, or gives up its room. */
  readonly caption: TileCaption;
  /**
   * Flips the content horizontally. Useful for avatars: a character composed to be seen on the left
   * of the screen looks the wrong way once moved right.
   */
  readonly mirrored: boolean;
  readonly whenUnavailable: UnavailableBehaviour;
  /** The first is the primary value, the rest are secondary. */
  readonly metrics: readonly MetricId[];
  /**
   * Preset the tile came from. Kept so the CSS imported with it can still target the tile long
   * after placement.
   */
  readonly presetId: string | null;
  /**
   * Tile theme, inherited from the preset at placement time. `null` means the application's.
   * Carried by the tile rather than the screen, so one grid can mix tiles from different themes.
   */
  readonly themeId: string | null;
}

export interface LayoutConfig {
  readonly columns: number;
  readonly rows: number;
  readonly tiles: readonly TileConfig[];
}

/**
 * Grid bounds.
 *
 * Here rather than in the screen that applies them, because they serve two distant purposes:
 * limiting the resize buttons, and distrusting an imported file. A layout claiming five thousand
 * columns would come from elsewhere - a hand-edited file, a truncated backup - and the grid would
 * try to draw them.
 *
 * Two different minima: a single column leaves no width to share, where a single row is still a
 * perfectly usable strip.
 */
export const GRID_COLUMNS = { min: 2, max: 42 } as const;
export const GRID_ROWS = { min: 1, max: 42 } as const;

/**
 * A node in a tile template.
 *
 * Deliberately narrow vocabulary: neutral containers and a few metric-bound slots. This is not
 * HTML, and that is the point - accepting free markup from a third-party file would open the door
 * to remote images, frames and links. Nothing can be injected here that was not planned for.
 */
export type TemplateNode =
  /** Fixed text. */
  | { readonly text: string; readonly class?: string }
  /** Current value of a metric, formatted and refreshed. */
  | { readonly value: MetricId; readonly class?: string }
  /** A metric's label. */
  | { readonly label: MetricId; readonly class?: string }
  /** A metric's unit. */
  | { readonly unit: MetricId; readonly class?: string }
  /** Neutral container, the only way to compose structure. */
  | {
      readonly tag: 'div' | 'span';
      readonly class?: string;
      readonly children?: readonly TemplateNode[];
    };

/**
 * Tile preset: what the catalogue drops onto the grid.
 *
 * A placed tile is a frozen instance; a preset is the recipe for creating one. That is what lets a
 * tile combining several metrics be composed once and reused, instead of recomposing the same
 * assembly at every placement.
 *
 * Every known metric produces one automatically; users can add their own. Both appear alike in the
 * catalogue.
 */
export interface TilePreset {
  readonly id: string;
  readonly label: string;
  /**
   * Owning theme. `null` means available whatever the theme. Intended so an imported tile set stays
   * attached to its own.
   */
  readonly themeId: string | null;
  readonly colSpan: number;
  readonly rowSpan: number;
  /** The first is the primary value, the rest are secondary. */
  readonly metrics: readonly MetricId[];
  /**
   * Preset-specific CSS, confined to its tiles by an `@scope` rule. Empty string means no special
   * dressing.
   */
  readonly css: string;
  /**
   * Internal structure. `null` means the standard arrangement (label, value, bar, secondary
   * values), which suits the vast majority of cases.
   */
  readonly layout: readonly TemplateNode[] | null;
  /** Import pack name, so a whole pack can be removed at once. */
  readonly pack: string | null;
  /** Derived from a known metric, therefore neither editable nor removable. */
  readonly builtIn: boolean;
}

/**
 * Importable background.
 *
 * Built like a tile preset - confined CSS and declarative structure - because a background is not
 * necessarily an image: animated gradient, halftone, reactive halos. Restricting it to an image
 * file would have closed the door on everything a designer can invent.
 */
export interface BackgroundPreset {
  readonly id: string;
  readonly label: string;
  /** Owning theme, used to group the choice list. */
  readonly themeId: string | null;
  readonly css: string;
  readonly layout: readonly TemplateNode[] | null;
  readonly pack: string | null;
}

export interface AppSettings {
  /**
   * Last theme selected in the catalogue. Not an appearance setting - each tile carries its own -
   * but a convenience: the catalogue reopens where it was left.
   */
  readonly themeId: string;
  /** Last metric filter selected in the catalogue. */
  readonly metricFilter: readonly MetricId[];
  /** User-composed presets, on top of those derived from metrics. */
  readonly presets: readonly TilePreset[];
  /** Imported backgrounds, on top of those supplied by themes. */
  readonly backgrounds: readonly BackgroundPreset[];
  /** Selected background. `null` means the application theme's. */
  readonly backgroundId: string | null;
  /** Avatar shown by tiles of type `avatar`. */
  readonly avatarId: string;
  /** Font multiplier applied to every tile. */
  readonly fontScale: number;
  /**
   * Whether the terms of use have been accepted.
   *
   * Kept with the settings rather than in a cookie of its own: it travels with a backup, so a
   * restored install does not ask again for something already answered.
   *
   * Restored to `false` by anything unreadable, deliberately. Asking twice costs one tap; treating
   * a corrupt file as an acceptance would be the wrong way to be wrong.
   */
  readonly termsAccepted: boolean;
  /**
   * Whether the recorded trips serve as a reference.
   *
   * Off by default, and reversible at any time: it makes the readings personal, which is what
   * makes them useful and also what makes them incomparable with anyone else's. Turning it back
   * off restores the fixed thresholds exactly, since nothing is rewritten - the trips are only
   * read.
   */
  readonly useTripHistory: boolean;
  /**
   * Layout lock - the normal state.
   *
   * Locked, the screen is only a display: no drag and drop, no editing, so a finger brushing the
   * screen while driving moves nothing. It is unlocked explicitly from the settings.
   */
  readonly locked: boolean;
  readonly editBarDock: EditBarDock;
  /** Interface language. Derived from the browser on first launch. */
  /**
   * Light toggle, for the theme and the interface alike.
   *
   * One switch for both, because they answer the same question, but two distinct palettes: the
   * theme's is derived from its own colours, the interface's belongs to the application and follows
   * no theme.
   */
  readonly light: boolean;
  readonly language: LanguageCode;
  /**
   * One layout per orientation, selected automatically.
   *
   * A grid designed for a landscape screen makes no sense upright: column count, footprints, the
   * avatar's place - everything changes. Rearranging on every rotation would undo the previous
   * work, hence two distinct layouts the application swaps between.
   */
  readonly layouts: LayoutsByOrientation;
}

export type Orientation = 'portrait' | 'landscape';

export interface LayoutsByOrientation {
  readonly portrait: LayoutConfig;
  readonly landscape: LayoutConfig;
}

/** Families used to filter the catalogue. */
export type MetricCategory =
  | 'conduite'
  | 'moteur'
  | 'consommation'
  | 'trajet'
  | 'dynamique'
  | 'avatar';

/** Family translation keys - see `LAYER_KEYS` for the rationale. */
export const CATEGORY_KEYS: Record<MetricCategory, keyof Translation['categories']> = {
  conduite: 'driving',
  moteur: 'engine',
  consommation: 'consumption',
  trajet: 'trip',
  dynamique: 'driving',
  avatar: 'character',
};

export const CATEGORIES = Object.keys(CATEGORY_KEYS) as MetricCategory[];

export interface MetricMeta {
  /** Translation key for the display name. */
  readonly key: keyof Translation['metrics'];
  readonly category: MetricCategory;
  /** Required channels. If any is missing, the metric is unavailable. */
  readonly requires: readonly AnyChannel[];
}

export const METRIC_META: Record<MetricId, MetricMeta> = {
  speed: { key: 'speed', category: 'conduite', requires: ['speed'] },
  rpm: { key: 'rpm', category: 'conduite', requires: ['rpm'] },
  gear: { key: 'gear', category: 'conduite', requires: ['gear'] },
  throttle: { key: 'throttle', category: 'conduite', requires: ['throttle'] },
  boost: { key: 'boost', category: 'moteur', requires: ['boost'] },
  consumption: {
    key: 'consumption',
    category: 'consommation',
    requires: ['consumption', 'speed'],
  },
  consumptionRate: { key: 'consumptionRate', category: 'consommation', requires: ['consumption'] },
  engineLoad: { key: 'engineLoad', category: 'moteur', requires: ['engineLoad'] },
  coolant: { key: 'coolant', category: 'moteur', requires: ['coolantTemp'] },
  maf: { key: 'maf', category: 'moteur', requires: ['maf'] },
  lateralG: { key: 'lateralG', category: 'dynamique', requires: ['lateralG'] },
  longitudinalG: { key: 'longitudinalG', category: 'dynamique', requires: ['longitudinalG'] },
  tripDistance: { key: 'tripDistance', category: 'trajet', requires: ['speed'] },
  tripAverage: { key: 'tripAverage', category: 'trajet', requires: ['speed'] },
  tripDuration: { key: 'tripDuration', category: 'trajet', requires: [] },
  // The avatar depends on no channel: it stays present even without data.
  avatar: { key: 'avatar', category: 'avatar', requires: [] },
};

/** Display name of a metric, in the current language. */
export function metricLabel(metric: MetricId, t: Translation): string {
  return t.metrics[METRIC_META[metric].key];
}

export const ALL_METRICS = Object.keys(METRIC_META) as MetricId[];

export function isMetricAvailable(metric: MetricId, channels: ReadonlySet<AnyChannel>): boolean {
  return METRIC_META[metric].requires.every((channel) => channels.has(channel));
}

/**
 * A tile shows if its primary metric is available, or if the user explicitly asked to keep it
 * visible anyway, in which case it shows a dash.
 */
export function isTileVisible(tile: TileConfig, channels: ReadonlySet<AnyChannel>): boolean {
  const primary = tile.metrics[0];
  // Tile being created: visible so it can be seen while its content is chosen.
  if (primary === undefined) return true;
  if (isMetricAvailable(primary, channels)) return true;
  return tile.whenUnavailable === 'show';
}

let idCounter = 0;

export function newTileId(): string {
  idCounter += 1;
  return `tile-${Date.now().toString(36)}-${idCounter}`;
}

/** Initial footprint of a newly placed tile. */
/**
 * Internal tile arrangement, declared by the theme.
 *
 * Defined here rather than in the manifest: footprint calculation depends on it, and `layout` is
 * the base module - the reverse would make footprints depend on the theme module.
 */
export type TileArrangement = 'stacked' | 'inline' | 'centered';

export type MetricWeight = 'hero' | 'primary' | 'normal';

/** How much the metric weighs when read, independently of the theme. */
export function metricWeight(metric: MetricId): MetricWeight {
  if (metric === 'speed') return 'hero';
  // Read peripherally, from the gauge's shape more than the figure.
  if (metric === 'rpm' || metric === 'boost' || metric === 'throttle' || metric === 'engineLoad') {
    return 'primary';
  }
  // The rest - trip, temperatures, accelerations - is consulted at a standstill.
  return 'normal';
}

/**
 * Footprint by weight, decided by the theme's arrangement.
 *
 * Weight says what matters, arrangement says what shape to give it: the same metric wants a square
 * cell in a stacked theme and a wide band in an inline one, where a square tile would defeat the
 * point of putting the label left and the value right.
 */
const SPANS_BY_ARRANGEMENT: Record<
  TileArrangement,
  Record<MetricWeight, { colSpan: number; rowSpan: number }>
> = {
  stacked: {
    hero: { colSpan: 2, rowSpan: 2 },
    primary: { colSpan: 2, rowSpan: 1 },
    normal: { colSpan: 1, rowSpan: 1 },
  },
  // Round: hierarchy comes through diameter, so shapes stay close to square. A very elongated pill
  // no longer reads as a dial.
  centered: {
    hero: { colSpan: 2, rowSpan: 2 },
    primary: { colSpan: 2, rowSpan: 2 },
    normal: { colSpan: 1, rowSpan: 1 },
  },
  // Wide and low, down to ordinary tiles: the shape this arrangement exists for.
  inline: {
    hero: { colSpan: 3, rowSpan: 2 },
    primary: { colSpan: 3, rowSpan: 1 },
    normal: { colSpan: 2, rowSpan: 1 },
  },
};

/**
 * Footprint requested by a metric, in cells.
 *
 * A default, never a constraint: it only decides what the tile takes on arrival, and the editor
 * changes it freely afterwards. An imported pack file overrides these with its own `colSpan` and
 * `rowSpan` - see `tileImport`.
 */
export function defaultSpanFor(
  metric: MetricId,
  arrangement: TileArrangement = 'stacked',
): { colSpan: number; rowSpan: number } {
  // The character carries the screen and its stage is composed vertically: its shape is its own and
  // does not follow the measurement arrangement.
  if (metric === 'avatar') return { colSpan: 2, rowSpan: 3 };

  return SPANS_BY_ARRANGEMENT[arrangement][metricWeight(metric)];
}

/**
 * Creates an empty tile at a precise spot.
 *
 * With no metric attached: it serves as a draft while the user chooses what to show, and disappears
 * if the editor is closed without a selection.
 */
export function createTileAt(layer: LayerIndex, colStart: number, rowStart: number): TileConfig {
  return {
    id: newTileId(),
    layer,
    colStart,
    rowStart,
    colSpan: 1,
    rowSpan: 1,
    fontScale: 1,
    mirrored: false,
    whenUnavailable: 'hide',
    presetId: null,
    themeId: null,
    flush: DEFAULT_FLUSH,
    spacing: null,
    chrome: DEFAULT_CHROME,
    caption: DEFAULT_CAPTION,
    metrics: [],
  };
}

/**
 * Default layout: everything on the main layer, no overlap.
 *
 * The background and front layers are deliberately left empty. Filling them would overlap tiles on
 * first launch - a background avatar under a speed tile starting from the same column - which would
 * look careless.
 */
const base = {
  layer: 1,
  fontScale: 1,
  mirrored: false,
  whenUnavailable: 'hide',
  presetId: null,
  themeId: null,
  flush: DEFAULT_FLUSH,
  spacing: null,
  chrome: DEFAULT_CHROME,
  caption: DEFAULT_CAPTION,
} as const;

export const DEFAULT_LAYOUT: LayoutConfig = {
  columns: 4,
  rows: 3,
  tiles: [
    {
      ...base,
      id: 'avatar',
      colStart: 1,
      rowStart: 1,
      colSpan: 2,
      rowSpan: 3,
      whenUnavailable: 'show',
      presetId: null,
      themeId: null,
      metrics: ['avatar'],
    },
    { ...base, id: 'speed', colStart: 3, rowStart: 1, colSpan: 2, rowSpan: 1, metrics: ['speed'] },
    { ...base, id: 'rpm', colStart: 3, rowStart: 2, colSpan: 1, rowSpan: 1, metrics: ['rpm'] },
    { ...base, id: 'gear', colStart: 4, rowStart: 2, colSpan: 1, rowSpan: 1, metrics: ['gear'] },
    { ...base, id: 'boost', colStart: 3, rowStart: 3, colSpan: 1, rowSpan: 1, metrics: ['boost'] },
    {
      ...base,
      id: 'consumption',
      colStart: 4,
      rowStart: 3,
      colSpan: 1,
      rowSpan: 1,
      metrics: ['consumption', 'tripDistance'],
    },
  ],
};

/**
 * Default portrait layout.
 *
 * Not the landscape one rotated: upright, the avatar takes the top across the full width and the
 * metrics stack below. Transposing the landscape grid would give a tall narrow avatar column where
 * it would no longer read.
 */
export const DEFAULT_PORTRAIT_LAYOUT: LayoutConfig = {
  columns: 2,
  rows: 4,
  tiles: [
    {
      ...base,
      id: 'avatar',
      colStart: 1,
      rowStart: 1,
      colSpan: 2,
      rowSpan: 2,
      whenUnavailable: 'show',
      metrics: ['avatar'],
    },
    { ...base, id: 'speed', colStart: 1, rowStart: 3, colSpan: 2, rowSpan: 1, metrics: ['speed'] },
    { ...base, id: 'rpm', colStart: 1, rowStart: 4, colSpan: 1, rowSpan: 1, metrics: ['rpm'] },
    {
      ...base,
      id: 'consumption',
      colStart: 2,
      rowStart: 4,
      colSpan: 1,
      rowSpan: 1,
      metrics: ['consumption', 'tripDistance'],
    },
  ],
};

export const DEFAULT_SETTINGS: AppSettings = {
  themeId: 'neon-miami',
  metricFilter: [],
  presets: [],
  backgrounds: [],
  backgroundId: null,
  avatarId: DEFAULT_AVATAR_ID,
  fontScale: 1,
  termsAccepted: false,
  useTripHistory: false,
  // Locked at startup: editing is entered deliberately.
  locked: true,
  editBarDock: 'top',
  light: false,
  language: DEFAULT_LANGUAGE,
  layouts: { portrait: DEFAULT_PORTRAIT_LAYOUT, landscape: DEFAULT_LAYOUT },
};

export const FONT_SCALE_MIN = 0.5;
export const FONT_SCALE_MAX = 2.5;
export const FONT_SCALE_STEP = 0.1;

export function clampFontScale(value: number): number {
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round(value * 10) / 10));
}

// --------------------------------------------------------------- occupancy

interface Rect {
  readonly col: number;
  readonly row: number;
  readonly colSpan: number;
  readonly rowSpan: number;
}

function rectOf(tile: TileConfig): Rect {
  return {
    col: tile.colStart,
    row: tile.rowStart,
    colSpan: tile.colSpan,
    rowSpan: tile.rowSpan,
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.col < b.col + b.colSpan &&
    b.col < a.col + a.colSpan &&
    a.row < b.row + b.rowSpan &&
    b.row < a.row + a.rowSpan
  );
}

/**
 * Is there room for this footprint?
 *
 * Two tiles on the same layer cannot occupy the same cell: the CSS grid would stack them without
 * complaint and one would vanish under the other. Blocking the resize costs less than moving the
 * neighbours, which would end up elsewhere unasked and then have to be hunted down.
 *
 * Other layers are ignored: they are never displayed at the same time.
 */
export function hasRoomFor(
  tiles: readonly TileConfig[],
  tile: TileConfig,
  colSpan: number,
  rowSpan: number,
  columns: number,
  rows: number,
): boolean {
  if (tile.colStart + colSpan - 1 > columns || tile.rowStart + rowSpan - 1 > rows) return false;

  const wanted: Rect = {
    col: tile.colStart,
    row: tile.rowStart,
    colSpan,
    rowSpan,
  };

  return !tiles.some(
    (other) => other.id !== tile.id && other.layer === tile.layer && overlaps(rectOf(other), wanted),
  );
}

/** Occupancy grid for one layer. `grid[row][col]`, 0-indexed. */
export function occupancyGrid(
  tiles: readonly TileConfig[],
  layer: LayerIndex,
  columns: number,
  rows: number,
): boolean[][] {
  const grid = Array.from({ length: rows }, () => Array.from({ length: columns }, () => false));
  for (const tile of tiles) {
    if (tile.layer !== layer) continue;
    fill(grid, rectOf(tile), columns, rows);
  }
  return grid;
}

function fill(grid: boolean[][], rect: Rect, columns: number, rows: number): void {
  for (let r = rect.row - 1; r < rect.row - 1 + rect.rowSpan; r += 1) {
    for (let c = rect.col - 1; c < rect.col - 1 + rect.colSpan; c += 1) {
      if (r < 0 || c < 0 || r >= rows || c >= columns) continue;
      const line = grid[r];
      if (line !== undefined) line[c] = true;
    }
  }
}

function fits(grid: boolean[][], rect: Rect, columns: number, rows: number): boolean {
  if (rect.col < 1 || rect.row < 1) return false;
  if (rect.col + rect.colSpan - 1 > columns) return false;
  if (rect.row + rect.rowSpan - 1 > rows) return false;

  for (let r = rect.row - 1; r < rect.row - 1 + rect.rowSpan; r += 1) {
    for (let c = rect.col - 1; c < rect.col - 1 + rect.colSpan; c += 1) {
      if (grid[r]?.[c] === true) return false;
    }
  }
  return true;
}

/** First free slot able to hold a given footprint. */
function findFreeSlot(
  grid: boolean[][],
  colSpan: number,
  rowSpan: number,
  columns: number,
  rows: number,
): { col: number; row: number } | null {
  for (let row = 1; row + rowSpan - 1 <= rows; row += 1) {
    for (let col = 1; col + colSpan - 1 <= columns; col += 1) {
      if (fits(grid, { col, row, colSpan, rowSpan }, columns, rows)) return { col, row };
    }
  }
  return null;
}

/** Is the cell free on this layer? */
export function isCellFree(
  tiles: readonly TileConfig[],
  layer: LayerIndex,
  col: number,
  row: number,
  columns: number,
  rows: number,
): boolean {
  if (col < 1 || row < 1 || col > columns || row > rows) return false;
  return occupancyGrid(tiles, layer, columns, rows)[row - 1]?.[col - 1] !== true;
}

/**
 * Places a tile at a position and rehouses whatever it covers.
 *
 * Shared by move and insert: both gestures must displace tiles identically, otherwise dragging an
 * existing tile and dropping a new one would give different results at the same spot.
 *
 * Returns the relocations to apply, or `null` if one of the displaced tiles has nowhere to go.
 */
function relocateOverlapping(
  others: readonly TileConfig[],
  placed: TileConfig,
  columns: number,
  rows: number,
): Map<string, TileConfig> | null {
  const placedRect = rectOf(placed);
  const displaced = others.filter((tile) => overlaps(rectOf(tile), placedRect));
  const untouched = others.filter((tile) => !displaced.includes(tile));

  const grid = Array.from({ length: rows }, () => Array.from({ length: columns }, () => false));
  fill(grid, placedRect, columns, rows);
  for (const tile of untouched) fill(grid, rectOf(tile), columns, rows);

  const relocated = new Map<string, TileConfig>();
  // Largest first: they have the fewest options and would fail if the small ones settled before
  // them.
  const bySizeDesc = [...displaced].sort((a, b) => b.colSpan * b.rowSpan - a.colSpan * a.rowSpan);

  for (const tile of bySizeDesc) {
    const slot = findFreeSlot(grid, tile.colSpan, tile.rowSpan, columns, rows);
    if (slot === null) return null;
    const moved: TileConfig = { ...tile, colStart: slot.col, rowStart: slot.row };
    fill(grid, rectOf(moved), columns, rows);
    relocated.set(tile.id, moved);
  }

  return relocated;
}

/** Clamps a position so a tile of that size fits in the grid. */
function clampToGrid(
  tile: TileConfig,
  col: number,
  row: number,
  columns: number,
  rows: number,
): TileConfig {
  return {
    ...tile,
    colStart: clampInt(col, 1, Math.max(1, columns - tile.colSpan + 1)),
    rowStart: clampInt(row, 1, Math.max(1, rows - tile.rowSpan + 1)),
  };
}

/**
 * Computes the layout resulting from a move, without mutating anything. Returns `null` if the move
 * is impossible.
 */
export function planMove(
  tiles: readonly TileConfig[],
  draggedId: string,
  targetCol: number,
  targetRow: number,
  columns: number,
  rows: number,
): readonly TileConfig[] | null {
  const dragged = tiles.find((tile) => tile.id === draggedId);
  if (dragged === undefined) return null;

  const moved = clampToGrid(dragged, targetCol, targetRow, columns, rows);
  const others = tiles.filter((tile) => tile.layer === dragged.layer && tile.id !== draggedId);
  const relocated = relocateOverlapping(others, moved, columns, rows);
  if (relocated === null) return null;

  return tiles.map((tile) => (tile.id === draggedId ? moved : (relocated.get(tile.id) ?? tile)));
}

/**
 * Computes the layout resulting from adding a tile, without mutating anything. Returns `null` if it
 * cannot be inserted there.
 */
export function planInsert(
  tiles: readonly TileConfig[],
  candidate: TileConfig,
  targetCol: number,
  targetRow: number,
  columns: number,
  rows: number,
): readonly TileConfig[] | null {
  const placed = clampToGrid(candidate, targetCol, targetRow, columns, rows);
  const others = tiles.filter((tile) => tile.layer === candidate.layer);
  const relocated = relocateOverlapping(others, placed, columns, rows);
  if (relocated === null) return null;

  return [...tiles.map((tile) => relocated.get(tile.id) ?? tile), placed];
}

/**
 * Brings every tile back inside the grid after it shrinks, and separates any tiles that overlap.
 * Without this, reducing the column count would leave tiles off screen.
 */
export function reflowIntoGrid(
  tiles: readonly TileConfig[],
  columns: number,
  rows: number,
): readonly TileConfig[] {
  const grids = new Map<LayerIndex, boolean[][]>();
  const gridFor = (layer: LayerIndex): boolean[][] => {
    let grid = grids.get(layer);
    if (grid === undefined) {
      grid = Array.from({ length: rows }, () => Array.from({ length: columns }, () => false));
      grids.set(layer, grid);
    }
    return grid;
  };

  const result: TileConfig[] = [];
  // Largest first, for the same reason as in `planMove`.
  const ordered = [...tiles].sort((a, b) => b.colSpan * b.rowSpan - a.colSpan * a.rowSpan);
  const placements = new Map<string, TileConfig>();

  for (const tile of ordered) {
    const grid = gridFor(tile.layer);
    const colSpan = Math.min(tile.colSpan, columns);
    const rowSpan = Math.min(tile.rowSpan, rows);
    const current: Rect = { col: tile.colStart, row: tile.rowStart, colSpan, rowSpan };

    if (fits(grid, current, columns, rows)) {
      const kept = { ...tile, colSpan, rowSpan };
      fill(grid, current, columns, rows);
      placements.set(tile.id, kept);
      continue;
    }

    const slot = findFreeSlot(grid, colSpan, rowSpan, columns, rows);
    if (slot === null) {
      // Out of room: the tile is dropped rather than stacked at random.
      continue;
    }
    const placed = { ...tile, colStart: slot.col, rowStart: slot.row, colSpan, rowSpan };
    fill(grid, rectOf(placed), columns, rows);
    placements.set(tile.id, placed);
  }

  // Original order preserved: it stays readable in the settings.
  for (const tile of tiles) {
    const placed = placements.get(tile.id);
    if (placed !== undefined) result.push(placed);
  }
  return result;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

// The version lives in the key: a layout saved by an earlier version is ignored rather than
// migrated, which avoids loading an incompatible structure.
//
// The prefix keeps the project's old name deliberately: this key is never seen by the user, and
// renaming it would erase their configuration on the next launch.
const STORAGE_KEY = 'car-board.settings.v3';

/**
 * Fills in fields an earlier version did not save yet, and squares up the geometry.
 *
 * Preferable to changing the storage key, which would erase the user's layout on every new setting.
 *
 * The non-overlap rule prevents creating overlaps; it does not prevent inheriting them. A layout
 * composed before the rule existed, or received from another device, can perfectly well stack two
 * tiles on one layer. Repairing it here - as the layout enters the application rather than at use -
 * lets the rest of the code take the absence of overlap for granted.
 *
 * `reflowIntoGrid` already does exactly this work for grid shrinking; reusing it avoids two repairs
 * that could diverge, and guarantees a sound layout comes back untouched.
 */
function normalizeLayout(
  layout: Partial<LayoutConfig> | undefined,
  fallback: LayoutConfig,
): LayoutConfig {
  if (layout === undefined) return fallback;

  const tiles = (layout.tiles ?? []).map((tile: Partial<TileConfig>) => ({
    id: tile.id ?? `tile-${Math.random().toString(36).slice(2, 9)}`,
    layer: tile.layer ?? 1,
    colStart: tile.colStart ?? 1,
    rowStart: tile.rowStart ?? 1,
    colSpan: tile.colSpan ?? 1,
    rowSpan: tile.rowSpan ?? 1,
    fontScale: tile.fontScale ?? 1,
    mirrored: tile.mirrored ?? false,
    whenUnavailable: tile.whenUnavailable ?? 'hide',
    presetId: tile.presetId ?? null,
    themeId: tile.themeId ?? null,
    // An earlier backup has no such field: `auto` everywhere reproduces exactly the behaviour it
    // had.
    flush: normalizeFlush(tile.flush),
    spacing: typeof tile.spacing === 'number' ? tile.spacing : null,
    chrome: normalizeChrome(tile.chrome),
    // Absent from any tile placed before the setting existed, and `show` is what it did.
    caption: normalizeCaption(tile.caption),
    metrics: tile.metrics ?? [],
  }));

  const columns = clampInt(layout.columns ?? fallback.columns, GRID_COLUMNS.min, GRID_COLUMNS.max);
  const rows = clampInt(layout.rows ?? fallback.rows, GRID_ROWS.min, GRID_ROWS.max);

  return { columns, rows, tiles: reflowIntoGrid(tiles, columns, rows) };
}

/**
 * What a backup may carry as layouts: nothing, a single one without orientation, or both - each
 * possibly incomplete.
 *
 * The type states what actually comes in, rather than promising complete layouts that a cast would
 * then have to contradict.
 */
export interface StoredLayouts {
  readonly layouts?: Partial<Record<Orientation, Partial<LayoutConfig>>> | undefined;
  /** Key from before orientations existed. */
  readonly layout?: Partial<LayoutConfig> | undefined;
}

/**
 * Rebuilds both layouts.
 *
 * An earlier backup carried only one, without orientation. It is reused for both rather than
 * discarded, so a patiently composed layout survives the update.
 *
 * Public because layouts no longer live only in the flat settings: each vehicle carries its own,
 * and they need the same guards whichever drawer they come out of.
 */
export function normalizeLayouts(parsed: StoredLayouts): LayoutsByOrientation {
  const inherited = parsed.layout;
  const layouts = parsed.layouts;

  if (layouts === undefined && inherited !== undefined) {
    const restored = normalizeLayout(inherited, DEFAULT_LAYOUT);
    return { portrait: restored, landscape: restored };
  }

  return {
    portrait: normalizeLayout(layouts?.portrait, DEFAULT_PORTRAIT_LAYOUT),
    landscape: normalizeLayout(layouts?.landscape, DEFAULT_LAYOUT),
  };
}

/**
 * Completes a partial settings object.
 *
 * Shared by local loading and file import: both ingest data written elsewhere - an earlier version
 * in one case, another device in the other - and need exactly the same guards.
 */
export function normalizeSettings(parsed: Partial<AppSettings>): AppSettings {
  return {
    themeId: parsed.themeId ?? DEFAULT_SETTINGS.themeId,
    metricFilter: parsed.metricFilter ?? DEFAULT_SETTINGS.metricFilter,
    presets: parsed.presets ?? DEFAULT_SETTINGS.presets,
    backgrounds: parsed.backgrounds ?? DEFAULT_SETTINGS.backgrounds,
    backgroundId: parsed.backgroundId ?? DEFAULT_SETTINGS.backgroundId,
    avatarId: parsed.avatarId ?? DEFAULT_SETTINGS.avatarId,
    fontScale: parsed.fontScale ?? DEFAULT_SETTINGS.fontScale,
    // Only a literal `true` counts: nothing else is an answer.
    termsAccepted: parsed.termsAccepted === true,
    useTripHistory: parsed.useTripHistory === true,
    locked: parsed.locked ?? DEFAULT_SETTINGS.locked,
    editBarDock:
      parsed.editBarDock === 'bottom' || parsed.editBarDock === 'top'
        ? parsed.editBarDock
        : DEFAULT_SETTINGS.editBarDock,
    light: parsed.light ?? DEFAULT_SETTINGS.light,
    // An unknown language - from a later version, or a hand-edited file - falls back to the default
    // rather than leaving the interface blank.
    language: LANGUAGES.includes(parsed.language as LanguageCode)
      ? (parsed.language as LanguageCode)
      : DEFAULT_SETTINGS.language,
    layouts: normalizeLayouts(parsed),
  };
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Only on the very first launch does the language come from the browser. Once set it is the
    // user's choice, and re-deriving it on every open would overwrite that choice whenever it
    // differs from the system.
    if (raw === null) {
      return { ...DEFAULT_SETTINGS, language: detectLanguage(navigator.languages ?? []) };
    }
    return normalizeSettings(JSON.parse(raw) as Partial<AppSettings>);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable (private browsing): the app keeps working, only the settings will not
    // survive a reload.
  }
}
