import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Press-and-hold that arms a second action, with its progress.
 *
 * The gesture hides a rare action behind a common one: here, recording a session behind simply
 * connecting to an adapter. A short press connects, a held press connects AND records.
 *
 * The progress is not an ornament. Five seconds of pressing with no feedback reads as a failure:
 * the user lets go before the end and concludes the button is broken. It is what makes the gesture
 * discoverable, which is why it is returned rather than left to the caller.
 *
 * Releasing early triggers the short action: a finger leaving too soon must not cancel anything,
 * only fall back to the expected behaviour.
 */

export interface HoldToArm {
  /** 0 to 1 while pressed, 0 at rest. */
  readonly progress: number;
  readonly holding: boolean;
  readonly handlers: {
    readonly onPointerDown: () => void;
    readonly onPointerUp: () => void;
    readonly onPointerLeave: () => void;
    readonly onPointerCancel: () => void;
  };
}

export function useHoldToArm(
  onShort: () => void,
  onLong: () => void,
  durationMs = 5000,
): HoldToArm {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const frame = useRef<number | null>(null);
  const startedAt = useRef(0);
  // Stored rather than derived from `progress`: render state can lag a frame behind the release,
  // and the gesture would then fall on the wrong side at the exact boundary.
  const fired = useRef(false);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setProgress(0);
    setHolding(false);
  }, []);

  // A frame clock rather than a timer: it gives progress and deadline from one mechanism, with no
  // risk of the two disagreeing.
  const tick = useCallback(() => {
    const ratio = Math.min(1, (performance.now() - startedAt.current) / durationMs);
    setProgress(ratio);

    if (ratio >= 1) {
      fired.current = true;
      stop();
      onLong();
      return;
    }
    frame.current = requestAnimationFrame(tick);
  }, [durationMs, onLong, stop]);

  const onPointerDown = useCallback(() => {
    fired.current = false;
    startedAt.current = performance.now();
    setHolding(true);
    frame.current = requestAnimationFrame(tick);
  }, [tick]);

  const onPointerUp = useCallback(() => {
    const wasHolding = frame.current !== null;
    stop();
    if (wasHolding && !fired.current) onShort();
  }, [onShort, stop]);

  // A finger sliding off the target abandons without triggering anything: neither the short action,
  // which was not wanted, nor the long one, which was not held.
  const onPointerLeave = useCallback(() => stop(), [stop]);

  useEffect(() => stop, [stop]);

  return {
    progress,
    holding,
    handlers: {
      onPointerDown,
      onPointerUp,
      onPointerLeave,
      onPointerCancel: onPointerLeave,
    },
  };
}
