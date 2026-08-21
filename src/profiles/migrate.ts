import { DEFAULT_SETTINGS, type AppSettings } from '../board/layout';
import type { ProfileState } from './state';
import { DEFAULT_RANGES } from './types';
import { normalizeVehicleLayouts } from './layouts';
import { DEFAULT_PERSON_ICON } from '../board/personIcons';

/** Ids of the entities created by the migration, so they can be found again. */
export const FIRST_PERSON = 'person-1';
export const FIRST_VEHICLE = 'vehicle-1';
export const FIRST_APPEARANCE = 'appearance-1';

/**
 * Lifts flat settings into the three-entity model.
 *
 * Used twice: on first launch, and for someone who used the application before profiles existed.
 * Both give the same result - one person, one vehicle, one appearance - because there is nothing to
 * guess.
 *
 * Names are left empty on purpose. Naming someone "Driver 1" creates a label nobody chose and
 * everybody keeps; left empty, the interface shows what it knows (the adapter name for the car, the
 * avatar for the person) until someone decides otherwise.
 */
export function toProfileState(settings: AppSettings): ProfileState {
  return {
    people: [
      { id: FIRST_PERSON, label: '', appearanceId: FIRST_APPEARANCE, icon: DEFAULT_PERSON_ICON },
    ],
    vehicles: [
      {
        id: FIRST_VEHICLE,
        label: '',
        adapterId: null,
        calibration: null,
        layouts: [{ id: 'grid-1', people: [FIRST_PERSON], ...settings.layouts }],
        ranges: DEFAULT_RANGES,
      },
    ],
    appearances: [
      {
        id: FIRST_APPEARANCE,
        label: '',
        themeId: settings.themeId,
        backgroundId: settings.backgroundId,
        avatarId: settings.avatarId,
        hiddenAvatarParts: settings.hiddenAvatarParts,
        fontScale: settings.fontScale,
        light: settings.light,
      },
    ],
    personId: FIRST_PERSON,
    vehicleId: FIRST_VEHICLE,
    shared: {
      presets: settings.presets,
      backgrounds: settings.backgrounds,
      metricFilter: settings.metricFilter,
      locked: settings.locked,
      editBarDock: settings.editBarDock,
      language: settings.language,
      termsAccepted: settings.termsAccepted,
      useTripHistory: settings.useTripHistory,
    },
  };
}

/**
 * Reads a profile state back, or rebuilds it from flat settings.
 *
 * The stored file may come from three ages: before profiles, after, or anything at all - a
 * truncated file, a key overwritten by another application. Nothing is trusted: any empty
 * collection or dead reference falls back to the migration, which produces a complete state by
 * construction.
 */
export function readProfileState(raw: unknown, settings: AppSettings): ProfileState {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<ProfileState>;

  const people = Array.isArray(source.people) ? source.people : [];
  const vehicles = Array.isArray(source.vehicles) ? source.vehicles : [];
  const appearances = Array.isArray(source.appearances) ? source.appearances : [];

  if (people.length === 0 || vehicles.length === 0 || appearances.length === 0) {
    return toProfileState(settings);
  }

  const person = people.find((item) => item.id === source.personId) ?? people[0]!;
  const vehicle = vehicles.find((item) => item.id === source.vehicleId) ?? vehicles[0]!;
  // A person whose appearance was deleted falls back to the first; otherwise resolution would yield
  // `undefined` and the screen would stay black.
  const orphan = !appearances.some((item) => item.id === person.appearanceId);

  // A vehicle saved before scales existed has none: give it the previous values so nothing moves on
  // screen.
  const repaired = vehicles.map((vehicle) => ({
    ...vehicle,
    ranges: { ...DEFAULT_RANGES, ...vehicle.ranges },
    // Absent on every vehicle saved before calibration existed. `null` is the honest value: never
    // run is not the same as run and found nothing.
    calibration: vehicle.calibration ?? null,
    // A vehicle saved before grids could be shared holds one pair for everybody; it becomes the
    // car's first grid, with the reader on it - which is exactly what they had.
    layouts: normalizeVehicleLayouts(vehicle.layouts, person.id),
  }));

  // Absent from every person saved before icons existed. They all start from the same face rather
  // than from none, which would leave the choice screen with empty buttons.
  const faced = people.map((item) => ({ ...item, icon: item.icon ?? DEFAULT_PERSON_ICON }));

  // Absent from every appearance saved before objects could be hidden. An empty map, not `null`:
  // the panel indexes it by avatar id on first render, and there is no avatar hiding anything yet.
  const dressed = appearances.map((item) => ({
    ...item,
    hiddenAvatarParts: item.hiddenAvatarParts ?? {},
  }));

  return {
    people: orphan
      ? faced.map((item) =>
          item.id === person.id ? { ...item, appearanceId: appearances[0]!.id } : item,
        )
      : faced,
    vehicles: repaired,
    appearances: dressed,
    personId: person.id,
    vehicleId: vehicle.id,
    shared: {
      presets: source.shared?.presets ?? settings.presets,
      backgrounds: source.shared?.backgrounds ?? settings.backgrounds,
      metricFilter: source.shared?.metricFilter ?? settings.metricFilter,
      locked: source.shared?.locked ?? DEFAULT_SETTINGS.locked,
      editBarDock: source.shared?.editBarDock ?? DEFAULT_SETTINGS.editBarDock,
      language: source.shared?.language ?? settings.language,
      // Only a literal `true` counts: a truncated or foreign file has not accepted anything.
      termsAccepted: source.shared?.termsAccepted === true,
      useTripHistory: source.shared?.useTripHistory === true,
    },
  };
}
