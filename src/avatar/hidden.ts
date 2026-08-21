/**
 * The one rule the hiding tool enforces: an avatar keeps at least one visible object.
 *
 * Hiding everything is reversible - "show everything again" is one tap away - but it is a state
 * worth refusing all the same. An empty frame gives the eye nothing to aim at, so the tool that
 * caused it can no longer be used to undo it: what is not drawn cannot be picked. The refusal is
 * what keeps the mode able to correct itself.
 */

/**
 * Whether hiding one more object would leave nothing drawn.
 *
 * `false` when the engine reports no objects at all: an avatar that names nothing has nothing to
 * protect, and refusing every hide there would be a rule with no purpose.
 */
export function wouldEmptyAvatar(
  pickable: readonly string[],
  hidden: readonly string[],
  part: string,
): boolean {
  if (pickable.length === 0) return false;

  const gone = new Set([...hidden, part]);
  // Asked of what the engine reports, not of the stored set: a hidden id left over from another
  // avatar - or from a model since edited - must not count towards emptying this one.
  return pickable.every((id) => gone.has(id));
}
