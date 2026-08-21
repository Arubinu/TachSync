import { describe, expect, it } from 'vitest';
import { buildTransferFile, readTransferFile, transferFileName, TRANSFER_EXTENSIONS } from './transfer';
import { addEntity } from './actions';
import { createArchive } from '../board/archive';
import { toProfileState } from './migrate';
import { DEFAULT_SETTINGS } from '../board/layout';
import { en } from '../i18n/en';
import type { Vehicle } from './types';

const base = toProfileState(DEFAULT_SETTINGS);
const vehicle = base.vehicles[0]!;
const person = base.people[0]!;

/** A file as the picker hands it over. */
const asFile = (blob: Blob): File => new File([blob], 'entity.tachvehicle');

describe('entity transfer', () => {
  it('reads back exactly what it wrote', async () => {
    const result = await readTransferFile(
      'vehicles',
      asFile(await buildTransferFile('vehicles', vehicle)),
      en,
    );

    expect(result.error).toBeNull();
    expect(result.entity?.label).toBe(vehicle.label);
    expect((result.entity as Vehicle).layouts[0]!.landscape.tiles.length).toBe(
      vehicle.layouts[0]!.landscape.tiles.length,
    );
  });

  it('refuses a file meant for another list', async () => {
    // A vehicle file is perfectly valid; it is only wrong on the person screen, and saying that
    // beats a parse error about a missing field.
    const result = await readTransferFile(
      'people',
      asFile(await buildTransferFile('vehicles', vehicle)),
      en,
    );

    expect(result.entity).toBeNull();
    expect(result.error).toContain(en.transfer.kinds.people);
  });

  it('refuses a file from somewhere else entirely', async () => {
    const result = await readTransferFile('people', new Blob([JSON.stringify({ label: 'Alex' })]), en);

    expect(result.entity).toBeNull();
    expect(result.error).toBe(en.errors.notAnEntity);
  });

  it('refuses what is neither an archive nor JSON', async () => {
    expect((await readTransferFile('people', new Blob(['{ not json']), en)).error).toBe(
      en.errors.invalidJson,
    );
  });

  it('drops the adapter a vehicle was paired with', async () => {
    // The pairing belongs to the machine it was made on. Carried in the file, an imported vehicle
    // would claim someone else's adapter and be recognised in its place.
    const paired = { ...vehicle, adapterId: 'bt-42' };

    const result = await readTransferFile(
      'vehicles',
      asFile(await buildTransferFile('vehicles', paired)),
      en,
    );

    expect((result.entity as Vehicle).adapterId).toBeNull();
  });

  it('repairs a layout the file carried broken', async () => {
    const broken = {
      ...vehicle,
      layouts: [
        {
          id: 'grid-1',
          people: [],
          landscape: { columns: 5000, rows: 0, tiles: [] },
          portrait: vehicle.layouts[0]!.portrait,
        },
      ],
    } as unknown as Vehicle;

    const result = await readTransferFile(
      'vehicles',
      asFile(await buildTransferFile('vehicles', broken)),
      en,
    );

    expect((result.entity as Vehicle).layouts[0]!.landscape.columns).toBeLessThan(100);
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

describe('the photograph a vehicle file can carry', () => {
  const picture = {
    id: 'v1',
    fileName: 'van.webp',
    type: 'image/webp',
    size: 7,
    data: new Blob(['PICTURE']),
  };

  it('carries it, and hands it back', async () => {
    const file = asFile(await buildTransferFile('vehicles', vehicle, picture));
    const result = await readTransferFile('vehicles', file, en);

    expect(result.photo?.name).toBe('van.webp');
    expect(await result.photo?.text()).toBe('PICTURE');
  });

  it('carries none when the exporter had none', async () => {
    // Deleting it on the screen that shows it is what leaves it out - there is no second switch.
    const file = asFile(await buildTransferFile('vehicles', vehicle, null));

    expect((await readTransferFile('vehicles', file, en)).photo).toBeNull();
  });

  it('ignores anything in that folder which is not a picture', async () => {
    const hand = createArchive([
      {
        name: 'entity.json',
        data: new TextEncoder().encode(
          JSON.stringify({ format: 'tachsync.entity', version: 1, kind: 'vehicles', entity: vehicle }),
        ),
      },
      { name: 'photo/notes.txt', data: new TextEncoder().encode('hello') },
    ]);

    expect((await readTransferFile('vehicles', asFile(hand), en)).photo).toBeNull();
  });

  it('still reads a bare JSON file, as every earlier export was', async () => {
    // Renaming the format would have turned every file already on disk into an unreadable one.
    const legacy = new Blob([
      JSON.stringify({ format: 'tachsync.entity', version: 1, kind: 'vehicles', entity: vehicle }),
    ]);
    const result = await readTransferFile('vehicles', legacy, en);

    expect(result.error).toBeNull();
    expect(result.photo).toBeNull();
  });
});
