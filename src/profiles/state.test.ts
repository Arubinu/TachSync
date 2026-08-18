import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../board/layout';
import { activeAppearance, applySettings, resolveSettings, type ProfileState } from './state';
import { FIRST_APPEARANCE, readProfileState, toProfileState } from './migrate';

/** Two people sharing one appearance, and two cars. */
function twoPeople(): ProfileState {
  const base = toProfileState(DEFAULT_SETTINGS);
  return {
    ...base,
    people: [
      ...base.people,
      { id: 'person-2', label: 'Alex', appearanceId: FIRST_APPEARANCE },
    ],
    vehicles: [
      ...base.vehicles,
      {
        id: 'vehicle-2',
        label: 'Clio',
        adapterId: 'bt-2',
        calibration: null,
        layouts: base.vehicles[0]!.layouts,
        ranges: base.vehicles[0]!.ranges,
      },
    ],
  };
}

describe('resolveSettings', () => {
  it('assembles flat settings from the active person and vehicle', () => {
    const state = toProfileState(DEFAULT_SETTINGS);
    expect(resolveSettings(state)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('applySettings', () => {
  it('writes taste into the appearance, not into the person', () => {
    const state = toProfileState(DEFAULT_SETTINGS);
    const next = applySettings(state, { ...resolveSettings(state), themeId: 'dial' });

    expect(activeAppearance(next).themeId).toBe('dial');
    expect(next.people).toBe(state.people);
  });

  it('writes the layout into the active vehicle, and it alone', () => {
    const state = twoPeople();
    const grid = { columns: 9, rows: 9, tiles: [] };
    const next = applySettings(state, {
      ...resolveSettings(state),
      layouts: { portrait: grid, landscape: grid },
    });

    expect(next.vehicles[0]!.layouts.portrait.columns).toBe(9);
    // The second car keeps its own: a layout belongs to the car it was composed for.
    expect(next.vehicles[1]!.layouts.portrait.columns).toBe(
      state.vehicles[1]!.layouts.portrait.columns,
    );
  });

  it('shares the appearance between the people pointing at it', () => {
    const state = twoPeople();
    const next = applySettings(state, { ...resolveSettings(state), light: true });

    // Both people point at the same appearance: fixing one serves the other. That
    // is the whole point of associating rather than copying.
    const vue = { ...next, personId: 'person-2' };
    expect(resolveSettings(vue).light).toBe(true);
  });

  it('files the library in common, outside the people', () => {
    const state = toProfileState(DEFAULT_SETTINGS);
    const next = applySettings(state, { ...resolveSettings(state), metricFilter: ['speed'] });

    expect(next.shared.metricFilter).toEqual(['speed']);
    expect(next.appearances).toBe(state.appearances);
  });

  it('touches nothing when nothing changes', () => {
    const state = toProfileState(DEFAULT_SETTINGS);
    expect(applySettings(state, resolveSettings(state))).toBe(state);
  });
});

describe('readProfileState', () => {
  it('rebuilds from flat settings when nothing has been stored', () => {
    const state = readProfileState(null, DEFAULT_SETTINGS);
    expect(resolveSettings(state)).toEqual(DEFAULT_SETTINGS);
  });

  it('reattaches a person whose appearance has vanished', () => {
    const base = toProfileState(DEFAULT_SETTINGS);
    const damaged = {
      ...base,
      people: [{ id: 'person-1', label: '', appearanceId: 'supprimee' }],
    };

    // Without this repair, resolution would yield `undefined` and the screen would
    // stay black over a dead reference.
    const state = readProfileState(damaged, DEFAULT_SETTINGS);
    expect(activeAppearance(state).id).toBe(FIRST_APPEARANCE);
  });

  it('falls back to migration when faced with unusable content', () => {
    expect(readProfileState({ people: 'oui' }, DEFAULT_SETTINGS).people).toHaveLength(1);
  });

  it('repairs an inherited layout where two tiles overlap', () => {
    // Layouts live inside the vehicle: they escape the flat-settings normaliser and
    // must therefore be re-read here.
    const base = toProfileState(DEFAULT_SETTINGS);
    const firstTile = base.vehicles[0]!.layouts.landscape.tiles[0]!;
    const twin = { ...firstTile, id: 'copy' };

    const damaged = {
      ...base,
      vehicles: [
        {
          ...base.vehicles[0]!,
          layouts: {
            ...base.vehicles[0]!.layouts,
            landscape: {
              ...base.vehicles[0]!.layouts.landscape,
              tiles: [firstTile, twin],
            },
          },
        },
      ],
    };

    const tiles = readProfileState(damaged, DEFAULT_SETTINGS).vehicles[0]!.layouts.landscape.tiles;
    const [a, b] = tiles;

    expect(tiles).toHaveLength(2);
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a!.colStart === b!.colStart && a!.rowStart === b!.rowStart).toBe(false);
  });
});
