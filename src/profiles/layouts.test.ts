import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, DEFAULT_PORTRAIT_LAYOUT, DEFAULT_SETTINGS } from '../board/layout';
import {
  flattenForExport,
  forgetPerson,
  joinLayout,
  layoutFor,
  normalizeVehicleLayouts,
  splitLayout,
} from './layouts';
import { applySettings, resolveSettings, type ProfileState } from './state';
import { toProfileState } from './migrate';
import { DEFAULT_RANGES, type Vehicle } from './types';

function grid(id: string, people: readonly string[], columns: number) {
  return {
    id,
    people,
    portrait: { ...DEFAULT_PORTRAIT_LAYOUT, columns },
    landscape: { ...DEFAULT_LAYOUT, columns },
  };
}

const car: Vehicle = {
  id: 'v1',
  label: 'Van',
  adapterId: null,
  ranges: DEFAULT_RANGES,
  calibration: null,
  layouts: [grid('grid-1', ['alex', 'sam'], 4), grid('grid-2', ['max'], 9)],
};

describe('which grid a driver gets', () => {
  it('gives each person the grid they are on', () => {
    expect(layoutFor(car, 'alex').id).toBe('grid-1');
    expect(layoutFor(car, 'max').id).toBe('grid-2');
  });

  it('hands the same object to people who share one', () => {
    // The whole point: not two grids kept in step, one grid. Anything else would need syncing, and
    // syncing is what drifts.
    expect(layoutFor(car, 'alex')).toBe(layoutFor(car, 'sam'));
  });

  it('falls back to the first for someone never placed', () => {
    // A person created after the car was: they have to land somewhere rather than see no board.
    expect(layoutFor(car, 'newcomer').id).toBe('grid-1');
  });
});

describe('changing who shares what', () => {
  it('moves a person, and takes them off the grid they left', () => {
    const moved = joinLayout(car, 'max', 'grid-1');

    expect(layoutFor(moved, 'max').id).toBe('grid-1');
    expect(moved.layouts.find((l) => l.id === 'grid-2')?.people).toEqual([]);
  });

  it('never lists a person twice', () => {
    const again = joinLayout(car, 'alex', 'grid-1');

    expect(again.layouts[0]?.people.filter((id) => id === 'alex')).toHaveLength(1);
  });

  it('separates a shared grid by copying it, not by emptying it', () => {
    // Separating is wanting to diverge from what is there, not to rebuild it from nothing.
    const split = splitLayout(car, 'sam');

    expect(layoutFor(split, 'sam').id).not.toBe('grid-1');
    expect(layoutFor(split, 'sam').portrait.columns).toBe(4);
    expect(layoutFor(split, 'alex').id).toBe('grid-1');
  });

  it('does nothing for someone already alone on their grid', () => {
    expect(splitLayout(car, 'max')).toBe(car);
  });

  it('drops a deleted person, and the grid left empty behind them', () => {
    const gone = forgetPerson(car, 'max');

    expect(gone.layouts).toHaveLength(1);
  });

  it('keeps the first grid even when nobody is left on it', () => {
    // A car with no grid has nothing to show.
    const empty = forgetPerson(forgetPerson(car, 'alex'), 'sam');

    expect(empty.layouts.length).toBeGreaterThanOrEqual(1);
  });
});

describe('reading stored grids back', () => {
  it('turns the single pair every car used to hold into its first grid', () => {
    const old = { portrait: DEFAULT_PORTRAIT_LAYOUT, landscape: { ...DEFAULT_LAYOUT, columns: 7 } };
    const read = normalizeVehicleLayouts(old, 'alex');

    expect(read).toHaveLength(1);
    expect(read[0]?.people).toEqual(['alex']);
    expect(read[0]?.landscape.columns).toBe(7);
  });

  it('repairs a grid that was stored broken', () => {
    const broken = [{ id: 'grid-1', people: ['alex'], landscape: { columns: 5000, rows: 0, tiles: [] } }];

    expect(normalizeVehicleLayouts(broken, 'alex')[0]!.landscape.columns).toBeLessThan(100);
  });

  it('gives a car with nothing stored a grid all the same', () => {
    expect(normalizeVehicleLayouts(undefined, 'alex')).toHaveLength(1);
  });
});

describe('a vehicle leaving as a file', () => {
  it('carries one grid, the exporter own', () => {
    const file = flattenForExport(car, 'max');

    expect(file.layouts).toHaveLength(1);
    expect(file.layouts[0]?.portrait.columns).toBe(9);
  });

  it('carries no names: they mean nothing on the machine that reads it', () => {
    expect(flattenForExport(car, 'max').layouts[0]?.people).toEqual([]);
  });
});

describe('the flat settings a shared grid produces', () => {
  /** Two people on one car, sharing its only grid. */
  function shared(): ProfileState {
    const base = toProfileState(DEFAULT_SETTINGS);
    const other = { ...base.people[0]!, id: 'p2', label: 'Sam' };
    return {
      ...base,
      people: [...base.people, other],
      vehicles: base.vehicles.map((v) => ({
        ...v,
        layouts: v.layouts.map((l) => ({ ...l, people: [...l.people, 'p2'] })),
      })),
    };
  }

  it('shows one driver what the other changed', () => {
    const state = shared();
    const wider = applySettings(state, {
      ...resolveSettings(state),
      layouts: {
        ...resolveSettings(state).layouts,
        landscape: { ...resolveSettings(state).layouts.landscape, columns: 11 },
      },
    });

    // Read as the other person: the same grid, because there is only one.
    const asOther = resolveSettings({ ...wider, personId: 'p2' });

    expect(asOther.layouts.landscape.columns).toBe(11);
  });

  it('leaves the grid alone when nothing about it changed', () => {
    // `resolveSettings` builds a fresh wrapper each call; comparing it by identity would rewrite
    // the vehicle on every save and defeat the sharing guard entirely.
    const state = shared();

    expect(applySettings(state, resolveSettings(state))).toBe(state);
  });
});
