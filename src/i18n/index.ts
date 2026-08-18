import { createContext, useContext } from 'react';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { it } from './it';
import { nl } from './nl';
import { pt } from './pt';
import { LANGUAGES, type LanguageCode, type Translation } from './types';

export type { LanguageCode, Translation };
export { LANGUAGES };

/**
 * Catalogues, all loaded eagerly.
 *
 * Seven languages of short strings weigh a few kilobytes altogether — less than
 * the machinery needed to fetch them on demand, and without the blank frame a
 * lazy load would cause on the very first screen.
 */
export const CATALOGUES: Record<LanguageCode, Translation> = { en, fr, es, de, nl, it, pt };

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

/**
 * Best language for this browser.
 *
 * Only the primary subtag is examined: `fr-CA` and `fr-BE` both get French,
 * since regional variants would multiply the catalogues for differences this
 * application does not make.
 */
export function detectLanguage(preferred: readonly string[]): LanguageCode {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    const match = LANGUAGES.find((code) => code === base);
    if (match !== undefined) return match;
  }
  return DEFAULT_LANGUAGE;
}

/** Next language in the list, wrapping around. */
export function nextLanguage(current: LanguageCode): LanguageCode {
  const index = LANGUAGES.indexOf(current);
  return LANGUAGES[(index + 1) % LANGUAGES.length] ?? DEFAULT_LANGUAGE;
}

/**
 * Substitutes `{name}` placeholders.
 *
 * Deliberately minimal: no plural rules, no date formats. Counts appear as
 * `avatar(s)` in every catalogue, which reads plainly and spares seven sets of
 * plural rules for a handful of strings — Slavic languages would need three
 * forms each.
 */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = values[key];
    return value === undefined ? whole : String(value);
  });
}

/**
 * Current catalogue, provided by the application root.
 *
 * English by default so that a component rendered outside the provider — in a
 * test, typically — still produces readable text instead of crashing.
 */
export const TranslationContext = createContext<Translation>(en);

export function useTranslation(): Translation {
  return useContext(TranslationContext);
}
