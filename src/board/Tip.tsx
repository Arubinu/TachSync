import { useEffect } from 'react';

/**
 * The transient tooltip, the same everywhere.
 *
 * It answers a gesture: what was just done, or what cannot be done. It fades on its own, because an
 * answer has no reason to persist once received - which is what distinguishes it from a status
 * message.
 *
 * Extracted from the catalogue, where it originated, so the tile editor uses it identically. Two
 * bubbles of similar but different design would have been enough to make the reader hesitate.
 */
/**
 * How long an answer stays up, in milliseconds.
 *
 * Here rather than at each call site: three callers timing the same bubble differently would be
 * three bubbles as far as the reader is concerned. Long enough to read a sentence at a glance in a
 * moving car, short enough not to sit over the screen it is commenting on.
 */
export const TIP_MS = 3200;

export function Tip({
  main,
  aside,
}: {
  readonly main: string;
  /** Second line, quieter. Absent when the first says enough. */
  readonly aside?: string;
}): React.JSX.Element {
  // A short pulse on appearance, where the device allows it.
  //
  // In a car the eyes are elsewhere: a bubble appearing at the foot of the screen can go unnoticed
  // for its whole life. Fifteen milliseconds is enough to flag it - felt, but too brief to read as
  // an alarm.
  //
  // The call is optional by construction: neither desktop browsers nor iOS expose it, and its
  // absence must prevent nothing.
  useEffect(() => {
    navigator.vibrate?.(15);
  }, []);

  return (
    <p className="tip" role="status">
      {main}
      {aside !== undefined && <span className="tip__aside">{aside}</span>}
    </p>
  );
}
