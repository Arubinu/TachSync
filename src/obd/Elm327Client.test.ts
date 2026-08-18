import { describe, expect, it } from 'vitest';
import { Elm327Client } from './Elm327Client';
import type { ObdTransport } from './transport';

/**
 * Fake transport: records what is written and lets the test decide what comes back, and when.
 * Exactly what the protocol/transport split makes possible - this whole dialogue is verified
 * without Bluetooth.
 */
class FakeTransport implements ObdTransport {
  readonly writes: string[] = [];
  #data: ((chunk: string) => void) | null = null;
  #disconnected: (() => void) | null = null;
  /** Reply to serve automatically, per written command. */
  responder: ((command: string) => string | null) | null = null;

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async write(data: string): Promise<void> {
    const command = data.replace(/\r$/, '');
    this.writes.push(command);

    const reply = this.responder?.(command) ?? null;
    if (reply !== null) {
      // Asynchronous, like a Bluetooth notification: never in the same turn.
      queueMicrotask(() => this.emit(reply));
    }
  }

  onData(listener: (chunk: string) => void): () => void {
    this.#data = listener;
    return () => {
      this.#data = null;
    };
  }

  onDisconnect(listener: () => void): () => void {
    this.#disconnected = listener;
    return () => {
      this.#disconnected = null;
    };
  }

  /** Simulates characters arriving. */
  emit(chunk: string): void {
    this.#data?.(chunk);
  }

  loseLink(): void {
    this.#disconnected?.();
  }
}

/**
 * Lets the command queue drain.
 *
 * `send` does not write in the current turn: it chains onto the previous command, so at best a
 * microtask later. Emitting a reply without waiting would mean answering before being asked.
 */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Answers `OK` to AT commands and serves a reply table for PIDs. */
function respondWith(table: Record<string, string>): (command: string) => string {
  return (command) => {
    if (command in table) return `${table[command] ?? ''}\r>`;
    if (command.startsWith('AT')) return 'OK\r>';
    return 'NO DATA\r>';
  };
}

describe('ELM327 dialogue', () => {
  it('plays the initialisation sequence on connection', async () => {
    const transport = new FakeTransport();
    transport.responder = respondWith({ ATZ: 'ELM327 v1.5' });
    const client = new Elm327Client(transport);

    await client.connect();

    expect(transport.writes).toEqual(['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0']);
  });

  it('reads a PID and converts it', async () => {
    const transport = new FakeTransport();
    transport.responder = respondWith({ '010C': '41 0C 1A F8' });
    const client = new Elm327Client(transport);

    await client.connect();
    const rpm = await client.readPid(0x0c);

    expect(rpm).toBe(1726);
  });

  it('returns null when the vehicle does not provide the PID', async () => {
    const transport = new FakeTransport();
    transport.responder = respondWith({});
    const client = new Elm327Client(transport);

    await client.connect();

    expect(await client.readPid(0x5e)).toBeNull();
  });

  it('sends the next command only after the previous reply', async () => {
    const transport = new FakeTransport();
    transport.responder = respondWith({ ATZ: 'ELM327 v1.5' });
    const client = new Elm327Client(transport);
    await client.connect();

    transport.responder = null; // Replies are served by hand here.
    const first = client.send('010C');
    const second = client.send('010D');
    await flush();

    // The second must not have gone out: the adapter has no queue.
    expect(transport.writes.at(-1)).toBe('010C');

    transport.emit('41 0C 1A F8\r>');
    await first;
    await flush();

    expect(transport.writes.at(-1)).toBe('010D');
    transport.emit('41 0D 32\r>');
    expect((await second).kind).toBe('data');
  });

  it('returns an error on timeout, without breaking the session', async () => {
    const transport = new FakeTransport();
    transport.responder = respondWith({ ATZ: 'ELM327 v1.5' });
    const client = new Elm327Client(transport, { commandTimeoutMs: 20 });
    await client.connect();

    transport.responder = null;
    expect(await client.readPid(0x0c)).toBeNull();

    // The session stays usable: a lost reading is routine in a car.
    const next = client.readPid(0x0d);
    await flush();
    transport.emit('41 0D 32\r>');

    expect(await next).toBe(50);
  });

  it('drops a late reply instead of serving it to the next request', async () => {
    const transport = new FakeTransport();
    transport.responder = respondWith({ ATZ: 'ELM327 v1.5' });
    const client = new Elm327Client(transport, { commandTimeoutMs: 20 });
    await client.connect();

    transport.responder = null;
    await client.readPid(0x0c); // Timed out.

    const next = client.readPid(0x0d);
    await flush();
    // The revs finally arrive, past the timeout: they must not pass for the speed.
    transport.emit('41 0C 1A F8\r>');
    transport.emit('41 0D 32\r>');

    expect(await next).toBe(50);
  });

  it('keeps waiting when the reply is about another PID', async () => {
    const transport = new FakeTransport();
    transport.responder = respondWith({ ATZ: 'ELM327 v1.5' });
    const client = new Elm327Client(transport, { commandTimeoutMs: 200 });
    await client.connect();

    transport.responder = null;
    const reading = client.readPid(0x0d);
    await flush();

    transport.emit('41 0C 1A F8\r>'); // Pas celle qu'on attend.
    transport.emit('41 0D 32\r>');

    expect(await reading).toBe(50);
  });

  it('discovers the supported PIDs by chaining the ranges', async () => {
    const transport = new FakeTransport();
    transport.responder = respondWith({
      ATZ: 'ELM327 v1.5',
      // Low bit set: the 0x20 range exists.
      '0100': '41 00 80 00 00 01',
      '0120': '41 20 80 00 00 00',
    });
    const client = new Elm327Client(transport);
    await client.connect();

    const supported = await client.discoverSupportedPids();

    expect(supported.has(0x01)).toBe(true);
    expect(supported.has(0x20)).toBe(true);
    expect(supported.has(0x21)).toBe(true);
    // 0x40 was not announced: it must not have been queried.
    expect(transport.writes).not.toContain('0140');
  });

  it('stops at the first range not announced', async () => {
    const transport = new FakeTransport();
    transport.responder = respondWith({
      ATZ: 'ELM327 v1.5',
      '0100': '41 00 98 3B 00 10',
    });
    const client = new Elm327Client(transport);
    await client.connect();

    const supported = await client.discoverSupportedPids();

    expect(supported.has(0x0c)).toBe(true);
    expect(supported.has(0x0d)).toBe(true);
    expect(transport.writes).not.toContain('0120');
  });
});
