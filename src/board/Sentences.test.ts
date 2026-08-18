import { describe, expect, it } from 'vitest';
import { sentences } from './Sentences';
import { CATALOGUES, LANGUAGES } from '../i18n';

describe('splitting into sentences', () => {
  it('separates two sentences', () => {
    expect(sentences('Only a vehicle fits here. Nothing is replaced.')).toEqual([
      'Only a vehicle fits here.',
      'Nothing is replaced.',
    ]);
  });

  it('leaves a single sentence whole', () => {
    expect(sentences('Nothing is replaced.')).toEqual(['Nothing is replaced.']);
  });

  it('does not split on a full stop with no space after it', () => {
    // A version number or a file name reads as one word, and cutting it would put half of it on
    // the next line.
    expect(sentences('Use ELM327 v1.5 here.')).toEqual(['Use ELM327 v1.5 here.']);
  });

  it('opens a line after a colon, which introduces a new thought', () => {
    expect(sentences('The browser shows the list itself: it does not inventory anything.')).toEqual([
      'The browser shows the list itself:',
      'it does not inventory anything.',
    ]);
  });

  it('keeps the space before a French colon with the clause it closes', () => {
    // French sets a space before the colon; it belongs to the left-hand side, not between boxes.
    expect(sentences('Le navigateur affiche la liste : il ne fait rien de plus.')[0]).toBe(
      'Le navigateur affiche la liste :',
    );
  });

  it('does not split a colon with no space after it', () => {
    expect(sentences('Ratio 3:2 stays whole.')).toEqual(['Ratio 3:2 stays whole.']);
  });

  it('splits on a question or an exclamation too', () => {
    expect(sentences('Which modes? Tick none if it has no selector.')).toHaveLength(2);
  });

  it('keeps the punctuation with the sentence it ends', () => {
    expect(sentences('One. Two.').every((part) => /[.!?]$/.test(part))).toBe(true);
  });

  it('yields nothing from an empty string', () => {
    expect(sentences('')).toEqual([]);
  });
});

/** Every leaf string of a catalogue, whatever its depth. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap(strings);
}

describe('the assumption the split rests on', () => {
  it.each(LANGUAGES)('“%s” has no full stop that fails to end a sentence', (code) => {
    /*
     * The splitter treats "full stop, space" as the end of a sentence. An abbreviation - "e.g. a
     * vehicle" - would be cut in half and rendered as two boxes.
     *
     * Rather than teach the splitter every abbreviation of seven languages, the catalogues are
     * held to the rule: a full stop followed by a lower-case letter is one, and this fails the day
     * someone writes one. Verified over every catalogue when the rule was introduced: none.
     */
    const suspect = strings(CATALOGUES[code]).filter((text) =>
      /\.\s+\p{Ll}/u.test(text),
    );

    expect(suspect).toEqual([]);
  });
});
