import { describe, expect, it } from 'vitest';
import { Calibration, redlineFromPeak, suggestedRanges } from './calibrationRun';
import type { CalibrationSample } from './calibration';

const FALLBACK = { speed: 200, redline: 7000 };

function sample(at: number, over: Partial<CalibrationSample> = {}): CalibrationSample {
  return {
    at,
    rpm: null,
    speed: null,
    throttle: null,
    engineLoad: null,
    coolantTemp: 90,
    map: null,
    barometric: null,
    ...over,
  };
}

/** Feeds `seconds` of held idle, ten samples a second. */
function idleFor(run: Calibration, secs: number, rpm = 800, from = 0): number {
  const count = secs * 10;
  for (let i = 0; i < count; i += 1) {
    run.observe(sample(from + i * 100, { rpm, speed: 0, throttle: 0 }));
  }
  return from + count * 100;
}

/** Feeds `seconds` of driving with a given pedal mapping and gearing. */
function driveFor(
  run: Calibration,
  secs: number,
  { load, ratio }: { load: number; ratio: number },
  from = 0,
): number {
  const count = secs * 10;
  for (let i = 0; i < count; i += 1) {
    run.observe(
      sample(from + i * 100, {
        throttle: 40,
        engineLoad: 40 * load,
        speed: 60,
        rpm: 60 * ratio + (i % 3),
      }),
    );
  }
  return from + count * 100;
}

describe('calibration protocol', () => {
  it('plans one driving phase on a car without modes', () => {
    // The ordinary case, not a degraded one: most cars have a single way of driving.
    const run = new Calibration();

    expect(run.phases.map((p) => `${p.kind}:${p.mode ?? '-'}`)).toEqual([
      'warmup:-',
      'idle:-',
      'drive:-',
    ]);
  });

  it('plans one driving phase per mode when the car has them', () => {
    const run = new Calibration(['eco', 'normal', 'sport']);

    expect(run.phases.map((p) => `${p.kind}:${p.mode ?? '-'}`)).toEqual([
      'warmup:-',
      'idle:-',
      'drive:eco',
      'drive:normal',
      'drive:sport',
    ]);
  });

  it('waits for the engine to warm before anything else', () => {
    const run = new Calibration();
    run.observe(sample(0, { coolantTemp: 30, rpm: 900 }));

    expect(run.progress.satisfied).toBe(false);

    run.observe(sample(100, { coolantTemp: 80, rpm: 850 }));

    expect(run.progress.satisfied).toBe(true);
  });

  it('counts held idle, not elapsed time', () => {
    // A driver who pulls away mid-phase has not measured an idle, and a bar that kept filling
    // would hide exactly that.
    const run = new Calibration();
    run.next();

    const after = idleFor(run, 10);
    expect(run.progress.satisfied).toBe(false);

    for (let i = 0; i < 200; i += 1) {
      run.observe(sample(after + i * 100, { rpm: 2500, speed: 50, throttle: 30 }));
    }

    expect(run.progress.satisfied).toBe(false);
  });

  it('is satisfied by a long enough idle', () => {
    const run = new Calibration();
    run.next();
    idleFor(run, 25);

    expect(run.progress.satisfied).toBe(true);
    expect(run.progress.ratio).toBe(1);
  });

  it('refuses a driving phase spent in a traffic jam', () => {
    // Ninety seconds went by, but never above walking pace: neither axis can be measured, so the
    // time alone must not let the phase pass.
    const run = new Calibration();
    run.next();
    run.next();
    for (let i = 0; i < 1200; i += 1) {
      run.observe(sample(i * 100, { rpm: 900, speed: 1, throttle: 2 }));
    }

    expect(run.progress.satisfied).toBe(false);
  });

  it('is satisfied by a driving phase that measured both axes', () => {
    const run = new Calibration();
    run.next();
    run.next();
    driveFor(run, 100, { load: 0.9, ratio: 40 });

    expect(run.progress.satisfied).toBe(true);
  });

  it('lets the driver move on regardless', () => {
    // The protocol advises; it never holds anyone hostage at the wheel.
    const run = new Calibration();
    run.next();
    run.next();
    run.next();

    expect(run.done).toBe(true);
  });
});

