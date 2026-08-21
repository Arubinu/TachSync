import type { AnyChannel } from '../telemetry/types';
import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';
import { LayoutPicker } from './LayoutPicker';
import { TileContent } from './tiles';
import { useDemoStore } from './useDemoStore';
import { useTileVariables } from './tileVariables';
import { findTheme, themeToTileVariables, type ThemeManifest } from '../theme/themes';
import { AlignIcon, LayersIcon, MirrorIcon } from './icons';
import { Modal } from './Modal';
import { Tip } from './Tip';
import {
  alignVariables,
  clampFontScale,
  FLUSH_SIDES,
  DEFAULT_CAPTION,
  DEFAULT_CHROME,
  TILE_CAPTIONS,
  TILE_CHROMES,
  hasRoomFor,
  type TileCaption,
  type TileChrome,
  FONT_SCALE_STEP,
  isMetricAvailable,
  LAYER_KEYS,
  LAYERS,
  SPACING_MAX,
  stepAlign,
  SPACING_MIN,
  stepSpacing,
  type FlushMode,
  type FlushSide,
  type LayerIndex,
  type TileConfig,
  type TilePreset,
  flushEdges,
} from './layout';

export interface TileEditorProps {
  readonly tile: TileConfig;
  /**
   * The board's theme, for a tile that has none of its own.
   *
   * `null` on a tile means "the board's", and the board's is the one the chosen background names.
   * Resolved here rather than looked up, because this window knows nothing of backgrounds.
   */
  readonly theme: ThemeManifest;
  /** The avatar actually on screen. An `avatar` tile previewing another one previews nothing. */
  readonly avatarId: string;
  /** Tile name: its preset's, or the list of its metrics. */
  readonly title: string;
  readonly columns: number;
  readonly rows: number;
  readonly availableChannels: ReadonlySet<AnyChannel>;
  /** Preset the tile came from, if any: the preview reuses its template. */
  readonly preset: TilePreset | null;
  /** The other tiles in the layout: room is checked against them. */
  readonly tiles: readonly TileConfig[];
  readonly onChange: (tile: TileConfig) => void;
  readonly onDelete: () => void;
  readonly onClose: () => void;
}

/**
 * Settings for a placed tile, opened by a short press on it.
 *
 * Two columns: the grid footprint on the left, everything presentational on the right. They stack
 * on a narrow screen.
 *
 * CONTENT is not set here: it is defined when composing the preset, in the catalogue. A tile
 * combining several metrics is composed once then dropped as often as wanted.
 */
