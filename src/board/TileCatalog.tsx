import { useEffect, useMemo, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { TelemetryStore } from '../telemetry/TelemetryStore';
import type { AnyChannel } from '../telemetry/types';
import { findTheme, themeToTileVariables, THEMES, type ThemeManifest } from '../theme/themes';
import { Modal } from './Modal';
import { Tip } from './Tip';
import { FilterIcon, ImportIcon, TrashIcon } from './icons';
import { MultiPickerList, PickerList, SelectField, type PickerRequest } from './Picker';
import { useTranslation } from '../i18n';
import {
  ALL_METRICS,
  CATEGORIES,
  CATEGORY_KEYS,
  DEFAULT_CAPTION,
  DEFAULT_CHROME,
  DEFAULT_FLUSH,
  isMetricAvailable,
  METRIC_META,
  metricLabel,
  type MetricId,
  type TileConfig,
  type TilePreset,
} from './layout';
import { allPresets, filterPresets, presetLabel } from './presets';
import { TileContent } from './tiles';
import { useDemoStore } from './useDemoStore';
import { useTileVariables } from './tileVariables';

/** Prefix distinguishing a catalogue entry from a grid tile. */
export const CATALOG_DRAG_PREFIX = 'new:';

export function catalogDragId(presetId: string): string {
  return `${CATALOG_DRAG_PREFIX}${presetId}`;
}

export function presetIdFromDragId(id: string): string | null {
  return id.startsWith(CATALOG_DRAG_PREFIX) ? id.slice(CATALOG_DRAG_PREFIX.length) : null;
}

export interface TileCatalogProps {
  readonly availableChannels: ReadonlySet<AnyChannel>;
  readonly presets: readonly TilePreset[];
  /** Active theme: acts as a filter and is changed from the catalogue. */
  readonly themeId: string;
  readonly onThemeChange: (themeId: string) => void;
  /** Selected filter, kept from one opening to the next. */
  readonly metricFilter: readonly MetricId[];
  readonly onMetricFilterChange: (metrics: readonly MetricId[]) => void;
  readonly onClose: () => void;
  readonly onImport: (file: File) => void;
  readonly onDeletePreset: (presetId: string) => void;
  /** Message from the last import, success or failure. */
  readonly importReport: string | null;
}

/**
 * Catalogue of available tiles.
 *
 * Each entry is a live preview rather than a frozen thumbnail, and adding is done by dragging it
 * out of the panel: the panel fades to reveal the grid, and the gesture continues exactly like
 * moving an existing tile.
 */
export function TileCatalog({
  availableChannels,
  presets,
  themeId,
  onThemeChange,
  metricFilter,
  onMetricFilterChange,
  onClose,
  onImport,
  onDeletePreset,
  importReport,
}: TileCatalogProps): React.JSX.Element {
  const t = useTranslation();
  const store = useDemoStore();
  // The two levels the window can show over the catalogue: the theme list and the metric list.
  // Never both at once - one always comes from the catalogue and returns to it.
  const [picker, setPicker] = useState<PickerRequest | null>(null);
  const [filtering, setFiltering] = useState(false);
  // The occurrence number travels with the text: re-tapping while the tooltip is up must restart
  // the delay, which reassigning the same text would not signal.
  const [hint, setHint] = useState<{
    readonly turn: number;
    readonly main: string;
    /** Second line, quieter. Null when the first says enough. */
    readonly aside: string | null;
  } | null>(null);
  // One row open at a time: two gaping drawers side by side and it is no longer clear which red
  // button belongs to what.
  const [opened, setOpened] = useState<string | null>(null);

  useEffect(() => {
    if (hint === null) return;
    const timer = window.setTimeout(() => setHint(null), 3200);
    return () => window.clearTimeout(timer);
  }, [hint]);

  // The import report goes through the same bubble as everything else.
  //
  // It used to occupy a permanent framed block at the top of the list, which stayed long after
  // being read and pushed the catalogue down. It is the same thing as the tooltip: an answer to a
  // gesture, with no reason to persist once received.
  useEffect(() => {
    if (importReport === null) return;
    setHint((current) => ({
      turn: (current?.turn ?? 0) + 1,
      main: importReport,
      aside: null,
    }));
  }, [importReport]);
  // Previews adopt the chosen theme: that is the point of this preview, since the dropped tile will
  // keep that look.
  const theme = findTheme(themeId);

  const visible = useMemo(
    () =>
      filterPresets(allPresets(presets, theme.tile.arrangement), {
        themeId,
        metrics: metricFilter,
      }),
    // `theme` derives from `themeId`: listing that is enough, and the arrangement follows.
    [presets, themeId, metricFilter, theme.tile.arrangement],
  );

  /**
   * Metrics by section, one section per label.
   *
   * Grouping is on the displayed name rather than the internal category: several of them share a
   * label - dynamics files under driving - and leaving them separate gave two consecutive sections
   * with the same name. React complained too, two children ending up with the same key.
   */
  const metricGroups = useMemo(() => {
    const byLabel = new Map<string, { label: string; options: { value: MetricId; label: string }[] }>();

    for (const category of CATEGORIES) {
      const label = t.categories[CATEGORY_KEYS[category]];
      const options = ALL_METRICS.filter(
        (metric) => METRIC_META[metric].category === category,
      ).map((metric) => ({ value: metric, label: metricLabel(metric, t) }));
      if (options.length === 0) continue;

      const group = byLabel.get(label);
      if (group === undefined) byLabel.set(label, { label, options });
      else group.options.push(...options);
    }

    return [...byLabel.values()];
  }, [t]);

  const nested = picker !== null || filtering;

  function back(): void {
    setPicker(null);
    setFiltering(false);
  }

  return (
    <Modal
      title={picker !== null ? picker.label : filtering ? t.catalog.information : t.catalog.title}
      onClose={onClose}
      {...(nested
        ? { onBack: back }
        : {
            leading: (
              <>
                {/*
                  A label rather than a button: only a `label` can open the system file picker
                  without script. It carries the button styling and role but stays what it is.
                */}
                <label className="modal__action" aria-label={t.catalog.import} title={t.catalog.import}>
                  <ImportIcon />
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="visually-hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file !== undefined) onImport(file);
                      // Reset so the same file can be imported again.
                      event.target.value = '';
                    }}
                  />
                </label>

                <button
                  type="button"
                  className={
                    metricFilter.length > 0 ? 'modal__action is-active' : 'modal__action'
                  }
                  onClick={() => setFiltering(true)}
                  aria-label={t.catalog.information}
                  title={t.catalog.information}
                >
                  <FilterIcon />
                </button>
              </>
            ),
          })}
    >
      {picker !== null && (
        <PickerList
          groups={picker.groups}
          value={picker.value}
          onChange={(next) => {
            picker.onChange(next);
            setPicker(null);
          }}
        />
      )}

      {filtering && (
        <MultiPickerList
          values={metricFilter}
          groups={metricGroups}
          allLabel={t.catalog.all}
          onChange={onMetricFilterChange}
        />
      )}

      {!nested && (
        <div className="catalog">
          {/*
            This selector is the active theme's, not a mere filter: changing it repaints the board
            behind at once and offers only the tiles attached to that theme. A filter changing
            nothing visually would suggest themes do nothing.
          */}
          <SelectField
            label={t.catalog.theme}
            value={themeId}
            groups={[
              {
                label: '',
                options: THEMES.map((theme) => ({ value: theme.id, label: theme.label })),
              },
            ]}
            onChange={onThemeChange}
            onOpen={setPicker}
          />

          <ul className="catalog__grid">
            {visible.map((preset) => (
              <CatalogEntry
                key={preset.id}
                preset={preset}
                store={store}
                theme={theme}
                availableChannels={availableChannels}
                onDelete={preset.builtIn ? null : () => onDeletePreset(preset.id)}
                opened={opened === preset.id}
                onOpenedChange={(open) => setOpened(open ? preset.id : null)}
                onRefuse={() =>
                  setHint((current) => ({
                    turn: (current?.turn ?? 0) + 1,
                    // What can be done first, the reason for the refusal second: the useful
                    // instruction leads.
                    main: t.catalog.hint,
                    aside: t.catalog.cannotRemove,
                  }))
                }
              />
            ))}
          </ul>

          {visible.length === 0 && <p className="catalog__empty">{t.catalog.noMatch}</p>}

          {/*
            The tooltip shows only to whoever needs it.

            Shown permanently, the instruction occupied the top of the window to repeat at every
            opening what is known from the first. It now appears only on the gesture that calls for
            an answer - the drawer refused to a built-in tile - then fades on its own.
          */}
          {hint !== null && (
            <Tip main={hint.main} {...(hint.aside === null ? {} : { aside: hint.aside })} />
          )}
        </div>
      )}
    </Modal>
  );
}

