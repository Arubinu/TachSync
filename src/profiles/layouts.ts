import { normalizeLayouts } from '../board/layout';
import type { Vehicle, VehicleLayout } from './types';

/**
 * Which grid a driver gets in a given car.
 *
 * A car holds several, and a grid names the people who use it. Sharing is therefore the same
 * object, not two kept in step: one moves a tile and the other sees it move, because there is only
 * ever one grid between them.
 *
 * This is the appearance pattern applied to layouts - associate, never copy. A copy forks, and
 * fixing the original leaves the duplicate wrong.
 *
 * Membership is written out rather than inferred. Falling back to "the first grid holds whoever is
 * not listed" would have left the settings unable to say who shares what without walking every
 * person on every vehicle.
 */

/** The grid a person drives with, or the first one when they have not been placed. */
export function layoutFor(vehicle: Vehicle, personId: string): VehicleLayout {
  return vehicle.layouts.find((layout) => layout.people.includes(personId)) ?? vehicle.layouts[0]!;
}

/** Ids in use, so a new grid does not collide with one already there. */
function nextLayoutId(layouts: readonly VehicleLayout[]): string {
  const taken = new Set(layouts.map((layout) => layout.id));
  for (let i = 1; ; i += 1) {
    const id = `grid-${i}`;
    if (!taken.has(id)) return id;
  }
}

/**
 * Reads stored layouts back, whatever age they come from.
 *
 * Before this a vehicle held one `{ portrait, landscape }` pair for everybody. That pair becomes
 * the car's first grid, and the person reading it is put on it - which is exactly what they had.
 *
 * Every grid still goes through `normalizeLayouts`, as it did: they live inside the vehicle and so
 * escape the flat-settings normaliser. Without it an inherited overlap would outlive the rule meant
 * to forbid it.
 */
export function normalizeVehicleLayouts(raw: unknown, personId: string): readonly VehicleLayout[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return (raw as readonly Partial<VehicleLayout>[]).map((layout, index) => ({
      id: typeof layout.id === 'string' && layout.id !== '' ? layout.id : `grid-${index + 1}`,
      people: Array.isArray(layout.people) ? layout.people.filter((p) => typeof p === 'string') : [],
      ...normalizeLayouts({
        layouts: {
          // Spread rather than assigned: under `exactOptionalPropertyTypes` an absent orientation
          // has to be absent, not present and undefined.
          ...(layout.portrait === undefined ? {} : { portrait: layout.portrait }),
          ...(layout.landscape === undefined ? {} : { landscape: layout.landscape }),
        },
      }),
    }));
  }

  // The single pair every vehicle carried before, or nothing at all.
  return [
    {
      id: 'grid-1',
      people: [personId],
      ...normalizeLayouts({ layouts: raw as never }),
    },
  ];
}

/** Puts a person on a grid, taking them off whichever one they were on. */
export function joinLayout(vehicle: Vehicle, personId: string, layoutId: string): Vehicle {
  return {
    ...vehicle,
    layouts: vehicle.layouts.map((layout) => ({
      ...layout,
      people:
        layout.id === layoutId
          ? [...layout.people.filter((id) => id !== personId), personId]
          : layout.people.filter((id) => id !== personId),
    })),
  };
}

/**
 * Gives a person a grid of their own, copied from the one they were sharing.
 *
 * Copied rather than started empty: separating is wanting to diverge from what is there, not to
 * rebuild it. An empty grid would punish the choice.
 */
export function splitLayout(vehicle: Vehicle, personId: string): Vehicle {
  const current = layoutFor(vehicle, personId);
  // Alone on it already: there is nothing to separate from.
  if (current.people.length <= 1 && current.people.includes(personId)) return vehicle;

  const own: VehicleLayout = {
    id: nextLayoutId(vehicle.layouts),
    people: [personId],
    portrait: current.portrait,
    landscape: current.landscape,
  };

  return {
    ...vehicle,
    layouts: [
      ...vehicle.layouts.map((layout) => ({
        ...layout,
        people: layout.people.filter((id) => id !== personId),
      })),
      own,
    ],
  };
}

/** Drops a person from every grid, and any grid left with nobody on it. */
export function forgetPerson(vehicle: Vehicle, personId: string): Vehicle {
  const layouts = vehicle.layouts
    .map((layout) => ({ ...layout, people: layout.people.filter((id) => id !== personId) }))
    // The first grid stays whatever happens: a car with no grid has nothing to show.
    .filter((layout, index) => index === 0 || layout.people.length > 0);

  return { ...vehicle, layouts };
}

/**
 * The vehicle as a file should carry it: one grid, the exporter's own.
 *
 * A file holding three drivers' grids would be a profile dump wearing a vehicle's name, and the
 * names on it would mean nothing on the machine that reads it. The importer adopts the single grid
 * they are given.
 */
export function flattenForExport(vehicle: Vehicle, personId: string): Vehicle {
  const mine = layoutFor(vehicle, personId);
  return {
    ...vehicle,
    layouts: [{ id: 'grid-1', people: [], portrait: mine.portrait, landscape: mine.landscape }],
  };
}
