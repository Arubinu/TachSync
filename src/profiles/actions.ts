import type { ProfileState } from './state';
import type { Appearance, Person, Vehicle } from './types';

/**
 * Administration actions, kept out of any component.
 *
 * Create, rename, duplicate, delete across three collections would be twelve cases written one by
 * one. They are generic instead: what distinguishes them is not what they do to the lists but what
 * they must repair around them - a deletion leaves dead references, and that is where the only real
 * choices are.
 */

export type ProfileKind = 'people' | 'vehicles' | 'appearances';

type Entity = Person | Vehicle | Appearance;

/** Fresh id, readable in storage. */
function nextId(items: readonly Entity[], kind: ProfileKind): string {
  const prefix = kind === 'people' ? 'person' : kind === 'vehicles' ? 'vehicle' : 'appearance';
  const used = new Set(items.map((item) => item.id));
  for (let index = items.length + 1; ; index += 1) {
    const id = `${prefix}-${index}`;
    if (!used.has(id)) return id;
  }
}

export function renameEntity(
  state: ProfileState,
  kind: ProfileKind,
  id: string,
  label: string,
): ProfileState {
  return {
    ...state,
    [kind]: state[kind].map((item) => (item.id === id ? { ...item, label } : item)),
  } as ProfileState;
}

/**
 * Duplicates and selects the copy.
 *
 * Duplicating without switching to the copy would force choosing it immediately afterwards, and it
 * would be indistinguishable from the original without a name. The name is deliberately not
 * suffixed: "Alex (copy)" is a label nobody chose and everybody keeps. The copy starts unnamed,
 * like a new entity.
 */
export function duplicateEntity(state: ProfileState, kind: ProfileKind, id: string): ProfileState {
  const source = state[kind].find((item) => item.id === id);
  if (source === undefined) return state;

  const copy = { ...source, id: nextId(state[kind], kind), label: '' } as Entity;
  const next = { ...state, [kind]: [...state[kind], copy] } as ProfileState;

  if (kind === 'people') return { ...next, personId: copy.id };
  if (kind === 'vehicles') return { ...next, vehicleId: copy.id };
  // An appearance is not "active" by itself, so the current person adopts the copy; otherwise
  // nothing would happen on screen.
  return assignAppearance(next, next.personId, copy.id);
}

/**
 * Deletes and repairs references.
 *
 * The last of a kind cannot be deleted: an application with no person or no vehicle has no
 * resolvable state, which means a black screen rather than a message. Deleting the active one moves
 * to the first remaining; deleting an appearance reattaches whoever pointed at it to the first.
 */
export function deleteEntity(state: ProfileState, kind: ProfileKind, id: string): ProfileState {
  if (state[kind].length <= 1) return state;

  const remaining = state[kind].filter((item) => item.id !== id);
  const fallback = remaining[0]!;
  const next = { ...state, [kind]: remaining } as ProfileState;

  if (kind === 'people') {
    return state.personId === id ? { ...next, personId: fallback.id } : next;
  }
  if (kind === 'vehicles') {
    return state.vehicleId === id ? { ...next, vehicleId: fallback.id } : next;
  }

  return {
    ...next,
    people: next.people.map((person) =>
      person.appearanceId === id ? { ...person, appearanceId: fallback.id } : person,
    ),
  };
}

export function selectEntity(state: ProfileState, kind: ProfileKind, id: string): ProfileState {
  if (kind === 'people') return { ...state, personId: id };
  if (kind === 'vehicles') return { ...state, vehicleId: id };
  return assignAppearance(state, state.personId, id);
}

/** Associates an appearance with a person. This is sharing, not copying. */
export function assignAppearance(
  state: ProfileState,
  personId: string,
  appearanceId: string,
): ProfileState {
  return {
    ...state,
    people: state.people.map((person) =>
      person.id === personId ? { ...person, appearanceId } : person,
    ),
  };
}

/**
 * Display name when there is none.
 *
 * Entities are born unnamed on purpose - see the migration. The interface still needs to write
 * something: it counts, which distinguishes without pretending to name. An empty name stays empty
 * in storage, so naming later overwrites nothing.
 */
export function entityLabel(
  entity: { readonly label: string },
  index: number,
  fallback: string,
): string {
  return entity.label.trim() === '' ? `${fallback} ${index + 1}` : entity.label;
}

/**
 * Adds an entity that came from a file.
 *
 * A fresh id, always: the file carries the id it had where it was written, and two installations
 * number their entities independently - keeping it would overwrite whatever already holds it.
 *
 * Selected once added, like a duplicate. Importing something and having to go and find it in the
 * list would make the file feel like it had not arrived.
 */
export function addEntity(state: ProfileState, kind: ProfileKind, entity: Entity): ProfileState {
  const added = { ...entity, id: nextId(state[kind], kind) } as Entity;
  const next = { ...state, [kind]: [...state[kind], added] } as ProfileState;

  if (kind === 'people') return { ...next, personId: added.id };
  if (kind === 'vehicles') return { ...next, vehicleId: added.id };
  return assignAppearance(next, next.personId, added.id);
}
