/**
 * The local database, and it alone.
 *
 * IndexedDB allows one version per database: two modules each opening it with their own would get
 * in each other's way, the second failing with a `VersionError` as soon as the first migrated the
 * schema. Everything persistent therefore goes through here, and the schema is described in one
 * place.
 *
 * Each version number must create what is missing without assuming anything about what came before:
 * a fresh install receives both stores at once, where an early install only needs the second.
 */

const DB_NAME = 'tachsync';

/**
 * 1 - imported avatars. 2 - recorded trips. 3 - the imported background image.
 */
const DB_VERSION = 3;

export const AVATARS = 'avatars';
export const TRIPS = 'trips';
export const WALLPAPERS = 'wallpapers';

/** Trip index by start date, to read them back newest first. */
export const BY_START = 'startedAt';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(AVATARS)) db.createObjectStore(AVATARS, { keyPath: 'id' });

      if (!db.objectStoreNames.contains(TRIPS)) {
        const trips = db.createObjectStore(TRIPS, { keyPath: 'id' });
        // Sorting on read would mean loading everything before knowing what to show; the index lets
        // the cursor walk in the wanted order.
        trips.createIndex(BY_START, 'startedAt');
      }

      if (!db.objectStoreNames.contains(WALLPAPERS)) {
        db.createObjectStore(WALLPAPERS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    // This message only serves if the browser supplies none: its own, more precise ones (quota,
    // private browsing) are in English too.
    request.onerror = () => reject(request.error ?? new Error('Storage unavailable.'));
  });
}

/**
 * Wraps a transaction: the promise settles on the transaction, not the request. A write can succeed
 * and then be rolled back at commit time.
 */
export async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const request = action(transaction.objectStore(store));

      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error ?? new Error('Write failed.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Write aborted.'));
    });
  } finally {
    db.close();
  }
}
