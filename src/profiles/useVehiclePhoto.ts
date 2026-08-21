import { useCallback, useEffect, useState } from 'react';
import type { Translation } from '../i18n';
import { useTipMessage } from '../board/Tip';
import { adoptPhoto, deletePhoto, readPhoto, type VehiclePhoto } from './photo';

export interface PhotoLibrary {
  /** The active car's photograph, or `null`. */
  readonly photo: VehiclePhoto | null;
  /** Object URL to paint it with, minted per stored blob and revoked when it changes. */
  readonly url: string | null;
  readonly report: string | null;
  readonly reportId: number;
  importFile(file: File): Promise<void>;
  remove(): Promise<void>;
}

/**
 * The photograph of one car, and the URL to show it with.
 *
 * Reloads when the car changes: the screen that shows it is reached once a vehicle is known, and a
 * stale picture there would name the wrong car at exactly the moment it is being confirmed.
 *
 * The catalogue is handed in, not read from the context - see `useWallpaper` for why.
 */
export function useVehiclePhoto(vehicleId: string, t: Translation): PhotoLibrary {
  const [photo, setPhoto] = useState<VehiclePhoto | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const { text: report, id: reportId, say: answer } = useTipMessage();

  useEffect(() => {
    let alive = true;
    // Cleared first: showing the previous car's photograph while the next one loads would be worse
    // than showing none.
    setPhoto(null);
    void readPhoto(vehicleId).then((found) => {
      if (alive) setPhoto(found);
    });
    return () => {
      alive = false;
    };
  }, [vehicleId]);

  useEffect(() => {
    if (photo === null) {
      setUrl(null);
      return;
    }

    const minted = URL.createObjectURL(photo.data);
    setUrl(minted);
    return () => URL.revokeObjectURL(minted);
  }, [photo]);

  const importFile = useCallback(
    async (file: File): Promise<void> => {
      const refused = await adoptPhoto(vehicleId, file, t);
      answer(refused);
      // Read back rather than kept from the write: the stored record is what the rest of the
      // application will see, converted name and size included.
      if (refused === null) setPhoto(await readPhoto(vehicleId));
    },
    [vehicleId, t, answer],
  );

  const remove = useCallback(async (): Promise<void> => {
    await deletePhoto(vehicleId);
    setPhoto(null);
    answer(null);
  }, [vehicleId, answer]);

  return { photo, url, report, reportId, importFile, remove };
}
