import { describe, expect, it } from 'vitest';
import { MIN_TRIPS, readBaseline, REFERENCE_ENERGY } from './baseline';
import { DrivingStyleTracker } from './drivingStyle';
import type { VehicleIdentity } from '../trips/identity';
import type { TripRecord } from '../trips/types';

/** Id and label alike, so a test that does not care about renaming can pass either. */
function trip(vehicle: string, meanEnergy: number | null): TripRecord {
  return {
    id: String(Math.random()),
    vehicleId: vehicle,
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

/** A vehicle whose id and label agree, which is the ordinary case. */
const of = (name: string): VehicleIdentity => ({ id: name, label: name });

const many = (vehicle: string, energy: number | null, count = MIN_TRIPS): TripRecord[] =>
  Array.from({ length: count }, () => trip(vehicle, energy));

describe('personal baseline', () => {
  it('says nothing until there are enough trips', () => {
    // Below this it is one drive, not a habit, and shifting a threshold on it would be a guess.
    expect(readBaseline(many('Van', 0.5, MIN_TRIPS - 1), of('Van'))).toBeNull();
    expect(readBaseline(many('Van', 0.5, MIN_TRIPS), of('Van'))).not.toBeNull();
  });

  it('reads only the vehicle asked for', () => {
    // A van and a hatchback are not driven alike; one baseline across both describes neither.
    const mixed = [...many('Van', 0.6), ...many('Clio', 0.3)];

    expect(readBaseline(mixed, of('Van'))?.energy).toBeCloseTo(0.6, 5);
    expect(readBaseline(mixed, of('Clio'))?.energy).toBeCloseTo(0.3, 5);
  });

  it('skips trips recorded before the style was kept', () => {
    // Counting an absent level as zero would drag every baseline towards calm.
    const withGaps = [...many('Van', 0.6), ...many('Van', null)];

    expect(readBaseline(withGaps, of('Van'))?.energy).toBeCloseTo(0.6, 5);
    expect(readBaseline(withGaps, of('Van'))?.trips).toBe(MIN_TRIPS);
  });

  it('ignores a single outlier, where a mean would follow it', () => {
    const town = [...many('Van', 0.3), trip('Van', 0.95)];

    expect(readBaseline(town, of('Van'))?.energy).toBeCloseTo(0.3, 5);
  });

  it('shifts nothing for a driver who matches the average', () => {
    expect(readBaseline(many('Van', REFERENCE_ENERGY), of('Van'))?.shift).toBeCloseTo(0, 5);
  });

  it('raises the bar for a habitually livelier driver', () => {
    expect(readBaseline(many('Van', REFERENCE_ENERGY + 0.08), of('Van'))!.shift).toBeGreaterThan(0);
  });

  it('bounds the shift, however extreme the history', () => {
    // A baseline is a nudge, not a licence to redefine the scale: past a tenth or so the word
    // "aggressive" would stop meaning anything.
    const wild = readBaseline(many('Van', 1), of('Van'))!.shift;
    const meek = readBaseline(many('Van', 0), of('Van'))!.shift;

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

describe('which car a trip belongs to', () => {
  /** A trip as it is written now: id, plus the name the car had at the time. */
  const recorded = (id: string, label: string): TripRecord =>
    ({ ...trip(label, 0.5), vehicleId: id }) as TripRecord;

  /** A trip from before ids were stored. */
  const legacy = (label: string): TripRecord =>
    ({ ...trip(label, 0.5), vehicleId: null }) as TripRecord;

  it('follows the car through a rename', () => {
    // The whole point: the history was keyed on a name the user is free to change, so renaming a
    // vehicle used to orphan every trip it had made.
    const history = Array.from({ length: MIN_TRIPS }, () => recorded('v1', 'Van'));

    expect(readBaseline(history, { id: 'v1', label: 'The Van' })?.trips).toBe(MIN_TRIPS);
  });

  it('follows it through a change of interface language', () => {
    // An unnamed vehicle is labelled from a translated string, so the same car read "Vehicle 1" in
    // English and "Vehicule 1" in French - two histories for one car, and nothing said so.
    const history = Array.from({ length: MIN_TRIPS }, () => recorded('v1', 'Vehicle 1'));

    expect(readBaseline(history, { id: 'v1', label: 'Vehicule 1' })?.trips).toBe(MIN_TRIPS);
  });

  it('keeps two cars apart even when they share a name', () => {
    const both = [
      ...Array.from({ length: MIN_TRIPS }, () => recorded('v1', 'Van')),
      ...Array.from({ length: MIN_TRIPS }, () => recorded('v2', 'Van')),
    ];

    expect(readBaseline(both, { id: 'v1', label: 'Van' })?.trips).toBe(MIN_TRIPS);
  });

  it('still reads trips written before the id, by their label', () => {
    // They carry nothing else. Refusing them would silently empty an existing history.
    const history = Array.from({ length: MIN_TRIPS }, () => legacy('Van'));

    expect(readBaseline(history, { id: 'v1', label: 'Van' })?.trips).toBe(MIN_TRIPS);
  });

  it('does not hand an old trip to a car that merely renamed itself onto its name', () => {
    const history = Array.from({ length: MIN_TRIPS }, () => legacy('Van'));

    expect(readBaseline(history, { id: 'v1', label: 'Clio' })).toBeNull();
  });
});
