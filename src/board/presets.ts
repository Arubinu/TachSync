import type { Translation } from '../i18n';
import {
  ALL_METRICS,
  DEFAULT_CAPTION,
  DEFAULT_CHROME,
  DEFAULT_FLUSH,
  defaultSpanFor,
  metricLabel,
  newTileId,
  type LayerIndex,
  type MetricId,
  type TileArrangement,
  type TileConfig,
  type TilePreset,
} from './layout';

/**
 * Tile presets.
 *
 * The catalogue only knows presets, never bare metrics: each metric produces one, users can compose
 * others, and both are handled identically. Adding a metric to the project is therefore enough to
 * make it appear in the catalogue, with nothing to declare.
 */

/** Prefix for metric-derived presets, to tell them from the rest. */
const BUILT_IN_PREFIX = 'metric:';

/**
 * One preset per known metric, generated on the fly.
 *
 * The label stays empty: `presetLabel` derives it from the metric in the current language. Freezing
 * it here would leave it in the startup language, these presets being built once.
 */
export function builtInPresets(arrangement: TileArrangement = 'stacked'): TilePreset[] {
  return ALL_METRICS.map((metric) => ({
    id: `${BUILT_IN_PREFIX}${metric}`,
    label: '',
    themeId: null,
    // The footprint follows the active theme's arrangement: an ordinary tile is square in a stacked
    // theme, wide and low in an inline one.
    ...defaultSpanFor(metric, arrangement),
    metrics: [metric],
    css: '',
    layout: null,
    pack: null,
    builtIn: true,
  }));
}

/** Full catalogue: derived presets then the user's. */
export function allPresets(
  custom: readonly TilePreset[],
  arrangement: TileArrangement = 'stacked',
): TilePreset[] {
  return [...builtInPresets(arrangement), ...custom];
}

export function findPreset(
  id: string,
  custom: readonly TilePreset[],
  arrangement: TileArrangement = 'stacked',
): TilePreset | null {
  return allPresets(custom, arrangement).find((preset) => preset.id === id) ?? null;
}

/**
 * Instantiates a preset into a placeable tile.
 *
 * The theme is frozen at placement: the tile keeps that look even if the application later changes
 * theme, which is what allows several to coexist on one grid.
 */
export function tileFromPreset(
  preset: TilePreset,
  layer: LayerIndex,
  themeId: string | null,
  id: string = newTileId(),
): TileConfig {
  return {
    id,
    layer,
    colStart: 1,
    rowStart: 1,
    colSpan: preset.colSpan,
    rowSpan: preset.rowSpan,
    fontScale: 1,
    mirrored: false,
    whenUnavailable: 'hide',
    // Kept so the CSS imported with the preset can target the tile, including after a reload.
    presetId: preset.id,
    themeId,
    flush: DEFAULT_FLUSH,
    spacing: null,
    chrome: DEFAULT_CHROME,
    caption: DEFAULT_CAPTION,
    metrics: preset.metrics,
  };
}

export interface PresetFilter {
  /** Theme id, or `null` for no filtering. */
  readonly themeId: string | null;
  /** Selected metrics. Empty means no filtering. */
  readonly metrics: readonly MetricId[];
}

/**
 * Applies the catalogue filters.
 *
 * A preset with no theme always stays visible: it belongs to no particular set, and hiding it would
 * deprive the user of the base metrics as soon as they filtered by theme.
 *
 * The metric filter is inclusive - a preset containing any of the ticked metrics is kept - because
 * the question is "where can I see my speed", not "which tile contains exactly this combination".
 */
export function filterPresets(
  presets: readonly TilePreset[],
  filter: PresetFilter,
): TilePreset[] {
  return presets.filter((preset) => {
    if (filter.themeId !== null && preset.themeId !== null && preset.themeId !== filter.themeId) {
      return false;
    }
    if (filter.metrics.length === 0) return true;
    return preset.metrics.some((metric) => filter.metrics.includes(metric));
  });
}

/** Fallback label when the user has entered none. */
export function presetLabel(preset: TilePreset, t: Translation): string {
  if (preset.label.trim() !== '') return preset.label;
  if (preset.metrics.length === 0) return t.editor.tile;
  return preset.metrics.map((metric) => metricLabel(metric, t)).join(' · ');
}
