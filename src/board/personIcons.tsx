/**
 * The faces a driver can wear.
 *
 * Drawn in the same hand as the interface icons - one weight, no fill, rounded ends - so a person
 * chosen from this list still belongs to the dashboard rather than sitting on it.
 *
 * They are read at arm's length in a car, not at 24 px in a menu: the buttons that carry them are
 * large, which is what lets a beetle or a long-necked dinosaur survive as line work. Three of these
 * were drawn twice and one three times, because a closed outline tapering to a point reads as a
 * fish whatever it was meant to be.
 *
 * A table of shapes rather than twenty-four components: the picker has to walk the list, and the
 * only thing that differs between them is the geometry.
 */

/** The two paths every human shares: shoulders, and the narrower pair long hair sits over. */
const SHOULDERS = 'M4.9 20.4 C4.9 16.4 8.1 14.3 12 14.3 C15.9 14.3 19.1 16.4 19.1 20.4';
const NARROW = 'M6.6 20.6 C6.6 17.6 9 15.9 12 15.9 C15 15.9 17.4 17.6 17.4 20.6';

export const PERSON_ICON_GROUPS = ['human', 'animal', 'insect', 'dinosaur', 'monster'] as const;
export type PersonIconGroup = (typeof PERSON_ICON_GROUPS)[number];

export interface PersonIconEntry {
  readonly id: string;
  readonly group: PersonIconGroup;
}

/** Order of the list, and therefore of the picker. */
export const PERSON_ICONS: readonly PersonIconEntry[] = [
  { id: 'court', group: 'human' },
  { id: 'longs', group: 'human' },
  { id: 'dreads', group: 'human' },
  { id: 'barbe', group: 'human' },
  { id: 'casquette', group: 'human' },
  { id: 'chat', group: 'animal' },
  { id: 'chien', group: 'animal' },
  { id: 'renard', group: 'animal' },
  { id: 'lapin', group: 'animal' },
  { id: 'ours', group: 'animal' },
  { id: 'oiseau', group: 'animal' },
  { id: 'scarabee', group: 'insect' },
  { id: 'abeille', group: 'insect' },
  { id: 'papillon', group: 'insect' },
  { id: 'araignee', group: 'insect' },
  { id: 'longcou', group: 'dinosaur' },
  { id: 'triceratops', group: 'dinosaur' },
  { id: 'stegosaure', group: 'dinosaur' },
  { id: 'trex', group: 'dinosaur' },
  { id: 'cyclope', group: 'monster' },
  { id: 'fantome', group: 'monster' },
  { id: 'robot', group: 'monster' },
  { id: 'alien', group: 'monster' },
  { id: 'dragon', group: 'monster' },
  { id: 'crane', group: 'monster' },
];

/** What a person wears until they choose otherwise. */
export const DEFAULT_PERSON_ICON = 'court';