export function TileEditor({
  tile,
  title,
  theme,
  avatarId,
  columns,
  rows,
  availableChannels,
  preset,
  tiles,
  onChange,
  onDelete,
  onClose,
}: TileEditorProps): React.JSX.Element {
  const t = useTranslation();
  const primary = tile.metrics[0];
  const unavailable = primary !== undefined && !isMetricAvailable(primary, availableChannels);

  function cycleLayer(): void {
    const next = ((tile.layer + 1) % LAYERS.length) as LayerIndex;
    onChange({ ...tile, layer: next });
  }

  /**
   * Refusal count, used to relight the tooltip on each one. A boolean already true would not signal
   * the second attempt, and the message would look left over.
   */
  const [refused, setRefused] = useState(0);

  useEffect(() => {
    if (refused === 0) return;
    const timer = window.setTimeout(() => setRefused(0), 3200);
    return () => window.clearTimeout(timer);
  }, [refused]);

  function cycleWhenUnavailable(): void {
    onChange({ ...tile, whenUnavailable: tile.whenUnavailable === 'hide' ? 'show' : 'hide' });
  }

  function cycleChrome(): void {
    const index = TILE_CHROMES.indexOf(tile.chrome);
    const next = TILE_CHROMES[(index + 1) % TILE_CHROMES.length] ?? DEFAULT_CHROME;
    onChange({ ...tile, chrome: next });
  }

  function cycleCaption(): void {
    const index = TILE_CAPTIONS.indexOf(tile.caption);
    const next = TILE_CAPTIONS[(index + 1) % TILE_CAPTIONS.length] ?? DEFAULT_CAPTION;
    onChange({ ...tile, caption: next });
  }

  function changeScale(delta: number): void {
    onChange({ ...tile, fontScale: clampFontScale(tile.fontScale + delta * FONT_SCALE_STEP) });
  }

  /*
   * Which half of the editor is on screen.
   *
   * Measured on a 390x844 phone: the footprint picker alone took 95% of the visible body, and every
   * option sat below the fold - the picker keeps the board's real proportions, and a portrait board
   * makes it taller than the window. Two panels give each what it needs instead of making one wait
   * behind the other.
   *
   * Opens on the footprint: it is what the tile was tapped to change most often, and it is the one
   * part that cannot be reached from anywhere else.
   */
  const [tab, setTab] = useState<'size' | 'options'>('size');

  return (
    <Modal
      title={title}
      onClose={onClose}
      onDelete={onDelete}
      /*
       * Mirroring, beside the close button rather than as a section of its own.
       *
       * It has two states and no measure: a pair of chips under a heading spent a third of the
       * window saying what one pressed icon says. Only an avatar has a side to face, so only an
       * avatar carries it.
       */
      /*
       * One control, cycling. Alignment has three states and a fourth that is the absence of one,
       * all of them drawn on the icon: a row of four buttons would have said the same thing with
       * four times the header.
       *
       * Never on an avatar - it has no label and no figure to range, and its own control lives in
       * this exact spot.
       */
      trailing={
        primary === 'avatar'
          ? [
              <button
                key="mirror"
                type="button"
                className={tile.mirrored ? 'modal__action is-active' : 'modal__action'}
                onClick={() => onChange({ ...tile, mirrored: !tile.mirrored })}
                aria-pressed={tile.mirrored}
                aria-label={t.editor.mirrored}
                title={t.editor.mirrored}
              >
                <MirrorIcon />
              </button>,
            ]
          : [
              <button
                key="align"
                type="button"
                className={tile.align === null ? 'modal__action' : 'modal__action is-active'}
                onClick={() => onChange({ ...tile, align: stepAlign(tile.align) })}
                aria-label={`${t.editor.align} : ${
                  tile.align === 'left'
                    ? t.editor.alignLeft
                    : tile.align === 'center'
                      ? t.editor.alignCenter
                      : tile.align === 'right'
                        ? t.editor.alignRight
                        : t.editor.spacingAuto
                }`}
                title={t.editor.align}
              >
                <AlignIcon align={tile.align} />
              </button>,
            ]
      }
    >
      {/*
        Two tabs rather than one long window.

        Both panels stay mounted and are only hidden: the footprint panel carries a live preview,
        which mounts a rendering engine and, for an avatar, reads a file. Unmounting it on every
        switch would reload that for nothing, and lose the mood it had built up.
      */}
      <div className="editor__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          id="tile-tab-size"
          aria-controls="tile-panel-size"
          aria-selected={tab === 'size'}
          className={tab === 'size' ? 'editor__tab is-active' : 'editor__tab'}
          onClick={() => setTab('size')}
        >
          {t.editor.tabSize}
        </button>
        <button
          type="button"
          role="tab"
          id="tile-tab-options"
          aria-controls="tile-panel-options"
          aria-selected={tab === 'options'}
          className={tab === 'options' ? 'editor__tab is-active' : 'editor__tab'}
          onClick={() => setTab('options')}
        >
          {t.editor.tabOptions}
        </button>
      </div>

      <div
        className="editor__panel"
        role="tabpanel"
        id="tile-panel-size"
        aria-labelledby="tile-tab-size"
        hidden={tab !== 'size'}
      >
      <div className="modal__columns">
        <section className="modal__column">
          {/*
            The footprint shows the tile as it will be, not a flat area.

            A coloured rectangle answers "how many cells"; the content answers "what will it look
            like", which is the question asked when sizing. The figure is seen growing as it widens
            and the label folding as it shrinks.

            One property carries all of it: the picker knows nothing about tiles, it just leaves
            room.
          */}
          <LayoutPicker
            label={t.editor.layout}
            columns={columns}
            rows={rows}
            colStart={tile.colStart}
            rowStart={tile.rowStart}
            colSpan={tile.colSpan}
            rowSpan={tile.rowSpan}
            onChange={(colSpan, rowSpan) => {
              // Refused rather than pushing the neighbours: displaced unasked, they would then have
              // to be hunted down. A refusal is understood on the spot.
              if (!hasRoomFor(tiles, tile, colSpan, rowSpan, columns, rows)) {
                setRefused((count) => count + 1);
                return;
              }
              onChange({ ...tile, colSpan, rowSpan });
            }}
            preview={
              <TilePreview
                tile={tile}
                preset={preset}
                board={theme}
                avatarId={avatarId}
                columns={columns}
                rows={rows}
              />
            }
          />

        </section>

        {/*
          The second column exists only if it carries something. Rendered empty it still reserved
          its track and left the picker at half the window width - and it is precisely the room
          given to the cells that makes them reachable by finger.
        */}
      </div>
      </div>

      <div
        className="editor__panel"
        role="tabpanel"
        id="tile-panel-options"
        aria-labelledby="tile-tab-options"
        hidden={tab !== 'options'}
      >
      {/*
        The two steppers, at either end of a row of their own. Stacked in a column they overflowed;
        side by side they ask for more than half the window. Full width they answer each other, and
        these two dimension settings end up neighbours, which is what they are.
      */}
      <div className="steppers">
        <div className="steppers__item">
          <h3>{t.editor.scale}</h3>
          <div className="scale">
            <button
              type="button"
              onClick={() => changeScale(-1)}
              disabled={tile.fontScale <= 0.5}
              aria-label={t.editor.decrease}
            >
              −
            </button>
            <span className="scale__value">{Math.round(tile.fontScale * 100)} %</span>
            <button
              type="button"
              onClick={() => changeScale(1)}
              disabled={tile.fontScale >= 2.5}
              aria-label={t.editor.increase}
            >
              +
            </button>
          </div>
        </div>

        <div className="steppers__item">
          <h3>{t.editor.spacing}</h3>
          <div className="scale">
            <button
              type="button"
              onClick={() => onChange({ ...tile, spacing: stepSpacing(tile.spacing, -1) })}
              disabled={tile.spacing !== null && tile.spacing <= SPACING_MIN}
              aria-label={t.editor.decrease}
            >
              −
            </button>
            <span className="scale__value">
              {tile.spacing === null ? t.editor.spacingAuto : `${tile.spacing} px`}
            </span>
            <button
              type="button"
              onClick={() => onChange({ ...tile, spacing: stepSpacing(tile.spacing, 1) })}
              disabled={tile.spacing !== null && tile.spacing >= SPACING_MAX}
              aria-label={t.editor.increase}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/*
        All three layers shown rather than one: the active layer decides what the next gesture will
        reach.
      */}
      <section className="edges">
        <span className="edges__label">{t.editor.layer}</span>
        <button type="button" className="cycle-button" onClick={cycleLayer}>
          <LayersIcon />
          <span>{t.layers[LAYER_KEYS[tile.layer]]}</span>
        </button>
      </section>

      <section className="edges">
        {/*
          The label carries its detail as a tooltip rather than a line of its own: two sentences
          above a two-state button weighed more than the setting itself.
        */}
        <span
          className="edges__label"
          title={unavailable ? t.editor.missingOnVehicle : t.editor.missingGeneric}
        >
          {t.editor.whenMissing}
        </span>
        <button type="button" className="cycle-button" onClick={cycleWhenUnavailable}>
          <EyeIcon hidden={tile.whenUnavailable === 'hide'} />
          <span>{tile.whenUnavailable === 'hide' ? t.editor.hide : t.editor.keep}</span>
        </button>
      </section>

      {/*
        The dressing precedes the edges, and that is not indifferent: it decides whether there is a
        border at all, where the next row decides what that border does at the board edges.
      */}
      <section className="edges">
        <span className="edges__label">{t.editor.dressing}</span>
        {/*
          A cycling button, like the layer one. Five labels side by side did not fit on one line
          and wrapped onto two, giving this setting more weight than the others.
        */}
        <button type="button" className="cycle-button" onClick={cycleChrome}>
          <DressingIcon chrome={tile.chrome} />
          <span>{t.editor.dressings[tile.chrome]}</span>
        </button>
      </section>

      {/*
        Next to the dressing, which it resembles: both decide how much of the standard tile is
        kept. A cycling button for the same reason - three labels side by side would wrap.
      */}
      <section className="edges">
        <span className="edges__label">{t.editor.caption}</span>
        <button type="button" className="cycle-button" onClick={cycleCaption}>
          <CaptionIcon caption={tile.caption} />
          <span>{t.editor.captions[tile.caption]}</span>
        </button>
      </section>

      {/*
        Outside the columns, full width: this setting is not about one face of the tile but about
        its relation to the whole board.
      */}
      <section className="edges">
        <span className="edges__label">{t.editor.edges}</span>
        <div className="edges__buttons">
          {FLUSH_SIDES.map((side) => (
            <EdgeButton
              key={side}
              side={side}
              mode={tile.flush[side]}
              onCycle={() =>
                onChange({ ...tile, flush: { ...tile.flush, [side]: nextMode(tile.flush[side]) } })
              }
            />
          ))}
        </div>
      </section>
      </div>

      {/*
        At the foot of the window, like every tooltip: placing it near the gesture seemed more apt,
        but a bubble appearing in a different place depending on what was just done has to be
        looked for every time.
      */}
      {refused > 0 && <Tip key={refused} main={t.editor.noRoom} />}
    </Modal>
  );
}


