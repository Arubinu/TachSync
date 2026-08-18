import { describe, expect, it } from 'vitest';
import { EMPTY_FRAME } from '../telemetry/types';
import type { TelemetrySnapshot } from '../telemetry/TelemetryStore';
import { DrivingStyleTracker } from './drivingStyle';

const REDLINE = 7000;

function frame(
  at: number,
  options: {
    readonly throttle?: number;
    readonly rpm?: number;
    readonly longitudinalG?: number;
    readonly lateralG?: number;
  },
): TelemetrySnapshot {
  return {
    frame: {
      ...EMPTY_FRAME,
      timestamp: at,
      throttle: options.throttle ?? 0,
      rpm: options.rpm ?? 800,
      longitudinalG: options.longitudinalG ?? 0,
      lateralG: options.lateralG ?? 0,
    },
    trip: { distanceKm: 0, durationS: 0, averageKmh: 0, litresUsed: 0, averagePer100km: null },
  };
}

function drive(
  tracker: DrivingStyleTracker,
  seconds: number,
  options: Parameters<typeof frame>[1],
  depart = 0,
): number {
  let at = depart;
  for (let i = 0; i < seconds * 10; i += 1) {
    at += 100;
    tracker.observe(frame(at, options), 0.1, REDLINE);
  }
  return at;
}

describe('DrivingStyleTracker', () => {
  it('ranks a trickle of throttle at idle as calm', () => {
    const tracker = new DrivingStyleTracker();
    drive(tracker, 12, { throttle: 6, rpm: 1200 });

    expect(tracker.style).toBe('calm');
  });

  it('tells fast and clean apart from jerky', () => {
    // Same sustained pace, but one holds it and the other shakes. A single score
    // would have ranked them in the same place, when they are two different drives.
    //
    // Several things must coincide to flip, deliberately: one firm braking event
    // happens to everyone arriving at a red light.
    const clean = new DrivingStyleTracker();
    drive(clean, 12, { throttle: 70, rpm: 4800 });

    const jerky = new DrivingStyleTracker();
    drive(jerky, 12, { throttle: 70, rpm: 4800, longitudinalG: -0.6, lateralG: 0.5 });

    expect(clean.style).toBe('spirited');
    expect(jerky.style).toBe('aggressive');
  });

  it('lets harshness fall back faster than energy', () => {
    const tracker = new DrivingStyleTracker();
    const after = drive(tracker, 12, { throttle: 70, rpm: 4800, longitudinalG: -0.4 });
    const harshnessBefore = tracker.levels.harshness;
    const energyBefore = tracker.levels.energy;

    // Three calm seconds: the jolt is forgotten, the pace takes longer.
    drive(tracker, 3, { throttle: 70, rpm: 4800 }, after);

    expect(tracker.levels.harshness).toBeLessThan(harshnessBefore * 0.5);
    expect(tracker.levels.energy).toBeGreaterThan(energyBefore * 0.8);
  });

  it('weighs lateral load heavier than longitudinal', () => {
    // A corner taken fast never happens by accident, where firm braking happens to
    // everyone arriving at a red light.
    const cornering = new DrivingStyleTracker();
    drive(cornering, 6, { lateralG: 0.3 });

    const braking = new DrivingStyleTracker();
    drive(braking, 6, { longitudinalG: -0.3 });

    expect(cornering.levels.harshness).toBeGreaterThan(braking.levels.harshness);
  });

  it('does not judge a single firm stop as jerky', () => {
    const tracker = new DrivingStyleTracker();
    drive(tracker, 4, { longitudinalG: -0.7 });

    expect(tracker.style).not.toBe('aggressive');
  });

  it('does not flicker at the boundary', () => {
    const tracker = new DrivingStyleTracker();
    const after = drive(tracker, 12, { throttle: 70, rpm: 4800 });
    expect(tracker.style).toBe('spirited');

    // A lull grazing the threshold must not flip the state.
    drive(tracker, 1, { throttle: 62, rpm: 4400 }, after);
    expect(tracker.style).toBe('spirited');
  });

  it('ignores an absurd time step', () => {
    const tracker = new DrivingStyleTracker();
    drive(tracker, 10, { throttle: 5, rpm: 900 });
    const calmEnergy = tracker.levels.energy;

    // A tab returning to the foreground: the smoothing must not jump straight to
    // its target as if it did not exist.
    tracker.observe(frame(600_000, { throttle: 100, rpm: 7000 }), 600, REDLINE);
    expect(tracker.levels.energy).toBeLessThan(calmEnergy + 0.8);
  });
});
