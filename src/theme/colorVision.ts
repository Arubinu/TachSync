/**
 * Colour vision: simulating the three dichromacies, to check what survives them.
 *
 * Not a display mode. A global daltonisation filter was built and measured against this palette,
 * and it degraded more pairs than it helped - the accents are already separated by brightness far
 * more than by hue, and redistributing chrominance only pushes colours out of gamut, where
 * clipping takes back whatever was gained.
 *
 * What matters instead is that no colour ever carries meaning alone. These functions exist so that
 * property can be asserted rather than assumed: see `colorVision.test.ts`.
 */

export type ColorVision = 'protan' | 'deutan' | 'tritan';

export type Rgb = readonly [number, number, number];

/**
 * Dichromacy simulation in sRGB.
 *
 * The usual approximations: enough to tell whether two colours collapse into one, which is the only
 * question asked here.
 */
const SIMULATION: Record<ColorVision, readonly Rgb[]> = {
  protan: [
    [0.567, 0.433, 0.0],
    [0.558, 0.442, 0.0],
    [0.0, 0.242, 0.758],
  ],
  deutan: [
    [0.625, 0.375, 0.0],
    [0.7, 0.3, 0.0],
    [0.0, 0.3, 0.7],
  ],
  tritan: [
    [0.95, 0.05, 0.0],
    [0.0, 0.433, 0.567],
    [0.0, 0.475, 0.525],
  ],
};

/** `#rrggbb` to channels in 0..1. */
export function parseHex(hex: string): Rgb {
  const raw = hex.replace('#', '');
  const at = (i: number): number => Number.parseInt(raw.slice(i, i + 2), 16) / 255;
  return [at(0), at(2), at(4)];
}

/** The colour as that type of dichromat sees it. */
export function simulate(vision: ColorVision, colour: Rgb): Rgb {
  const m = SIMULATION[vision];
  const channel = (row: Rgb): number =>
    Math.min(1, Math.max(0, row[0] * colour[0] + row[1] * colour[1] + row[2] * colour[2]));
  return [channel(m[0]!), channel(m[1]!), channel(m[2]!)];
}

function toLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance, as WCAG defines it. */
export function luminance(colour: Rgb): number {
  const [r, g, b] = colour;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio between two colours. */
export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** How far apart two colours sit in sRGB. Crude, but it answers "same or not". */
export function chromaGap(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