/**
 * The tile at reduced size, as it will appear.
 *
 * The same rendering as on the board and in the catalogue - never an imitation, which would sooner
 * or later diverge from the original. Values come from the simulator: the modal opens at a
 * standstill as well as on the move, and an empty preview would say nothing about proportions.
 */
function TilePreview({
  tile,
  preset,
  board,
  avatarId,
  columns,
  rows,
}: {
  readonly tile: TileConfig;
  readonly preset: TilePreset | null;
  readonly board: ThemeManifest;
  readonly avatarId: string;
  readonly columns: number;
  readonly rows: number;
}): React.JSX.Element {
  const store = useDemoStore();
  /*
   * The tile's own theme, or the board's - never the catalogue's first.
   *
   * `findTheme('')` finds nothing and falls back to Neon Miami, so a tile deferring to the board
   * was previewed in whatever theme happens to lead the list. A tile carrying its own was right,
   * which is why the bug looked like it had an exception.
   */
  const theme = tile.themeId === null ? board : findTheme(tile.themeId);
  const setVariables = useTileVariables(store, tile.metrics);

  return (
    <div className="layout-picker__frame">
    <div
      // The same markers as on the board, and for the same reason: they are what the stylesheet and
      // imported dressings read. A preview without them would show a different tile from the one
      // being adjusted.
      className={tile.metrics[0] === 'avatar' ? 'tile tile--bare layout-picker__tile' : 'tile layout-picker__tile'}
      ref={setVariables}
      data-flush={flushEdges(tile, columns, rows)}
      data-chrome={tile.chrome}
      {...(tile.align === null ? {} : { 'data-align': tile.align })}
      data-caption={tile.caption}
      {...(tile.presetId === null ? {} : { 'data-preset': tile.presetId })}
      {...(tile.spacing === null ? {} : { 'data-spacing': tile.spacing })}
      style={
        {
          ...themeToTileVariables(theme),
          ...alignVariables(tile.align),
          '--tile-font-scale': tile.fontScale,
          ...(tile.spacing === null ? {} : { '--tile-spacing': `${tile.spacing}px` }),
        } as React.CSSProperties
      }
    >
      <TileContent
        tile={tile}
        store={store}
        avatarId={avatarId}
        palette={{ accent: theme.colors.accent, accentAlt: theme.colors.accentAlt }}
        template={preset?.layout ?? null}
        gauge={theme.tile.gauge}
      />
    </div>
    </div>
  );
}