describe('calibration result', () => {
  it('gathers the findings across every phase', () => {
    const run = new Calibration();
    run.observe(sample(0, { coolantTemp: 90 }));
    run.next();
    const afterIdle = idleFor(run, 25, 780);
    run.next();
    driveFor(run, 100, { load: 0.9, ratio: 40 }, afterIdle);

    const result = run.result();

    expect(result.idleRpm).toBe(780);
    expect(result.peakSpeed).toBe(60);
    expect(result.peakRpm).toBe(2402);
  });

  it('leaves the spread unstated on a car without modes', () => {
    // Nothing to compare is not the same as modes that resemble each other, and only the second
    // should ever be reported as a problem.
    const run = new Calibration();
    run.next();
    run.next();
    driveFor(run, 100, { load: 0.9, ratio: 40 });

    const result = run.result();

    expect(result.signatures).toEqual([]);
    expect(result.spread).toBeNull();
  });

  it('measures how far two calibrated modes stand apart', () => {
    const run = new Calibration(['eco', 'sport']);
    run.next();
    run.next();
    const afterEco = driveFor(run, 100, { load: 0.8, ratio: 35 });
    run.next();
    driveFor(run, 100, { load: 1.4, ratio: 55 }, afterEco);

    const result = run.result();

    expect(result.signatures.map((s) => s.mode)).toEqual(['eco', 'sport']);
    expect(result.spread!).toBeGreaterThan(0.2);
  });

  it('drops a mode the driver skipped rather than counting it against the spread', () => {
    const run = new Calibration(['eco', 'sport']);
    run.next();
    run.next();
    driveFor(run, 100, { load: 0.8, ratio: 35 });
    run.next();
    run.next(); // sport never driven

    const result = run.result();

    expect(result.signatures.map((s) => s.mode)).toEqual(['eco']);
    expect(result.spread).toBeNull();
  });
});

describe('suggested ranges', () => {
  const empty = {
    idleRpm: null,
    limiterRpm: null,
    peakRpm: null,
    peakSpeed: null,
    turbo: null,
    signatures: [],
    spread: null,
  };

  it('trusts a redline measured against the limiter', () => {
    const offer = suggestedRanges({ ...empty, limiterRpm: 6580, peakRpm: 6580 }, FALLBACK);

    expect(offer.redline).toBe(6600);
    expect(offer.redlineMeasured).toBe(true);
  });

  it('marks a redline merely inferred from a peak', () => {
    // All that is known is that the engine goes at least this high. Saying so is the difference
    // between a measurement and a guess wearing its clothes.
    const offer = suggestedRanges({ ...empty, peakRpm: 5200 }, FALLBACK);

    expect(offer.redline).toBe(5500);
    expect(offer.redlineMeasured).toBe(false);
  });

  it('falls back when the car said nothing at all', () => {
    expect(suggestedRanges(empty, FALLBACK)).toEqual({
      speed: 200,
      redline: 7000,
      redlineMeasured: false,
    });
  });

  it('never leaves the needle on its stop', () => {
    const offer = suggestedRanges({ ...empty, peakSpeed: 137 }, FALLBACK);

    expect(offer.speed).toBeGreaterThan(137);
  });

  it('keeps a floor under the speedometer', () => {
    // A calibration done entirely in town would otherwise produce a 60 km/h dial.
    expect(suggestedRanges({ ...empty, peakSpeed: 48 }, FALLBACK).speed).toBe(120);
  });
});

describe('a redline from a peak', () => {
  it('clears the reading rather than sitting on it', () => {
    // The engine went at least this high. A dial ending exactly there would put the needle on its
    // stop at the very moment the zone matters.
    expect(redlineFromPeak(6400)).toBeGreaterThan(6400);
  });

  it('agrees with what a calibration would have offered', () => {
    // Two paths to the same number: the calibration's own peak and the trip history. Drifting
    // apart would mean the same engine getting two different redlines depending on who noticed.
    const fromCalibration = suggestedRanges(
      {
        idleRpm: null,
        limiterRpm: null,
        peakRpm: 6400,
        peakSpeed: null,
        turbo: null,
        signatures: [],
        spread: null,
      },
      FALLBACK,
    );

    expect(redlineFromPeak(6400)).toBe(fromCalibration.redline);
  });

  it('rounds to a graduation a dial can carry', () => {
    expect(redlineFromPeak(6400) % 500).toBe(0);
  });
});
