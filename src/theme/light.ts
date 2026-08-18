import type { ThemeManifest } from './themes';

/**
 * Light variant of a dark theme, derived so imported themes get one too.
 *
 * Not an inversion: inverting hues turns cyan into orange and the theme stops being recognisable.
 * Accent, secondary accent and danger colour are kept; only surfaces and text are rebuilt.
 *
 * A theme declaring itself light is returned as-is.
 */
export function lightenTheme(theme: ThemeManifest): ThemeManifest {
  if (theme.appearance === 'light') return theme;

  const { accent } = theme.colors;

  return {
    ...theme,
    appearance: 'light',
    // The background keeps the original theme's construction - top-to-bottom gradient, a stronger
    // tone at the foot of the screen - but in light.
    background: `
      radial-gradient(120% 90% at 50% -10%, ${mix(accent, 14, '#ffffff')} 0%, transparent 70%),
      linear-gradient(180deg, ${mix(accent, 6, '#f6f8fc')} 0%, ${mix(accent, 10, '#e6ebf4')} 100%)
    `,
    colors: {
      ...theme.colors,
      // Darkened on the way: an accent designed to glow on black has too little contrast on white,
      // and it is what carries the values.
      accent: mix(accent, 78, '#0b1220'),
      accentAlt: mix(theme.colors.accentAlt, 70, '#0b1220'),
      textPrimary: mix(accent, 18, '#101722'),
      textMuted: mix(accent, 14, 'rgba(38, 48, 66, 0.66)'),
      tileBackground: mix(accent, 7, 'rgba(255, 255, 255, 0.72)'),
      tileBorder: mix(accent, 26, 'rgba(15, 23, 42, 0.16)'),
    },
  };
}

/**
 * Mixed in oklab rather than sRGB.
 *
 * An sRGB mix passes through muddy greys as soon as the two hues are far apart; oklab follows
 * perception and keeps the steps alike. The values stay CSS strings so the browser computes, which
 * lets an imported theme declare its colours in whatever notation it likes.
 */
function mix(color: string, percent: number, base: string): string {
  return `color-mix(in oklab, ${color} ${percent}%, ${base})`;
}