/**
 * The eye, open or struck through.
 *
 * The oblique stroke says "hidden" as it says "forbidden" on the edge buttons just below: one more
 * vocabulary would have been one too many in a window that already has three.
 */
function EyeIcon({ hidden }: { readonly hidden: boolean }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <path
        d="M2.5 12 C6 6.5 10 4.8 12 4.8 C14 4.8 18 6.5 21.5 12 C18 17.5 14 19.2 12 19.2 C10 19.2 6 17.5 2.5 12 Z"
        fill="none"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" fill="none" strokeWidth="1.8" />
      {hidden && <line x1="4" y1="20" x2="20" y2="4" strokeWidth="2.2" strokeLinecap="round" />}
    </svg>
  );
}

/**
 * Dressing as a square.
 *
 * The tile seen face on: its border when it has one, its fill when it keeps one. The same
 * vocabulary as the edge buttons just below, where the square already stands for the tile.
 *
 * The feathering gradient carries a fixed id: the edit window exists in a single instance, so two
 * definitions of the same name cannot meet.
 */
function DressingIcon({ chrome }: { readonly chrome: TileChrome }): React.JSX.Element {
  // The outline: solid when the tile keeps one, dotted when it has nothing left. An entirely empty
  // square would read as a missing icon.
  const outline =
    chrome === 'default' || chrome === 'unfilled'
      ? { stroke: 'currentColor', strokeOpacity: 1 }
      : chrome === 'bare'
        ? { stroke: 'currentColor', strokeOpacity: 0.45, strokeDasharray: '3 3' }
        : { stroke: 'none' as const };

  const fill =
    chrome === 'feathered'
      ? { fill: 'url(#dressing-feather)' }
      : chrome === 'default' || chrome === 'borderless'
        ? { fill: 'currentColor', fillOpacity: 0.32 }
        : { fill: 'none' as const };

  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      {chrome === 'feathered' && (
        <defs>
          <radialGradient id="dressing-feather">
            <stop offset="35%" stopColor="currentColor" stopOpacity="0.85" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
      )}

      <rect x="4.5" y="4.5" width="15" height="15" rx="3" strokeWidth="1.8" {...outline} {...fill} />
    </svg>
  );
}

