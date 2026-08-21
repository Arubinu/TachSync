import { describe, expect, it } from 'vitest';
import { createArchive, readArchive } from './archive';
import { BACKUP_EXTENSION, createBackup, readBackup } from './backup';
import { DEFAULT_SETTINGS } from './layout';
import { toProfileState } from '../profiles/migrate';
import type { ProfileState } from '../profiles/state';
import { en } from '../i18n/en';
import type { ImportedAvatar } from '../avatar/store';
import type { TripRecord } from '../trips/types';
import type { StoredWallpaper } from './wallpaper';

// Language changes nothing about the archive mechanics: English is enough here, and `i18n.test.ts`
// guarantees the other catalogues follow.
const writeBackup = (profiles: ProfileState, avatars: readonly ImportedAvatar[]) =>
  createBackup(profiles, [], avatars, null, []);
const readBackupFile = (file: File) => readBackup(file, en);

function avatar(fileName: string, content: string): ImportedAvatar {
  return {
    id: 'a1',
    label: fileName.replace(/\.[^.]+$/, ''),
    kind: fileName.endsWith('.riv') ? 'vector' : 'volumetric',
    fileName,
    size: content.length,
    data: new Blob([content]),
  };
}

function asFile(blob: Blob): File {
  return new File([blob], `backup.${BACKUP_EXTENSION}`);
}

const BASE = toProfileState(DEFAULT_SETTINGS);

