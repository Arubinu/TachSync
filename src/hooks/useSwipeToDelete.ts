import { useRef, useState } from 'react';

/**
 * The drawer gesture: drag a row aside to uncover what deletes it.
 *
 * Extracted from the tile catalogue, where it started, so the trip list behaves identically rather
 * than similarly. Two drawers that opened at slightly different distances, or settled at different
 * speeds, would read as two mechanisms to learn.
 *
 * Only the gesture lives here. Markup and class names stay with each list, which is what lets them
 * keep their own look without agreeing on a stylesheet.
 */

/** Displacement below which a gesture stays a simple tap, in pixels. */
export const TAP_SLOP = 6;

/** Drawer width, and therefore the row's travel when it opens, in pixels. */
export const REVEAL = 84;

/**
 * Resistance offered to dragging a row that will not open.
 *
 * The row follows the finger at a third, then returns: it is not inert - which would suggest a
 * misread gesture - but neither does it promise an opening that will not come.
 */
const RUBBER = 0.3;

export interface SwipeOptions {
  readonly opened: boolean;
  readonly onOpenedChange: (opened: boolean) => void;
  /** `false` when the row has nothing to delete: it resists instead of opening. */
  readonly enabled: boolean;
  /** A press that went nowhere. On a row that cannot open, this is the only thing that fires. */
  readonly onTap: () => void;
  /** Lets a list keep part of its row for another gesture - a drag handle, typically. */
  readonly canStart?: (target: EventTarget | null) => boolean;
}

export interface SwipeToDelete {
  /** Horizontal displacement to apply, in pixels. Negative while the drawer shows. */
  readonly offset: number;
  /** `true` while a finger is on the row, when a transition would fight it. */
  readonly dragging: boolean;
  readonly handlers: {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
  };
}

export function useSwipeToDelete({
  opened,
  onOpenedChange,
  enabled,
  onTap,
  canStart,
}: SwipeOptions): SwipeToDelete {
  // The gesture in progress, or `null` when the press started somewhere this row does not own.
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<number | null>(null);

  function settle(): void {
    gesture.current = null;
    setDrag(null);
  }

  return {
    offset: drag ?? (opened ? -REVEAL : 0),
    dragging: drag !== null,
    handlers: {
      onPointerDown: (event) => {
        if (canStart !== undefined && !canStart(event.target)) {
          gesture.current = null;
          return;
        }
        gesture.current = { x: event.clientX, y: event.clientY };
        // Capture keeps the gesture on the row even if the finger leaves sideways. It fails for an
        // already-released pointer - a synthetic event, say - and that is no reason to abandon the
        // rest.
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /** tracking continues without capture */
        }
      },

      onPointerMove: (event) => {
        const start = gesture.current;
        if (start === null) return;
        const moved = event.clientX - start.x;
        if (Math.abs(moved) <= TAP_SLOP) return;
        const base = opened ? -REVEAL : 0;
        setDrag(
          enabled ? Math.max(-REVEAL, Math.min(0, base + moved)) : Math.min(0, moved * RUBBER),
        );
      },

      onPointerUp: (event) => {
        const start = gesture.current;
        if (start === null) return;
        const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        settle();

        if (!enabled) {
          onTap();
          return;
        }
        if (moved <= TAP_SLOP) {
          onTap();
          return;
        }
        // At half travel the row picks the edge it is nearest, so it never stays half open.
        onOpenedChange(event.clientX - start.x + (opened ? -REVEAL : 0) < -REVEAL / 2);
      },

      onPointerCancel: settle,
    },
  };
}
