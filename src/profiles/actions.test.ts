import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../board/layout';
import { toProfileState } from './migrate';
import { activeAppearance, activePerson, activeVehicle, resolveSettings } from './state';
import {
  assignAppearance,
  deleteEntity,
  duplicateEntity,
  entityLabel,
  renameEntity,
  selectEntity,
} from './actions';

const base = toProfileState(DEFAULT_SETTINGS);

describe('duplicateEntity', () => {
  it('keeps the copy, without inventing a name for it', () => {
    const next = duplicateEntity(renameEntity(base, 'people', 'person-1', 'Alex'), 'people', 'person-1');

    expect(next.people).toHaveLength(2);
    expect(activePerson(next).id).toBe(next.people[1]!.id);
    // Neither "Alex (copy)" nor "Alex": a name nobody chose ends up sticking,
    // and two entities with the same name stop being distinguishable.
    expect(activePerson(next).label).toBe('');
  });

  it('has the copy of an appearance adopted by the person of the moment', () => {
    const next = duplicateEntity(base, 'appearances', 'appearance-1');

    expect(next.appearances).toHaveLength(2);
    expect(activeAppearance(next).id).toBe(next.appearances[1]!.id);
  });

  it('copies the layout along with the vehicle', () => {
    const next = duplicateEntity(base, 'vehicles', 'vehicle-1');

    expect(activeVehicle(next).layouts).toEqual(base.vehicles[0]!.layouts);
    // A copy, not a share: changing it afterwards must not touch the original.
    expect(activeVehicle(next).id).not.toBe('vehicle-1');
  });
});

describe('deleteEntity', () => {
  it('refuses to delete the last one', () => {
    expect(deleteEntity(base, 'people', 'person-1')).toBe(base);
    expect(deleteEntity(base, 'vehicles', 'vehicle-1')).toBe(base);
    expect(deleteEntity(base, 'appearances', 'appearance-1')).toBe(base);
  });

  it('falls back to the first remaining one when the active is deleted', () => {
    const twoLooks = duplicateEntity(base, 'people', 'person-1');
    const next = deleteEntity(twoLooks, 'people', twoLooks.personId);

    expect(next.people).toHaveLength(1);
    expect(activePerson(next).id).toBe('person-1');
  });

  it('reattaches the people that pointed at the deleted appearance', () => {
    const twoLooks = duplicateEntity(base, 'appearances', 'appearance-1');
    const next = deleteEntity(twoLooks, 'appearances', twoLooks.appearances[1]!.id);

    // Without this repair the person would point at nothing and the screen
    // would stay black.
    expect(activeAppearance(next).id).toBe('appearance-1');
    expect(resolveSettings(next)).toBeDefined();
  });
});

describe('assignAppearance', () => {
  it('shares instead of copying', () => {
    const twoLooks = duplicateEntity(base, 'appearances', 'appearance-1');
    const withPerson = duplicateEntity(twoLooks, 'people', 'person-1');
    const shared = assignAppearance(withPerson, 'person-1', twoLooks.appearances[1]!.id);

    // Both people now point at the same appearance: one entity, two references.
    expect(shared.people[0]!.appearanceId).toBe(shared.people[1]!.appearanceId);
    expect(shared.appearances).toHaveLength(2);
  });
});

describe('selectEntity', () => {
  it('changes the active vehicle without touching the rest', () => {
    const twoLooks = duplicateEntity(base, 'vehicles', 'vehicle-1');
    const next = selectEntity(twoLooks, 'vehicles', 'vehicle-1');

    expect(activeVehicle(next).id).toBe('vehicle-1');
    expect(next.people).toBe(twoLooks.people);
  });
});

describe('entityLabel', () => {
  it('counts when there is no name, and keeps quiet when there is one', () => {
    expect(entityLabel({ id: 'a', label: '' } as never, 2, 'Personne')).toBe('Personne 3');
    expect(entityLabel({ id: 'a', label: 'Alex' } as never, 2, 'Personne')).toBe('Alex');
    expect(entityLabel({ id: 'a', label: '   ' } as never, 0, 'Personne')).toBe('Personne 1');
  });
});
