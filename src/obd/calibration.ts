/**
 * Calibrating the dashboard on the car actually plugged in.
 *
 * Ranges used to be typed by hand, which asks the driver for numbers they rarely know: nobody reads
 * their redline off the manual, and a speedometer full scale guessed from the dial is the dial's
 * own lie. The car knows all of it and answers when asked.
 *
 * Deliberately pure: it consumes samples and returns findings, holding no transport and no clock.
 * That is what lets the whole protocol be exercised against synthetic traces, which matters here
 * more than elsewhere - the real thing needs a car, a road, and an adapter nobody has yet.
 *
 * Nothing is applied on its own. Every finding comes back with what it was measured from, for a
 * screen to show and a human to confirm: a calibration that silently rewrites the dials would be
 * impossible to tell from a bug.
 */

/**
 * Turns a live frame into an observation.
 *
 * A frame carries a dozen channels; calibration reads six. Narrowing here rather than storing the
 * frame keeps a ninety-second phase to a few kilobytes, and keeps the measurements honest about
 * what they actually depend on.
 */
export function toCalibrationSample(frame: {
  readonly timestamp: number;
  readonly rpm: number | null;
  readonly speed: number | null;
  readonly throttle: number | null;
  readonly engineLoad: number | null;
  readonly coolantTemp: number | null;
  readonly map: number | null;
  readonly barometric: number | null;
}): CalibrationSample {
  return {
    at: frame.timestamp,
    rpm: frame.rpm,
    speed: frame.speed,
    throttle: frame.throttle,
    engineLoad: frame.engineLoad,
    coolantTemp: frame.coolantTemp,
    map: frame.map,
    barometric: frame.barometric,
  };
}

/** One observation, taken from a telemetry frame. */
export interface CalibrationSample {
  /** Milliseconds, any origin. */
  readonly at: number;
  readonly rpm: number | null;
  readonly speed: number | null;
  readonly throttle: number | null;
  readonly engineLoad: number | null;
  readonly coolantTemp: number | null;
  readonly map: number | null;
  readonly barometric: number | null;
}

export type CalibrationStepId = 'warmup' | 'idle' | 'road' | 'modes';

/** Coolant temperature from which readings are trusted, C. */
export const WARM_COOLANT_C = 70;
/** Below this, the car counts as stopped, km/h. */
const STOPPED_KMH = 2;
/** Above this the pedal is no longer released, %. */
const PEDAL_RELEASED = 5;
/** From here the engine is being asked for everything, %. */
const PEDAL_FLOORED = 80;
/** Manifold pressure above atmospheric that means forced induction, kPa. */
const BOOST_MARGIN_KPA = 15;
/** Readings needed before an idle speed is worth stating. */
const MIN_IDLE_SAMPLES = 20;
/** A limiter holds the engine within this band, rpm. */
const PLATEAU_BAND_RPM = 120;
/** And holds it there at least this long, ms. */
const PLATEAU_MS = 300;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Idle speed: the median of a released pedal on a stopped, warm engine.
 *
 * Median rather than mean, and rather than the minimum. A cold engine idles high and an air
 * conditioning compressor cutting in shifts it for a few seconds; the mean follows both, the
 * minimum latches onto the single lowest dip before a stall. The median ignores what is brief.
 */
export function idleRpm(samples: readonly CalibrationSample[]): number | null {
  const held = samples
    .filter(
      (s) =>
        s.rpm !== null &&
        s.rpm > 0 &&
        (s.speed ?? 0) <= STOPPED_KMH &&
        (s.throttle ?? 0) <= PEDAL_RELEASED &&
        (s.coolantTemp ?? 0) >= WARM_COOLANT_C,
    )
    .map((s) => s.rpm as number);

  if (held.length < MIN_IDLE_SAMPLES) return null;
  return Math.round(median(held));
}

