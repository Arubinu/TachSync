import type { AppSettings } from '../board/layout';
import type { Appearance, Person, Vehicle } from './types';

/**
 * The persisted state once profiles exist.
 *
 * One source of truth: the collections. The rest of the application still reads a flat
 * `AppSettings`, but that is no longer stored - it is computed from the active person and vehicle,
 * and every write is routed back to its owner. Keeping both would give two truths that diverge on
 * the first omission.
 */
export interface ProfileState {
  readonly people: readonly Person[];
  readonly vehicles: readonly Vehicle[];
  readonly appearances: readonly Appearance[];
  readonly personId: string;
  readonly vehicleId: string;
  /**
   * What belongs to neither a person nor a car.
   *
   * The imported library belongs to the installation: attached to a person, the same pack would
   * need importing once per driver. Language and lock are device state, not taste.
   */
  readonly shared: Pick<
    AppSettings,
    | 'presets'
    | 'backgrounds'
    | 'metricFilter'
    | 'locked'
    | 'editBarDock'
    | 'language'
    | 'termsAccepted'
    | 'useTripHistory'
  >;
}

/** Which entity owns each flat field. */
const OWNERS = {
  themeId: 'appearance',
  backgroundId: 'appearance',
  avatarId: 'appearance',
  fontScale: 'appearance',
  light: 'appearance',
  layouts: 'vehicle',
  presets: 'shared',
  backgrounds: 'shared',
  metricFilter: 'shared',
  locked: 'shared',
  editBarDock: 'shared',
  language: 'shared',
  // Shared: the terms are accepted by whoever installed the application, not by a driver or a car.
  termsAccepted: 'shared',
  // Shared: it describes how this installation reads its own history, not a taste.
  useTripHistory: 'shared',
} as const satisfies Record<keyof AppSettings, 'appearance' | 'vehicle' | 'shared'>;

export function activePerson(state: ProfileState): Person {
  return state.people.find((person) => person.id === state.personId) ?? state.people[0]!;
}

export function activeVehicle(state: ProfileState): Vehicle {
  return state.vehicles.find((vehicle) => vehicle.id === state.vehicleId) ?? state.vehicles[0]!;
}

export function activeAppearance(state: ProfileState): Appearance {
  const person = activePerson(state);
  return (
    state.appearances.find((appearance) => appearance.id === person.appearanceId) ??
    state.appearances[0]!
  );
}

/** The flat settings the rest of the application consumes. */
export function resolveSettings(state: ProfileState): AppSettings {
  const appearance = activeAppearance(state);
  const vehicle = activeVehicle(state);

  return {
    themeId: appearance.themeId,
    backgroundId: appearance.backgroundId,
    avatarId: appearance.avatarId,
    fontScale: appearance.fontScale,
    light: appearance.light,
    layouts: vehicle.layouts,
    ...state.shared,
  };
}

/**
 * Routes flat settings back to their owners.
 *
 * Only changed fields are rewritten. A write that copied everything would make two people sharing
 * an appearance diverge as soon as one of them changed theme.
 */
export function applySettings(state: ProfileState, next: AppSettings): ProfileState {
  const appearance = activeAppearance(state);
  const vehicle = activeVehicle(state);
  const current = resolveSettings(state);

  const changed = (Object.keys(OWNERS) as (keyof AppSettings)[]).filter(
    (key) => next[key] !== current[key],
  );
  if (changed.length === 0) return state;

  const touched = (owner: (typeof OWNERS)[keyof typeof OWNERS]): boolean =>
    changed.some((key) => OWNERS[key] === owner);

  return {
    ...state,
    appearances: touched('appearance')
      ? state.appearances.map((item) =>
          item.id === appearance.id
            ? {
                ...item,
                themeId: next.themeId,
                backgroundId: next.backgroundId,
                avatarId: next.avatarId,
                fontScale: next.fontScale,
                light: next.light,
              }
            : item,
        )
      : state.appearances,
    vehicles: touched('vehicle')
      ? state.vehicles.map((item) =>
          item.id === vehicle.id ? { ...item, layouts: next.layouts } : item,
        )
      : state.vehicles,
    shared: touched('shared')
      ? {
          presets: next.presets,
          backgrounds: next.backgrounds,
          metricFilter: next.metricFilter,
          locked: next.locked,
          editBarDock: next.editBarDock,
          language: next.language,
          termsAccepted: next.termsAccepted,
          useTripHistory: next.useTripHistory,
        }
      : state.shared,
  };
}
