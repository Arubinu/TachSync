/**
 * What remains of a trip once it is over.
 *
 * A summary, not a trace: neither the frames nor their sequence are kept, only the few quantities
 * that sum up the drive. An hour on the road at 10 Hz is thirty-six thousand frames, useless once
 * the screen is off, where a summary fits in two hundred bytes and still reads years later.
 *
 * The day driving analysis needs the full trace, it will be a second store - optional and
 * purgeable. The trip list itself must stay light.
 */
export interface TripRecord {
  /**
   * The departure time in milliseconds, and nothing else.
   *
   * This is what allows rewriting a trip in progress without scattering a copy at every checkpoint.
   * Two trips cannot start in the same millisecond: that would mean opening the same connection
   * twice.
   */
  readonly id: string;
  /** Start, in milliseconds since the epoch. */
  readonly startedAt: number;
  readonly endedAt: number;
  readonly distanceKm: number;
  readonly durationS: number;
  readonly averageKmh: number;
  readonly maxKmh: number;
  readonly litresUsed: number;
  /** `null` under a hundred metres, where the average would be meaningless. */
  readonly averagePer100km: number | null;
  /** `null` if the vehicle does not expose engine speed. */
  readonly maxRpm: number | null;
  /**
   * How the trip felt, averaged over it: the two levels the style engine works from.
   *
   * `null` on every trip recorded before this existed, and on one too short to have been sampled.
   * Stored rather than recomputed because the frames are gone - only their summary survives.
   */
  readonly meanEnergy: number | null;
  readonly meanHarshness: number | null;
  /**
   * Which vehicle, by id.
   *
   * `null` on trips written before this was stored, which have only the label below to go on.
   *
   * The label alone was the identity, and it was the wrong one twice over: renaming a vehicle
   * orphaned its whole history, and an unnamed one is labelled from a TRANSLATED string, so
   * switching the interface language split one car into two.
   */
  readonly vehicleId: string | null;
  /**
   * Vehicle name at the time of the trip, as it was displayed.
   *
   * Kept for display and for matching the trips that predate the id: a history shows the name the
   * car had then, not the one it has now.
   */
  readonly vehicle: string;
  /**
   * Where the frames came from.
   *
   * Without this distinction a simulator demonstration would file among the real trips and skew
   * every later reading of the history.
   */
  readonly source: 'simulated' | 'obd';
}
