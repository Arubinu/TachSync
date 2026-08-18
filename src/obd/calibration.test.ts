import { describe, expect, it } from 'vitest';
import {
  hasBoost,
  idleRpm,
  isWarm,
  limiterRpm,
  buildSignature,
  classifyMode,
  modeCandidates,
  signatureSpread,
  peakRpm,
  peakSpeed,
  WARM_COOLANT_C,
  type CalibrationSample,
  type ModeReading,
} from './calibration';

const BLANK: CalibrationSample = {
  at: 0,
  rpm: null,
  speed: null,
  throttle: null,
  engineLoad: null,
  coolantTemp: null,
  map: null,
  barometric: null,
};

/** A run of samples 100 ms apart, each field overridable per index. */
function run(count: number, at: (i: number) => Partial<CalibrationSample>): CalibrationSample[] {
  return Array.from({ length: count }, (_unused, i) => ({
    ...BLANK,
    at: i * 100,
    coolantTemp: 90,
    ...at(i),
  }));
}

const idling = (rpm: number) => ({ rpm, speed: 0, throttle: 0 });

describe('idle speed', () => {
  it('reads a steady idle', () => {
    expect(idleRpm(run(40, () => idling(820)))).toBe(820);
  });

  it('ignores a brief excursion, where a mean would follow it', () => {
    // Ten seconds of idle, one second of the compressor cutting in.
    const samples = run(40, (i) => idling(i >= 30 ? 1100 : 800));

    expect(idleRpm(samples)).toBe(800);
  });

  it('says nothing on a cold engine', () => {
    // Idle is high and unsettled until the engine warms: a number read here would be wrong all day.
    const cold = run(40, () => ({ ...idling(1200), coolantTemp: WARM_COOLANT_C - 20 }));

    expect(idleRpm(cold)).toBeNull();
  });

  it('says nothing while the car is moving', () => {
    expect(idleRpm(run(40, () => ({ rpm: 900, speed: 50, throttle: 0 })))).toBeNull();
  });

  it('says nothing with the pedal down', () => {
    expect(idleRpm(run(40, () => ({ rpm: 2000, speed: 0, throttle: 40 })))).toBeNull();
  });

  it('says nothing on too few readings', () => {
    // Half a second of idle proves nothing, and a dial set from it would be a guess.
    expect(idleRpm(run(5, () => idling(800)))).toBeNull();
  });
});

describe('rev limiter', () => {
  it('finds the plateau held under full throttle', () => {
    // Revs climb, then stop climbing while the pedal stays down: that is the limiter, not a shift.
    const samples = run(30, (i) => ({
      throttle: 95,
      rpm: i < 20 ? 3000 + i * 180 : 6580,
    }));

    expect(limiterRpm(samples)).toBe(6580);
  });

  it('does not mistake a gear change for a limiter', () => {
    // Revs stop rising because the pedal came up. Nothing was reached.
    const samples = run(30, (i) => ({
      throttle: i < 15 ? 95 : 10,
      rpm: i < 15 ? 3000 + i * 200 : 3000,
    }));

    expect(limiterRpm(samples)).toBeNull();
  });

  it('does not mistake a climb for a plateau', () => {
    expect(limiterRpm(run(30, (i) => ({ throttle: 95, rpm: 2000 + i * 200 })))).toBeNull();
  });

  it('ignores a plateau too brief to be a limiter', () => {
    // Two samples flat is 100 ms: a coincidence of sampling, not an engine on its stop.
    const samples = run(30, (i) => ({ throttle: 95, rpm: i === 10 || i === 11 ? 5000 : 2000 + i * 300 }));

    expect(limiterRpm(samples)).toBeNull();
  });
});

describe('peaks', () => {
  it('reports the highest engine and road speeds seen', () => {
    const samples = run(20, (i) => ({ rpm: 1000 + i * 100, speed: i * 7 }));

    expect(peakRpm(samples)).toBe(2900);
    expect(peakSpeed(samples)).toBe(133);
  });

  it('says nothing when the car never reported them', () => {
    expect(peakRpm(run(10, () => ({})))).toBeNull();
    expect(peakSpeed(run(10, () => ({})))).toBeNull();
  });
});

describe('forced induction', () => {
  it('sees boost above atmospheric', () => {
    const samples = run(20, (i) => ({ barometric: 101, map: i === 15 ? 160 : 40 }));

    expect(hasBoost(samples)).toBe(true);
  });

  it('reports none on an engine that never passes atmospheric', () => {
    expect(hasBoost(run(20, () => ({ barometric: 101, map: 98 })))).toBe(false);
  });

  it('separates not knowing from knowing there is none', () => {
    // Without both pressures the question cannot be answered, and a `false` here would wrongly
    // hide the gauge on a turbo car.
    expect(hasBoost(run(20, () => ({ map: 150 })))).toBeNull();
  });
});

describe('warm-up', () => {
  it('waits for the coolant to come up', () => {
    expect(isWarm(run(10, () => ({ coolantTemp: 40 })))).toBe(false);
    expect(isWarm(run(10, () => ({ coolantTemp: WARM_COOLANT_C })))).toBe(true);
  });
});