interface CatalogEntryProps {
  readonly preset: TilePreset;
  readonly store: TelemetryStore;
  readonly theme: ThemeManifest;
  readonly availableChannels: ReadonlySet<AnyChannel>;
  /** `null` for a preset derived from a metric, which cannot be removed. */
  readonly onDelete: (() => void) | null;
  /** Open drawer, decided by the catalogue so only one is open at a time. */
  readonly opened: boolean;
  readonly onOpenedChange: (opened: boolean) => void;
  /** Drawer pulled on a built-in tile: it must be said, not ignored. */
  readonly onRefuse: () => void;
}

/** Displacement below which a gesture stays a simple tap, in pixels. */
const TAP_SLOP = 6;

/** Drawer width, and therefore the row's travel when it opens, in pixels. */
const REVEAL = 84;

/**
 * Resistance offered to dragging a row that will not open.
 *
 * The row follows the finger at a third, then returns: it is not inert - which would suggest a
 * misread gesture - but neither does it promise an opening that will not come.
 */
const RUBBER = 0.3;

function CatalogEntry({
  preset,
  store,
  theme,
  availableChannels,
  onDelete,
  opened,
  onOpenedChange,
  onRefuse,
}: CatalogEntryProps): React.JSX.Element {
  const t = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: catalogDragId(preset.id),
  });
  const tile = useMemo(() => previewTile(preset), [preset]);
  const setVariablesRef = useTileVariables(store, tile.metrics);
  const missing = preset.metrics.filter((metric) => !isMetricAvailable(metric, availableChannels));

  // The gesture in progress. Null until something starts, and abandoned as soon as the pointer
  // moves onto the thumbnail: that is the handle for dragging to the grid, and the two gestures
  // cannot share a start without one stealing the other.
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<number | null>(null);

  function settle(): void {
    gesture.current = null;
    setDrag(null);
  }

  const offset = drag ?? (opened ? -REVEAL : 0);

  return (
    <li
      className={offset < 0 ? 'catalog__row is-open' : 'catalog__row'}
      style={{ '--reveal': `${REVEAL}px` } as React.CSSProperties}
    >
      {/*
        The button sits under the row rather than after it: the row retreating is what reveals it,
        exactly as the gesture suggests. Out of the keyboard path while hidden, or tabbing would
        cross invisible delete buttons.
      */}
      {onDelete !== null && (
        <button
          type="button"
          className="catalog__remove"
          onClick={onDelete}
          tabIndex={opened ? 0 : -1}
          aria-hidden={!opened}
          aria-label={t.settings.remove}
        >
          <TrashIcon />
        </button>
      )}

      <div
        className={[
          'catalog__entry',
          isDragging ? 'is-dragging' : '',
          // As soon as the row moves, its right corners open onto the drawer: keeping them rounded
          // would leave two notches of background between it and the button it reveals.
          offset < 0 ? 'is-open' : '',
        ]
          .filter((name) => name !== '')
          .join(' ')}
        style={{
          transform: `translateX(${offset}px)`,
          // During the gesture the row sticks to the finger; it rejoins its position on release,
          // and only there does a transition make sense.
          transition: drag === null ? undefined : 'none',
        }}
        onPointerDown={(event) => {
          if (event.target instanceof Element && event.target.closest('.catalog__preview') !== null) {
            gesture.current = null;
            return;
          }
          gesture.current = { x: event.clientX, y: event.clientY };
          // Capture keeps the gesture on the row even if the finger leaves sideways. It fails for
          // an already-released pointer - a synthetic event, say - and that is no reason to abandon
          // the rest.
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            /** tracking continues without capture */
          }
        }}
        onPointerMove={(event) => {
          const start = gesture.current;
          if (start === null) return;
          const moved = event.clientX - start.x;
          if (Math.abs(moved) <= TAP_SLOP) return;
          const base = opened ? -REVEAL : 0;
          setDrag(
            onDelete === null
              ? Math.min(0, moved * RUBBER)
              : Math.max(-REVEAL, Math.min(0, base + moved)),
          );
        }}
        onPointerUp={(event) => {
          const start = gesture.current;
          if (start === null) return;
          const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
          settle();

          if (onDelete === null) {
            // A built-in tile opens neither on click nor on drag; both refuse the same thing, so
            // both explain the same thing.
            onRefuse();
            return;
          }
          if (moved <= TAP_SLOP) {
            onOpenedChange(!opened);
            return;
          }
          // At half travel the row picks the edge it is nearest, so it never stays half open.
          onOpenedChange((event.clientX - start.x + (opened ? -REVEAL : 0)) < -REVEAL / 2);
        }}
        onPointerCancel={settle}
      >
        {/*
          The footprint at the head of the row, set vertically.

          Upright it fits in the gutter the thumbnail leaves free instead of taking a column of its
          own, and reading top to bottom distinguishes it at a glance from the name, which reads
          flat.
        */}
        <span className="catalog__span" aria-hidden>
          {preset.colSpan}×{preset.rowSpan}
        </span>

        <div
          className="catalog__preview"
          ref={setNodeRef}
          // The preview carries the same anchor as the placed tile, so imported dressing applies
          // identically.
          {...(preset.builtIn ? {} : { 'data-preset': preset.id })}
          {...listeners}
          {...attributes}
        >
          {preset.metrics[0] === 'avatar' ? (
            // An avatar preview would mount a whole rendering engine for a thumbnail: a symbol will
            // do.
            <span className="catalog__glyph" aria-hidden>
              ☺
            </span>
          ) : (
            <div
              className="tile catalog__tile"
              ref={setVariablesRef}
              style={themeToTileVariables(theme) as React.CSSProperties}
            >
              <TileContent
                tile={tile}
                store={store}
                avatarId=""
                palette={{ accent: theme.colors.accent, accentAlt: theme.colors.accentAlt }}
                template={preset.layout}
                gauge={theme.tile.gauge}
              />
            </div>
          )}
        </div>

        <span className="catalog__label">
          <span className="catalog__name">{presetLabel(preset, t)}</span>
          {missing.length > 0 && (
            <span className="catalog__badge">{t.catalog.unavailableOnVehicle}</span>
          )}
          {preset.pack !== null && <span className="catalog__badge">{preset.pack}</span>}
        </span>
      </div>
    </li>
  );
}

/** Dummy tile used only to render the preview. */
function previewTile(preset: TilePreset): TileConfig {
  return {
    id: `preview-${preset.id}`,
    flush: DEFAULT_FLUSH,
    spacing: null,
    chrome: DEFAULT_CHROME,
    caption: DEFAULT_CAPTION,
    layer: 1,
    colStart: 1,
    rowStart: 1,
    colSpan: 1,
    rowSpan: 1,
    fontScale: 1,
    mirrored: false,
    // The preview always shows the tile, even if the vehicle does not supply the metric: this is a
    // catalogue, not a vehicle state.
    whenUnavailable: 'show',
    presetId: preset.id,
    // The preview receives its theme through the variables set on the element.
    themeId: null,
    metrics: preset.metrics,
  };
}