/**
 * Rev limiter, when the car has actually met it.
 *
 * The signal is a plateau, not a peak: the pedal stays down while the engine speed stops rising.
 * Anything else is just the highest gear change of the day.
 *
 * There is deliberately no step asking anyone to bounce off the limiter. In neutral it would
 * measure the wrong thing - most modern cars hold a much lower no-load limit to protect the engine
 * - and under load it is a poor thing to ask of someone driving. This reads what happens anyway.
 */
export function limiterRpm(samples: readonly CalibrationSample[]): number | null {
  let best: number | null = null;

  for (let start = 0; start < samples.length; start += 1) {
    const first = samples[start];
    if (first === undefined || first.rpm === null) continue;
    if ((first.throttle ?? 0) < PEDAL_FLOORED) continue;

    let end = start;
    let low = first.rpm;
    let high = first.rpm;

    for (let i = start + 1; i < samples.length; i += 1) {
      const s = samples[i];
      if (s === undefined || s.rpm === null || (s.throttle ?? 0) < PEDAL_FLOORED) break;
      const nextLow = Math.min(low, s.rpm);
      const nextHigh = Math.max(high, s.rpm);
      if (nextHigh - nextLow > PLATEAU_BAND_RPM) break;
      low = nextLow;
      high = nextHigh;
      end = i;
    }

    const held = (samples[end]?.at ?? 0) - first.at;
    if (held >= PLATEAU_MS) best = Math.max(best ?? 0, Math.round(high));
  }

  return best;
}

/** Highest engine speed seen at all. A floor under the redline, never the redline itself. */
export function peakRpm(samples: readonly CalibrationSample[]): number | null {
  const revs = samples.map((s) => s.rpm).filter((r): r is number => r !== null);
  return revs.length === 0 ? null : Math.round(Math.max(...revs));
}

/** Highest road speed seen at all. */
export function peakSpeed(samples: readonly CalibrationSample[]): number | null {
  const speeds = samples.map((s) => s.speed).filter((s): s is number => s !== null);
  return speeds.length === 0 ? null : Math.round(Math.max(...speeds));
}

/**
 * Forced induction: manifold pressure above atmospheric, by more than sensor noise.
 *
 * `null` rather than `false` when the car never reported both pressures - not knowing and knowing
 * there is no turbo are different answers, and only the second should hide the boost gauge.
 */
export function hasBoost(samples: readonly CalibrationSample[]): boolean | null {
  const pairs = samples.filter((s) => s.map !== null && s.barometric !== null);
  if (pairs.length === 0) return null;
  return pairs.some((s) => (s.map as number) - (s.barometric as number) > BOOST_MARGIN_KPA);
}

/** Whether the engine reached a temperature where its readings settle. */
export function isWarm(samples: readonly CalibrationSample[]): boolean {
  return samples.some((s) => (s.coolantTemp ?? -273) >= WARM_COOLANT_C);
}

/** Everything read while the car sat in one of its drive modes. */
export interface ModeReading {
  /** What the driver selected on the car: `eco`, `sport`, or whatever it is called there. */
  readonly mode: string;
  /** PID to the values it returned while that mode was held. */
  readonly values: ReadonlyMap<number, readonly number[]>;
}

/** A PID whose value tracks the selected mode. */
export interface ModeCandidate {
  readonly pid: number;
  /** Representative value per mode, in the order the modes were read. */
  readonly byMode: ReadonlyMap<string, number>;
  /**
   * How cleanly the modes come apart: the narrowest gap between two modes, divided by the widest
   * wobble inside one. Above 1 the gap beats the noise; well above, it is not noise at all.
   */
  readonly separation: number;
}

/** Nothing below this is worth showing: the modes are not really apart. */
const MIN_SEPARATION = 3;

