import { describe, expect, it } from 'vitest';
import { THEMES } from './themes';
import { chromaGap, contrast, parseHex, simulate, type ColorVision } from './colorVision';

/**
 * No colour may be the only thing carrying a meaning.
 *
 * The interface never asks anyone to name a hue: the gauge encodes its value by fill length as well
 * as colour, the dial's red zone by its position at the end of the scale, and the three edge states
 * by three different shapes. Colour reinforces, it does not inform.
 *
 * These tests hold that line for the pairs that do carry meaning. A theme added later, or a token
 * nudged, cannot quietly turn a reinforcement into the only signal.
 */

const VISIONS: readonly ColorVision[] = ['protan', 'deutan', 'tritan'];

/** Far enough apart to read as two colours. */
const DISTINCT = 0.15;
/** Or, failing that, far enough apart in brightness. */
const READABLE = 1.6;

function separated(a: string, b: string, vision: ColorVision): { gap: number; ratio: number } {
  const sa = simulate(vision, parseHex(a));
  const sb = simulate(vision, parseHex(b));
  return { gap: chromaGap(sa, sb), ratio: contrast(sa, sb) };
}

describe('colour vision', () => {
  it.each(VISIONS)('keeps the danger colour apart from every accent, for %s', (vision) => {
    // The gauge warms from the theme accent towards danger. It is redundant with the fill length,
    // but a driver should not have to fall back on that to see a redline coming.
    //
    // Each theme is judged against its own danger colour: they differ from one theme to the next,
    // and a fixed red would test pairs that never meet on screen.
    for (const theme of THEMES) {
      const { gap, ratio } = separated(theme.colors.accent, theme.colors.danger, vision);
      const readable = gap >= DISTINCT || ratio >= READABLE;
      expect(readable, `${theme.id}: gap ${gap.toFixed(3)}, contrast ${ratio.toFixed(2)}:1`).toBe(
        true,
      );
    }
  });

  it.each(VISIONS)('keeps the three semantic colours apart, for %s', (vision) => {
    const pairs: readonly (readonly [string, string])[] = [
      ['#34d399', '#fb3b53'],
      ['#fbbf24', '#fb3b53'],
      ['#34d399', '#fbbf24'],
    ];

    for (const [a, b] of pairs) {
      const { gap, ratio } = separated(a, b, vision);
      expect(gap >= DISTINCT || ratio >= READABLE, `${a}/${b}: gap ${gap.toFixed(3)}`).toBe(true);
    }
  });

  // A theme's secondary accent is deliberately not checked. It only ever reaches the avatar
  // palette, where it tints a character: nothing reads it, so two hues collapsing into one costs
  // a dichromat nothing. Asserting it would have failed the halo theme for a decoration.

  it('simulation collapses what it should', () => {
    // A guard on the guard: if the matrices ever stopped simulating anything, every test above
    // would pass for the wrong reason.
    const red = parseHex('#ff0000');
    const green = parseHex('#00ff00');
    expect(chromaGap(simulate('deutan', red), simulate('deutan', green))).toBeLessThan(
      chromaGap(red, green),
    );
  });
});
