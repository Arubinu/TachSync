import { describe, expect, it } from 'vitest';
import { plot } from './TripChart';

/** How many strokes the path is made of: one `M` opens each. */
const strokes = (path: string): number => (path.match(/M/g) ?? []).length;

describe('drawing a channel', () => {
  const at = new Float32Array([0, 1, 2, 3, 4]);

  it('draws one unbroken stroke when every reading is there', () => {
    expect(strokes(plot(new Float32Array([0, 1, 2, 3, 4]), at, 0, 4))).toBe(1);
  });

  it('breaks rather than bridging a gap', () => {
    // The one thing a curve must never do: join two readings that never followed one another. A
    // bridged gap invents a straight climb the car never made.
    const withHole = new Float32Array([0, 1, Number.NaN, 3, 4]);

    expect(strokes(plot(withHole, at, 0, 4))).toBe(2);
  });

  it('draws nothing at all for a channel the car never answered on', () => {
    const absent = new Float32Array([Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN]);

    expect(plot(absent, at, 0, 1)).toBe('');
  });

  it('survives a channel that never moved, without dividing by nothing', () => {
    // A flat line is a real reading - idling at a light - and `high - low` is zero there.
    const flat = new Float32Array([50, 50, 50, 50, 50]);

    expect(plot(flat, at, 50, 50)).toContain('M');
    expect(plot(flat, at, 50, 50)).not.toContain('NaN');
  });
});
