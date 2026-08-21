import type { Translation } from '../i18n';
import { checkImage, fitImage, storedName } from '../storage/image';
import { PHOTOS, run } from '../storage/db';

/**
 * A photograph of the car, kept per vehicle.
 *
 * It exists for one screen: the one that asks who is driving. A name in a list says which car the
 * application thinks it is; a photograph says it without being read, which is the whole reason that
 * screen shows one at all.
 *
 * Keyed by the vehicle's id, so it follows the car through a rename - and disappears with it.
 *
 * Not carried in the `.tachvehicle` file. Those files travel between installations and describe how
 * a car is DRIVEN; a snapshot of one particular vehicle in one particular driveway is not something
 * the person importing it has any use for.
 */

export interface VehiclePhoto {
  /** The vehicle's id. */
  readonly id: string;
  /** Original file name, for the backup archive. */
  readonly fileName: string;
  readonly type: string;
  readonly size: number;
  readonly data: Blob;
}

export async function readPhoto(vehicleId: string): Promise<VehiclePhoto | null> {
  try {
    const found = await run<VehiclePhoto | undefined>(PHOTOS, 'readonly', (store) =>
      store.get(vehicleId),
    );
    return found ?? null;
  } catch {
    // Private browsing, quota refused: the screen shows the car's name and carries on.
    return null;
  }
}

export async function savePhoto(photo: VehiclePhoto): Promise<void> {
  await run(PHOTOS, 'readwrite', (store) => store.put(photo));
}

export async function deletePhoto(vehicleId: string): Promise<void> {
  await run(PHOTOS, 'readwrite', (store) => store.delete(vehicleId));
}

/**
 * Takes a chosen file and stores it against a car, converting it on the way.
 *
 * Here rather than in the hook because two callers need it: the screen where a photograph is
 * chosen, and the import of a vehicle file that arrived carrying one.
 *
 * Returns why it was refused, or `null` when it was taken.
 */
export async function adoptPhoto(
  vehicleId: string,
  file: File,
  t: Translation,
): Promise<string | null> {
  const refused = checkImage(file, t);
  if (refused !== null) return refused;

  try {
    const data = await fitImage(file);
    await savePhoto({
      id: vehicleId,
      fileName: storedName(file, data !== (file as Blob)),
      type: data.type,
      size: data.size,
      data,
    });
    return null;
  } catch (cause: unknown) {
    return cause instanceof Error ? cause.message : t.settings.importFailed;
  }
}

/** Every photograph, for a backup. */
export async function listPhotos(): Promise<readonly VehiclePhoto[]> {
  try {
    return await run<VehiclePhoto[]>(PHOTOS, 'readonly', (store) => store.getAll());
  } catch {
    return [];
  }
}
