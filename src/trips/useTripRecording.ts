import { useCallback, useEffect, useRef } from 'react';
import type { TelemetryStore } from '../telemetry/TelemetryStore';
import { TripRecorder } from './recorder';
import { saveTrip } from './store';
import { saveTrace } from './trace';
import type { TripRecord } from './types';

/**
 * Checkpoint interval, in milliseconds.
 *
 * Nobody disconnects from a dashboard cleanly: the ignition goes off and the tab dies without React
 * unmounting anything. Writing only on close would lose nearly every trip - `pagehide` does not
 * help, because opening the database is asynchronous and the page dies before the transaction
 * opens.
 *
 * The trip is therefore rewritten while driving, under the same id. Worst case, the last 20 seconds
 * are lost.
 */
const CHECKPOINT_MS = 20_000;

/**
 * Sampling interval, in milliseconds.
 *
 * A store subscription is not enough: it is served by the animation loop, which the browser stops
 * as soon as the page is hidden. Measured on a backgrounded window: zero frames in three seconds,
 * where a timer still fired its five ticks. That is exactly a phone whose screen switches off while
 * the adapter keeps streaming.
 *
 * The running totals the store keeps stay exact at any sampling rate, since it integrates on every
 * frame received; only the maxima degrade as samples spread out, and the subscription catches those
 * up while the screen is on.
 */
const SAMPLE_MS = 1000;

export interface TripRecordingOptions {
  readonly store: TelemetryStore;
  /** `null` until a source is chosen: there is nothing to record before that. */
  readonly source: TripRecord['source'] | null;
  /** Identifies the car; the label below only says how it read at the time. */
  readonly vehicleId: string;
  readonly vehicle: string;
  /** Needed by the style engine: the same revs mean different things on different engines. */
  readonly redline: number;
  /** Called once the trip is closed and written, so history can refresh. */
  readonly onSaved: () => void;
}

/**
 * Records the trip while a source is streaming.
 *
 * A trip starts when the source connects and ends when it disconnects: the only two moments known
 * with certainty. Guessing a start from the first non-zero frame and an end from a long standstill
 * would cut a trip at every red light.
 *
 * The vehicle is read when the trip opens, not when it closes: a trip belongs to the car it started
 * with, even if the setting changes on the way.
 */
export function useTripRecording({
  store,
  source,
  vehicleId,
  vehicle,
  redline,
  onSaved,
}: TripRecordingOptions): { readonly restart: () => void } {
  const recorder = useRef<TripRecorder | null>(null);
  // Read when the trip opens but deliberately not dependencies: including them would open a new
  // trip on every vehicle change, and the second would recount the first one's distance since the
  // store totals do not reset.
  const latest = useRef({ vehicleId, vehicle, redline, onSaved });
  latest.current = { vehicleId, vehicle, redline, onSaved };

  /** Writes the current state without closing anything. */
  const write = useCallback((then?: () => void) => {
    const trip = recorder.current?.record(Date.now()) ?? null;
    // Below the thresholds it is not a trip: nothing to write, and nothing to erase either since
    // nothing was written under this id.
    if (trip === null) return;

    void saveTrip(trip).then(
      () => then?.(),
      // Quota, private browsing: the trip is lost but the drive goes on.
      () => undefined,
    );

    /*
     * The trace follows the summary, and never the other way round.
     *
     * Written after, and its failure swallowed on its own: a trace is a nicety, a trip is the
     * record. Losing the curve because storage was tight must not cost the drive itself.
     */
    const trace = recorder.current?.trace() ?? null;
    if (trace !== null) void saveTrace(trace).catch(() => undefined);
  }, []);

  const close = useCallback(() => {
    if (recorder.current === null) return;
    write(() => latest.current.onSaved());
    recorder.current = null;
  }, [write]);

  useEffect(() => {
    if (source === null) return;

    recorder.current = new TripRecorder(
      { vehicleId: latest.current.vehicleId, vehicle: latest.current.vehicle, source },
      Date.now(),
    );
    // The two sources complement each other without interfering: the accumulator only keeps maxima
    // and the last state seen, so sampling twice is the same as sampling once.
    const unsubscribe = store.subscribe((snapshot) => recorder.current?.observe(snapshot));
    const sampler = window.setInterval(() => {
      recorder.current?.observe(store.current);
      // Only here, and never from the subscription: the style engine integrates over time, so it
      // needs one feed per interval, not one per frame.
      recorder.current?.observeStyle(store.current, SAMPLE_MS / 1000, latest.current.redline);
      // Same beat, same reason - and one reading per second is all a curve on a phone can show.
      recorder.current?.sample(store.current);
    }, SAMPLE_MS);
    const timer = window.setInterval(() => write(), CHECKPOINT_MS);
    // Last chance when the page leaves cleanly. No guarantee - hence the checkpoints - but it costs
    // one line.
    const leave = (): void => write();
    window.addEventListener('pagehide', leave);

    return () => {
      window.clearInterval(sampler);
      window.clearInterval(timer);
      window.removeEventListener('pagehide', leave);
      unsubscribe();
      close();
    };
  }, [store, source, close, write]);

  /**
   * Closes the current trip and opens a fresh one.
   *
   * Called when the counters are reset: the store totals restart from zero, and a recorder carrying
   * on would see its distance drop and keep a trip missing everything before the reset.
   */
  const restart = useCallback(() => {
    if (recorder.current === null || source === null) return;
    const { vehicleId, vehicle: label } = latest.current;
    close();
    recorder.current = new TripRecorder({ vehicleId, vehicle: label, source }, Date.now());
  }, [close, source]);

  return { restart };
}
