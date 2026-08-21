import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragMoveEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import type { ConnectionStatus } from '../telemetry/DataSource';
import type { TelemetryStore } from '../telemetry/TelemetryStore';
import type { AnyChannel } from '../telemetry/types';
import { useTranslation } from '../i18n';
import { findTheme, themeToTileVariables, type ThemeManifest } from '../theme/themes';
import {
  alignVariables,
  flushEdges,
  forcedEdges,
  hasRoomFor,
  isTileVisible,
  LAYERS,
  newTileId,
  occupancyGrid,
  planInsert,
  planMove,
  type AppSettings,
  type LayerIndex,
  type EditBarDock,
  type LayoutConfig,
  type MetricId,
  type TileConfig,
} from './layout';
import { findPreset, tileFromPreset } from './presets';
import { useTileVariables } from './tileVariables';
import { EditBar } from './EditBar';
import type { VehicleRanges } from '../profiles/types';
import { presetIdFromDragId, TileCatalog } from './TileCatalog';
import { TileContent } from './tiles';
import { Tip, TIP_MS } from './Tip';

/** Past this displacement the gesture becomes a drag rather than a press. */
const DRAG_THRESHOLD_PX = 10;
/** Shift plus an arrow, in span steps. */
const KEY_SPANS: Record<string, { col: number; row: number } | undefined> = {
  ArrowRight: { col: 1, row: 0 },
  ArrowLeft: { col: -1, row: 0 },
  ArrowDown: { col: 0, row: 1 },
  ArrowUp: { col: 0, row: -1 },
};

/** Press duration beyond which the general settings open. */
const LONG_PRESS_MS = 550;

/**
 * How many times a launch may explain the long press.
 *
 * Module scope, so it survives leaving and re-entering the board but not a reload: a driver who has
 * learnt the gesture should not be told again every time they brush the screen, and someone opening
 * the application tomorrow gets the reminder afresh.
 */
const HINT_LIMIT = 3;

/** How long a bubble stays before withdrawing. */
let hintsShown = 0;

export interface BoardProps {
  readonly store: TelemetryStore;
  readonly settings: AppSettings;
  /** Layout for the current orientation, resolved by the caller. */
  readonly layout: LayoutConfig;
  readonly theme: ThemeManifest;
  readonly status: ConnectionStatus;
  readonly availableChannels: ReadonlySet<AnyChannel>;
  readonly activeLayer: LayerIndex;
  readonly catalogOpen: boolean;
  /** A panel covers the screen: nothing may move behind it any more. */
  readonly panelOpen: boolean;
  readonly onOpenCatalog: () => void;
  /**
   * How far this driver's ordinary sits from the average, or 0 to judge against the average.
   *
   * Read from the trip history by the application, and only when the setting asks for it.
   */
  readonly baselineShift: number;
  /** Active vehicle's gauge full-scale values. */
  readonly ranges: VehicleRanges;
  readonly onCloseCatalog: () => void;
  readonly onOpenSettings: () => void;
  readonly onEditTile: (tileId: string) => void;
  readonly onCommitLayout: (tiles: readonly TileConfig[]) => void;
  readonly onImport: (file: File) => void;
  readonly onDeletePreset: (presetId: string) => void;
  readonly importReport: string | null;
  /** Remembers the catalogue's choices from one session to the next. */
  readonly onCatalogThemeChange: (themeId: string) => void;
  readonly onMetricFilterChange: (metrics: readonly MetricId[]) => void;
  /** Moves to the next layer, cyclically. */
  readonly onSelectLayer: (layer: LayerIndex) => void;
  readonly editBarDock: EditBarDock;
  readonly onEditBarDock: (dock: EditBarDock) => void;
  /** Adjusts the grid, in columns then rows. */
  readonly onGridChange: (columnsDelta: number, rowsDelta: number) => void;
  readonly onExitEdit: () => void;
}

