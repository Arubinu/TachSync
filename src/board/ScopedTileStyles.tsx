import { useMemo } from 'react';
import type { BackgroundPreset, TilePreset } from './layout';

export interface ScopedTileStylesProps {
  readonly presets: readonly TilePreset[];
  readonly backgrounds: readonly BackgroundPreset[];
}

/**
 * Dressings imported with presets and backgrounds.
 *
 * CSS from a third-party file cannot be injected as-is: a rule as ordinary as `* { display: none }`
 * would erase the whole dashboard, with no recourse since the settings would go with it. Each block
 * is therefore confined to its own elements by an `@scope` rule, native and enforced by the engine
 * itself - where rewriting selectors by hand would be circumventable and fragile.
 *
 * Worth noting, and not covered by the confinement: a stylesheet can still request a remote image,
 * and so signal its opening to a server. That is harmless for personal offline use, but only import
 * files whose provenance is known.
 */
export function ScopedTileStyles({
  presets,
  backgrounds,
}: ScopedTileStylesProps): React.JSX.Element | null {
  const css = useMemo(() => {
    const blocks = [
      ...presets
        .filter((preset) => preset.css.trim() !== '')
        .map((preset) => scopeCss('data-preset', preset.id, preset.css)),
      ...backgrounds
        .filter((background) => background.css.trim() !== '')
        .map((background) => scopeCss('data-background', background.id, background.css)),
    ];
    return blocks.join('\n');
  }, [presets, backgrounds]);

  if (css === '') return null;
  return <style data-tile-styles>{css}</style>;
}

/**
 * Confines a block to the elements carrying a given anchor.
 *
 * The block's braces are not parsed: `@scope` delegates to the CSS engine, which will ignore a
 * malformed rule without the rest suffering.
 */
function scopeCss(attribute: string, id: string, css: string): string {
  return `@scope ([${attribute}="${cssEscape(id)}"]) {\n${css}\n}`;
}

/** Neutralises anything that could close the selector and escape it. */
function cssEscape(value: string): string {
  return value.replace(/["\\\]]/g, '');
}
