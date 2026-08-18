import { describe, expect, it } from 'vitest';
import { angleAt, arcPath, CENTER, pointAt, RADIUS, START, SWEEP, tick, ticks } from './dialGeometry';

describe('dial geometry', () => {
  it('opens at the bottom and turns through the top', () => {
    // Starts bottom left, half way at the top, ends bottom right.
    const start = pointAt(0, RADIUS);
    const middle = pointAt(0.5, RADIUS);
    const end = pointAt(1, RADIUS);

    expect(start.x).toBeLessThan(CENTER.x);
    expect(start.y).toBeGreaterThan(CENTER.y);

    expect(middle.x).toBeCloseTo(CENTER.x, 6);
    expect(middle.y).toBeCloseTo(CENTER.y - RADIUS, 6);

    expect(end.x).toBeGreaterThan(CENTER.x);
    expect(end.y).toBeGreaterThan(CENTER.y);
  });

  it('clamps out-of-range fractions', () => {
    expect(angleAt(-1)).toBe(START);
    expect(angleAt(2)).toBe(START + SWEEP);
  });

  it('raises the large-arc flag past the half turn', () => {
    // Two thirds of the range is a hundred and eighty degrees: past that the arc
    // must take the long way, or it comes back round the other side.
    expect(arcPath(0, 0.6)).toMatch(/ 0 1 /);
    expect(arcPath(0, 0.7)).toMatch(/ 1 1 /);
    expect(arcPath(0, 1)).toMatch(/ 1 1 /);
  });

  it('draws the graduations pointing at the centre', () => {
    const tickMark = tick(0.5, 8);

    // At the top the graduation is vertical and points down towards the centre.
    expect(tickMark.x1).toBeCloseTo(tickMark.x2, 1);
    expect(tickMark.y2).toBeGreaterThan(tickMark.y1);
    expect(tickMark.y2 - tickMark.y1).toBeCloseTo(8, 1);
  });

  it('counts one notch more than intervals', () => {
    // Eight intervals make nine strokes, both ends included.
    expect(ticks(8)).toHaveLength(9);
    expect(ticks(8)[0]).toBe(0);
    expect(ticks(8).at(-1)).toBe(1);
  });
});
