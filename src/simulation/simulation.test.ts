import { describe, expect, it } from 'vitest';
import { SimulatedSource } from './SimulatedSource';
import { CITY_CAR_NA, HOT_HATCH_TURBO, massAirFlow, rpmForSpeed } from './vehicle';
import { boostPressure, fuelRateLitresPerHour, type TelemetryFrame } from '../telemetry/types';
import type { DrivingProfile } from './driver';

/**
 * Runs a whole trip at a fixed step, with no clock. This is also the harness used to test the
 * analysis engines.
 */
function driveFor(profile: DrivingProfile, seconds: number, seed = 42): TelemetryFrame[] {
  const source = new SimulatedSource({ profile, seed, vehicle: HOT_HATCH_TURBO });
  const dt = 0.1;
  const frames: TelemetryFrame[] = [];
  for (let t = 0; t < seconds; t += dt) {
    frames.push(source.advance(dt));
  }
  return frames;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function nonNull<T>(values: (T | null)[]): T[] {
  return values.filter((v): v is T => v !== null);
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index] ?? 0;
}

describe('physics model', () => {
  it('produces a realistic idle fuel use (~1 L/h)', () => {
    const idleRpm = HOT_HATCH_TURBO.idleRpm;
    const idleMap = 101.3 * 0.3;
    const maf = massAirFlow(HOT_HATCH_TURBO, idleRpm, idleMap);
    const litresPerHour = fuelRateLitresPerHour({
      maf,
      fuelRate: null,
    } as TelemetryFrame);

    expect(litresPerHour).not.toBeNull();
    expect(litresPerHour!).toBeGreaterThan(0.5);
    expect(litresPerHour!).toBeLessThan(2.5);
  });

  it('ties engine speed to road speed through the engaged gear', () => {
    // Same speed, taller gear, so lower revs.
    const speedMs = 25;
    const rpmThird = rpmForSpeed(HOT_HATCH_TURBO, speedMs, 3);
    const rpmSixth = rpmForSpeed(HOT_HATCH_TURBO, speedMs, 6);

    expect(rpmThird).toBeGreaterThan(rpmSixth);
    expect(rpmSixth).toBeGreaterThan(HOT_HATCH_TURBO.idleRpm);
    expect(rpmThird).toBeLessThanOrEqual(HOT_HATCH_TURBO.redlineRpm);
  });

  it('stays within plausible physical ranges over a whole trip', () => {
    for (const frame of driveFor('normal', 120)) {
      expect(frame.speed!).toBeGreaterThanOrEqual(0);
      expect(frame.speed!).toBeLessThan(250);
      expect(frame.rpm!).toBeGreaterThanOrEqual(HOT_HATCH_TURBO.idleRpm);
      expect(frame.rpm!).toBeLessThanOrEqual(HOT_HATCH_TURBO.redlineRpm);
      expect(frame.throttle!).toBeGreaterThanOrEqual(0);
      expect(frame.throttle!).toBeLessThanOrEqual(100);
      expect(frame.engineLoad!).toBeGreaterThanOrEqual(0);
      expect(frame.engineLoad!).toBeLessThanOrEqual(100);
      expect(Math.abs(frame.lateralG!)).toBeLessThan(1.5);
    }
  });

  it('is deterministic at equal seed', () => {
    const a = driveFor('sporty', 30, 7).map((f) => f.speed);
    const b = driveFor('sporty', 30, 7).map((f) => f.speed);
    expect(a).toEqual(b);
  });
});

