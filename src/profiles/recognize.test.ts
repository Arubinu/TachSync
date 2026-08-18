import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../board/layout';
import { toProfileState } from './migrate';
import { recognizeVehicle } from './recognize';
import { activeVehicle } from './state';

const base = toProfileState(DEFAULT_SETTINGS);

describe('recognizeVehicle', () => {
  it('adopts the adapter along with the vehicle that had none', () => {
    const { state: next, introduced } = recognizeVehicle(base, 'bt-1', 'OBDII');

    expect(introduced).toBe(true);

    // Someone who has just installed the application already has a car: it was only
    // missing an id, which the migration could not guess.
    expect(next.vehicles).toHaveLength(1);
    expect(activeVehicle(next).adapterId).toBe('bt-1');
    expect(activeVehicle(next).label).toBe('OBDII');
  });

  it('recognises an adapter already seen without creating anything', () => {
    const first = recognizeVehicle(base, 'bt-1', 'OBDII').state;
    const other = recognizeVehicle(first, 'bt-2', 'Vgate').state;
    const { state: retour, introduced } = recognizeVehicle(other, 'bt-1', 'OBDII');

    // Meeting an acquaintance again is not an introduction: nothing should offer to
    // rename it.
    expect(introduced).toBe(false);

    expect(retour.vehicles).toHaveLength(2);
    expect(activeVehicle(retour).adapterId).toBe('bt-1');
  });

  it('creates a car for an unknown adapter', () => {
    const first = recognizeVehicle(base, 'bt-1', 'OBDII').state;
    const next = recognizeVehicle(first, 'bt-2', 'Vgate').state;

    expect(next.vehicles).toHaveLength(2);
    expect(activeVehicle(next).label).toBe('Vgate');
    // Fresh grid: reusing another's would place tiles composed for a dashboard that
    // is not its own.
    expect(activeVehicle(next).layouts).not.toBe(first.vehicles[0]!.layouts);
  });

  it('does not overwrite a name already chosen', () => {
    const named = {
      ...base,
      vehicles: [{ ...base.vehicles[0]!, label: 'La Clio' }],
    };

    expect(activeVehicle(recognizeVehicle(named, 'bt-1', 'OBDII').state).label).toBe('La Clio');
  });
});
