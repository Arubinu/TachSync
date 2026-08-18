import {
  buildSignature,
  hasBoost,
  idleRpm,
  isWarm,
  limiterRpm,
  peakRpm,
  peakSpeed,
  signatureSpread,
  type CalibrationSample,
  type ModeSignature,
} from './calibration';

/**
 * The calibration protocol: which phase the driver is in, and when it has seen enough.
 *
 * Split from the measurements next door because the two answer to different things. The
 * measurements are arithmetic on a list of samples; this is the order they are gathered in, when a
 * phase is satisfied, and what the screen must say. Keeping the arithmetic free of any notion of
 * "current step" is what lets it be tested on a trace with no protocol at all.
 *
 * The mode phases have to be driven, not idled through. A mode betrays itself in engine load per
 * unit of pedal and in the gear it holds - neither exists standing still. Costly to ask, and the
 * only thing that works: a stationary sweep would compare three identical idles.
 */

export interface CalibrationPhase<M extends string = string> {
  readonly kind: 'warmup' | 'idle' | 'drive' | 'done';
  /**
   * Which drive mode the driver was asked to select, for a `drive` phase.
   *
   * `null` on a car without modes - and that is the ordinary case, not a degraded one. Most cars
   * have one way of driving, and the protocol then holds a single driving phase.
   */
  readonly mode: M | null;
}

export interface PhaseProgress {
  /** 0 to 1. What the screen turns into a bar. */
  readonly ratio: number;
  /** Whether the phase has what it needs and the driver may move on. */
  readonly satisfied: boolean;
}

export interface CalibrationResult<M extends string = string> {
  readonly idleRpm: number | null;
  /** Measured against the limiter, when the car happened to meet it. */
  readonly limiterRpm: number | null;
  /** Highest engine speed seen. A floor: the redline is at least this. */
  readonly peakRpm: number | null;
  readonly peakSpeed: number | null;
  readonly turbo: boolean | null;
  /** One per driven mode. Empty on a car without modes. */
  readonly signatures: readonly ModeSignature<M>[];
  /**
   * How far the calibrated modes stand apart, or `null` when there is nothing to compare.
   *
   * Reported rather than hidden: on a car whose modes barely differ, detection cannot work
   * afterwards, and the screen should say so instead of promising it.
   */
  readonly spread: number | null;
}

/** Seconds of held idle before the reading is worth keeping. */
const IDLE_SECONDS = 20;
/** Seconds of driving per mode. Long enough to meet a few gears and a few pedal positions. */
const DRIVE_SECONDS = 90;

function seconds(samples: readonly CalibrationSample[]): number {
  if (samples.length < 2) return 0;
  return ((samples[samples.length - 1]?.at ?? 0) - (samples[0]?.at ?? 0)) / 1000;
}

/**
 * Runs one calibration.
 *
 * Samples are pushed in as they arrive and kept per phase; nothing is computed until asked. The
 * driver decides when to move on - `progress` only says whether moving on is reasonable, because a
 * protocol that advanced on its own would do it at the exact moment attention was elsewhere.
 */
export class Calibration<M extends string = string> {
  readonly #modes: readonly M[];
  readonly #byPhase = new Map<string, CalibrationSample[]>();
  #index = 0;

  /** @param modes What the car offers, in the order they will be asked for. Empty if it has none. */
  constructor(modes: readonly M[] = []) {
    this.#modes = modes;
  }

  /** The phases this car will go through, decided up front so the screen can count them. */
  get phases(): readonly CalibrationPhase<M>[] {
    const driving: CalibrationPhase<M>[] =
      this.#modes.length === 0
        ? [{ kind: 'drive', mode: null }]
        : this.#modes.map((mode) => ({ kind: 'drive' as const, mode }));

    return [{ kind: 'warmup', mode: null }, { kind: 'idle', mode: null }, ...driving];
  }

  get phase(): CalibrationPhase<M> {
    return this.phases[this.#index] ?? { kind: 'done', mode: null };
  }

  get index(): number {
    return this.#index;
  }

  get total(): number {
    return this.phases.length;
  }

  get done(): boolean {
    return this.#index >= this.phases.length;
  }

  #key(phase: CalibrationPhase<M> = this.phase): string {
    return `${phase.kind}:${phase.mode ?? ''}`;
  }

  /** Files a sample under the phase in progress. Ignored once finished. */
  observe(sample: CalibrationSample): void {
    if (this.done) return;
    const key = this.#key();
    const kept = this.#byPhase.get(key) ?? [];
    kept.push(sample);
    this.#byPhase.set(key, kept);
  }

