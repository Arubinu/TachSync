import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TelemetryStore } from './TelemetryStore';
import { EMPTY_FRAME } from './types';

/**
 * Hand-driven frame loop: `requestAnimationFrame` does not exist outside a browser, and we want to
 * decide when a frame passes anyway.
 */
let pending: Array<() => void> = [];

function tick(times = 1): void {
  for (let i = 0; i < times; i += 1) {
    const callbacks = pending;
    pending = [];
    for (const callback of callbacks) callback();
  }
}

beforeEach(() => {
  pending = [];
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    pending.push(callback);
    return pending.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    pending = [];
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const frame = (speed: number) => ({ ...EMPTY_FRAME, timestamp: speed * 100, speed });

describe('snapshot delivery', () => {
  it('serves the subscriber immediately, without waiting for a frame', () => {
    const store = new TelemetryStore();
    const seen = vi.fn();

    store.subscribe(seen);

    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('does not call a “value” subscriber back while nothing changes', () => {
    const store = new TelemetryStore();
    const seen = vi.fn();
    store.subscribe(seen);
    seen.mockClear();

    // Six frames for a single telemetry sample: the real ratio between the screen (60 Hz) and the
    // adapter (10 Hz).
    store.push(frame(50));
    tick(6);

    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('calls back once per frame, whatever the number of images', () => {
    const store = new TelemetryStore();
    const seen = vi.fn();
    store.subscribe(seen);
    seen.mockClear();

    for (const speed of [10, 20, 30]) {
      store.push(frame(speed));
      tick(6);
    }

    expect(seen).toHaveBeenCalledTimes(3);
    expect(seen.mock.calls.at(-1)?.[0].frame.speed).toBe(30);
  });

  it('calls an “animation” subscriber back on every frame, even with no new data', () => {
    const store = new TelemetryStore();
    const animated = vi.fn();
    store.subscribeFrames(animated);

    tick(6);

    expect(animated).toHaveBeenCalledTimes(6);
  });

  it('redistributes after the trip reset', () => {
    const store = new TelemetryStore();
    const seen = vi.fn();
    store.subscribe(seen);
    store.push(frame(50));
    tick(1);
    seen.mockClear();

    store.resetTrip();
    tick(1);

    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0]?.[0].trip.durationS).toBe(0);
  });

  it('resumes delivery after a full stop of the loop', () => {
    const store = new TelemetryStore();
    store.push(frame(50));

    const first = vi.fn();
    const stop = store.subscribe(first);
    tick(1);
    stop();

    // No subscribers left, so the loop stops. A newcomer must get a full delivery, without the
    // current snapshot counting as already served.
    const second = vi.fn();
    store.subscribe(second);
    second.mockClear();
    store.push(frame(60));
    tick(1);

    expect(second).toHaveBeenCalledTimes(1);
  });
});