interface GridMetrics {
  readonly left: number;
  readonly top: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly colGap: number;
  readonly rowGap: number;
}

/**
 * The board: three stacked grids filling the screen.
 *
 * Drag and drop rests on dnd-kit; placement stays ours, decided by `planMove` and `planInsert`,
 * both covered by tests.
 *
 * Two drag origins coexist and deliberately share one path: an already-placed tile, and a catalogue
 * entry. Both compute and display a projected layout applied only on release, so dropping a new
 * tile behaves exactly like moving one.
 *
 * The other gestures are handled by hand for want of an equivalent: a short press on a tile edits
 * it, a short press on an empty cell creates one there, and a long press anywhere opens the
 * settings.
 */
export function Board(props: BoardProps): React.JSX.Element {
  const {
    settings,
    layout,
    activeLayer,
    catalogOpen,
    onOpenCatalog,
    onCloseCatalog,
    onOpenSettings,
    onEditTile,
    onCommitLayout,
  } = props;
  const t = useTranslation();
  const { locked } = settings;

  const layerRefs = useRef(new Map<LayerIndex, HTMLDivElement>());
  const metrics = useRef<GridMetrics | null>(null);
  const lastTarget = useRef('');
  const previewRef = useRef<readonly TileConfig[] | null>(null);
  /** Tile being created, when the drag comes from the catalogue. */
  const candidateRef = useRef<TileConfig | null>(null);
  /** Pointer position at the start of the gesture, used to target the hovered cell. */
  const pointerStart = useRef({ x: 0, y: 0 });
  /** Where the dragged tile sat when it was grabbed. Every target is measured from there. */
  const grabbedFrom = useRef<{ left: number; top: number } | null>(null);

  const dragHappened = useRef(false);
  // Bumped on each explained press, so the bubble remounts and pulses again.
  const [hinted, setHinted] = useState(0);
  const longPressTimer = useRef<number | null>(null);
  const pressTarget = useRef<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<TileConfig | null>(null);
  const [preview, setPreview] = useState<readonly TileConfig[] | null>(null);
  const [valid, setValid] = useState(true);
  /**
   * A counter rather than a boolean, reset on its own.
   *
   * It keys the tooltip: two refused drops in a row must remount it, and so vibrate a second time.
   * A boolean already true would change nothing and the second refusal would go unnoticed.
   */
  const [refused, setRefused] = useState(0);

  useEffect(() => {
    if (refused === 0) return;
    const timer = window.setTimeout(() => setRefused(0), TIP_MS);
    return () => window.clearTimeout(timer);
  }, [refused]);

  // The same withdrawal for the hint. `Tip` draws itself and vibrates but never leaves on its own -
  // whoever renders one owes it an exit, or it sits at the foot of the screen for the whole drive.
  useEffect(() => {
    if (hinted === 0) return;
    const timer = window.setTimeout(() => setHinted(0), TIP_MS);
    return () => window.clearTimeout(timer);
  }, [hinted]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_THRESHOLD_PX } }),
    // One arrow press moves one cell.
    //
    // The default step is 25 px against cells measured at 271: eleven presses to cross one, and
    // nothing to tell the user which press finally counts. The grid is the unit here, so the
    // sensor moves in grid units.
    useSensor(KeyboardSensor, {
      coordinateGetter: cellCoordinates,
      // Space alone picks a tile up. Enter is left free for the editor, which the short press opens
      // and the keyboard otherwise could not.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragHappened.current = false;
      cancelLongPress();

      const target = event.target as Element;
      pressTarget.current = target.closest('[data-tile-id]')?.getAttribute('data-tile-id') ?? null;

      longPressTimer.current = window.setTimeout(() => {
        longPressTimer.current = null;
        if (dragHappened.current) return;
        pressTarget.current = null;
        onOpenSettings();
      }, LONG_PRESS_MS);
    },
    [cancelLongPress, onOpenSettings],
  );

  const handlePointerUp = useCallback(() => {
    const wasPending = longPressTimer.current !== null;
    cancelLongPress();

    if (dragHappened.current || !wasPending) return;

    /*
     * Locked, a short press does nothing at all - and nothing said so.
     *
     * The gesture that opens the settings is a long one, which is not discoverable by trying: a
     * press that produces no effect reads as an unresponsive screen rather than as the wrong
     * gesture. This answers it, in the same bubble every other refusal uses.
     */
    if (locked) {
      if (hintsShown < HINT_LIMIT) {
        hintsShown += 1;
        setHinted((count) => count + 1);
      }
      return;
    }

    const tileId = pressTarget.current;
    if (tileId !== null) onEditTile(tileId);
  }, [cancelLongPress, locked, onEditTile]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      dragHappened.current = true;
      cancelLongPress();
      lastTarget.current = '';
      previewRef.current = null;

      const id = String(event.active.id);
      const presetId = presetIdFromDragId(id);
      const preset = presetId === null ? null : findPreset(presetId, settings.presets);

      if (preset !== null) {
        // The catalogue fades to reveal the grid: from here the gesture is identical to moving an
        // existing tile.
        onCloseCatalog();
        // The provisional id is the drag's, so the projected tile recognises itself as the one
        // being moved. The theme selected in the catalogue becomes the placed tile's.
        const created = tileFromPreset(preset, activeLayer, settings.themeId, id);
        candidateRef.current = created;
        setCandidate(created);
      } else {
        candidateRef.current = null;
        setCandidate(null);
      }

      const activator = event.activatorEvent as Partial<PointerEvent>;
      pointerStart.current = { x: activator.clientX ?? 0, y: activator.clientY ?? 0 };

      // Measured from the document rather than read off `active.rect.current.initial`, which is
      // still unset at this point: the tile followed the arrows and landed back where it started.
      const node = document.querySelector<HTMLElement>(`[data-tile-id="${CSS.escape(id)}"]`);
      const box = node?.getBoundingClientRect();
      grabbedFrom.current = box === undefined ? null : { left: box.left, top: box.top };

      const layerElement = layerRefs.current.get(activeLayer);
      metrics.current =
        layerElement === undefined
          ? null
          : measureGrid(layerElement, layout.columns, layout.rows);
      measuredCell =
        metrics.current === null
          ? null
          : {
              width: metrics.current.cellWidth + metrics.current.colGap,
              height: metrics.current.cellHeight + metrics.current.rowGap,
            };

      setActiveId(id);
      setPreview(null);
      setValid(true);
    },
    [
      activeLayer,
      cancelLongPress,
      layout.columns,
      layout.rows,
      onCloseCatalog,
      settings.presets,
      settings.themeId,
    ],
  );

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      const grid = metrics.current;
      if (grid === null) return;

      const pending = candidateRef.current;
      let col: number;
      let row: number;

      if (pending !== null) {
        // For a new tile, aim at the cell under the finger: it has no previous position whose grab
        // offset would need preserving.
        const point = {
          x: pointerStart.current.x + event.delta.x,
          y: pointerStart.current.y + event.delta.y,
        };
        ({ col, row } = cellUnderPoint(grid, point.x, point.y));
      } else {
        // From the corner where the tile started, plus how far the gesture has travelled.
        //
        // Not from `rect.current.translated`, which is what this used to read: measured, a keyboard
        // drag left it unset, so the handler returned before computing anything. The tile followed
        // the arrows on screen and landed back where it started, without even the refusal tooltip -
        // the drag was never planned at all.
        //
        // `delta` is the one thing a pointer and a keyboard both report.
        const start = grabbedFrom.current;
        if (start === null) return;
        ({ col, row } = cellForCorner(grid, start.left + event.delta.x, start.top + event.delta.y));
      }

      const key = `${col},${row}`;
      if (key === lastTarget.current) return;
      lastTarget.current = key;

      const planned =
        pending === null
          ? planMove(layout.tiles, String(event.active.id), col, row, layout.columns, layout.rows)
          : planInsert(layout.tiles, pending, col, row, layout.columns, layout.rows);

      previewRef.current = planned;
      setPreview(planned);
      setValid(planned !== null);
    },
    [layout.columns, layout.rows, layout.tiles],
  );

  const finishDrag = useCallback(() => {
    setActiveId(null);
    setCandidate(null);
    setPreview(null);
    setValid(true);
    previewRef.current = null;
    candidateRef.current = null;
    grabbedFrom.current = null;
    metrics.current = null;
  }, []);

  const handleDragEnd = useCallback(() => {
    const planned = previewRef.current;
    const pending = candidateRef.current;

    // A drop that fails used to say so only by tinting the floating tile, which assumes looking at
    // it on release - precisely when the eye moves away. The tooltip stays after the gesture, and
    // the vibration flags it.
    //
    // The aimed target distinguishes a refusal from a gesture with no effect: `lastTarget` is only
    // set after a first layout computation, so a drag abandoned before aiming at anything says
    // nothing.
    if (planned === null && lastTarget.current !== '') setRefused((count) => count + 1);

    if (planned !== null) {
      // The catalogue's provisional id must not survive the drop.
      const committed =
        pending === null
          ? planned
          : planned.map((tile) => (tile.id === pending.id ? { ...tile, id: newTileId() } : tile));
      onCommitLayout(committed);
    }
    finishDrag();
  }, [finishDrag, onCommitLayout]);

  const overlayOpen = catalogOpen || props.panelOpen;

  /**
   * A panel has just opened: abandon the gesture in progress.
   *
   * This happens without trying. The long press opens the settings while the finger is still down;
   * dnd-kit has armed its sensor and only waits for the distance threshold. The slightest movement
   * then moved a tile behind the panel, unseen.
   *
   * `Escape` is the library's intended exit: its sensors abandon on it whether a drag is active or
   * merely armed. No imperative method is exposed for this.
   */
  useEffect(() => {
    if (!overlayOpen) return;
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
    );
    finishDrag();
  }, [overlayOpen, finishDrag]);

  const displayedTiles = preview ?? layout.tiles;
  const draggedTile = useMemo(
    () => candidate ?? layout.tiles.find((tile) => tile.id === activeId) ?? null,
    [candidate, activeId, layout.tiles],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={finishDrag}
    >
      <div
        className={locked ? 'board board--locked' : 'board board--unlocked'}
        style={
          {
            '--cols': layout.columns,
            '--rows': layout.rows,
            '--font-scale': settings.fontScale,
          } as React.CSSProperties
        }
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={cancelLongPress}
        /*
         * The gesture that opens the settings is the same one the system reads as "show me the
         * context menu": half a second of a still finger. Left alone, the menu appeared over the
         * board at the exact moment the settings did.
         *
         * Refused on the board only, never on the document: a text field in a window still owes
         * its user copy and paste.
         */
        onContextMenu={(event) => event.preventDefault()}
      >
        {/*
          The only way in for a keyboard.

          Settings open on a long press and editing on a short one - both pointer-only, so a
          keyboard user reaching the board could go no further: measured, exactly one focusable
          element on the whole screen, and it was a transient notification.

          A skip-link rather than focus on the board itself: focusing a full-screen element means
          ringing a full screen to show it, which is a heavy mark for something a driver will never
          see. This stays out of sight until Tab reaches it, and names itself instead of describing
          a gesture.
        */}
        <button type="button" className="board__skip" onClick={onOpenSettings}>
          {t.settings.title}
        </button>

        {LAYERS.map((layer) => {
          const isActive = layer === activeLayer && !locked;
          const layerTiles = displayedTiles.filter(
            (tile) => tile.layer === layer && isTileVisible(tile, props.availableChannels),
          );
          return (
            <div
              key={layer}
              ref={(node) => {
                if (node === null) layerRefs.current.delete(layer);
                else layerRefs.current.set(layer, node);
              }}
              className={isActive ? 'layer layer--active' : 'layer layer--inactive'}
              style={{ zIndex: layer }}
            >
              {layerTiles.map((tile) => (
                <DraggableTile
                  key={tile.id}
                  tile={tile}
                  board={props}
                  isGhost={tile.id === activeId}
                  // No new gesture starts behind a panel.
                  disabled={!isActive || overlayOpen}
                  onRefuse={() => setRefused((count) => count + 1)}
                />
              ))}

              {/*
                Editing lattice, as separate elements rather than drawn on the tiles: it describes
                the cells, not their dressing. A rounded, bevelled or air-surrounded tile therefore
                keeps a readable footprint.
              */}
              {!locked &&
                layerTiles.map((tile) => (
                  <div
                    key={`used-${tile.id}`}
                    className="cell-slot cell-slot--used"
                    style={{
                      gridColumn: `${tile.colStart} / span ${tile.colSpan}`,
                      gridRow: `${tile.rowStart} / span ${tile.rowSpan}`,
                    }}
                    aria-hidden
                  />
                ))}

              {/*
                Free cells: merely materialised, with no invitation. A tile is added from the
                catalogue, not by tapping empty space.
              */}
              {isActive &&
                freeCells(displayedTiles, layer, layout.columns, layout.rows).map(({ col, row }) => (
                  <div
                    key={`slot-${col}-${row}`}
                    className="cell-slot"
                    style={{ gridColumn: col, gridRow: row }}
                    aria-hidden
                  />
                ))}
            </div>
          );
        })}

        {props.theme.effects.scanlines && <div className="scanlines" aria-hidden />}

        {/*
          What the keyboard can do, for whoever is finding out.
          It shows only while a tile holds keyboard focus - a CSS rule, no state - so a pointer
          never summons it. The gestures teach themselves by trial; that Shift widens a tile does
          not, and nothing on a bare board would ever hint at it.
        */}
        <dl className="board__legend" aria-hidden>
          <dt>Tab</dt>
          <dd>{t.keyboard.between}</dd>
          <dt>Space</dt>
          <dd>{t.keyboard.grab}</dd>
          <dt>&#8592;&#8593;&#8594;&#8595;</dt>
          <dd>{t.keyboard.nudge}</dd>
          <dt>Shift + &#8592;&#8593;&#8594;&#8595;</dt>
          <dd>{t.keyboard.resize}</dd>
          <dt>Enter</dt>
          <dd>{t.keyboard.edit}</dd>
        </dl>

        {!locked && (
          <EditBar
            activeLayer={activeLayer}
            onOpenCatalog={onOpenCatalog}
            onSelectLayer={props.onSelectLayer}
            dock={props.editBarDock}
            onDock={props.onEditBarDock}
            onExitEdit={props.onExitEdit}
          />
        )}

        {props.status !== 'connected' && (
          <div className={`halo halo--${props.status}`} role="status" aria-live="polite">
            <span className="halo__text">{t.status[props.status]}</span>
          </div>
        )}
      </div>

      {/*
        The catalogue shares the drag context: that is what allows carrying one of its entries onto
        the grid.
      */}
      {catalogOpen && (
        <TileCatalog
          availableChannels={props.availableChannels}
          presets={settings.presets}
          themeId={settings.themeId}
          onThemeChange={props.onCatalogThemeChange}
          avatarId={settings.avatarId}
          metricFilter={settings.metricFilter}
          onMetricFilterChange={props.onMetricFilterChange}
          onClose={onCloseCatalog}
          onImport={props.onImport}
          onDeletePreset={props.onDeletePreset}
          importReport={props.importReport}
        />
      )}

      <DragOverlay dropAnimation={null}>
        {draggedTile !== null && (
          <FloatingTile
            tile={draggedTile}
            valid={valid}
            theme={props.theme}
            store={props.store}
            avatarId={settings.avatarId}
            baselineShift={props.baselineShift}
            ranges={props.ranges}
          />
        )}
      </DragOverlay>

      {/*
        At the foot of the screen, like every other tooltip.
      */}
      {refused > 0 && <Tip key={refused} main={t.editor.boardFull} />}
      {hinted > 0 && <Tip key={`hint-${hinted}`} main={t.editor.holdForSettings} />}
    </DndContext>
  );
}

