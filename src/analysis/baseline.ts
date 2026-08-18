import type { TripRecord } from '../trips/types';

/**
 * What this driver's ordinary driving looks like, read from their own trips.
 *
 * The style engine judges against fixed thresholds, which is the only thing it can do knowing
 * nothing about who is behind the wheel. Those thresholds describe an average driver, so a calm one
 * is never called spirited and a quick one is called aggressive on the way to the shops - both are
 * told about the population rather than about themselves.
 *
 * The baseline shifts the thresholds by the gap between this driver's usual energy and that
 * average. It never changes what is measured, only where the line sits: "more lively than your
 * usual" instead of "lively for a human being".
 *
 * Deliberately something one can switch off. It makes the readings personal, which is what makes
 * them useful, and also what makes them incomparable with anyone else's.
 */

/**
 * The energy an ordinary drive settles around.
 *
 * Taken from the simulator's `normal` profile, the same one the thresholds were tuned against, so
 * a driver who matches it gets exactly the behaviour they had before enabling this.
 */
export const REFERENCE_ENERGY = 0.42;

/** Trips needed before a baseline is offered. Below this it is one drive, not a habit. */
export const MIN_TRIPS = 5;

/** How far the thresholds may move, either way. */
const MAX_SHIFT = 0.12;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export interface Baseline {
  /** This driver's usual energy, 0..1. */
  readonly energy: number;
  /** Trips it was read from. */
  readonly trips: number;
  /**
   * What to add to every energy threshold, positive for a livelier-than-average driver.
   *
   * Bounded: a baseline is a nudge, not a licence to redefine the scale. Beyond a tenth or so the
   * classifier would stop describing anything the word "aggressive" still means.
   */
  readonly shift: number;
}

/**
 * Reads the baseline from the trips of one vehicle.
 *
 * The median rather than the mean: a single motorway run among town trips would drag an average
 * where it drags no median. Trips with no style recorded - every one from before it was kept - are
 * skipped rather than counted as zero.
 */
export function readBaseline(trips: readonly TripRecord[], vehicle: string): Baseline | null {
  const levels = trips
    .filter((trip) => trip.vehicle === vehicle && trip.meanEnergy !== null)
    .map((trip) => trip.meanEnergy as number);

  if (levels.length < MIN_TRIPS) return null;

  const energy = median(levels);
  const raw = energy - REFERENCE_ENERGY;

  return {
    energy,
    trips: levels.length,
    shift: Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, raw)),
  };
}
