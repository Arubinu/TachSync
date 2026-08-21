import { useState } from 'react';
import { format, useTranslation } from '../i18n';
import { joinLayout, layoutFor, splitLayout } from '../profiles/layouts';
import type { Vehicle } from '../profiles/types';
import { SelectField, type PickerRequest } from './Picker';
import { stepRange } from '../profiles/types';
import {
  assignAppearance,
  deleteEntity,
  duplicateEntity,
  entityLabel,
  renameEntity,
  selectEntity,
  type ProfileKind,
} from '../profiles/actions';
import { activeAppearance, activePerson, activeVehicle, type ProfileState } from '../profiles/state';

export interface ProfilesSectionProps {
  readonly kind: ProfileKind;
  readonly state: ProfileState;
  readonly onChange: (state: ProfileState) => void;
  /** Delegates displaying the list to the window, which shows it as one level. */
  readonly onOpenPicker: (request: PickerRequest) => void;
}

/**
 * Administration of one of the three collections.
 *
 * One view for all three: what distinguishes them fits in two lines here, and naming, choosing,
 * duplicating and deleting are identical.
 *
 * The order follows the question asked: which one - the list - then what to do with it.
 */
export function ProfilesSection({
  kind,
  state,
  onChange,
  onOpenPicker,
}: ProfilesSectionProps): React.JSX.Element {
  const t = useTranslation();

  // Widened view of the collection: the three entities share only an id and a name, and that is all
  // this view needs. Without it, a union of arrays would require every item to be all three at
  // once.
  const items: readonly { readonly id: string; readonly label: string }[] = state[kind];
  const current =
    kind === 'people'
      ? activePerson(state)
      : kind === 'vehicles'
        ? activeVehicle(state)
        : activeAppearance(state);

  const fallback =
    kind === 'people' ? t.settings.person : kind === 'vehicles' ? t.settings.vehicleProfile : t.settings.look;

  return (
    <div className="profiles">
      <ul className="picker">
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              className={item.id === current.id ? 'picker__item is-selected' : 'picker__item'}
              onClick={() => onChange(selectEntity(state, kind, item.id))}
            >
              <span>{entityLabel(item, index, fallback)}</span>
              {item.id === current.id && (
                <span className="picker__check" aria-hidden>
                  ✓
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {/*
        The foot gathers what acts on the entity chosen above: what it is associated with, how it
        is renamed, what becomes of it. An explicit group rather than a margin on the last element:
        there are two or three depending on the entity, and two automatic margins would share the
        space instead of pushing it up.
      */}
      <div className="profiles__footer">
        {/*
          An expanded list took a block's height for a choice made once and pushed the rest down.
          Collapsed, it says at a glance which appearance is selected - something checked far more
          often than changed.

          Association, and only association, distinguishes people from the other two: it is what
          lets two drivers share a look without copying it.
        */}
        {kind === 'people' && (
          <SelectField
            label={t.settings.look}
            value={activeAppearance(state).id}
            groups={[
              {
                label: '',
                options: state.appearances.map((appearance, index) => ({
                  value: appearance.id,
                  label: entityLabel(appearance, index, t.settings.look),
                })),
              },
            ]}
            onChange={(appearanceId) => onChange(assignAppearance(state, current.id, appearanceId))}
            onOpen={onOpenPicker}
          />
        )}

        {/*
          The two full-scale values, where the car they describe lives.

          They are mechanics, not taste: the same reason puts the layout here rather than in the
          appearance. A gauge set to two hundred km/h leaves the needle flat in a city car, and
          then measures nothing.
        */}
        {kind === 'vehicles' && (
          <div className="profiles__ranges">
            <RangeStepper
              label={t.settings.topSpeed}
              value={activeVehicle(state).ranges.speed}
              unit="km/h"
              onStep={(direction) => onChange(stepVehicleRange(state, 'speed', direction))}
            />
            <RangeStepper
              label={t.settings.redline}
              value={activeVehicle(state).ranges.redline}
              unit="tr/min"
              onStep={(direction) => onChange(stepVehicleRange(state, 'redline', direction))}
            />
          </div>
        )}

        {kind === 'vehicles' && <GridSharing state={state} onChange={onChange} />}

        {/*
          Renaming sits beside duplicating and deleting deliberately: all three act on the entity
          chosen just above and form the block of what can be done to it. At the top, the field
          preceded the list designating what it names - one read an input before knowing what it
          applied to.
        */}
        <label className="field">
          <span className="field__label">{t.settings.profileName}</span>
          <input
            type="text"
            className="field__input"
            value={current.label}
            // The placeholder carries the counted name, the one that would be replaced: an empty
            // field with no hint suggests the entity has no name at all, when it displays one
            // elsewhere.
            placeholder={entityLabel(
              current,
              items.findIndex((item) => item.id === current.id),
              fallback,
            )}
            onChange={(event) => onChange(renameEntity(state, kind, current.id, event.target.value))}
          />
        </label>

        <div className="board-actions">
          <button
            type="button"
            className="chip"
            onClick={() => onChange(duplicateEntity(state, kind, current.id))}
          >
            {t.settings.duplicate}
          </button>
          <button
            type="button"
            // Red, like removing an imported pack: it is the same gesture, and nothing would
            // justify flagging it here and not there.
            className="chip chip--danger"
            // The last one cannot be deleted: with no person or no vehicle there is no resolvable
            // state, and therefore no screen.
            disabled={items.length <= 1}
            onClick={() => onChange(deleteEntity(state, kind, current.id))}
          >
            {t.settings.delete}
          </button>
        </div>
      </div>
    </div>
  );
}

/** One step, in either direction. */
function RangeStepper({
  label,
  value,
  unit,
  onStep,
}: {
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly onStep: (direction: 1 | -1) => void;
}): React.JSX.Element {
  const t = useTranslation();

  return (
    <div className="grid-size__item">
      <span className="grid-size__label">{label}</span>
      <div className="scale">
        <button type="button" onClick={() => onStep(-1)} aria-label={t.editor.decrease}>
          −
        </button>
        <span className="scale__value">
          {value} {unit}
        </span>
        <button type="button" onClick={() => onStep(1)} aria-label={t.editor.increase}>
          +
        </button>
      </div>
    </div>
  );
}

/** Applies a step to the active vehicle's scale, and to it alone. */
function stepVehicleRange(
  state: ProfileState,
  key: 'speed' | 'redline',
  direction: 1 | -1,
): ProfileState {
  const vehicle = activeVehicle(state);
  return {
    ...state,
    vehicles: state.vehicles.map((item) =>
      item.id === vehicle.id ? { ...item, ranges: stepRange(item.ranges, key, direction) } : item,
    ),
  };
}

/**
 * Who drives this car with which grid.
 *
 * A row that unfolds, like a trip: the list is rarely wanted and would otherwise sit between the
 * gauge scales and the name field on every visit to the section.
 *
 * Sharing is joining a grid, not copying one. Two people on the same entry hold the same object, so
 * a tile moved by one has moved for the other - there is nothing to keep in step because nothing
 * was duplicated.
 */
function GridSharing({
  state,
  onChange,
}: {
  readonly state: ProfileState;
  readonly onChange: (next: ProfileState) => void;
}): React.JSX.Element {
  const t = useTranslation();
  const [open, setOpen] = useState(false);

  const vehicle = activeVehicle(state);
  const mine = layoutFor(vehicle, state.personId);

  /** A grid's drivers, named as the rest of the interface names them. */
  const drivers = (people: readonly string[]): string =>
    people
      .map((id) => {
        const index = state.people.findIndex((person) => person.id === id);
        const person = state.people[index];
        return person === undefined ? null : entityLabel(person, index, t.settings.person);
      })
      .filter((name): name is string => name !== null)
      .join(', ');

  const update = (next: Vehicle): void =>
    onChange({
      ...state,
      vehicles: state.vehicles.map((item) => (item.id === next.id ? next : item)),
    });

  return (
    <div className="grids">
      <button type="button" className="grids__toggle" onClick={() => setOpen(!open)}>
        <span>{t.settings.grids}</span>
        <span className="grids__count">
          {format(t.settings.gridCount, { count: vehicle.layouts.length })}
        </span>
      </button>

      {open && (
        <ul className="grids__list">
          {vehicle.layouts.map((layout) => {
            const ours = layout.id === mine.id;
            const named = drivers(layout.people);

            return (
              <li key={layout.id} className={ours ? 'grids__item is-mine' : 'grids__item'}>
                <span className="grids__who">{named === '' ? t.settings.gridEmpty : named}</span>

                {ours ? (
                  // Only worth offering while somebody else is on it: alone, there is nothing to
                  // separate from.
                  layout.people.length > 1 && (
                    <button
                      type="button"
                      className="chip"
                      onClick={() => update(splitLayout(vehicle, state.personId))}
                    >
                      {t.settings.splitGrid}
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="chip"
                    onClick={() => update(joinLayout(vehicle, state.personId, layout.id))}
                  >
                    {t.settings.joinGrid}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