const SHAPES: Record<string, React.JSX.Element> = {
  court: (
    <>
      <circle cx="12" cy="8.4" r="3.5" />
      <path d={SHOULDERS} />
      <path d="M8.7 6.6 C9.6 4.9 14.4 4.9 15.3 6.6" />
    </>
  ),
  longs: (
    <>
      <path d="M6.1 16.6 C5.3 13.4 5.5 4.6 12 4.6 C18.5 4.6 18.7 13.4 17.9 16.6" />
      <circle cx="12" cy="9.4" r="3.2" />
      <path d={NARROW} />
    </>
  ),
  dreads: (
    <>
      <circle cx="12" cy="8.6" r="3.3" />
      <path d={NARROW} />
      <path d="M8.9 6.1 C6.4 7.4 5.4 10.6 5.6 14.6" />
      <path d="M15.1 6.1 C17.6 7.4 18.6 10.6 18.4 14.6" />
    </>
  ),
  barbe: (
    <>
      <circle cx="12" cy="8.4" r="3.5" />
      <path d={SHOULDERS} />
      <path d="M8.5 9.4 C8.5 13.4 9.8 14.8 12 14.8 C14.2 14.8 15.5 13.4 15.5 9.4" />
    </>
  ),
  casquette: (
    <>
      <circle cx="12" cy="9.2" r="3.4" />
      <path d={SHOULDERS} />
      <path d="M8.3 7.6 C8.3 5.2 15.7 5.2 15.7 7.6" />
      <path d="M15.7 7.6 H19.6" />
    </>
  ),
  chat: (
    <>
      <circle cx="12" cy="13.8" r="5.9" />
      <path d="M7.7 9.1 L6.5 4 L10.9 6.6" />
      <path d="M16.3 9.1 L17.5 4 L13.1 6.6" />
      <path d="M9.9 12.7 v1.3" />
      <path d="M14.1 12.7 v1.3" />
      <path d="M3.3 14.6 H6.2" />
      <path d="M17.8 14.6 H20.7" />
      <path d="M10.7 16.6 Q12 17.9 13.3 16.6" />
    </>
  ),
  chien: (
    <>
      <circle cx="12" cy="13.4" r="4.9" />
      <path d="M8.2 10 L4 11.8 L6.2 16.2" />
      <path d="M15.8 10 L20 11.8 L17.8 16.2" />
      <path d="M10.1 12.6 v1.1" />
      <path d="M13.9 12.6 v1.1" />
      <circle cx="12" cy="15.4" r=".9" />
      <path d="M10.6 17.4 Q12 18.6 13.4 17.4" />
    </>
  ),
  renard: (
    <>
      <path d="M12 20.4 L6.4 12.8 C5.6 11.7 5.9 10.4 7 10.1 L17 10.1 C18.1 10.4 18.4 11.7 17.6 12.8 Z" />
      <path d="M7 10.1 L5.6 4.6 L10.2 8" />
      <path d="M17 10.1 L18.4 4.6 L13.8 8" />
      <path d="M9.4 13 v1" />
      <path d="M14.6 13 v1" />
    </>
  ),
  lapin: (
    <>
      <circle cx="12" cy="15.2" r="4.5" />
      <path d="M10 11 C8.9 7.6 9.1 3.2 10.5 3.2 C11.9 3.2 11.7 7.8 11.1 10.8" />
      <path d="M14 11 C15.1 7.6 14.9 3.2 13.5 3.2 C12.1 3.2 12.3 7.8 12.9 10.8" />
      <path d="M10.3 14.4 v1" />
      <path d="M13.7 14.4 v1" />
      <circle cx="12" cy="16.8" r=".8" />
    </>
  ),
  ours: (
    <>
      <circle cx="12" cy="13.8" r="5.3" />
      <circle cx="7.5" cy="8.3" r="2.2" />
      <circle cx="16.5" cy="8.3" r="2.2" />
      <path d="M10.2 12.8 v1" />
      <path d="M13.8 12.8 v1" />
      <ellipse cx="12" cy="16.2" rx="2.6" ry="2" />
      <circle cx="12" cy="15.2" r=".8" />
    </>
  ),
  oiseau: (
    <>
      <ellipse cx="12" cy="14.6" rx="4.9" ry="5.4" />
      <circle cx="12" cy="7.8" r="3.3" />
      <path d="M10.9 9.2 L12 10.9 L13.1 9.2" />
      <circle cx="10.7" cy="7.2" r=".6" />
      <circle cx="13.3" cy="7.2" r=".6" />
      <path d="M7.4 12.6 C6 14.6 6.2 17.2 7.6 18.6" />
      <path d="M16.6 12.6 C18 14.6 17.8 17.2 16.4 18.6" />
      <path d="M10.3 19.9 V21.4" />
      <path d="M13.7 19.9 V21.4" />
    </>
  ),
  scarabee: (
    <>
      <ellipse cx="12" cy="13.4" rx="5.1" ry="6.5" />
      <path d="M12 7 V19.7" />
      <circle cx="12" cy="5.5" r="2" />
      <path d="M10.7 3.8 L9.2 2" />
      <path d="M13.3 3.8 L14.8 2" />
      <path d="M6.9 9.6 L3.6 7.9" />
      <path d="M6.9 13.4 H3.4" />
      <path d="M6.9 17.2 L3.6 18.9" />
      <path d="M17.1 9.6 L20.4 7.9" />
      <path d="M17.1 13.4 H20.6" />
      <path d="M17.1 17.2 L20.4 18.9" />
    </>
  ),
  abeille: (
    <>
      <ellipse cx="12" cy="14.6" rx="3.9" ry="5.3" />
      <path d="M8.4 13 H15.6" />
      <path d="M8.3 16.2 H15.7" />
      <circle cx="12" cy="7.4" r="2.1" />
      <path d="M10.8 5.8 L9.7 3.9" />
      <path d="M13.2 5.8 L14.3 3.9" />
      <path d="M8.7 10.8 C5.2 8.6 2.6 11.4 4.9 13.4" />
      <path d="M15.3 10.8 C18.8 8.6 21.4 11.4 19.1 13.4" />
    </>
  ),
  papillon: (
    <>
      <path d="M12 8.2 V18.6" />
      <path d="M11.3 9.6 C7.9 5.2 2.8 6.8 3.4 10.9 C3.9 14 8.1 13.6 11.3 12.4" />
      <path d="M11.3 13.4 C8.4 14.4 4.6 15.6 5.4 18.2 C6.1 20.4 10.2 19.4 11.3 16.6" />
      <path d="M12.7 9.6 C16.1 5.2 21.2 6.8 20.6 10.9 C20.1 14 15.9 13.6 12.7 12.4" />
      <path d="M12.7 13.4 C15.6 14.4 19.4 15.6 18.6 18.2 C17.9 20.4 13.8 19.4 12.7 16.6" />
      <path d="M11.4 7.8 L9.6 5.4" />
      <path d="M12.6 7.8 L14.4 5.4" />
    </>
  ),
  araignee: (
    <>
      <ellipse cx="12" cy="14.2" rx="3.3" ry="3.9" />
      <circle cx="12" cy="9.2" r="2" />
      <path d="M9 11.4 L4.6 8.4 L2.6 10.4" />
      <path d="M8.8 13.4 L3.6 12.6 L2 14.6" />
      <path d="M8.8 15.6 L3.8 16.8 L2.6 19" />
      <path d="M9.4 17.4 L6.4 20 L6.6 21.8" />
      <path d="M15 11.4 L19.4 8.4 L21.4 10.4" />
      <path d="M15.2 13.4 L20.4 12.6 L22 14.6" />
      <path d="M15.2 15.6 L20.2 16.8 L21.4 19" />
      <path d="M14.6 17.4 L17.6 20 L17.4 21.8" />
    </>
  ),
  longcou: (
    <>
      <circle cx="4.9" cy="5.4" r="2" />
      <path d="M5.8 7.2 C6.6 10.4 7.8 12.4 10 13.2 C13.4 14.5 15.7 15.6 16.6 17.2 C17.5 18.7 19.1 19.4 21.4 19.4" />
      <path d="M8.4 13.5 C8.4 16.6 10.4 18.5 13.2 18.5 C14.7 18.5 15.9 18 16.6 17.2" />
      <path d="M9.9 18.3 V21" />
      <path d="M13.9 18.4 V21" />
    </>
  ),
  triceratops: (
    <>
      <path d="M3.4 16.8 C3.4 9.2 7.2 5 12 5 C16.8 5 20.6 9.2 20.6 16.8" />
      <path d="M3.4 16.8 H20.6" />
      <path d="M8.2 12.6 C8.2 10.4 9.9 9 12 9 C14.1 9 15.8 10.4 15.8 12.6 C15.8 15.8 14.1 19.6 12 19.6 C9.9 19.6 8.2 15.8 8.2 12.6 Z" />
      <path d="M9.3 9.6 L7.6 4.2" />
      <path d="M14.7 9.6 L16.4 4.2" />
      <path d="M12 15.4 L12 12.8" />
      <circle cx="10.1" cy="12.4" r=".65" />
      <circle cx="13.9" cy="12.4" r=".65" />
    </>
  ),
  stegosaure: (
    <>
      <path d="M2.4 18.4 C2.4 15 5.8 12.6 10.4 12.6 C14 12.6 16.6 13.8 18.2 15.8 L21.8 18.8" />
      <path d="M4.6 18.4 C4.6 20 6 21 7.8 21" />
      <path d="M15 17.4 C15.4 19.4 16.8 20.6 18.4 20.6" />
      <path d="M6.4 13.4 L7.6 9.4 L9.4 12.8" />
      <path d="M10.2 12.6 L11.8 8.6 L13.4 12.9" />
      <path d="M14.2 13.6 L16 10.4 L16.9 14.2" />
      <circle cx="3.6" cy="16.4" r=".8" />
    </>
  ),
  /*
   * A theropod, in open lines.
   *
   * Four closed silhouettes were drawn before this - two pterosaurs and two tyrannosaurs - and
   * every one read as a fish. In this weight a closed outline that tapers to a point IS a fish,
   * whatever it was meant to be. The long-necked one above never had the problem because it was
   * never closed, which is the recipe borrowed here.
   */
  trex: (
    <>
      <path d="M21.6 9 L18.2 8.2 C16.2 6.6 13.4 7.4 12 9.6 C10.4 12 8.4 14.4 6.2 16 C4.6 17.2 3 17.8 1.6 18" />
      <path d="M21.6 10.8 L18 11 C16.6 11.2 15.6 11.8 15 12.8" />
      <path d="M13.4 11.4 C12.4 13.4 11.8 15.4 11.6 17.4" />
      <path d="M10.2 15.8 C10.2 18 11.4 19.8 13.4 20.6" />
      <path d="M13.6 16.2 C14 18.4 15.4 20 17.2 20.6" />
      <path d="M15 13.4 L16.6 14.8" />
      <circle cx="18.4" cy="9.6" r=".7" />
    </>
  ),
  cyclope: (
    <>
      <path d="M5.2 18.8 C5.2 12.6 8.2 8.8 12 8.8 C15.8 8.8 18.8 12.6 18.8 18.8 Z" />
      <path d="M8.6 9.4 C7 7.4 6.9 5.6 8.2 4.4" />
      <path d="M15.4 9.4 C17 7.4 17.1 5.6 15.8 4.4" />
      <circle cx="12" cy="13.2" r="2.4" />
      <path d="M9.4 17 l1.3 1.2 l1.3 -1.2 l1.3 1.2 l1.3 -1.2" />
      <path d="M7.6 18.8 V21" />
      <path d="M16.4 18.8 V21" />
    </>
  ),
  fantome: (
    <>
      <path d="M5.4 20.6 V12.2 C5.4 8.2 8.4 5.2 12 5.2 C15.6 5.2 18.6 8.2 18.6 12.2 V20.6 L16.4 18.4 L14.2 20.6 L12 18.4 L9.8 20.6 L7.6 18.4 Z" />
      <circle cx="9.8" cy="11.4" r=".95" />
      <circle cx="14.2" cy="11.4" r=".95" />
      <path d="M10.9 14.4 Q12 15.6 13.1 14.4" />
    </>
  ),
  robot: (
    <>
      <rect x="5.4" y="8.2" width="13.2" height="11" rx="2.6" />
      <path d="M12 8.2 V5" />
      <circle cx="12" cy="3.9" r="1.1" />
      <circle cx="9.3" cy="12.4" r="1.2" />
      <circle cx="14.7" cy="12.4" r="1.2" />
      <path d="M9 16 H15" />
      <path d="M11 16 V17.6" />
      <path d="M13 16 V17.6" />
    </>
  ),
  alien: (
    <>
      <path d="M12 4.4 C16.9 4.4 19.6 7.8 19.6 11.6 C19.6 16.4 15.7 20.6 12 20.6 C8.3 20.6 4.4 16.4 4.4 11.6 C4.4 7.8 7.1 4.4 12 4.4 Z" />
      <ellipse cx="9" cy="11.6" rx="2.4" ry="1.5" transform="rotate(-24 9 11.6)" />
      <ellipse cx="15" cy="11.6" rx="2.4" ry="1.5" transform="rotate(24 15 11.6)" />
      <path d="M10.6 16.8 H13.4" />
    </>
  ),
  dragon: (
    <>
      <path d="M6 11.6 C6 8.5 8.6 6.6 12 6.6 C15.4 6.6 18 8.5 18 11.6 C18 14.2 16.9 15.9 15.1 16.8 C14.5 18.8 13.4 20 12 20 C10.6 20 9.5 18.8 8.9 16.8 C7.1 15.9 6 14.2 6 11.6 Z" />
      <path d="M8.6 7.6 L6.2 3.4 L10.6 6" />
      <path d="M15.4 7.6 L17.8 3.4 L13.4 6" />
      <path d="M9.6 10.8 v1.6" />
      <path d="M14.4 10.8 v1.6" />
      <circle cx="11" cy="16.6" r=".5" />
      <circle cx="13" cy="16.6" r=".5" />
      <path d="M10.3 18.2 l.7 1.4" />
      <path d="M13.7 18.2 l-.7 1.4" />
    </>
  ),
  /*
   * The twenty-fifth, and the reason there is one: five columns want five full rows.
   *
   * A skull is the one shape in this set that shares nothing with the others - no ears, no snout,
   * no horns - so it costs nothing to tell apart at a glance.
   */
  crane: (
    <>
      <path d="M6 12.6 C6 8.4 8.6 5.4 12 5.4 C15.4 5.4 18 8.4 18 12.6 C18 14.8 17.2 16.4 15.9 17.4 L15.9 19.6 L8.1 19.6 L8.1 17.4 C6.8 16.4 6 14.8 6 12.6 Z" />
      <circle cx="9.6" cy="12.4" r="1.75" />
      <circle cx="14.4" cy="12.4" r="1.75" />
      <path d="M12 14.6 L10.9 16.6 L13.1 16.6 Z" />
      <path d="M8.1 17.4 H15.9" />
      <path d="M10.6 17.4 V19.6" />
      <path d="M13.4 17.4 V19.6" />
    </>
  ),
};

/**
 * Draws one.
 *
 * An unknown id falls back rather than drawing nothing: a stored icon from a later version, or a
 * hand-edited profile, must still leave a face on the button.
 */
export function PersonAvatar({ icon }: { readonly icon: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="face" aria-hidden focusable="false">
      {SHAPES[icon] ?? SHAPES[DEFAULT_PERSON_ICON]}
    </svg>
  );
}