interface DraggableTileProps {
  readonly tile: TileConfig;
  readonly board: BoardProps;
  readonly isGhost: boolean;
  readonly disabled: boolean;
  /** Signals a resize with nowhere to go, so the shared tooltip can say so. */
  readonly onRefuse: () => void;
}

function DraggableTile({
  tile,
  board,
  isGhost,
  disabled,
  onRefuse,
}: DraggableTileProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: tile.id, disabled });

  /**
   * What the keyboard can do to a tile it has focused.
   *
   * dnd-kit owns the arrows only once a drag has started, so until Space is pressed they are free.
   * Shift resizes, which is the pairing every drawing tool uses; Enter opens the editor, the
   * keyboard's equivalent of the short press that has no other way in.
   *
   * A resize with nowhere to go is refused rather than pushing the neighbours - the same rule the
   * editor's own picker applies, and the same tooltip says so.
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (disabled || event.target !== event.currentTarget) return;

    /*
     * Nothing while the tile is in the air.
     *
     * Once a drag has started, dnd-kit listens for keys on the window rather than on the tile, so
     * `preventDefault` on this event never reaches it: Shift and an arrow resized the tile here
     * and moved it there, and the drop landed it one cell over. Measured: 1x1 @2,2 came back 2x1
     * @3,2.
     *
     * Standing down is also the right answer on its own terms - a tile being placed is not a tile
     * being sized, and Enter has no business opening an editor mid-flight.
     */
    if (isGhost) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      board.onEditTile(tile.id);
      return;
    }

    if (!event.shiftKey) return;

    const step = KEY_SPANS[event.key];
    if (step === undefined) return;
    event.preventDefault();

    const colSpan = Math.max(1, tile.colSpan + step.col);
    const rowSpan = Math.max(1, tile.rowSpan + step.row);
    if (colSpan === tile.colSpan && rowSpan === tile.rowSpan) return;

    const { columns, rows } = board.layout;
    if (!hasRoomFor(board.layout.tiles, tile, colSpan, rowSpan, columns, rows)) {
      onRefuse();
      return;
    }

    board.onCommitLayout(
      board.layout.tiles.map((other) =>
        other.id === tile.id ? { ...other, colSpan, rowSpan } : other,
      ),
    );
  }
  // Imported dressings consume the same ratios as the gauges: they must know the same full scale,
  // or a background filling with speed and a bar measuring it would say two different things.
  const setVariablesRef = useTileVariables(board.store, tile.metrics, board.ranges);
  const preset = tile.presetId === null ? null : findPreset(tile.presetId, board.settings.presets);
  // The tile carries its theme: set inline, its variables override those on the root, so tiles of
  // different origins coexist without contaminating each other.
  const theme = tile.themeId === null ? board.theme : findTheme(tile.themeId);

  // Two consumers for the same node: dnd-kit for input, and the CSS variable writer.
  const setRef = (node: HTMLDivElement | null): void => {
    setNodeRef(node);
    setVariablesRef(node);
  };

  return (
    <div
      ref={setRef}
      data-tile-id={tile.id}
      // Anchor for imported dressing - see `ScopedTileStyles`.
      {...(tile.presetId === null ? {} : { 'data-preset': tile.presetId })}
      /**
       * Board edges the tile touches, with settings applied.
       *
       * An attribute rather than a class, and a word list: a theme's CSS and an imported pack's
       * alike can write `[data-flush~="left"]` knowing nothing about the grid. That is what lets a
       * tile be drawn to graft onto an edge.
       */
      data-flush={flushEdges(tile, board.layout.columns, board.layout.rows)}
      data-chrome={tile.chrome}
      {...(tile.align === null ? {} : { 'data-align': tile.align })}
      data-caption={tile.caption}
      /**
       * Per-tile spacing, exposed twice on purpose.
       *
       * The attribute serves selectors - `[data-spacing="0"]` - and typed `attr()` where available;
       * the custom property serves calculations, where typed `attr()` is not yet reliable
       * everywhere.
       */
      {...(tile.spacing === null ? {} : { 'data-spacing': tile.spacing })}
      className={tileClassName(tile, isGhost)}
      style={
        {
          ...themeToTileVariables(theme),
          ...alignVariables(tile.align),
          gridColumn: `${tile.colStart} / span ${tile.colSpan}`,
          gridRow: `${tile.rowStart} / span ${tile.rowSpan}`,
          '--tile-font-scale': tile.fontScale,
          // Absent when the tile defers to the theme: the stylesheet then falls back to
          // `--tile-margin` through the `var()` fallback.
          ...(tile.spacing === null ? {} : { '--tile-spacing': `${tile.spacing}px` }),
        } as React.CSSProperties
      }
      {...(disabled ? {} : listeners)}
      {...(disabled ? {} : attributes)}
      /*
       * After the spreads, and chaining by hand.
       *
       * dnd-kit puts its own `onKeyDown` in `listeners`; declared before them, ours was simply
       * overwritten and neither resizing nor Enter did anything. Declared after, it must pass the
       * event on itself, or picking a tile up would stop working.
       */
      onKeyDown={(event) => {
        handleKeyDown(event);
        if (!event.defaultPrevented) listeners?.['onKeyDown']?.(event);
      }}
    >
      {isGhost ? null : (
        <TileContent
          tile={tile}
          store={board.store}
          avatarId={board.settings.avatarId}
          palette={{ accent: theme.colors.accent, accentAlt: theme.colors.accentAlt }}
          template={preset?.layout ?? null}
          gauge={theme.tile.gauge}
          baselineShift={board.baselineShift}
          ranges={board.ranges}
        />
      )}
    </div>
  );
}

