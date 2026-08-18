import { en } from '../i18n/en';
import type { Translation } from '../i18n';
import {
  ALL_METRICS,
  newTileId,
  type BackgroundPreset,
  type MetricId,
  type TemplateNode,
  type TilePreset,
} from './layout';

/**
 * Tile import from a file.
 *
 * The format is JSON: natively parseable with no dependency to ship, easy to write by hand or
 * generate, and strictly validatable. CSS lives in a text field rather than a separate file, so a
 * pack stays one file that can be shared as-is.
 *
 * A file may contain a single tile or a whole pack; both forms are accepted, as is a plain array.
 * Being lenient on input spares the user having to remember an exact envelope for one tile.
 *
 * Nothing is trusted: every field is checked, and an invalid tile is rejected with its reason
 * rather than silently corrected. A tile whose content had been guessed would behave differently
 * from what it announced.
 *
 * Rejection reasons stay in English: they name the format's fields (`css`, `metrics`, `children`),
 * which are themselves English, and address whoever writes a pack. Only the two messages an
 * ordinary user can receive - wrong file, empty file - are translated.
 */

export interface ImportResult {
  readonly presets: readonly TilePreset[];
  readonly backgrounds: readonly BackgroundPreset[];
  /** Rejection reasons, to be shown as-is: they name the offending item. */
  readonly errors: readonly string[];
  /** Pack name, if it declares one. */
  readonly pack: string | null;
}

const MAX_SPAN = 6;
/** Guard: oversized styling betrays a dubious file. */
const MAX_CSS_LENGTH = 20000;

export function parseTilePack(text: string, fileName: string, t: Translation = en): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { presets: [], backgrounds: [], errors: [t.errors.invalidJson], pack: null };
  }

  const envelope = asRecord(data);
  const pack = envelope !== null ? asString(envelope['name']) : null;
  const packName = pack ?? fileName.replace(/\.[^.]+$/, '');

  const errors: string[] = [];
  const presets: TilePreset[] = [];
  const backgrounds: BackgroundPreset[] = [];

  const envelopeTheme = envelope !== null ? asString(envelope['themeId']) : null;

  const rawBackgrounds = envelope?.['backgrounds'];
  if (Array.isArray(rawBackgrounds)) {
    rawBackgrounds.forEach((entry, index) => {
      const result = readBackground(entry, index, packName, envelopeTheme, t);
      if (typeof result === 'string') errors.push(result);
      else backgrounds.push(result);
    });
  }

  const entries = collectEntries(data);
  if (entries === null) {
    // A file containing only backgrounds is perfectly valid.
    if (backgrounds.length === 0) errors.push(t.errors.noTilesFound);
    return { presets, backgrounds, errors, pack: backgrounds.length > 0 ? packName : null };
  }

  const defaultTheme = envelope !== null ? asString(envelope['themeId']) : null;

  entries.forEach((entry, index) => {
    const result = readPreset(entry, index, packName, defaultTheme);
    if (typeof result === 'string') errors.push(result);
    else presets.push(result);
  });

  const imported = presets.length > 0 || backgrounds.length > 0;
  return { presets, backgrounds, errors, pack: imported ? packName : null };
}

function readBackground(
  entry: unknown,
  index: number,
  packName: string,
  defaultTheme: string | null,
  t: Translation,
): BackgroundPreset | string {
  const where = `Background #${index + 1}`;
  const record = asRecord(entry);
  if (record === null) return `${where}: not an object.`;

  const css = record['css'] ?? '';
  if (typeof css !== 'string') return `${where}: "css" must be text.`;
  if (css.length > MAX_CSS_LENGTH) return `${where}: styling too large.`;

  const rawLayout = record['layout'];
  let layout: TemplateNode[] | null = null;
  if (rawLayout !== undefined && rawLayout !== null) {
    if (!Array.isArray(rawLayout)) return `${where}: "layout" must be a list.`;
    const parsed = readNodes(rawLayout, 0, { count: 0 });
    if (typeof parsed === 'string') return `${where}: ${parsed}`;
    layout = parsed;
  }

  if (css.trim() === '' && layout === null) {
    return `${where}: a background must provide at least "css" or "layout".`;
  }

  return {
    id: newTileId(),
    // The label is shown in the catalogue, so it follows the language.
    label: asString(record['label']) ?? `${t.settings.background} ${index + 1}`,
    themeId: asString(record['themeId']) ?? defaultTheme,
    css,
    layout,
    pack: packName,
  };
}

