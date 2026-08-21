import type { TripRecord } from './types';

/** The little a caller needs to name a vehicle: what cannot change, and what is shown. */
export interface VehicleIdentity {
  readonly id: string;
  readonly label: string;
}

/**
 * Whether a trip belongs to a vehicle.
 *
 * By id, which no rename and no language change can touch. Trips written before ids were stored
 * fall back to the label they carried, which is best effort and fails exactly where it always did -
 * but a trip that was already orphaned is not made worse by asking.
 */
export function isTripOf(trip: TripRecord, vehicle: VehicleIdentity): boolean {
  return trip.vehicleId === null ? trip.vehicle === vehicle.label : trip.vehicleId === vehicle.id;
}

/**
 * Fills in what an older record has not got.
 *
 * IndexedDB hands back exactly what was written, so a trip from before the id gives `undefined`
 * where the type promises `null`. Every trip enters the application through `listTrips`, which is
 * why this belongs there rather than at each reader.
 */
export function normalizeTrip(trip: TripRecord): TripRecord {
  return trip.vehicleId === undefined ? { ...trip, vehicleId: null } : trip;
}
