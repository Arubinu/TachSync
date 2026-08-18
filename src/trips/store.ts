import { BY_START, run, TRIPS } from '../storage/db';
import type { TripRecord } from './types';

/**
 * Trip history.
 *
 * Every read falls back to an empty list on failure: private browsing, quota refused, storage
 * disabled by configuration. An unavailable history must never prevent driving - the dashboard is
 * what matters, the history is only its memory.
 *
 * Writes do surface their error: whoever records must be able to say the recording failed.
 */

/** Newest first: it is the last trip that gets looked up. */
export async function listTrips(): Promise<readonly TripRecord[]> {
  try {
    const all = await run<TripRecord[]>(TRIPS, 'readonly', (store) =>
      store.index(BY_START).getAll(),
    );
    return all.reverse();
  } catch {
    return [];
  }
}

export async function saveTrip(trip: TripRecord): Promise<void> {
  await run(TRIPS, 'readwrite', (store) => store.put(trip));
}

export async function deleteTrip(id: string): Promise<void> {
  await run(TRIPS, 'readwrite', (store) => store.delete(id));
}

export async function clearTrips(): Promise<void> {
  await run(TRIPS, 'readwrite', (store) => store.clear());
}
