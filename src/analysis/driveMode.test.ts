import { describe, expect, it } from 'vitest';
import { EMPTY_FRAME } from '../telemetry/types';
import type { TelemetrySnapshot } from '../telemetry/TelemetryStore';
import { DriveModeTracker, WINDOW_SECONDS } from './driveMode';

const REDLINE = 7000;

function frame(at: number, throttle: number, rpm: number): TelemetrySnapshot {
  return {
    frame: { ...EMPTY_FRAME, timestamp: at, throttle, rpm, engineLoad: throttle },
    trip: { distanceKm: 0, durationS: 0, averageKmh: 0, litresUsed: 0, averagePer100km: null },
  };
}

/** Drives for `seconds` at a given throttle and engine speed. */
function drive(
  tracker: DriveModeTracker,
  seconds: number,
  throttle: number,
  rpm: number,
  depart = 0,
): number {
  let at = depart;
  for (let i = 0; i < seconds; i += 1) {
    at += 1000;
    tracker.observe(frame(at, throttle, rpm), REDLINE);
  }
  return at;
}

describe('DriveModeTracker', () => {
  it('ranks smooth steady driving as economical', () => {
    const tracker = new DriveModeTracker();
    drive(tracker, 60, 12, 1600);

    expect(tracker.mode).toBe('eco');
  });

  it('ranks full throttle at high revs as sporty', () => {
    const tracker = new DriveModeTracker();
    drive(tracker, 60, 75, 5200);

    expect(tracker.mode).toBe('sport');
  });

  it('tells the manner apart, at equal demand', () => {
    // Same mean throttle, but one alternates and the other holds: variance is what
    // separates them, and that is exactly what we mean to measure.
    const smooth = new DriveModeTracker();
    drive(smooth, 60, 40, 2600);

    const jolty = new DriveModeTracker();
    let at = 0;
    for (let i = 0; i < 60; i += 1) {
      at += 1000;
      jolty.observe(frame(at, i % 2 === 0 ? 5 : 75, 2600), REDLINE);
    }

    expect(jolty.score).toBeGreaterThan(smooth.score);
  });

  it('forgets what leaves the window', () => {
    const tracker = new DriveModeTracker();
    const after = drive(tracker, 30, 90, 6000);
    expect(tracker.mode).toBe('sport');

    // A minute of calm driving erases the previous one: the window slides.
    drive(tracker, WINDOW_SECONDS + 5, 10, 1500, after);
    expect(tracker.mode).toBe('eco');
  });

  it('does not flicker around a threshold', () => {
    const tracker = new DriveModeTracker();
    let at = drive(tracker, 60, 75, 5200);
    expect(tracker.mode).toBe('sport');

    // A lull grazing the threshold must not flip the mode: leaving one is harder
    // than entering it.
    for (let i = 0; i < 5; i += 1) {
      at += 1000;
      tracker.observe(frame(at, 70, 5000), REDLINE);
    }
    expect(tracker.mode).toBe('sport');
  });

  it('keeps its mode when the vehicle publishes nothing', () => {
    const tracker = new DriveModeTracker();
    drive(tracker, 60, 80, 5500);

    // Neither throttle nor revs: do not drift to eco for lack of data, keep what
    // was known.
    tracker.observe(
      { frame: { ...EMPTY_FRAME, timestamp: 61_000 }, trip: frame(0, 0, 0).trip },
      REDLINE,
    );
    expect(tracker.mode).toBe('sport');
  });
});
