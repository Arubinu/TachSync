import { describe, expect, it } from 'vitest';
import { EMPTY_FRAME } from '../telemetry/types';
import { TripRecorder } from './recorder';
import { byteSize } from './format';
import { MAX_SAMPLES, TraceBuilder, weightOf } from './trace';
import type { TelemetrySnapshot } from '../telemetry/TelemetryStore';

describe('collecting a trace', () => {
  it('keeps what it is given, in order', () => {
    const builder = new TraceBuilder();
    builder.add(0, 0, 800, 0, -50);
    builder.add(1, 12, 1800, 30, -20);

    const trace = builder.build('t1');

    expect(trace.id).toBe('t1');
    expect([...trace.at]).toEqual([0, 1]);
    expect([...trace.speed]).toEqual([0, 12]);
    expect([...trace.rpm]).toEqual([800, 1800]);
  });

  it('never grows past the cap, however long the drive', () => {
    const builder = new TraceBuilder();
    // Eight hours at one per second, four times over the cap.
    for (let i = 0; i < 28_800; i += 1) builder.add(i, 50, 2000, 20, 0);

    expect(builder.length).toBeLessThanOrEqual(MAX_SAMPLES);
  });

  it('thins evenly rather than forgetting the start', () => {
    // Dropping the oldest would draw a trip that begins where the driver does not remember
    // beginning. The whole drive has to stay visible, at a coarser step.
    const builder = new TraceBuilder();
    for (let i = 0; i < 20_000; i += 1) builder.add(i, 0, 0, 0, 0);

    const trace = builder.build('t1');

    expect(trace.at[0]).toBe(0);
    expect(trace.at[trace.at.length - 1]).toBeGreaterThan(19_000);
  });

  it('spaces its readings evenly after thinning', () => {
    const builder = new TraceBuilder();
    for (let i = 0; i < 20_000; i += 1) builder.add(i, 0, 0, 0, 0);

    const at = builder.build('t1').at;
    const steps = new Set<number>();
    for (let i = 1; i < at.length; i += 1) steps.add((at[i] as number) - (at[i - 1] as number));

    expect(steps.size).toBe(1);
  });
});

describe('a trip that records its shape', () => {
  const snapshot = (speed: number | null, rpm: number | null, durationS: number): TelemetrySnapshot =>
    ({
      frame: { ...EMPTY_FRAME, speed, rpm, throttle: 40 },
      trip: { durationS },
    }) as TelemetrySnapshot;

  it('has nothing to show before it is sampled', () => {
    const recorder = new TripRecorder(
      { vehicleId: 'v1', vehicle: 'Van', source: 'obd' },
      1_700_000_000_000,
    );

    expect(recorder.trace()).toBeNull();
  });

  it('keys the trace to its own trip', () => {
    const recorder = new TripRecorder(
      { vehicleId: 'v1', vehicle: 'Van', source: 'obd' },
      1_700_000_000_000,
    );
    recorder.sample(snapshot(30, 2000, 1));

    expect(recorder.trace()?.id).toBe('1700000000000');
  });

  it('marks an unavailable channel as a gap, not as zero', () => {
    // A car with no boost sensor would otherwise draw a flat line at atmospheric pressure, which
    // reads as a measurement rather than an absence.
    const recorder = new TripRecorder(
      { vehicleId: 'v1', vehicle: 'Van', source: 'obd' },
      1_700_000_000_000,
    );
    recorder.sample(snapshot(30, null, 1));

    const trace = recorder.trace();

    expect(trace?.speed[0]).toBe(30);
    expect(Number.isNaN(trace?.rpm[0] as number)).toBe(true);
    expect(Number.isNaN(trace?.boost[0] as number)).toBe(true);
  });

  it('measures along the trip clock, not the wall clock', () => {
    // The trip clock stops with the car; the wall clock does not. A trace on wall time would
    // stretch a traffic light into a flat hour.
    const recorder = new TripRecorder(
      { vehicleId: 'v1', vehicle: 'Van', source: 'obd' },
      1_700_000_000_000,
    );
    recorder.sample(snapshot(30, 2000, 5));
    recorder.sample(snapshot(30, 2000, 6));

    expect([...(recorder.trace()?.at ?? [])]).toEqual([5, 6]);
  });
});

describe('what a trip costs to keep', () => {
  const trace = (samples: number) => {
    const builder = new TraceBuilder();
    for (let i = 0; i < samples; i += 1) builder.add(i, 1, 1, 1, 1);
    return builder.build('t1');
  };

  it('counts four bytes per reading, on five channels', () => {
    expect(weightOf(trace(100))).toBe(100 * 5 * 4);
  });

  it('stays bounded however long the drive', () => {
    // The whole point of thinning: an eight-hour trip must not cost four times a two-hour one.
    expect(weightOf(trace(28_800))).toBeLessThanOrEqual(weightOf(trace(MAX_SAMPLES)));
  });

  it('reads in kilobytes below a megabyte, and megabytes above', () => {
    expect(byteSize(142 * 1024, 'en')).toBe('142 kB');
    expect(byteSize(1.2 * 1024 * 1024, 'en')).toBe('1.2 MB');
  });

  it('uses the units of whoever is reading', () => {
    // No seven strings to keep in step: every locale already has an official abbreviation.
    expect(byteSize(142 * 1024, 'fr')).toContain('ko');
    expect(byteSize(2 * 1024 * 1024, 'fr')).toContain('Mo');
  });
});