/**
 * PIDs that answer differently depending on the mode.
 *
 * The whole point of the exercise, and the part most likely to come back empty. No standard PID
 * reports the drive mode; manufacturers put it on their own service or on a raw CAN frame, which an
 * ordinary ELM327 restricted to mode 01 never sees. Run anyway: it costs one stationary minute, it
 * occasionally catches a car whose fuelling map shifts enough to show through, and the readings it
 * leaves behind are exactly what a later analysis needs.
 *
 * Requires every mode to have answered, so a PID missing from one of them cannot look like a
 * difference. A value that simply drifts - coolant climbing while the car idles through the
 * protocol - fails on its own spread rather than being named here: it wobbles inside each mode as
 * much as it moves between them.
 */
export function modeCandidates(
  readings: readonly ModeReading[],
  minSeparation = MIN_SEPARATION,
): readonly ModeCandidate[] {
  if (readings.length < 2) return [];

  const everywhere = [...(readings[0]?.values.keys() ?? [])].filter((pid) =>
    readings.every((reading) => (reading.values.get(pid)?.length ?? 0) > 0),
  );

  const candidates: ModeCandidate[] = [];

  for (const pid of everywhere) {
    const byMode = new Map<string, number>();
    let widestWobble = 0;

    for (const reading of readings) {
      const values = reading.values.get(pid) as readonly number[];
      byMode.set(reading.mode, median(values));
      widestWobble = Math.max(widestWobble, Math.max(...values) - Math.min(...values));
    }

    const levels = [...byMode.values()].sort((a, b) => a - b);
    let narrowestGap = Infinity;
    for (let i = 1; i < levels.length; i += 1) {
      narrowestGap = Math.min(narrowestGap, (levels[i] ?? 0) - (levels[i - 1] ?? 0));
    }
    if (narrowestGap === 0) continue;

    // A perfectly steady reading has no wobble to divide by; treat one unit as the floor, since
    // PID values are integers and nothing finer can be told apart anyway.
    const separation = narrowestGap / Math.max(widestWobble, 1);
    if (separation >= minSeparation) candidates.push({ pid, byMode, separation });
  }

  return candidates.sort((a, b) => b.separation - a.separation);
}

/**
 * How a car behaves in one of its drive modes.
 *
 * The point of this is that it works when nothing reports the mode. Almost no car publishes its
 * selector position over standard OBD, but every car betrays the mode in how it answers: Sport
 * hands out more engine load for the same pedal, and holds a gear where Eco would have shifted up.
 * Measure that once per mode with the driver turning the dial, and the mode becomes readable
 * afterwards from behaviour alone.
 *
 * Idle speed is kept but weighted least. An air conditioning compressor cutting in raises it, and
 * that must not read as a change of mode - which is exactly why the discriminating axes are the two
 * measured under load.
 */
export interface ModeSignature<M extends string = string> {
  readonly mode: M;
  /** Engine load per unit of throttle: how eagerly the engine answers the pedal. */
  readonly loadPerThrottle: number | null;
  /** Engine speed held per km/h: how willingly the gearbox stays in a gear. */
  readonly rpmPerKmh: number | null;
  /** Idle speed, rpm. Weak signal - see above. */
  readonly idleRpm: number | null;
}

/** Below this road speed the ratio is meaningless: the car is stopping, or in first. */
const RATIO_MIN_KMH = 20;
/** Below this the pedal is too lightly pressed for the mapping to show. */
const MAPPING_MIN_THROTTLE = 10;
/** Readings needed on an axis before it is stated. */
const MIN_AXIS_SAMPLES = 8;

function axis(values: readonly number[]): number | null {
  return values.length < MIN_AXIS_SAMPLES ? null : median(values);
}

