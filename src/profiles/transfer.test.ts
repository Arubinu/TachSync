import { describe, expect, it } from 'vitest';
import { buildTransferFile, readTransferFile, transferFileName, TRANSFER_EXTENSIONS } from './transfer';
import { addEntity } from './actions';
import { toProfileState } from './migrate';
import { DEFAULT_SETTINGS } from '../board/layout';
import { en } from '../i18n/en';
import type { Vehicle } from './types';

const base = toProfileState(DEFAULT_SETTINGS);
const vehicle = base.vehicles[0]!;
const person = base.people[0]!;

describe('entity transfer', () => {
  it('reads back exactly what it wrote', () => {
    const result = readTransferFile('vehicles', buildTransferFile('vehicles', vehicle), en);

    expect(result.error).toBeNull();
    expect(result.entity?.label).toBe(vehicle.label);
    expect((result.entity as Vehicle).layouts.landscape.tiles.length).toBe(
      vehicle.layouts.landscape.tiles.length,
    );
  });

  it('refuses a file meant for another list', () => {
    // A vehicle file is perfectly valid; it is only wrong on the person screen, and saying that
    // beats a parse error about a missing field.
    const result = readTransferFile('people', buildTransferFile('vehicles', vehicle), en);

    expect(result.entity).toBeNull();
    expect(result.error).toContain(en.transfer.kinds.people);
  });

  it('refuses a file from somewhere else entirely', () => {
    const result = readTransferFile('people', JSON.stringify({ label: 'Alex' }), en);

    expect(result.entity).toBeNull();
    expect(result.error).toBe(en.errors.notAnEntity);
  });

  it('refuses what is not JSON', () => {
    expect(readTransferFile('people', '{ not json', en).error).toBe(en.errors.invalidJson);
  });

  it('drops the adapter a vehicle was paired with', () => {
    // The pairing belongs to the machine it was made on. Carried in the file, an imported vehicle
    // would claim someone else's adapter and be recognised in its place.
    const paired = { ...vehicle, adapterId: 'bt-42' };

    const result = readTransferFile('vehicles', buildTransferFile('vehicles', paired), en);

    expect((result.entity as Vehicle).adapterId).toBeNull();
  });

  it('repairs a layout the file carried broken', () => {
    const broken = {
      ...vehicle,
      layouts: { landscape: { columns: 5000, rows: 0, tiles: [] }, portrait: vehicle.layouts.portrait },
    } as unknown as Vehicle;

    const result = readTransferFile('vehicles', buildTransferFile('vehicles', broken), en);

    expect((result.entity as Vehicle).layouts.landscape.columns).toBeLessThan(100);
  });

  it('gives each kind its own extension', () => {
    const all = Object.values(TRANSFER_EXTENSIONS);

    expect(new Set(all).size).toBe(all.length);
  });

  it('names the file after the entity', () => {
    expect(transferFileName('people', 'Alex Dupont')).toBe('alex-dupont.tachperson');
  });

  it('falls back to a name when the entity has none', () => {
    // Entities may be left unnamed - the list shows "Person 1" for them - and a file called
    // `.tachperson` with no stem is one the system refuses to save.
    expect(transferFileName('people', '   ')).toBe('export.tachperson');
  });
});

describe('adding an imported entity', () => {
  it('gives it a fresh id rather than the one from the file', () => {
    // Two installations number independently: keeping the id would overwrite whatever holds it.
    const next = addEntity(base, 'people', { ...person, id: person.id, label: 'Alex' });

    expect(next.people).toHaveLength(base.people.length + 1);
    expect(new Set(next.people.map((p) => p.id)).size).toBe(next.people.length);
  });

  it('selects what was just imported', () => {
    const next = addEntity(base, 'vehicles', { ...vehicle, label: 'Van' });

    expect(next.vehicles.find((v) => v.id === next.vehicleId)?.label).toBe('Van');
  });

  it('leaves the rest of the collection alone', () => {
    const next = addEntity(base, 'people', { ...person, label: 'Alex' });

    expect(next.people.slice(0, base.people.length)).toEqual(base.people);
  });
});
