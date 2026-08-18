import { describe, expect, it } from 'vitest';
import { CITY_CAR_NA, HOT_HATCH_TURBO, type VehicleSpec } from '../simulation/vehicle';
import { SimulatedSource } from '../simulation/SimulatedSource';
import type { DrivingProfile } from '../simulation/driver';
import type { TelemetrySnapshot } from '../telemetry/TelemetryStore';
import { DriveModeTracker, type DriveMode } from './driveMode';
import { DRIVING_STYLES, DrivingStyleTracker, type DrivingStyle } from './drivingStyle';

/**
 * Both engines, against simulated drives.
 *
 * Each engine's unit tests check its arithmetic on fabricated inputs; these check the only thing
 * that really matters - that gentle driving is recognised as gentle and nervous driving as nervous
 * - on frames produced by the physics model.
 *
 * Two vehicles with very different rev ranges and two seeds, because weights tuned on a single trip
 * prove nothing.
 */

const SECONDS = 120;
const STEP = 0.1;
/** The first seconds fill the smoothing filters; they are not judged. */
const WARMUP = 10;

const VEHICLES: readonly VehicleSpec[] = [HOT_HATCH_TURBO, CITY_CAR_NA];
const SEEDS = [42, 7] as const;

type Shares = Record<DrivingStyle, number>;

interface Run {
  readonly shares: Shares;
  readonly mode: DriveMode;
}

function drive(spec: VehicleSpec, profile: DrivingProfile, seed: number): Run {
  const source = new SimulatedSource({ profile, seed, vehicle: spec });
  const style = new DrivingStyleTracker();
  const mode = new DriveModeTracker();

  const counts = Object.fromEntries(DRIVING_STYLES.map((s) => [s, 0])) as Record<
    DrivingStyle,
    number
  >;
  let judged = 0;
  let nextSample = 1;

  for (let t = STEP; t <= SECONDS; t += STEP) {
    const snapshot: TelemetrySnapshot = {
      frame: source.advance(STEP),
      trip: { distanceKm: 0, durationS: 0, averageKmh: 0, litresUsed: 0, averagePer100km: null },
    };

    style.observe(snapshot, STEP, spec.redlineRpm);
    if (t > WARMUP) {
      counts[style.style] += 1;
      judged += 1;
    }

    // The mode is sampled every second, as in the application.
    if (t >= nextSample) {
      nextSample += 1;
      mode.observe(snapshot, spec.redlineRpm);
    }
  }

  const shares = Object.fromEntries(
    DRIVING_STYLES.map((s) => [s, counts[s] / judged]),
  ) as Shares;
  return { shares, mode: mode.mode };
}

/** The same trip, played on each vehicle and each seed. */
function runs(profile: DrivingProfile): readonly Run[] {
  return VEHICLES.flatMap((spec) => SEEDS.map((seed) => drive(spec, profile, seed)));
}

/** Share of time spent driving fast, cleanly or not. */
function lively(run: Run): number {
  return run.shares.spirited + run.shares.aggressive;
}

describe('instant style over simulated trips', () => {
  it('never finds anything jerky in economical driving', () => {
    for (const run of runs('eco')) {
      expect(run.shares.aggressive).toBe(0);
      expect(run.shares.spirited).toBe(0);
      expect(run.shares.calm).toBeGreaterThan(0.7);
    }
  });

  it('never finds anything calm in aggressive driving', () => {
    for (const run of runs('aggressive')) {
      expect(run.shares.calm).toBe(0);
      expect(lively(run)).toBeGreaterThan(0.6);
    }
  });

  it('reserves aggressive for what really shakes', () => {
    // Normal driving sometimes climbs the rev range - that is spirited, not nervous. Without the
    // distinction the character would be tense permanently.
    for (const run of runs('normal')) {
      expect(run.shares.aggressive).toBe(0);
    }
  });

  it('ranks higher and higher as the driving hardens', () => {
    // The property that matters: not precise values but an order. It survives a reweighting, where
    // thresholds hard-coded in the test would merely copy the implementation.
    const profiles: readonly DrivingProfile[] = ['eco', 'normal', 'sporty', 'aggressive'];
    const perTrip = profiles.map((profile) => runs(profile).map(lively));

    for (let i = 1; i < perTrip.length; i += 1) {
      const avant = perTrip[i - 1] ?? [];
      const after = perTrip[i] ?? [];
      for (let run = 0; run < after.length; run += 1) {
        expect(after[run] ?? 0).toBeGreaterThan(avant[run] ?? 0);
      }
    }
  });

  it('judges at engine scale, not in absolute revs', () => {
    // A city car at 5000 rpm works as hard as a sports car at 6500: at equal driving, both must
    // read the same.
    const [sportive, citadine] = VEHICLES;
    if (sportive === undefined || citadine === undefined) throw new Error('preset manquant');

    const a = lively(drive(sportive, 'sporty', 42));
    const b = lively(drive(citadine, 'sporty', 42));

    expect(Math.abs(a - b)).toBeLessThan(0.25);
  });
});

describe('drive mode over simulated trips', () => {
  it('recognises economical and sporty', () => {
    for (const run of runs('eco')) expect(run.mode).toBe('eco');
    for (const run of runs('sporty')) expect(run.mode).toBe('sport');
    for (const run of runs('aggressive')) expect(run.mode).toBe('sport');
  });
});
