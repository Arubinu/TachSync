import { describe, expect, it } from 'vitest';
import { TransportRecorder } from './recorder';
import { advance, captureState, CAPTURE_STEPS } from './capture';
import type { Unsubscribe } from '../telemetry/DataSource';
import type { ObdTransport } from './transport';

/** Facade transport: it only makes its inputs observable. */
function fakeTransport(): ObdTransport & { emit: (chunk: string) => void; sent: string[] } {
  const listeners: Array<(chunk: string) => void> = [];
  const sent: string[] = [];

  return {
    sent,
    emit: (chunk) => listeners.forEach((listener) => listener(chunk)),
    connect: async () => undefined,
    disconnect: async () => undefined,
    write: async (data) => {
      sent.push(data);
    },
    onData: (listener): Unsubscribe => {
      listeners.push(listener);
      return () => listeners.splice(listeners.indexOf(listener), 1);
    },
    onDisconnect: (): Unsubscribe => () => undefined,
  };
}

/** Manual clock: a timestamped trace must not depend on real time. */
function clock(): { now: () => number; advanceBy: (ms: number) => void } {
  let value = 1000;
  return { now: () => value, advanceBy: (ms) => (value += ms) };
}

describe('recording an OBD session', () => {
  it('keeps the commands and the replies in order', async () => {
    const inner = fakeTransport();
    const time = clock();
    const recorder = new TransportRecorder(inner, { now: time.now });

    await recorder.connect();
    time.advanceBy(120);
    await recorder.write('010D\r');
    time.advanceBy(45);
    inner.emit('41 0D 3C\r>');

    expect(recorder.events.map((event) => event.kind)).toEqual([
      'note',
      'sent',
      'received',
    ]);
    // The terminator is stripped on send, never on receive: on the reply side it is what says where
    // the adapter cut.
    expect(recorder.events[1]).toMatchObject({ kind: 'sent', data: '010D', at: 120 });
    expect(recorder.events[2]).toMatchObject({ kind: 'received', at: 165 });
  });

  it('lets the data through to the client', async () => {
    const inner = fakeTransport();
    const recorder = new TransportRecorder(inner, { now: clock().now });
    const received: string[] = [];

    recorder.onData((chunk) => received.push(chunk));
    await recorder.write('ATZ\r');
    inner.emit('ELM327 v1.5');

    // Recording must divert nothing: the client sees exactly what it would have seen without the
    // recorder.
    expect(inner.sent).toEqual(['ATZ\r']);
    expect(received).toEqual(['ELM327 v1.5']);
  });

  it('masks the vehicle serial number', () => {
    const inner = fakeTransport();
    const recorder = new TransportRecorder(inner, { now: clock().now });

    inner.emit('49 02 01 56 46 31 41 42 43 44 45');

    // The application never queries mode 09, but a log gets shared and the VIN ties the trace to a
    // car by name.
    expect(recorder.toLog()).not.toContain('56 46 31');
    expect(recorder.toLog()).toContain('VIN redacted');
  });

  it('timestamps the markers laid by the wizard', async () => {
    const inner = fakeTransport();
    const time = clock();
    const recorder = new TransportRecorder(inner, { now: time.now });

    await recorder.connect();
    time.advanceBy(30_000);
    recorder.mark('firmAccel');

    expect(recorder.toLog()).toContain('30.000 # firmAccel');
  });

  it('caps the log and says so', async () => {
    const inner = fakeTransport();
    const recorder = new TransportRecorder(inner, { now: clock().now, limit: 3 });

    await recorder.connect();
    for (let i = 0; i < 10; i += 1) inner.emit('41 0C 1A F8');

    expect(recorder.events).toHaveLength(3);
    // A silent truncation would suggest a mute link.
    expect(recorder.toLog()).toContain('dropped');
  });
});

describe('guided protocol', () => {
  it('covers the link, the settled regime and the extremes', () => {
    const purposes = new Set(CAPTURE_STEPS.map((step) => step.purpose));

    // Without firm acceleration and hard braking the style classifier would have no extremes to
    // learn from.
    expect(purposes).toContain('link');
    expect(purposes).toContain('dynamics');
    expect(CAPTURE_STEPS.map((step) => step.id)).toContain('firmAccel');
    expect(CAPTURE_STEPS.map((step) => step.id)).toContain('hardBrake');
  });

  it('advances one step and stops at the end', () => {
    let index = 0;
    expect(captureState(index).index).toBe(1);

    for (let i = 0; i < CAPTURE_STEPS.length; i += 1) index = advance(index);

    expect(captureState(index).done).toBe(true);
    // One press too many must not run past the end.
    expect(captureState(advance(index)).done).toBe(true);
  });
});
