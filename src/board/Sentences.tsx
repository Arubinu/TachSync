import { Fragment } from 'react';

/**
 * A paragraph whose sentences never straddle a line break.
 *
 * Each sentence becomes an inline-block, which cannot be entered by the line breaker: it either
 * fits where it is or moves down whole. Only if a sentence is wider than the paragraph does it wrap
 * inside itself, as ordinary text.
 *
 * `text-wrap: balance` was measured first and rejected. It equalises line lengths without regard
 * for meaning - on the import notice it broke after "It", leaving a subject stranded at the end of
 * the line above. `pretty` changed nothing at all here: it only rescues an orphaned last word, and
 * there was none.
 *
 * Splitting on punctuation rather than on separate keys per sentence, because the alternative is a
 * key per clause in seven catalogues, and a language that prefers one sentence where English has
 * two would then have to leave one empty. The assumption - that a full stop followed by a space
 * ends a sentence - is pinned by a test over the catalogues.
 */

/**
 * Where a line may open: end-of-sentence punctuation, or a colon, each followed by space.
 *
 * The colon earns its place because a clause introduced by one is a new thought, and reads badly
 * starting at the tail of the line above - "the browser shows the list itself: it does not let a
 * page inventory your Bluetooth" is one sentence and two ideas.
 *
 * It is also the reason this is applied per screen rather than to every string. A colon often
 * introduces a value rather than a clause - "Limit: 64 MB", "Active layer: {layer}" - and breaking
 * there would strand the label. None of the paragraphs this component renders is of that kind.
 */
const BREAK = /(?<=[.!?…:])\s+/;

export function sentences(text: string): readonly string[] {
  return text.split(BREAK).filter((part) => part.trim() !== '');
}

export function Sentences({ text }: { readonly text: string }): React.JSX.Element {
  const parts = sentences(text);

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={`${index}-${part}`}>
          {/* The space belongs between the boxes, not inside one: a trailing space in an
              inline-block is kept and pushes the box off centre. */}
          {index > 0 && ' '}
          <span className="sentence">{part}</span>
        </Fragment>
      ))}
    </>
  );
}