/** Automatic to forced to disabled, cycling. */
function nextMode(mode: FlushMode): FlushMode {
  if (mode === 'auto') return 'force';
  return mode === 'force' ? 'off' : 'auto';
}

/**
 * One board edge, in its three states.
 *
 * The icon shows a square with the relevant side thickened: the tile seen from above, and the heavy
 * stroke the edge it sits against. No words are needed, which matters in an already dense modal.
 */
function EdgeButton({
  side,
  mode,
  onCycle,
}: {
  readonly side: FlushSide;
  readonly mode: FlushMode;
  readonly onCycle: () => void;
}): React.JSX.Element {
  const t = useTranslation();

  return (
    <button
      type="button"
      className={`edges__button edges__button--${mode}`}
      onClick={onCycle}
      aria-label={`${t.editor.edgeSides[side]} — ${t.editor.edgeModes[mode]}`}
      title={`${t.editor.edgeSides[side]} — ${t.editor.edgeModes[mode]}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden focusable="false">
        <rect x="4.5" y="4.5" width="15" height="15" rx="2" className="edges__frame" />
        <line {...EDGE_LINES[side]} className="edges__side" />
        {/*
          The oblique bar says "never", where an unfilled side would only say "not for now". It is
          drawn in CSS on the button, not here: drawn inside this SVG it would strike through only
          the square standing for the tile, whereas it cancels the whole setting.
        */}
      </svg>
    </button>
  );
}

const EDGE_LINES: Record<FlushSide, { x1: number; y1: number; x2: number; y2: number }> = {
  top: { x1: 5, y1: 4.5, x2: 19, y2: 4.5 },
  right: { x1: 19.5, y1: 5, x2: 19.5, y2: 19 },
  bottom: { x1: 5, y1: 19.5, x2: 19, y2: 19.5 },
  left: { x1: 4.5, y1: 5, x2: 4.5, y2: 19 },
};

/**
 * The three states of the caption, drawn rather than named.
 *
 * A tile in outline, its caption a short bar at the top and its value a long one below. Showing
 * keeps both; hiding empties the caption bar but leaves its row; collapsing removes the row and
 * lets the value rise into it - which is the difference the words alone struggle to carry.
 */
function CaptionIcon({ caption }: { readonly caption: TileCaption }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <rect x="3" y="4" width="18" height="16" rx="2.5" fill="none" strokeWidth="1.6" opacity="0.5" />

      {caption === 'show' && <rect x="6" y="7.5" width="7" height="2" rx="1" strokeWidth="0" />}
      {caption === 'hide' && (
        <rect
          x="6"
          y="7.5"
          width="7"
          height="2"
          rx="1"
          fill="none"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      )}

      {/* The value: level with a kept caption, risen into its place once collapsed. */}
      <rect
        x="6"
        y={caption === 'spread' ? '9' : '12'}
        width="12"
        height={caption === 'spread' ? '7' : '5'}
        rx="1.2"
        strokeWidth="0"
      />
    </svg>
  );
}
