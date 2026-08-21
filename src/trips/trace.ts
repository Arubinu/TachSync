import { run, TRACES } from '../storage/db';

/**
 * What a trip looked like while it happened.
 *
 * The summary in `TripRecord` answers "how was that drive"; this answers "what happened, and when".
 * They are stored apart because they are wanted apart: the list reads every summary at once and
 * must stay light, where a trace is read for one trip at a time and only if someone asks to see it.
 *
 * Typed arrays rather than objects: IndexedDB clones them as they are, and four bytes per reading
 * against the forty a `{ at, speed, rpm }` object costs is what makes keeping the trace reasonable
 * at all.
 *
 * A missing reading is `NaN`, never zero. A car with no boost sensor would otherwise draw a flat
 * line at atmospheric pressure, which is a measurement, not an absence.
 */

/**
 * Readings kept per trip.
 *
 * Two hours at one per second. Past it the trace halves its resolution rather than grow: a
 * four-hour drive is drawn from the same 7200 points, one every two seconds, and the curve is
 * indistinguishable at any size a screen can show.
 */
export const MAX_SAMPLES = 7200;

export interface TripTrace {
  /** The trip's id. A trace belongs to one and is fetched by it. */
  readonly id: string;
  /** Seconds since the trip opened. */
  readonly at: Float32Array;
  /** km/h */
  readonly speed: Float32Array;
  /** rpm */
  readonly rpm: Float32Array;
  /** % */
  readonly throttle: Float32Array;
  /** kPa above atmospheric, negative under vacuum. */
  readonly boost: Float32Array;
}

/** The channels a trace carries, in the order a chart offers them. */
export const TRACE_CHANNELS = ['speed', 'rpm', 'throttle', 'boost'] as const;
export type TraceChannel = (typeof TRACE_CHANNELS)[number];

/**
 * Collects readings while the trip runs.
 *
 * Plain arrays until the moment of writing: a trip's length is not known in advance, and growing a
 * typed array means copying it whole every time.
 */
export class TraceBuilder {
  #at: number[] = [];
  #speed: number[] = [];
  #rpm: number[] = [];
  #throttle: number[] = [];
  #boost: number[] = [];

  /**
   * One reading in every `#stride`, which doubles each time the trace fills up.
   *
   * Halving what is already held and then taking one sample in two keeps the spacing even across
   * the whole trip - the alternative, dropping the oldest, would draw a trip that starts where the
   * driver does not remember starting.
   */
  #stride = 1;
  #seen = 0;

  add(at: number, speed: number, rpm: number, throttle: number, boost: number): void {
    /*
     * Counted from zero, and tested before the increment.
     *
     * Thinning keeps the even positions of the array, so the readings that survive are those whose
     * index is a multiple of the new stride. Testing a one-based counter would accept the odd ones
     * instead, leaving one wrong gap at the join every time the trace halves.
     */
    const index = this.#seen;
    this.#seen += 1;
    if (index % this.#stride !== 0) return;

    this.#at.push(at);
    this.#speed.push(speed);
    this.#rpm.push(rpm);
    this.#throttle.push(throttle);
    this.#boost.push(boost);

    if (this.#at.length >= MAX_SAMPLES) this.#thin();
  }

  #thin(): void {
    const half = <T>(values: T[]): T[] => values.filter((_unused, index) => index % 2 === 0);
    this.#at = half(this.#at);
    this.#speed = half(this.#speed);
    this.#rpm = half(this.#rpm);
    this.#throttle = half(this.#throttle);
    this.#boost = half(this.#boost);
    this.#stride *= 2;
  }

  get length(): number {
    return this.#at.length;
  }

  build(id: string): TripTrace {
    return {
      id,
      at: new Float32Array(this.#at),
      speed: new Float32Array(this.#speed),
      rpm: new Float32Array(this.#rpm),
      throttle: new Float32Array(this.#throttle),
      boost: new Float32Array(this.#boost),
    };
  }
}

/**
 * Reads a trace back.
 *
 * `null` covers three cases the caller cannot tell apart and does not need to: a trip recorded
 * before traces existed, one whose trace was dropped to free space, and storage refusing to answer.
 * All three mean the same thing on screen - no curve for this trip.
 */
export async function readTrace(id: string): Promise<TripTrace | null> {
  try {
    const found = await run<TripTrace | undefined>(TRACES, 'readonly', (store) => store.get(id));
    return found ?? null;
  } catch {
    return null;
  }
}

export async function saveTrace(trace: TripTrace): Promise<void> {
  await run(TRACES, 'readwrite', (store) => store.put(trace));
}

export async function deleteTrace(id: string): Promise<void> {
  await run(TRACES, 'readwrite', (store) => store.delete(id));
}

export async function clearTraces(): Promise<void> {
  await run(TRACES, 'readwrite', (store) => store.clear());
}

/** What one trace occupies, in bytes. Its arrays and nothing else - the id is a few characters. */
export function weightOf(trace: TripTrace): number {
  return (
    trace.at.byteLength +
    trace.speed.byteLength +
    trace.rpm.byteLength +
    trace.throttle.byteLength +
    trace.boost.byteLength
  );
}

/**
 * Roughly what the traces occupy, in bytes.
 *
 * Counted from the arrays rather than asked of the browser: `navigator.storage.estimate()` reports
 * the whole origin - avatars, the background image, the precached shell - which would answer a
 * question nobody asked when the point is to decide whether to delete a trip.
 */
export async function tracesWeight(): Promise<number> {
  try {
    const all = await run<TripTrace[]>(TRACES, 'readonly', (store) => store.getAll());
    return all.reduce((total, trace) => total + weightOf(trace), 0);
  } catch {
    return 0;
  }
}
