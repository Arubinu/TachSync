import { describe, expect, it } from 'vitest';
import { lightenTheme } from './light';
import { DAYLIGHT, NEON_MIAMI } from './themes';

describe('lightenTheme', () => {
  it('keeps what makes the identity of the theme', () => {
    const lightened = lightenTheme(NEON_MIAMI);

    // Danger stays danger: its colour carries meaning, not taste.
    expect(lightened.colors.danger).toBe(NEON_MIAMI.colors.danger);
    expect(lightened.id).toBe(NEON_MIAMI.id);
    expect(lightened.tile).toEqual(NEON_MIAMI.tile);
  });

  it('darkens the accent instead of keeping it as is', () => {
    const lightened = lightenTheme(NEON_MIAMI);

    // An accent designed to glow on black has no contrast left on white: it is
    // mixed towards the dark without changing hue.
    expect(lightened.colors.accent).not.toBe(NEON_MIAMI.colors.accent);
    expect(lightened.colors.accent).toContain(NEON_MIAMI.colors.accent);
    expect(lightened.colors.accent).toContain('oklab');
  });

  it('leaves untouched a theme already declaring itself light', () => {
    // Daylight has its own idea of light: a general rule adds nothing and would
    // only wash it out.
    expect(lightenTheme(DAYLIGHT)).toBe(DAYLIGHT);
  });

  it('marks the result as light, so it does not derive twice', () => {
    const once = lightenTheme(NEON_MIAMI);
    const twice = lightenTheme(once);

    expect(once.appearance).toBe('light');
    expect(twice).toBe(once);
  });
});
