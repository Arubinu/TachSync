import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { format, useTranslation } from '../i18n';
import { CheckIcon, PlusIcon } from './icons';
import { LAYERS, LAYER_KEYS, type EditBarDock, type LayerIndex } from './layout';

export interface EditBarProps {
  readonly activeLayer: LayerIndex;
  readonly dock: EditBarDock;
  readonly onOpenCatalog: () => void;
  readonly onSelectLayer: (layer: LayerIndex) => void;
  readonly onDock: (dock: EditBarDock) => void;
  readonly onExitEdit: () => void;
}

/** Past this vertical displacement the press becomes a drag. */
const DRAG_START_PX = 8;

/**
 * Speed that counts as a decision, in pixels per millisecond.
 *
 * 0.45 px/ms is 450 px/s: a firm thumb flick, out of reach of a hesitating or resting finger. Speed
 * alone decides, never distance travelled - dragging the bar to the bottom and releasing sends it
 * back where it came from. A bar that docked as soon as it had been nudged would change edge by
 * accident.
 */
const FLICK_PX_PER_MS = 0.45;

/** Window over which speed is measured. Short enough to read only the end of the gesture. */
const VELOCITY_WINDOW_MS = 120;

interface Sample {
  readonly y: number;
  readonly t: number;
}

interface Gesture {
  readonly id: number;
  readonly startY: number;
  samples: Sample[];
}

/**
 * Edit controls, in a capsule docked to one edge.
 *
 * Three kinds of action, three treatments: add is filled with the accent because it is what this
 * mode is entered for, the layers form a segmented control, and the exit is set apart by a
 * hairline.
 *
 * Targets are 44 px, Apple's minimum, Google's being 48. Their presence makes any other edit-mode
 * indicator unnecessary.
 */