describe('full backup', () => {
  it('restores the collection and the avatars', async () => {
    const state = toProfileState({ ...DEFAULT_SETTINGS, fontScale: 1.85 });
    const archive = await writeBackup(state, [avatar('companion.glb', 'OCTETS')]);

    const result = await readBackupFile(asFile(archive));

    expect(result.error).toBeNull();
    expect(result.profiles?.appearances[0]?.fontScale).toBe(1.85);
    expect(result.avatars).toHaveLength(1);
    expect(result.avatars[0]?.name).toBe('companion.glb');
    expect(await result.avatars[0]?.text()).toBe('OCTETS');
  });

  it('accepts a backup with no avatar at all', async () => {
    const result = await readBackupFile(asFile(await writeBackup(BASE, [])));

    expect(result.error).toBeNull();
    expect(result.avatars).toHaveLength(0);
  });

  it('carries only what it was given', async () => {
    // Nothing writes itself into the archive uninvited: it held a README that explained the
    // format, and explaining a format nobody opens by hand is not what a backup is for.
    const entries = await readArchive(await writeBackup(BASE, [avatar('face.riv', 'X')]));

    expect(entries.map((e) => e.name).sort()).toEqual([
      'avatars/face.riv',
      'profiles.json',
      'trips.json',
    ]);
  });

  it('refuses an archive with no settings', async () => {
    const broken = createArchive([
      { name: 'avatars/x.glb', data: new TextEncoder().encode('X') },
    ]);

    const result = await readBackupFile(asFile(broken));

    expect(result.settings).toBeNull();
    expect(result.error).toContain('profiles.json');
  });

  it('still reads a backup written under the former entry name', async () => {
    // The settings entry used to be called `reglages.json`. An archive outlives the version that
    // produced it, so the old name stays readable - only the writing side moved.
    const legacy = createArchive([
      {
        name: 'reglages.json',
        data: new TextEncoder().encode(JSON.stringify({ ...DEFAULT_SETTINGS, fontScale: 1.4 })),
      },
    ]);

    const result = await readBackupFile(asFile(legacy));

    expect(result.error).toBeNull();
    expect(result.settings?.fontScale).toBe(1.4);
  });

  it('refuses a file that is not an archive', async () => {
    const result = await readBackupFile(new File(['not an archive'], 'x.tachsync'));

    expect(result.settings).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it('drops from the archive whatever is not a recognised avatar', async () => {
    const archive = await writeBackup(BASE, [avatar('good.glb', 'X')]);

    // A hand-edited archive can contain anything.
    const entries = await (await import('./archive')).readArchive(archive);
    const tampered = createArchive([
      ...entries,
      { name: 'avatars/note.txt', data: new TextEncoder().encode('parasite') },
    ]);

    const result = await readBackupFile(asFile(tampered));

    expect(result.avatars.map((f) => f.name)).toEqual(['good.glb']);
  });
});

describe('what a backup carries', () => {
  it('keeps every person, vehicle and look, not just the active ones', async () => {
    // The whole point of widening it: the earlier backup exported resolved settings, so restoring
    // one rebuilt a single set and quietly dropped everyone else.
    const crowded: ProfileState = {
      ...BASE,
      people: [
        ...BASE.people,
        { id: 'person-2', label: 'Alex', appearanceId: BASE.appearances[0]!.id, icon: 'chat' },
      ],
      vehicles: [...BASE.vehicles, { ...BASE.vehicles[0]!, id: 'vehicle-2', label: 'Van' }],
    };

    const result = await readBackupFile(asFile(await writeBackup(crowded, [])));

    expect(result.profiles?.people.map((p) => p.label)).toEqual(['', 'Alex']);
    expect(result.profiles?.vehicles.map((v) => v.label)).toEqual(['', 'Van']);
  });

  it('carries the trip history', async () => {
    const trip = {
      id: 't1',
      startedAt: 1,
      endedAt: 2,
      distanceKm: 12,
      durationS: 600,
      averageKmh: 72,
      litresUsed: 1,
      averagePer100km: 8,
      peakSpeedKmh: 90,
      peakRpm: 4000,
      vehicle: 'Van',
    } as unknown as TripRecord;

    const archive = await createBackup(BASE, [trip], [], null, []);
    const result = await readBackupFile(asFile(archive));

    expect(result.trips.map((t) => t.id)).toEqual(['t1']);
  });

  it('accepts a backup written before it carried the collection', async () => {
    // Those files hold `settings.json` alone. They still restore, into a single set - all they
    // ever held.
    const legacy = createArchive([
      {
        name: 'settings.json',
        data: new TextEncoder().encode(JSON.stringify({ ...DEFAULT_SETTINGS, fontScale: 1.4 })),
      },
    ]);

    const result = await readBackupFile(asFile(legacy));

    expect(result.error).toBeNull();
    expect(result.profiles).toBeNull();
    expect(result.settings?.fontScale).toBe(1.4);
    expect(result.trips).toEqual([]);
  });
});

describe('the imported background image', () => {
  const image = (fileName: string, content: string): StoredWallpaper => ({
    id: 'current',
    fileName,
    type: 'image/png',
    size: content.length,
    data: new Blob([content]),
  });

  it('travels in the archive and comes back', async () => {
    const archive = await createBackup(BASE, [], [], image('sunset.png', 'PNGDATA'), []);
    const result = await readBackupFile(asFile(archive));

    expect(result.wallpaper?.name).toBe('sunset.png');
    expect(await result.wallpaper?.text()).toBe('PNGDATA');
  });

  it('leaves the archive as it was when there is none', async () => {
    // The whole point of restoring a backup written before this existed: no image is not a
    // damaged file, and must not read as one.
    const result = await readBackupFile(asFile(await writeBackup(BASE, [])));

    expect(result.wallpaper).toBeNull();
    expect(result.error).toBeNull();
  });

  it('ignores anything in that folder which is not an image', async () => {
    // A hand-edited archive can hold anything; the folder name is not a promise.
    const archive = createArchive([
      { name: 'profiles.json', data: new TextEncoder().encode(JSON.stringify(BASE)) },
      { name: 'wallpaper/notes.txt', data: new TextEncoder().encode('hello') },
    ]);

    expect((await readBackupFile(asFile(archive))).wallpaper).toBeNull();
  });
});

describe('vehicle photographs in a backup', () => {
  const photo = (id: string, name: string, content: string) => ({
    id,
    fileName: name,
    type: 'image/webp',
    size: content.length,
    data: new Blob([content]),
  });

  it('keeps each picture paired with its car', async () => {
    // Two cars photographed from the same phone arrive as the same file name: the id has to be
    // carried by the archive itself, or a restore hands the wrong picture to the wrong vehicle.
    const archive = await createBackup(
      BASE,
      [],
      [],
      null,
      [photo('v1', 'IMG_0042.webp', 'FIRST'), photo('v2', 'IMG_0042.webp', 'SECOND')],
    );
    const result = await readBackupFile(asFile(archive));

    const byCar = Object.fromEntries(
      await Promise.all(result.photos.map(async (p) => [p.vehicleId, await p.file.text()])),
    );

    expect(byCar).toEqual({ v1: 'FIRST', v2: 'SECOND' });
  });

  it('reads a backup written before photographs as having none', async () => {
    expect((await readBackupFile(asFile(await writeBackup(BASE, [])))).photos).toEqual([]);
  });

  it('ignores anything in that folder which is not a picture', async () => {
    const hand = createArchive([
      { name: 'profiles.json', data: new TextEncoder().encode(JSON.stringify(BASE)) },
      { name: 'photos/v1/notes.txt', data: new TextEncoder().encode('hello') },
    ]);

    expect((await readBackupFile(asFile(hand))).photos).toEqual([]);
  });
});
