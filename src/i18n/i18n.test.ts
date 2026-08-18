import { describe, expect, it } from 'vitest';
import { CATALOGUES, LANGUAGES, detectLanguage, format, nextLanguage } from './index';
import { en } from './en';

/** Paths of every leaf in a catalogue, `connect.searching` and so on. */
function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

const referenceKeys = keys(en).sort();

describe('catalogues', () => {
  it.each(LANGUAGES)('“%s” covers exactly the same keys as English', (code) => {
    // The type already enforces this at compile time; this test checks it against the real
    // structure, including if an object were widened elsewhere.
    expect(keys(CATALOGUES[code]).sort()).toEqual(referenceKeys);
  });

  it.each(LANGUAGES)('“%s” leaves no empty string', (code) => {
    const empty = Object.entries(flatten(CATALOGUES[code]))
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);

    expect(empty).toEqual([]);
  });

  it.each(LANGUAGES)('“%s” keeps the substitution placeholders', (code) => {
    // A translation losing `{count}` would show a sentence stripped of its number, with nothing to
    // flag it.
    for (const [key, template] of Object.entries(flatten(en))) {
      const expected = [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      const actual = [...(flatten(CATALOGUES[code])[key] ?? '').matchAll(/\{(\w+)\}/g)]
        .map((m) => m[1])
        .sort();
      expect({ key, actual }).toEqual({ key, actual: expected });
    }
  });
});

function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  if (typeof value !== 'object' || value === null) return {};
  return Object.entries(value).reduce<Record<string, string>>(
    (acc, [key, child]) => ({ ...acc, ...flatten(child, prefix === '' ? key : `${prefix}.${key}`) }),
    {},
  );
}

describe('language choice', () => {
  it('keeps the first browser language it knows', () => {
    expect(detectLanguage(['sv', 'de-DE', 'en'])).toBe('de');
  });

  it('ignores the regional variant', () => {
    expect(detectLanguage(['fr-CA'])).toBe('fr');
  });

  it('falls back to English if nothing matches', () => {
    expect(detectLanguage(['sv', 'ja'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });

  it('tourne en boucle', () => {
    const last = LANGUAGES[LANGUAGES.length - 1]!;
    expect(nextLanguage(last)).toBe(LANGUAGES[0]);
    expect(nextLanguage('en')).toBe('fr');
  });
});

describe('substitution', () => {
  it('replaces the named placeholders', () => {
    expect(format('{count} avatar(s)', { count: 3 })).toBe('3 avatar(s)');
  });

  it('leaves untouched a placeholder with no value', () => {
    expect(format('{missing} ici', {})).toBe('{missing} ici');
  });
});