export function EditBar({
  activeLayer,
  dock,
  onOpenCatalog,
  onSelectLayer,
  onDock,
  onExitEdit,
}: EditBarProps): React.JSX.Element {
  const t = useTranslation();
  const railRef = useRef<HTMLDivElement>(null);

  /**
   * The active thumb, measured because the segments are not equal width.
   *
   * Equal widths would slide in pure CSS, but the longest label then sets all three - and in Dutch,
   * German or Italian that pushes the bar past a 360 px phone.
   *
   * `useLayoutEffect`, so the measurement lands before paint; otherwise the thumb shows at its
   * previous place and jumps.
   */
  const [thumb, setThumb] = useState({ x: 0, width: 0 });

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (rail === null) return;

    const measure = (): void => {
      const active = rail.querySelector<HTMLElement>('.is-active');
      if (active === null) return;
      setThumb({ x: active.offsetLeft, width: active.offsetWidth });
    };

    measure();

    // Label widths change with the language, with the font once loaded, and with the narrow-screen
    // media query.
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [activeLayer, t]);

  /**
   * The gesture that moves the bar between edges.
   *
   * It sits at the top of the screen, which is also where one likes to put speed: when it is in the
   * way, a thumb flick throws it to the bottom. The movement mirrors dismissing a notification, the
   * gesture everyone already knows for getting rid of something without deleting it.
   */
  const gesture = useRef<Gesture | null>(null);
  const dragged = useRef(false);
  const [offset, setOffset] = useState<number | null>(null);

  /**
   * The gesture is listened for on the window, not on the bar.
   *
   * A firm flick moves tens of pixels between frames, so the first `pointermove` already lands
   * outside the 54 px capsule and the bar never sees it. `setPointerCapture` would fix that but
   * also retargets the derived `click`, which would stop the three buttons responding.
   *
   * Attached imperatively: going through React state would attach the listeners one render late
   * and lose the start of the movement, the only part from which speed can be read.
   */
  const detach = useRef<(() => void) | null>(null);
  useEffect(() => () => detach.current?.(), []);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    // Otherwise the board's long press would fire under the fingers.
    event.stopPropagation();
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    detach.current?.();
    dragged.current = false;
    gesture.current = {
      id: event.pointerId,
      startY: event.clientY,
      samples: [{ y: event.clientY, t: event.timeStamp }],
    };

    const onMove = (moved: PointerEvent): void => track(moved);
    const onEnd = (ended: PointerEvent): void => finish(ended);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    detach.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      detach.current = null;
    };
  }

  function track(event: PointerEvent): void {
    const current = gesture.current;
    if (current === null || current.id !== event.pointerId) return;

    current.samples.push({ y: event.clientY, t: event.timeStamp });
    // Only the last moments count: the velocity window is short, and a list growing without end
    // during a slow gesture serves nothing.
    if (current.samples.length > 12) current.samples.shift();

    const dy = event.clientY - current.startY;
    if (!dragged.current) {
      if (Math.abs(dy) < DRAG_START_PX) return;
      dragged.current = true;
    }
    setOffset(dy);
  }

  function finish(event: PointerEvent): void {
    const current = gesture.current;
    if (current === null || current.id !== event.pointerId) return;

    gesture.current = null;
    detach.current?.();
    // Returned to its place: either it goes back, or the new edge takes it. Either way the CSS
    // transition carries it there.
    setOffset(null);
    if (!dragged.current) return;

    const wanted = flicked(current.samples, dock);
    if (wanted !== null) onDock(wanted);
  }

  return (
    <div
      className={
        offset === null
          ? `edit-bar edit-bar--${dock}`
          : `edit-bar edit-bar--${dock} edit-bar--dragging`
      }
      style={offset === null ? undefined : ({ '--drag-y': `${offset}px` } as React.CSSProperties)}
      onPointerDown={handlePointerDown}
      // A drag must not count as a press: without this interception, throwing the bar down starting
      // from the `+` would open the catalogue on arrival.
      onClickCapture={(event) => {
        if (!dragged.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      role="toolbar"
      aria-label={t.settings.editMode}
    >
      <button
        type="button"
        className="edit-bar__primary"
        onClick={onOpenCatalog}
        aria-label={t.editBar.addTile}
      >
        <PlusIcon />
      </button>

      {/*
        All three layers shown rather than one.

        A cycling button forces remembering what comes next and hides the other two states. The
        active layer decides what the next gesture will reach: it is information to see
        permanently, not guess.
      */}
      <div className="edit-bar__layers" role="group" aria-label={t.editor.layer} ref={railRef}>
        {/*
          A single thumb that moves, rather than three fills switching on. That is what gives the
          change continuity: the selection is seen travelling from one segment to the next instead
          of disappearing here and reappearing there.

          Until measured it does not exist; otherwise it would cross the rail from the left every
          time the mode opens.
        */}
        {thumb.width > 0 && (
          <span
            className="edit-bar__thumb"
            aria-hidden
            style={
              {
                '--thumb-x': `${thumb.x}px`,
                '--thumb-w': `${thumb.width}px`,
              } as React.CSSProperties
            }
          />
        )}

        {LAYERS.map((layer) => {
          const name = t.layers[LAYER_KEYS[layer]];
          return (
            <button
              key={layer}
              type="button"
              className={layer === activeLayer ? 'edit-bar__layer is-active' : 'edit-bar__layer'}
              onClick={() => onSelectLayer(layer)}
              aria-pressed={layer === activeLayer}
              aria-label={format(t.editBar.activeLayer, { layer: name })}
            >
              {name}
            </button>
          );
        })}
      </div>

      <span className="edit-bar__divider" aria-hidden />

      <button
        type="button"
        className="edit-bar__done"
        onClick={onExitEdit}
        aria-label={t.editBar.exitEditMode}
      >
        <CheckIcon />
      </button>
    </div>
  );
}

/**
 * The edge the end of the gesture asks for, or `null` if it asked for nothing.
 *
 * Speed is taken over the last moments rather than the whole gesture: bringing the bar down slowly
 * then flicking on release counts as a flick, and the reverse - throwing then holding back - counts
 * as an abandon. The end expresses the intent.
 */
function flicked(samples: readonly Sample[], dock: EditBarDock): EditBarDock | null {
  const last = samples.at(-1);
  if (last === undefined) return null;

  // Oldest sample still inside the window, or the first one.
  const oldest =
    [...samples].reverse().find((sample) => last.t - sample.t >= VELOCITY_WINDOW_MS) ?? samples[0];
  if (oldest === undefined) return null;

  const elapsed = last.t - oldest.t;
  if (elapsed === 0) return null;

  const velocity = (last.y - oldest.y) / elapsed;
  if (velocity > FLICK_PX_PER_MS) return dock === 'top' ? 'bottom' : null;
  if (velocity < -FLICK_PX_PER_MS) return dock === 'bottom' ? 'top' : null;
  return null;
}