function tileClassName(tile: TileConfig, isGhost: boolean): string {
  const classes = ['tile'];
  if (tile.metrics[0] === 'avatar') classes.push('tile--bare');
  if (tile.metrics.length === 0) classes.push('tile--empty');
  if (isGhost) classes.push('tile--ghost');
  return classes.join(' ');
}

function freeCells(
  tiles: readonly TileConfig[],
  layer: LayerIndex,
  columns: number,
  rows: number,
): Array<{ col: number; row: number }> {
  const grid = occupancyGrid(tiles, layer, columns, rows);
  const cells: Array<{ col: number; row: number }> = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      if (grid[row]?.[col] !== true) cells.push({ col: col + 1, row: row + 1 });
    }
  }
  return cells;
}

/**
 * Measures a layer's geometry.
 *
 * Margins and gutters come from the theme, hence from CSS: they are read back rather than
 * duplicated in JavaScript, where they would eventually diverge.
 */
function measureGrid(element: HTMLElement, columns: number, rows: number): GridMetrics {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const padLeft = parseFloat(style.paddingLeft) || 0;
  const padTop = parseFloat(style.paddingTop) || 0;
  const padRight = parseFloat(style.paddingRight) || 0;
  const padBottom = parseFloat(style.paddingBottom) || 0;
  const colGap = parseFloat(style.columnGap) || 0;
  const rowGap = parseFloat(style.rowGap) || 0;

  return {
    left: rect.left + padLeft,
    top: rect.top + padTop,
    cellWidth: (rect.width - padLeft - padRight - colGap * (columns - 1)) / columns,
    cellHeight: (rect.height - padTop - padBottom - rowGap * (rows - 1)) / rows,
    colGap,
    rowGap,
  };
}

