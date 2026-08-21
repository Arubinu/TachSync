import { BY_START, run, TRIPS } from '../storage/db';
import { normalizeTrip } from './identity';
import { clearTraces, deleteTrace } from './trace';
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
    return all.reverse().map(normalizeTrip);
  } catch {
    return [];
  }
}

export async function saveTrip(trip: TripRecord): Promise<void> {
  await run(TRIPS, 'readwrite', (store) => store.put(trip));
}

/**
 * Removes a trip and the trace that belongs to it.
 *
 * Two stores, so two deletions - and the trace goes first is not the point; that it goes at all is.
 * A trace outliving its trip would be unreachable and unaccountable: nothing lists traces, so it
 * would sit in storage with no screen able to name it.
 */
export async function deleteTrip(id: string): Promise<void> {
  await run(TRIPS, 'readwrite', (store) => store.delete(id));
  await deleteTrace(id);
}

export async function clearTrips(): Promise<void> {
  await run(TRIPS, 'readwrite', (store) => store.clear());
  await clearTraces();
}
