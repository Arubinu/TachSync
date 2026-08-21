import { DEFAULT_LAYOUT, DEFAULT_PORTRAIT_LAYOUT } from '../board/layout';
import type { ProfileState } from './state';
import { DEFAULT_RANGES } from './types';

/**
 * Recognises the car from its adapter rather than asking for it.
 *
 * The id the browser assigns a Bluetooth device is stable across sessions for one origin, so it is
 * what says "that car" with nothing to type. A known adapter selects its vehicle; an unknown one
 * creates it.
 *
 * The name the adapter advertises is the starting label. It is not the car's name - "OBDII"
 * identifies nobody - but it beats an empty field mid-drive.
 *
 * The first vehicle without an adapter adopts this one instead of creating a second. That is the
 * case for someone who has just installed the application: their car already exists and was only
 * missing an id, which the migration could not guess.
 *
 * `introduced` says whether an introduction just happened, by creation or adoption. It is what
 * allows offering a name at that moment and only then - the rest of the time recognition must stay
 * silent, or it becomes the question it exists to avoid.
 */
export interface Recognition {
  readonly state: ProfileState;
  /** True when this adapter has just been attached to a car. */
  readonly introduced: boolean;
}

export function recognizeVehicle(
  state: ProfileState,
  adapterId: string,
  adapterName: string,
): Recognition {
  const known = state.vehicles.find((vehicle) => vehicle.adapterId === adapterId);
  if (known !== undefined) return { state: { ...state, vehicleId: known.id }, introduced: false };

  const orphan = state.vehicles.find((vehicle) => vehicle.adapterId === null);
  if (orphan !== undefined) {
    return {
      introduced: true,
      state: {
      ...state,
      vehicles: state.vehicles.map((vehicle) =>
        vehicle.id === orphan.id
          ? { ...vehicle, adapterId, label: vehicle.label === '' ? adapterName : vehicle.label }
          : vehicle,
      ),
      vehicleId: orphan.id,
      },
    };
  }

  const id = `vehicle-${state.vehicles.length + 1}`;
  return {
    introduced: true,
    state: {
    ...state,
    vehicles: [
      ...state.vehicles,
      {
        id,
        label: adapterName,
        adapterId,
        calibration: null,
        // A new car starts from a fresh grid: reusing another's would place tiles composed for a
        // dashboard that is not its own. Nobody is placed on it - the first grid is what a driver
        // gets until they are put somewhere else.
        layouts: [
          { id: 'grid-1', people: [], portrait: DEFAULT_PORTRAIT_LAYOUT, landscape: DEFAULT_LAYOUT },
        ],
        ranges: DEFAULT_RANGES,
      },
    ],
    vehicleId: id,
    },
  };
}
