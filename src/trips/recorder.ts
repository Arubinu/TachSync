import { DrivingStyleTracker } from '../analysis/drivingStyle';
import type { TelemetrySnapshot } from '../telemetry/TelemetryStore';
import type { TripRecord } from './types';

/**
 * Below these two thresholds a trip is not a trip.
 *
 * Plugging in the adapter, checking the screen lights up and unplugging leaves a trace a few metres
 * long. Recorded, it would drown the history under drives that never happened. The two conditions
 * are joint: a hundred metres is not enough if covered in ten seconds, and a minute idling is no
 * more a trip.
 */
export const MIN_DISTANCE_KM = 0.2;
export const MIN_DURATION_S = 60;

export interface TripContext {
  readonly vehicle: string;
  readonly source: TripRecord['source'];
}

/**
 * Accumulates what the current trip will leave behind.
 *
 * The continuous totals - distance, duration, fuel - are already kept by the `TelemetryStore`,
 * which integrates each frame as it arrives; recomputing them here would give two counts that
 * diverge. This object therefore keeps only what nobody else tracks: the maxima, and the trip's
 * bounds.
 *
 * Deliberately free of storage and React dependencies: it is arithmetic over a sequence of
 * snapshots, and must be verifiable as such.
 */
export class TripRecorder {
  readonly #context: TripContext;
  readonly #startedAt: number;
  #lastSnapshot: TelemetrySnapshot | null = null;
  #maxKmh = 0;
  #maxRpm: number | null = null;
  // Its own tracker: the avatar owns one too, but entangling a recording with what is on screen
  // would tie the history to whether an avatar happens to be displayed.
  readonly #style = new DrivingStyleTracker();
  #energySum = 0;
  #harshnessSum = 0;
  #styleSamples = 0;

  constructor(context: TripContext, startedAt: number) {
    this.#context = context;
    this.#startedAt = startedAt;
  }

  observe(snapshot: TelemetrySnapshot): void {
    this.#lastSnapshot = snapshot;

    const { speed, rpm } = snapshot.frame;
    if (speed !== null && speed > this.#maxKmh) this.#maxKmh = speed;
    // `null` is not zero: a vehicle that does not expose engine speed must finish the trip with no
    // maximum, not with a maximum of zero.
    if (rpm !== null && (this.#maxRpm === null || rpm > this.#maxRpm)) this.#maxRpm = rpm;
  }

  /**
   * The trip's state at this instant, or `null` if there is nothing worth keeping - too short, or
   * not a single frame received.
   *
   * Closes nothing: it can be called as often as needed, which is how a trip in progress is
   * checkpointed. The id depends only on the start time, so two successive calls rewrite the same
   * entry instead of scattering one per checkpoint.
   */
  /**
   * Feeds the style engine, on a regular beat.
   *
   * Separate from `observe` because this one cannot be called twice for the same instant: the
   * engine integrates over `dt`, so a double feed would count the same second twice. `observe`
   * only keeps maxima, which is why it tolerates any sampling rate and this does not.
   */
  observeStyle(snapshot: TelemetrySnapshot, dt: number, redline: number): void {
    this.#style.observe(snapshot, dt, redline);
    const levels = this.#style.levels;
    this.#energySum += levels.energy;
    this.#harshnessSum += levels.harshness;
    this.#styleSamples += 1;
  }

  record(endedAt: number): TripRecord | null {
    const snapshot = this.#lastSnapshot;
    if (snapshot === null) return null;

    const { trip } = snapshot;
    if (trip.distanceKm < MIN_DISTANCE_KM || trip.durationS < MIN_DURATION_S) return null;

    return {
      id: String(this.#startedAt),
      startedAt: this.#startedAt,
      endedAt,
      distanceKm: trip.distanceKm,
      durationS: trip.durationS,
      averageKmh: trip.averageKmh,
      maxKmh: this.#maxKmh,
      litresUsed: trip.litresUsed,
      averagePer100km: trip.averagePer100km,
      maxRpm: this.#maxRpm,
      meanEnergy: this.#styleSamples === 0 ? null : this.#energySum / this.#styleSamples,
      meanHarshness: this.#styleSamples === 0 ? null : this.#harshnessSum / this.#styleSamples,
      vehicle: this.#context.vehicle,
      source: this.#context.source,
    };
  }
}
