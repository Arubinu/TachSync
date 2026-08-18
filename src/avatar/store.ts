import { AVATARS, run } from '../storage/db';
import type { AvatarKind } from './types';

/**
 * Imported avatars, kept in IndexedDB.
 *
 * Not in `localStorage`: a volumetric model weighs megabytes where that storage caps around five
 * and only accepts text. Base64-encoding a binary would inflate it by a further third before
 * saturating anyway. IndexedDB accepts blobs as they are.
 *
 * The file is not copied into the exported settings - see the avatars README: a settings backup
 * must stay a text file readable by eye, not an archive of tens of megabytes.
 *
 * Opening the database is delegated to `storage/db`: the schema belongs to the whole database, not
 * to one of its stores.
 */

export interface ImportedAvatar {
  readonly id: string;
  readonly label: string;
  readonly kind: AvatarKind;
  /** Original file name, shown to the user for orientation. */
  readonly fileName: string;
  readonly size: number;
  readonly data: Blob;
}

export async function listAvatars(): Promise<readonly ImportedAvatar[]> {
  try {
    const all = await run<ImportedAvatar[]>(AVATARS, 'readonly', (store) => store.getAll());
    return all;
  } catch {
    // Private browsing, quota refused, storage disabled: the application must carry on with its
    // built-in avatars rather than refuse to start.
    return [];
  }
}

export async function saveAvatar(avatar: ImportedAvatar): Promise<void> {
  await run(AVATARS, 'readwrite', (store) => store.put(avatar));
}

export async function deleteAvatar(id: string): Promise<void> {
  await run(AVATARS, 'readwrite', (store) => store.delete(id));
}
