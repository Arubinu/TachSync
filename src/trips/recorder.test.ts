import { describe, expect, it } from 'vitest';
import { EMPTY_FRAME } from '../telemetry/types';
import type { TelemetrySnapshot } from '../telemetry/TelemetryStore';
import { MIN_DISTANCE_KM, MIN_DURATION_S, TripRecorder } from './recorder';

const CONTEXT = { vehicleId: 'v1', vehicle: 'Golf GTI', source: 'simulated' } as const;

/** Minimal snapshot: what the store would deliver after a few frames. */
function snapshot(options: {
  readonly distanceKm?: number;
  readonly durationS?: number;
  readonly speed?: number | null;
  readonly rpm?: number | null;
  readonly litresUsed?: number;
  readonly averagePer100km?: number | null;
}): TelemetrySnapshot {
  const distanceKm = options.distanceKm ?? 10;
  const durationS = options.durationS ?? 600;

  return {
    frame: {
      ...EMPTY_FRAME,
      speed: options.speed ?? null,
      rpm: options.rpm ?? null,
    },
    trip: {
      distanceKm,
      durationS,
      averageKmh: durationS > 0 ? (distanceKm / durationS) * 3600 : 0,
      litresUsed: options.litresUsed ?? 0.7,
      averagePer100km: options.averagePer100km ?? 7,
    },
  };
}

describe('TripRecorder', () => {
  it('keeps the peak speed and engine speed', () => {
    const recorder = new TripRecorder(CONTEXT, 1000);
    recorder.observe(snapshot({ speed: 50, rpm: 2000 }));
    recorder.observe(snapshot({ speed: 130, rpm: 5500 }));
    recorder.observe(snapshot({ speed: 90, rpm: 3000 }));

    const trip = recorder.record(2000);

    expect(trip?.maxKmh).toBe(130);
    expect(trip?.maxRpm).toBe(5500);
  });

  it('leaves engine speed absent when the vehicle does not publish it', () => {
    const recorder = new TripRecorder(CONTEXT, 1000);
    recorder.observe(snapshot({ speed: 80, rpm: null }));

    // `null` and not zero: the channel is missing, it is not worth zero.
    expect(recorder.record(2000)?.maxRpm).toBeNull();
  });

  it('takes the totals from the store without recomputing them', () => {
    const recorder = new TripRecorder(CONTEXT, 1000);
    recorder.observe(snapshot({ distanceKm: 42.5, durationS: 1800, litresUsed: 3.4 }));

    const trip = recorder.record(2000);

    expect(trip?.distanceKm).toBe(42.5);
    expect(trip?.durationS).toBe(1800);
    expect(trip?.litresUsed).toBe(3.4);
    expect(trip?.averageKmh).toBeCloseTo(85, 5);
  });

  it('keeps nothing without a single frame', () => {
    expect(new TripRecorder(CONTEXT, 1000).record(2000)).toBeNull();
  });

  it('discards a trip too short in distance', () => {
    const recorder = new TripRecorder(CONTEXT, 1000);
    recorder.observe(snapshot({ distanceKm: MIN_DISTANCE_KM - 0.01, durationS: 600 }));

    expect(recorder.record(2000)).toBeNull();
  });

  it('discards an engine idling at a standstill, however far it revs', () => {
    const recorder = new TripRecorder(CONTEXT, 1000);
    // The two conditions are joint: distance alone is not enough.
    recorder.observe(snapshot({ distanceKm: 5, durationS: MIN_DURATION_S - 1 }));

    expect(recorder.record(2000)).toBeNull();
  });

  it('marks without scattering: two readings carry the same identifier', () => {
    const recorder = new TripRecorder(CONTEXT, 1000);
    recorder.observe(snapshot({ distanceKm: 3, durationS: 300 }));
    const marker = recorder.record(5000);

    recorder.observe(snapshot({ distanceKm: 9, durationS: 900 }));
    const end = recorder.record(9000);

    // The second rewrites the first instead of piling up beside it, which is what
    // allows checkpointing while driving without filling the history with copies.
    expect(end?.id).toBe(marker?.id);
    expect(end?.distanceKm).toBe(9);
    expect(end?.endedAt).toBe(9000);
  });

  it('keeps the context and the bounds of the trip', () => {
    const recorder = new TripRecorder({ vehicleId: 'v2', vehicle: 'Clio', source: 'obd' }, 1_700_000_000_000);
    recorder.observe(snapshot({ durationS: 1234.6 }));

    const trip = recorder.record(1_700_000_600_000);

    expect(trip?.vehicle).toBe('Clio');
    expect(trip?.source).toBe('obd');
    expect(trip?.startedAt).toBe(1_700_000_000_000);
    expect(trip?.endedAt).toBe(1_700_000_600_000);
    // The id depends only on the start time: a later checkpoint must rewrite the
    // same entry, not scatter a second one.
    expect(trip?.id).toBe('1700000000000');
  });
});