/** Cell a top-left corner snaps to, in screen pixels. */
function cellForCorner(metrics: GridMetrics, left: number, top: number): { col: number; row: number } {
  return {
    col: Math.round((left - metrics.left) / (metrics.cellWidth + metrics.colGap)) + 1,
    row: Math.round((top - metrics.top) / (metrics.cellHeight + metrics.rowGap)) + 1,
  };
}

/**
 * Keyboard steps, in grid cells.
 *
 * dnd-kit asks where the drag should go next; the answer here is one cell over, taken from the
 * layer actually being edited so it follows a grid of two columns as readily as one of forty.
 *
 * Falls back to the library's own step when the grid cannot be measured - better a slow move than
 * a stuck one.
 */
const cellCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const current = args.currentCoordinates;
  const step = measuredCell ?? { width: 25, height: 25 };

  switch (event.key) {
    case 'ArrowRight':
      return { ...current, x: current.x + step.width };
    case 'ArrowLeft':
      return { ...current, x: current.x - step.width };
    case 'ArrowDown':
      return { ...current, y: current.y + step.height };
    case 'ArrowUp':
      return { ...current, y: current.y - step.height };
    default:
      return undefined;
  }
};

/**
 * The cell size of the layer being dragged over.
 *
 * A module-level value because the coordinate getter is handed to the sensor once, outside any
 * render, and cannot close over a ref that does not exist yet.
 */
