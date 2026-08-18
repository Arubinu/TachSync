/**
 * Dial geometry.
 *
 * Separate from the component: this is mathematics, and it must be verifiable without mounting a
 * React tree or measuring a path on screen.
 *
 * SVG frame: angle zero points at three o'clock and grows clockwise, the vertical axis pointing
 * down. The dial's opening is therefore at the bottom, as on a rev counter: start bottom left, pass
 * through the top, finish bottom right.
 */

/** Dial centre within the hundred-unit square. */
export const CENTER = { x: 50, y: 50 };

/** Radius of the graduated arc. Everything else derives from it. */
export const RADIUS = 38;

/** Arc start, in degrees. */
export const START = 135;

/** Total sweep, in degrees. Two hundred and seventy leaves the bottom free. */
export const SWEEP = 270;

/** Arc length, for the dashed stroke that renders the fill. */
export const ARC_LENGTH = (2 * Math.PI * RADIUS * SWEEP) / 360;

/** Angle for a given fraction of the range, in degrees. */
export function angleAt(ratio: number): number {
  return START + SWEEP * clamp01(ratio);
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Point on the circle of a given radius, at a given fraction of the range. */
export function pointAt(ratio: number, radius: number): { x: number; y: number } {
  const radians = (angleAt(ratio) * Math.PI) / 180;
  return {
    x: CENTER.x + radius * Math.cos(radians),
    y: CENTER.y + radius * Math.sin(radians),
  };
}

/**
 * Arc path between two fractions of the range.
 *
 * The large-arc flag is derived from the sweep actually travelled: an arc of more than half a turn
 * is drawn differently, and hard-coding it would give a path that starts on the right side but
 * returns on the wrong one past a hundred and eighty degrees.
 */
export function arcPath(from: number, to: number, radius = RADIUS): string {
  const start = pointAt(from, radius);
  const end = pointAt(to, radius);
  const large = Math.abs(angleAt(to) - angleAt(from)) > 180 ? 1 : 0;
  return `M ${round(start.x)} ${round(start.y)} A ${radius} ${radius} 0 ${large} 1 ${round(end.x)} ${round(end.y)}`;
}

/** One graduation: a radial segment, from the outer radius inwards. */
export function tick(
  ratio: number,
  length: number,
  radius = RADIUS,
): { x1: number; y1: number; x2: number; y2: number } {
  const outer = pointAt(ratio, radius);
  const inner = pointAt(ratio, radius - length);
  return { x1: round(outer.x), y1: round(outer.y), x2: round(inner.x), y2: round(inner.y) };
}

/**
 * The fractions at which to place the graduations.
 *
 * Computed once: they depend only on the tick count, and recomputing them every frame would redo a
 * static drawing sixty times a second.
 */
export function ticks(count: number): number[] {
  return Array.from({ length: count + 1 }, (_, index) => index / count);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
