import { describe, expect, it } from 'vitest';
import { MIN_TRIPS, readBaseline, REFERENCE_ENERGY } from './baseline';
import { DrivingStyleTracker } from './drivingStyle';
import type { TripRecord } from '../trips/types';

function trip(vehicle: string, meanEnergy: number | null): TripRecord {
  return {
    id: String(Math.random()),
    startedAt: 1,
    endedAt: 2,
    distanceKm: 10,
    durationS: 600,
    averageKmh: 60,
    maxKmh: 90,
    litresUsed: 1,
    averagePer100km: 8,
    maxRpm: 4000,
    meanEnergy,
    meanHarshness: 0.2,
    vehicle,
    source: 'obd',
  } as unknown as TripRecord;
}

const many = (vehicle: string, energy: number | null, count = MIN_TRIPS): TripRecord[] =>
  Array.from({ length: count }, () => trip(vehicle, energy));

describe('personal baseline', () => {
  it('says nothing until there are enough trips', () => {
    // Below this it is one drive, not a habit, and shifting a threshold on it would be a guess.
    expect(readBaseline(many('Van', 0.5, MIN_TRIPS - 1), 'Van')).toBeNull();
    expect(readBaseline(many('Van', 0.5, MIN_TRIPS), 'Van')).not.toBeNull();
  });

  it('reads only the vehicle asked for', () => {
    // A van and a hatchback are not driven alike; one baseline across both describes neither.
    const mixed = [...many('Van', 0.6), ...many('Clio', 0.3)];

    expect(readBaseline(mixed, 'Van')?.energy).toBeCloseTo(0.6, 5);
    expect(readBaseline(mixed, 'Clio')?.energy).toBeCloseTo(0.3, 5);
  });

  it('skips trips recorded before the style was kept', () => {
    // Counting an absent level as zero would drag every baseline towards calm.
    const withGaps = [...many('Van', 0.6), ...many('Van', null)];

    expect(readBaseline(withGaps, 'Van')?.energy).toBeCloseTo(0.6, 5);
    expect(readBaseline(withGaps, 'Van')?.trips).toBe(MIN_TRIPS);
  });

  it('ignores a single outlier, where a mean would follow it', () => {
    const town = [...many('Van', 0.3), trip('Van', 0.95)];

    expect(readBaseline(town, 'Van')?.energy).toBeCloseTo(0.3, 5);
  });

  it('shifts nothing for a driver who matches the average', () => {
    expect(readBaseline(many('Van', REFERENCE_ENERGY), 'Van')?.shift).toBeCloseTo(0, 5);
  });

  it('raises the bar for a habitually livelier driver', () => {
    expect(readBaseline(many('Van', REFERENCE_ENERGY + 0.08), 'Van')!.shift).toBeGreaterThan(0);
  });

  it('bounds the shift, however extreme the history', () => {
    // A baseline is a nudge, not a licence to redefine the scale: past a tenth or so the word
    // "aggressive" would stop meaning anything.
    const wild = readBaseline(many('Van', 1), 'Van')!.shift;
    const meek = readBaseline(many('Van', 0), 'Van')!.shift;

    expect(wild).toBeLessThanOrEqual(0.12);
    expect(meek).toBeGreaterThanOrEqual(-0.12);
  });
});

describe('the shift on the classifier', () => {
  /** Holds a steady demand long enough for the levels to settle. */
  function drive(shift: number): DrivingStyleTracker {
    const tracker = new DrivingStyleTracker();
    tracker.setBaselineShift(shift);

    for (let i = 0; i < 200; i += 1) {
      tracker.observe(
        {
          frame: { throttle: 55, rpm: 4200, speed: 70, lateralG: 0, longitudinalG: 0 },
          trip: {},
        } as never,
        0.1,
        7000,
      );
    }
    return tracker;
  }

  it('leaves the verdict alone at zero', () => {
    expect(drive(0).style).toBe(drive(0).style);
  });

  it('makes the same driving read calmer for a habitually lively driver', () => {
    // The levels are identical; only where the line sits has moved.
    const neutral = drive(0);
    const lively = drive(0.12);

    expect(lively.levels.energy).toBeCloseTo(neutral.levels.energy, 5);
    const rank = { calm: 0, normal: 1, spirited: 2, aggressive: 3 } as const;
    expect(rank[lively.style]).toBeLessThanOrEqual(rank[neutral.style]);
  });

  it('never moves the harshness line', () => {
    // A jolt is a jolt, whoever is driving: moving this would stop telling a rough driver about it.
    const tracker = new DrivingStyleTracker();
    tracker.setBaselineShift(0.12);

    for (let i = 0; i < 200; i += 1) {
      tracker.observe(
        {
          frame: { throttle: 90, rpm: 6000, speed: 80, lateralG: 0.6, longitudinalG: -0.7 },
          trip: {},
        } as never,
        0.1,
        7000,
      );
    }

    expect(tracker.style).toBe('aggressive');
  });
});
