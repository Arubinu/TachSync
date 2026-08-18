import type { TelemetrySnapshot } from '../telemetry/TelemetryStore';

/**
 * Instantaneous driving style, evaluated every frame.
 *
 * The short-window counterpart to `driveMode`, which reads over a minute and drives the ambience.
 * This one drives the avatar, so it has to react within seconds.
 *
 * Scoring is composite rather than a threshold on any single channel: high revs alone mean nothing
 * (overtaking calmly), and hard braking alone means nothing (every red light).
 */

export const DRIVING_STYLES = ['calm', 'normal', 'spirited', 'aggressive'] as const;
export type DrivingStyle = (typeof DRIVING_STYLES)[number];

/**
 * Smoothing time constants, in seconds.
 *
 * Energy is sustained and decays slowly; harshness is event-like and must decay fast, otherwise a
 * jolt becomes indistinguishable from a steady state.
 */
const ENERGY_TAU = 2.5;
const HARSHNESS_TAU = 1.2;

/** Margin a score must clear to flip the state, preventing flicker at a threshold. */
const HYSTERESIS = 0.06;

export class DrivingStyleTracker {
  /**
   * Where this driver's ordinary sits, relative to the average the thresholds describe.
   *
   * Zero leaves the engine exactly as it was. A positive value raises the bar for a driver who is
   * habitually livelier, so "spirited" keeps meaning "livelier than usual" rather than "livelier
   * than most people".
   */
  #shift = 0;

  /** Set from the trip history when the driver asked for it, otherwise never called. */
  setBaselineShift(shift: number): void {
    this.#shift = shift;
  }

  #energy = 0;
  #harshness = 0;
  #style: DrivingStyle = 'normal';

  get style(): DrivingStyle {
    return this.#style;
  }

  /** Energy and harshness, 0..1. Exposed for animation, not for scoring. */
  get levels(): { readonly energy: number; readonly harshness: number } {
    return { energy: this.#energy, harshness: this.#harshness };
  }

  /**
   * `dt` is supplied rather than derived from `snapshot.frame.timestamp`, which carries vehicle
   * time: replaying a recorded trip or stepping a simulated trace would otherwise barely advance
   * the smoothing.
   *
   * Re-observing the same frame is harmless: smoothing targets a value computed from the current
   * reading, so repetition extends the state rather than double-counting it.
   */
  observe(snapshot: TelemetrySnapshot, dt: number, redline: number): void {
    const { throttle, rpm, longitudinalG, lateralG } = snapshot.frame;

    // Clamped: a backgrounded tab resumes with a huge step, which would snap the smoothing straight
    // to its target.
    const step = Math.min(Math.max(dt, 0), 2);
    if (step === 0) return;

    // Revs outweigh throttle: 35% throttle holding a steady speed on the flat is no effort at all.
    const demand = (throttle ?? 0) / 100;
    const revs = rpm === null ? 0 : Math.min(1, rpm / redline);
    const energyTarget = clamp01(demand * 0.5 + revs * 0.7);

    // No single axis can cross the threshold on its own. Everyone brakes hard at a red light; what
    // marks nervous driving is two of the three at once.
    const braking = Math.max(0, -(longitudinalG ?? 0));
    const pushing = Math.max(0, longitudinalG ?? 0);
    const cornering = Math.abs(lateralG ?? 0);
    const harshnessTarget = clamp01(braking * 0.72 + pushing * 0.7 + cornering * 1.1);

    this.#energy += (energyTarget - this.#energy) * (1 - Math.exp(-step / ENERGY_TAU));
    this.#harshness +=
      (harshnessTarget - this.#harshness) * (1 - Math.exp(-step / HARSHNESS_TAU));

    this.#settle();
  }

  /**
   * Harshness decides between spirited and aggressive; energy only says how fast things are moving.
   * A single combined score would rank clean fast driving and jerky driving in the same place.
   */
  #settle(): void {
    const margin = (style: DrivingStyle): number => (this.#style === style ? HYSTERESIS : 0);

    // Harshness is not shifted: a jolt is a jolt, whoever is driving, and moving that line would
    // make a habitually rough driver stop being told about it.
    if (this.#harshness > 0.62 - margin('aggressive')) this.#style = 'aggressive';
    else if (this.#energy > 0.5 + this.#shift - margin('spirited')) this.#style = 'spirited';
    else if (
      this.#energy < 0.36 + this.#shift + margin('calm') &&
      this.#harshness < 0.25
    ) {
      this.#style = 'calm';
    }
    else this.#style = 'normal';
  }
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