/** Distils one mode's samples into the three axes. */
export function buildSignature<M extends string>(
  mode: M,
  samples: readonly CalibrationSample[],
): ModeSignature<M> {
  const mapping: number[] = [];
  const ratio: number[] = [];

  for (const s of samples) {
    if (s.throttle !== null && s.engineLoad !== null && s.throttle >= MAPPING_MIN_THROTTLE) {
      mapping.push(s.engineLoad / s.throttle);
    }
    if (s.rpm !== null && s.speed !== null && s.speed >= RATIO_MIN_KMH) {
      ratio.push(s.rpm / s.speed);
    }
  }

  return {
    mode,
    loadPerThrottle: axis(mapping),
    rpmPerKmh: axis(ratio),
    idleRpm: idleRpm(samples),
  };
}

/** What the axes are worth when telling two modes apart. */
const WEIGHTS = { loadPerThrottle: 1, rpmPerKmh: 1, idleRpm: 0.25 } as const;
type Axis = keyof typeof WEIGHTS;
const AXES: readonly Axis[] = ['loadPerThrottle', 'rpmPerKmh', 'idleRpm'];

/**
 * Relative distance between two signatures, 0 when identical.
 *
 * Relative rather than absolute: `rpmPerKmh` runs around 40 and `loadPerThrottle` around 1, so a
 * raw difference would let the first decide everything. Only axes present on both sides count -
 * a missing one is not a difference.
 */
function distance(a: ModeSignature<string>, b: ModeSignature<string>): number | null {
  let total = 0;
  let weight = 0;

  for (const key of AXES) {
    const left = a[key];
    const right = b[key];
    if (left === null || right === null) continue;
    const scale = Math.max(Math.abs(left), Math.abs(right), 1e-6);
    total += WEIGHTS[key] * (Math.abs(left - right) / scale);
    weight += WEIGHTS[key];
  }

  return weight === 0 ? null : total / weight;
}

/**
 * How far apart the calibrated modes are from each other.
 *
 * Worth showing at the end of a calibration: on a car whose modes barely differ, detection cannot
 * work afterwards, and saying so beats letting the dashboard announce a mode it is guessing.
 */
export function signatureSpread(signatures: readonly ModeSignature<string>[]): number | null {
  let closest: number | null = null;

  for (let i = 0; i < signatures.length; i += 1) {
    for (let j = i + 1; j < signatures.length; j += 1) {
      const gap = distance(signatures[i]!, signatures[j]!);
      if (gap === null) continue;
      closest = closest === null ? gap : Math.min(closest, gap);
    }
  }

  return closest;
}

export interface ModeVerdict<M extends string = string> {
  readonly mode: M;
  /** 0 to 1. How much nearer the winner is than the runner-up. */
  readonly confidence: number;
}

/**
 * Which calibrated mode the car is behaving like.
 *
 * Returns nothing when the nearest two are within a hair of each other: a mode announced on a coin
 * toss is worse than no mode at all, since the whole ambience follows it.
 */
export function classifyMode<M extends string>(
  live: ModeSignature<string>,
  signatures: readonly ModeSignature<M>[],
  minConfidence = 0.2,
): ModeVerdict<M> | null {
  const ranked = signatures
    .map((signature) => ({ mode: signature.mode, gap: distance(live, signature) }))
    .filter((entry): entry is { mode: M; gap: number } => entry.gap !== null)
    .sort((a, b) => a.gap - b.gap);

  const best = ranked[0];
  if (best === undefined) return null;
  if (ranked.length === 1) return { mode: best.mode, confidence: 1 };

  const next = ranked[1]!;
  // Both distances near zero means the car behaves the same in both: nothing to choose between.
  const confidence = next.gap === 0 ? 0 : (next.gap - best.gap) / next.gap;
  return confidence < minConfidence ? null : { mode: best.mode, confidence };
}

/**
 * Below this, calibrated modes cannot be told apart afterwards.
 *
 * Measured on the protocol's own traces: two genuinely different modes land well above 0.2, while a
 * Sport that changes almost nothing lands under 0.05. The floor sits between them, nearer the low
 * side - refusing a usable calibration is worse than accepting a marginal one, since the fallback
 * is a generic guess either way.
 */
export const USABLE_SPREAD = 0.1;
