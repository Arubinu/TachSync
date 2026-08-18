import type { TelemetrySnapshot } from '../telemetry/TelemetryStore';

/**
 * Long-window driving mode, which drives the board's ambience.
 *
 * No standard PID reports the vehicle's own mode - it is a manufacturer frame, different on every
 * model - so it is inferred here, which works on any car. A vehicle profile declaring the
 * proprietary PID can override this later without changing the output type.
 */

export const DRIVE_MODES = ['eco', 'normal', 'sport'] as const;
export type DriveMode = (typeof DRIVE_MODES)[number];

/**
 * Window length, in seconds. Long enough that a traffic queue does not force `eco`, short enough
 * that a motorway slip road registers before it ends.
 */
export const WINDOW_SECONDS = 60;

/**
 * Margin a score must clear to flip the mode. Entering a mode is easier than leaving it.
 */
const HYSTERESIS = 0.08;

/** Composite score thresholds, 0 (eco) to 1 (sport). */
const THRESHOLDS = { eco: 0.32, sport: 0.62 } as const;

interface Sample {
  readonly at: number;
  readonly throttle: number;
  readonly load: number;
  readonly revs: number;
}

/**
 * Accumulates a sliding window and derives a mode from it.
 *
 * Three inputs, each carrying something the others do not: mean throttle is demand, its variance is
 * manner (eco is smooth, sport alternates), and relative rpm is gear choice. Engine load is
 * deliberately absent - it tracks throttle too closely to add anything.
 */
export class DriveModeTracker {
  #samples: Sample[] = [];
  #mode: DriveMode = 'normal';

  get mode(): DriveMode {
    return this.#mode;
  }

  /** Raw score, 0..1. */
  get score(): number {
    return this.#score();
  }

  observe(snapshot: TelemetrySnapshot, redline: number): void {
    const { throttle, rpm, engineLoad, timestamp } = snapshot.frame;
    // With neither throttle nor rpm there is nothing to classify: keep the current mode rather than
    // drifting to `eco` for lack of data.
    if (throttle === null && rpm === null) return;

    this.#samples.push({
      at: timestamp,
      throttle: (throttle ?? engineLoad ?? 0) / 100,
      load: (engineLoad ?? throttle ?? 0) / 100,
      revs: rpm === null ? 0 : Math.min(1, rpm / redline),
    });

    const horizon = timestamp - WINDOW_SECONDS * 1000;
    while (this.#samples.length > 0 && this.#samples[0]!.at < horizon) this.#samples.shift();

    this.#settle();
  }

  #score(): number {
    if (this.#samples.length === 0) return 0;

    const throttles = this.#samples.map((sample) => sample.throttle);
    const mean = average(throttles);
    // Standard deviation rather than variance: same unit as the mean, so the two weights do not
    // need recalibrating against each other.
    const spread = Math.sqrt(average(throttles.map((value) => (value - mean) ** 2)));
    const revs = average(this.#samples.map((sample) => sample.revs));

    return clamp01(mean * 0.45 + spread * 1.1 + revs * 0.45);
  }

  #settle(): void {
    const score = this.#score();
    const margin = (mode: DriveMode): number => (this.#mode === mode ? HYSTERESIS : 0);

    if (score >= THRESHOLDS.sport - margin('sport')) this.#mode = 'sport';
    else if (score <= THRESHOLDS.eco + margin('eco')) this.#mode = 'eco';
    else if (this.#mode !== 'sport' || score < THRESHOLDS.sport - HYSTERESIS) this.#mode = 'normal';
  }
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
