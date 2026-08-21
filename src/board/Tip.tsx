import { useCallback, useEffect, useState } from 'react';

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

export interface TipMessage {
  /** What to say, or `null` while there is nothing to answer. */
  readonly text: string | null;
  /**
   * Changes on every answer.
   *
   * Twice the same words is twice the same string, which React would leave mounted and motionless:
   * the second attempt would look unread. Used as the bubble's `key`, it makes a new one.
   */
  readonly id: number;
  /** Says something, or withdraws whatever stands. */
  readonly say: (text: string | null) => void;
}

/**
 * Holds what the bubble is saying, and takes it back on its own.
 *
 * The counter and the timer travel together because they answer the same question - how long this
 * answer lives, and when it counts as a new one. Written out at each call site they drifted: the
 * hint bubble sat forever until a refusal counter elsewhere was noticed to have a timer.
 */
export function useTipMessage(): TipMessage {
  const [text, setText] = useState<string | null>(null);
  const [id, setId] = useState(0);

  const say = useCallback((message: string | null): void => {
    setText(message);
    setId((count) => count + 1);
  }, []);

  useEffect(() => {
    if (text === null) return;
    const timer = window.setTimeout(() => setText(null), TIP_MS);
    return () => window.clearTimeout(timer);
  }, [text, id]);

  return { text, id, say };
}

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