let measuredCell: { width: number; height: number } | null = null;

function cellUnderPoint(metrics: GridMetrics, x: number, y: number): { col: number; row: number } {
  return {
    col: Math.floor((x - metrics.left) / (metrics.cellWidth + metrics.colGap)) + 1,
    row: Math.floor((y - metrics.top) / (metrics.cellHeight + metrics.rowGap)) + 1,
  };
}

/**
 * The tile under the finger.
 *
 * It carries everything the placed tile carries - dressing, chrome, caption, spacing, theme - so
 * what is being moved looks like the result. It used to take only the theme, and a tile with no
 * border and no fill grew both the moment it was picked up.
 *
 * The one exception is the edges. `auto` means "touching the board here", and a tile in the air
 * touches nothing: only a side deliberately forced still applies.
 */
function FloatingTile({
  tile,
  valid,
  theme,
  store,
  avatarId,
  baselineShift,
  ranges,
}: {
  readonly tile: TileConfig;
  readonly valid: boolean;
  readonly theme: ThemeManifest;
  readonly store: TelemetryStore;
  readonly avatarId: string;
  readonly baselineShift: number;
  readonly ranges: VehicleRanges;
}): React.JSX.Element {
  // The same variables the placed tile publishes: an imported dressing that reacts to speed has to
  // keep reacting while it is carried, or it changes appearance in the hand.
  const setVariablesRef = useTileVariables(store, tile.metrics, ranges);
  const own = tile.themeId === null ? theme : findTheme(tile.themeId);

  return (
    <div
      ref={setVariablesRef}
      className={`${tileClassName(tile, false)} tile--floating${valid ? '' : ' is-invalid'}`}
      {...(tile.presetId === null ? {} : { 'data-preset': tile.presetId })}
      data-flush={forcedEdges(tile)}
      data-chrome={tile.chrome}
      {...(tile.align === null ? {} : { 'data-align': tile.align })}
      data-caption={tile.caption}
      {...(tile.spacing === null ? {} : { 'data-spacing': tile.spacing })}
      style={
        {
          ...themeToTileVariables(own),
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
        gauge={theme.tile.gauge}
        baselineShift={baselineShift}
        ranges={ranges}
      />
    </div>
  );
}