  samplesFor(phase: CalibrationPhase<M>): readonly CalibrationSample[] {
    return this.#byPhase.get(this.#key(phase)) ?? [];
  }

  get progress(): PhaseProgress {
    const phase = this.phase;
    const samples = this.samplesFor(phase);

    if (phase.kind === 'warmup') {
      const warm = isWarm(samples);
      return { ratio: warm ? 1 : 0, satisfied: warm };
    }

    if (phase.kind === 'idle') {
      // Held idle, not merely elapsed time: a driver who drives off mid-phase has to start over,
      // and a bar that kept filling would hide that.
      const held = seconds(samples.filter((s) => (s.speed ?? 0) <= 2 && (s.throttle ?? 0) <= 5));
      return { ratio: Math.min(held / IDLE_SECONDS, 1), satisfied: held >= IDLE_SECONDS };
    }

    if (phase.kind === 'drive') {
      const moving = seconds(samples.filter((s) => (s.speed ?? 0) > 2));
      const signature = buildSignature(phase.mode ?? '', samples);
      // Time is the bar, but the axes decide: ninety seconds in a traffic jam measure nothing.
      const measured = signature.loadPerThrottle !== null && signature.rpmPerKmh !== null;
      return {
        ratio: Math.min(moving / DRIVE_SECONDS, 1),
        satisfied: measured && moving >= DRIVE_SECONDS,
      };
    }

    return { ratio: 1, satisfied: true };
  }

  /** Moves to the next phase, satisfied or not: the driver may always decide it is enough. */
  next(): void {
    if (!this.done) this.#index += 1;
  }

  /** Everything gathered, whichever phases were actually completed. */
  result(): CalibrationResult<M> {
    const all = [...this.#byPhase.values()].flat().sort((a, b) => a.at - b.at);

    const signatures = this.phases
      .filter((phase) => phase.kind === 'drive' && phase.mode !== null)
      .map((phase) => buildSignature(phase.mode as M, this.samplesFor(phase)))
      // A mode the driver skipped has nothing to compare with, and an empty signature would only
      // make the spread look worse than it is.
      .filter((signature) => signature.loadPerThrottle !== null || signature.rpmPerKmh !== null);

    return {
      idleRpm: idleRpm(all),
      limiterRpm: limiterRpm(all),
      peakRpm: peakRpm(all),
      peakSpeed: peakSpeed(all),
      turbo: hasBoost(all),
      signatures,
      spread: signatures.length < 2 ? null : signatureSpread(signatures),
    };
  }
}

/** Rounds to the nearest step. For a value that was measured, and should stay what it was. */
function toNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Rounds up past the value, never onto it: a needle resting on its stop reads badly. */
function above(value: number, step: number): number {
  return Math.floor(value / step) * step + step;
}

/**
 * A redline offered from the highest reading seen, whatever saw it.
 *
 * The same rule the calibration applies to its own peak, exported so the trip history cannot drift
 * from it: both know only that the engine goes AT LEAST this high, so both must clear the reading
 * rather than sit on it.
 */
export function redlineFromPeak(peak: number): number {
  return above(peak, 500);
}

export interface SuggestedRanges {
  readonly speed: number;
  readonly redline: number;
  /** Whether the redline was measured against the limiter, or merely inferred from a peak. */
  readonly redlineMeasured: boolean;
}

/**
 * What to offer the driver at the end, for confirmation rather than for application.
 *
 * The redline is the honest part. Met the limiter, and it is known; otherwise all that is known is
 * that the engine goes at least as high as it was seen to go, so the offer is that peak rounded up
 * and flagged as inferred. Falls back to what was passed in when the car said nothing at all.
 */
export function suggestedRanges(
  result: CalibrationResult<string>,
  fallback: { readonly speed: number; readonly redline: number },
): SuggestedRanges {
  const speed = result.peakSpeed === null ? fallback.speed : Math.max(above(result.peakSpeed, 10), 120);

  // Measured: kept as it was read. The margin the dial draws above the redline belongs to
  // `rpmScale`, and adding it here too would put the red zone where the needle never goes.
  if (result.limiterRpm !== null) {
    return { speed, redline: toNearest(result.limiterRpm, 100), redlineMeasured: true };
  }

  // Inferred: the engine goes at LEAST this high, so the offer has to clear the peak.
  if (result.peakRpm !== null) {
    return { speed, redline: redlineFromPeak(result.peakRpm), redlineMeasured: false };
  }

  return { speed, redline: fallback.redline, redlineMeasured: false };
}