/** Recognises the three accepted shapes and returns the raw list. */
function collectEntries(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;

  const record = asRecord(data);
  if (record === null) return null;

  const tiles = record['tiles'];
  if (Array.isArray(tiles)) return tiles;

  // A lone tile with no envelope: recognised by the presence of `metrics`.
  if (Array.isArray(record['metrics'])) return [record];

  return null;
}

function readPreset(
  entry: unknown,
  index: number,
  packName: string,
  defaultTheme: string | null,
): TilePreset | string {
  const where = `Tile #${index + 1}`;
  const record = asRecord(entry);
  if (record === null) return `${where}: not an object.`;

  const rawMetrics = record['metrics'];
  if (!Array.isArray(rawMetrics) || rawMetrics.length === 0) {
    return `${where}: "metrics" must be a non-empty list.`;
  }

  const metrics: MetricId[] = [];
  for (const candidate of rawMetrics) {
    if (typeof candidate !== 'string' || !(ALL_METRICS as string[]).includes(candidate)) {
      return `${where}: unknown metric "${String(candidate)}".`;
    }
    metrics.push(candidate as MetricId);
  }

  const css = record['css'] ?? '';
  if (typeof css !== 'string') return `${where}: "css" must be text.`;
  if (css.length > MAX_CSS_LENGTH) return `${where}: styling too large.`;

  const label = asString(record['label']) ?? '';
  const themeId = asString(record['themeId']) ?? defaultTheme;

  const rawLayout = record['layout'];
  let layout: TemplateNode[] | null = null;
  if (rawLayout !== undefined && rawLayout !== null) {
    if (!Array.isArray(rawLayout)) return `${where}: "layout" must be a list.`;
    const parsed = readNodes(rawLayout, 0, { count: 0 });
    if (typeof parsed === 'string') return `${where}: ${parsed}`;
    layout = parsed;
  }

  return {
    // Id regenerated: the file's could collide with a preset already present, and two imports of
    // the same pack must be able to coexist.
    id: newTileId(),
    label,
    themeId,
    colSpan: readSpan(record['colSpan']),
    rowSpan: readSpan(record['rowSpan']),
    metrics,
    css,
    layout,
    pack: packName,
    builtIn: false,
  };
}

/** Depth and node count bounded: an oversized template freezes rendering. */
const MAX_DEPTH = 8;
const MAX_NODES = 120;

function readNodes(
  raw: readonly unknown[],
  depth: number,
  budget: { count: number },
): TemplateNode[] | string {
  if (depth > MAX_DEPTH) return 'template too deep.';

  const nodes: TemplateNode[] = [];
  for (const entry of raw) {
    budget.count += 1;
    if (budget.count > MAX_NODES) return 'template too large.';

    const node = readNode(entry, depth, budget);
    if (typeof node === 'string') return node;
    nodes.push(node);
  }
  return nodes;
}

function readNode(
  entry: unknown,
  depth: number,
  budget: { count: number },
): TemplateNode | string {
  const record = asRecord(entry);
  if (record === null) return 'a template node must be an object.';

  const className = readClass(record['class']);
  if (className === false) return 'invalid class: letters, digits, hyphen and underscore.';

  if (typeof record['text'] === 'string') {
    return className === null ? { text: record['text'] } : { text: record['text'], class: className };
  }

  for (const slot of ['value', 'label', 'unit'] as const) {
    const metric = record[slot];
    if (metric === undefined) continue;
    if (typeof metric !== 'string' || !(ALL_METRICS as string[]).includes(metric)) {
      return `unknown metric "${String(metric)}" in the template.`;
    }
    const id = metric as MetricId;
    if (slot === 'value') return className === null ? { value: id } : { value: id, class: className };
    if (slot === 'label') return className === null ? { label: id } : { label: id, class: className };
    return className === null ? { unit: id } : { unit: id, class: className };
  }

  const tag = record['tag'];
  if (tag !== 'div' && tag !== 'span') {
    // Explicit refusal: accepting any tag would let images, frames or links through from a
    // third-party file.
    return `tag "${String(tag)}" not allowed: only "div" and "span" are.`;
  }

  const rawChildren = record['children'];
  let children: TemplateNode[] = [];
  if (rawChildren !== undefined) {
    if (!Array.isArray(rawChildren)) return '"children" must be a list.';
    const parsed = readNodes(rawChildren, depth + 1, budget);
    if (typeof parsed === 'string') return parsed;
    children = parsed;
  }

  return className === null ? { tag, children } : { tag, class: className, children };
}

/** `null` means no class, `false` means the class was refused. */
function readClass(value: unknown): string | null | false {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return false;
  return /^[A-Za-z0-9_ -]{1,120}$/.test(value) ? value : false;
}

function readSpan(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.min(MAX_SPAN, Math.max(1, Math.round(value)));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
