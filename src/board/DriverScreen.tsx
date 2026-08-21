import { useState } from 'react';
import { useTranslation } from '../i18n';
import { useHoldToArm } from '../hooks/useHoldToArm';
import { entityLabel } from '../profiles/actions';
import type { Person } from '../profiles/types';
import { ImportIcon, TrashIcon } from './icons';
import { PERSON_ICONS, PersonAvatar } from './personIcons';

/**
 * Who is driving.
 *
 * Between the adapter and the board, and only when more than one person exists: with a single
 * driver there is nothing to ask, and a screen that always answers itself is a screen in the way.
 *
 * The car's photograph is at the top because the question only makes sense about a particular car -
 * the grid and the history that follow both belong to it. It is also the only place the photograph
 * can be changed: it exists for this screen, so it is administered from this screen.
 *
 * Borrows the connect screen's ground, like the terms do, so the launch reads as one sequence
 * rather than three unrelated pages. The icon chooser is a page of the same sequence rather than a
 * window over it, for the same reason.
 */

/** Long enough not to fire while aiming, short enough not to feel stuck. */
const HOLD_MS = 550;

export interface DriverScreenProps {
  readonly people: readonly Person[];
  readonly vehicleLabel: string;
  /** The car's photograph, or `null`. */
  readonly photoUrl: string | null;
  readonly onPickPerson: (personId: string) => void;
  readonly onPickIcon: (personId: string, icon: string) => void;
  readonly onImportPhoto: (file: File) => void;
  readonly onRemovePhoto: () => void;
}

export function DriverScreen({
  people,
  vehicleLabel,
  photoUrl,
  onPickPerson,
  onPickIcon,
  onImportPhoto,
  onRemovePhoto,
}: DriverScreenProps): React.JSX.Element {
  const t = useTranslation();
  // Whose icon is being chosen, or `null` while nobody's is.
  const [dressing, setDressing] = useState<string | null>(null);

  if (dressing !== null) {
    return (
      <IconPage
        who={((): string => {
          const index = people.findIndex((person) => person.id === dressing);
          const person = people[index];
          return person === undefined ? '' : entityLabel(person, index, t.settings.person);
        })()}
        current={people.find((person) => person.id === dressing)?.icon ?? ''}
        onPick={(icon) => {
          onPickIcon(dressing, icon);
          setDressing(null);
        }}
      />
    );
  }

  return (
    <div className="connect driver">
      <PhotoZone
        url={photoUrl}
        label={vehicleLabel}
        onImport={onImportPhoto}
        onRemove={onRemovePhoto}
      />

      <div className="driver__body">
        <h1 className="driver__title">{t.driver.title}</h1>

        <ul className="driver__people">
          {people.map((person, index) => (
            <PersonButton
              key={person.id}
              label={entityLabel(person, index, t.settings.person)}
              icon={person.icon}
              onPick={() => onPickPerson(person.id)}
              onDress={() => setDressing(person.id)}
            />
          ))}
        </ul>

        {/* The gesture is not discoverable on its own, and nothing else on this screen says it. */}
        <p className="driver__hint">{t.driver.hold}</p>
      </div>
    </div>
  );
}

/**
 * The car, where the logo stands on the page before.
 *
 * Same measure and same place, so the sequence does not shift under the eye between one page and
 * the next.
 *
 * The frame is the control, as in the profile panels: a label wrapping a hidden input, so a tap
 * anywhere inside opens the picker and a drop lands on the same target. A photograph already there
 * still accepts one - dropping a better picture on the old one is the obvious way to replace it.
 */
function PhotoZone({
  url,
  label,
  onImport,
  onRemove,
}: {
  readonly url: string | null;
  readonly label: string;
  readonly onImport: (file: File) => void;
  readonly onRemove: () => void;
}): React.JSX.Element {
  const t = useTranslation();
  const [over, setOver] = useState(false);

  const classes = ['driver__frame', 'transfer__zone', over ? 'is-over' : '', url === null ? '' : 'is-filled']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="driver__car">
      <label
        className={classes}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const file = event.dataTransfer.files[0];
          if (file !== undefined) onImport(file);
        }}
      >
        {url === null ? (
          <>
            <ImportIcon />
            <span className="driver__invite">{t.driver.addPhoto}</span>
          </>
        ) : (
          <img className="driver__photo" src={url} alt="" />
        )}

        <input
          type="file"
          accept="image/*"
          className="visually-hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) onImport(file);
            // Reset, so the same file can be chosen again after a removal.
            event.target.value = '';
          }}
        />
      </label>

      {url !== null && (
        <button
          type="button"
          className="driver__drop"
          onClick={onRemove}
          aria-label={t.driver.removePhoto}
          title={t.driver.removePhoto}
        >
          <TrashIcon />
        </button>
      )}

      <p className="driver__vehicle">{label}</p>
    </div>
  );
}

/**
 * The faces, all of them, as one grid.
 *
 * No headings and no rows per family: the point is to find one at a glance, and a page broken into
 * five labelled bands is five things to read before looking.
 *
 * No confirm and no back. Choosing is the answer, and choosing the one already worn is how one
 * leaves without changing anything - a button that only ever means "never mind" is a button in the
 * way of the one that matters.
 */
function IconPage({
  who,
  current,
  onPick,
}: {
  readonly who: string;
  readonly current: string;
  readonly onPick: (icon: string) => void;
}): React.JSX.Element {
  const t = useTranslation();

  return (
    <div className="connect faces">
      <header className="faces__head">
        <h1 className="faces__title">{t.driver.chooseIcon}</h1>
        {/* Whose. Held on this page one no longer sees the name that was pressed to reach it. */}
        <p className="faces__who">{who}</p>
      </header>

      <ul className="faces__grid">
        {PERSON_ICONS.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              className={entry.id === current ? 'faces__pick is-selected' : 'faces__pick'}
              onClick={() => onPick(entry.id)}
            >
              <PersonAvatar icon={entry.id} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One driver.
 *
 * A short press answers the question, a held one dresses the answer. The rare action hides behind
 * the common one rather than beside it: a second control per person would double the targets on a
 * screen whose whole point is to be answered at a glance.
 */
function PersonButton({
  label,
  icon,
  onPick,
  onDress,
}: {
  readonly label: string;
  readonly icon: string;
  readonly onPick: () => void;
  readonly onDress: () => void;
}): React.JSX.Element {
  const { holding, handlers } = useHoldToArm(onPick, onDress, HOLD_MS);

  return (
    <li>
      <button
        type="button"
        className={holding ? 'driver__person is-holding' : 'driver__person'}
        {...handlers}
      >
        <span className="driver__face">
          <PersonAvatar icon={icon} />
        </span>
        <span className="driver__name">{label}</span>
      </button>
    </li>
  );
}