describe('unavailable channels', () => {
  it('reports no boost on a naturally aspirated engine', () => {
    const source = new SimulatedSource({ vehicle: CITY_CAR_NA, profile: 'sporty', seed: 3 });
    let maxBoost = -Infinity;
    for (let t = 0; t < 60; t += 0.1) {
      maxBoost = Math.max(maxBoost, boostPressure(source.advance(0.1)) ?? -Infinity);
    }
    // Without a turbo, manifold pressure never exceeds atmospheric.
    expect(maxBoost).toBeLessThanOrEqual(0.001);
  });

  it('reaches positive boost on a turbocharged engine', () => {
    const frames = driveFor('aggressive', 90);
    const maxBoost = Math.max(...frames.map((f) => boostPressure(f) ?? -Infinity));
    expect(maxBoost).toBeGreaterThan(10);
  });

  it('estimates fuel use from the MAF when PID 0x5E is missing', () => {
    const source = new SimulatedSource({ seed: 5 });
    expect(source.getAvailableChannels().has('fuelRate')).toBe(false);

    const frame = source.advance(0.1);
    expect(frame.fuelRate).toBeNull();
    expect(fuelRateLitresPerHour(frame)).not.toBeNull();
  });
});

describe('driving profiles', () => {
  /**
   * The test that really matters: the profiles must be separable on the quantities the analysis
   * engines measure. If those gaps do not exist, no classifier will tell them apart in a car
   * either.
   *
   * Important: MEAN throttle does not discriminate. An aggressive driver reaches the target speed
   * in seconds then lifts, where an eco driver holds a moderate opening for longer - the two means
   * converge. What really separates the styles is the PEAK opening and the pedal's RATE OF CHANGE,
   * so the classifier must be built on percentiles and derivatives rather than means.
   */
  it('separates eco from aggressive on peaks and derivatives, not means', () => {
    const eco = driveFor('eco', 180);
    const aggressive = driveFor('aggressive', 180);

    const p95Throttle = (frames: TelemetryFrame[]) =>
      percentile(nonNull(frames.map((f) => f.throttle)), 0.95);
    const meanThrottleRate = (frames: TelemetryFrame[]) => {
      const rates: number[] = [];
      for (let i = 1; i < frames.length; i += 1) {
        rates.push(Math.abs(frames[i]!.throttle! - frames[i - 1]!.throttle!));
      }
      return mean(rates);
    };
    const meanRpm = (frames: TelemetryFrame[]) => mean(nonNull(frames.map((f) => f.rpm)));
    const peakLongG = (frames: TelemetryFrame[]) =>
      Math.max(...nonNull(frames.map((f) => f.longitudinalG)).map(Math.abs));

    expect(p95Throttle(aggressive)).toBeGreaterThan(p95Throttle(eco) * 1.5);
    expect(meanThrottleRate(aggressive)).toBeGreaterThan(meanThrottleRate(eco) * 2);
    expect(meanRpm(aggressive)).toBeGreaterThan(meanRpm(eco));
    expect(peakLongG(aggressive)).toBeGreaterThan(peakLongG(eco));
  });

  it('does NOT separate the styles on mean throttle (regression guard)', () => {
    // Documents the trap above explicitly: if this assertion ever breaks, the driver model has
    // changed in nature and the classifier must be re-evaluated.
    const meanThrottle = (profile: DrivingProfile) =>
      mean(nonNull(driveFor(profile, 180).map((f) => f.throttle)));

    const ratio = meanThrottle('aggressive') / meanThrottle('eco');
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(1.5);
  });

  it('burns more fuel aggressive than eco', () => {
    const consumption = (profile: DrivingProfile) =>
      mean(nonNull(driveFor(profile, 180).map((f) => fuelRateLitresPerHour(f))));

    expect(consumption('aggressive')).toBeGreaterThan(consumption('eco'));
  });

  it('revs higher before shifting when sporty', () => {
    const shiftRpm = (profile: DrivingProfile) => {
      const frames = driveFor(profile, 180);
      const peaks: number[] = [];
      for (let i = 1; i < frames.length; i += 1) {
        const previous = frames[i - 1]!;
        const current = frames[i]!;
        // A gear change means the gear goes up one step while moving.
        if (current.gear! > previous.gear! && previous.gear! > 0) {
          peaks.push(previous.rpm!);
        }
      }
      return peaks.length > 0 ? mean(peaks) : 0;
    };

    expect(shiftRpm('sporty')).toBeGreaterThan(shiftRpm('eco'));
  });
});