function reading(mode: string, values: Record<number, readonly number[]>): ModeReading {
  return { mode, values: new Map(Object.entries(values).map(([pid, v]) => [Number(pid), v])) };
}

describe('drive mode candidates', () => {
  it('finds the PID that tracks the selected mode', () => {
    const found = modeCandidates([
      reading('eco', { 0x04: [20, 21, 20], 0x22: [1, 1, 1] }),
      reading('sport', { 0x04: [21, 20, 21], 0x22: [9, 9, 9] }),
    ]);

    expect(found.map((c) => c.pid)).toEqual([0x22]);
  });

  it('ignores a PID whose wobble is as wide as the difference', () => {
    // Coolant creeping up while the car idles through the protocol: it moves between the modes
    // because it moves all the time, not because of the mode.
    const found = modeCandidates([
      reading('eco', { 0x05: [80, 82, 84] }),
      reading('sport', { 0x05: [85, 87, 89] }),
    ]);

    expect(found).toEqual([]);
  });

  it('ignores a PID missing from one of the modes', () => {
    // Absent on one side is not a difference in value; treating it as one would name every PID the
    // car happened to drop a reply for.
    const found = modeCandidates([
      reading('eco', { 0x22: [1, 1, 1] }),
      reading('sport', {}),
    ]);

    expect(found).toEqual([]);
  });

  it('needs at least two modes to compare', () => {
    expect(modeCandidates([reading('sport', { 0x22: [9, 9, 9] })])).toEqual([]);
  });

  it('ranks the cleanest separation first', () => {
    const found = modeCandidates([
      reading('eco', { 0x22: [1, 1, 1], 0x23: [10, 8, 12] }),
      reading('sport', { 0x22: [9, 9, 9], 0x23: [40, 38, 42] }),
    ]);

    expect(found.map((c) => c.pid)).toEqual([0x22, 0x23]);
    expect(found[0]!.separation).toBeGreaterThan(found[1]!.separation);
  });

  it('carries the value per mode, so the finding can be read', () => {
    const found = modeCandidates([
      reading('eco', { 0x22: [1, 1, 1] }),
      reading('normal', { 0x22: [5, 5, 5] }),
      reading('sport', { 0x22: [9, 9, 9] }),
    ]);

    expect([...found[0]!.byMode]).toEqual([
      ['eco', 1],
      ['normal', 5],
      ['sport', 9],
    ]);
  });
});

/** A stretch of driving with a given pedal mapping and gearing. */
function driving(
  count: number,
  { load, ratio, idle = 800 }: { load: number; ratio: number; idle?: number },
): CalibrationSample[] {
  return run(count, (i) => ({
    throttle: 40,
    engineLoad: 40 * load,
    speed: 60,
    rpm: 60 * ratio + (i % 3),
    coolantTemp: 90,
    ...(i < 25 ? { throttle: 0, speed: 0, rpm: idle } : {}),
  }));
}

describe('mode signatures', () => {
  const eco = buildSignature('eco', driving(80, { load: 0.8, ratio: 35 }));
  const sport = buildSignature('sport', driving(80, { load: 1.4, ratio: 55 }));

  it('measures the pedal mapping and the gearing held', () => {
    expect(eco.loadPerThrottle).toBeCloseTo(0.8, 2);
    expect(sport.loadPerThrottle).toBeCloseTo(1.4, 2);
    expect(sport.rpmPerKmh!).toBeGreaterThan(eco.rpmPerKmh!);
  });

  it('leaves an axis unstated when too little was seen', () => {
    // Standing still the whole time: nothing can be said about gearing.
    const parked = buildSignature('eco', run(40, () => ({ rpm: 800, speed: 0, throttle: 0 })));

    expect(parked.rpmPerKmh).toBeNull();
    expect(parked.idleRpm).toBe(800);
  });

  it('reports how far the calibrated modes stand apart', () => {
    expect(signatureSpread([eco, sport])!).toBeGreaterThan(0.2);
  });

  it('reports modes that barely differ, so detection is not promised', () => {
    // A car whose Sport does almost nothing. Saying so beats announcing a mode on a coin toss.
    const barely = buildSignature('sport', driving(80, { load: 0.81, ratio: 35.2 }));

    expect(signatureSpread([eco, barely])!).toBeLessThan(0.05);
  });

  it('recognises the mode the car is behaving like', () => {
    const live = buildSignature('?', driving(80, { load: 1.38, ratio: 54 }));

    expect(classifyMode(live, [eco, sport])?.mode).toBe('sport');
  });

  it('refuses to choose when the two are equally close', () => {
    const between = buildSignature('?', driving(80, { load: 1.1, ratio: 45 }));

    expect(classifyMode(between, [eco, sport])).toBeNull();
  });

  it('is not fooled by the air conditioning', () => {
    // The compressor lifts idle by 200 rpm. What saves the verdict is not the low weight on idle -
    // measured, an equal weighting still answers Eco - but that the two axes read under load carry
    // the signal at all. On idle alone the two modes sit at exactly the same distance, 0.200 each,
    // and the answer would be a coin toss.
    const withAircon = buildSignature('?', driving(80, { load: 0.8, ratio: 35, idle: 1000 }));

    expect(classifyMode(withAircon, [eco, sport])?.mode).toBe('eco');
  });
});
