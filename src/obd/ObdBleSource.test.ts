import { describe, expect, it } from 'vitest';
import { ObdBleSource, derivedChannels } from './ObdBleSource';
import type { ObdTransport } from './transport';

/**
 * Fake vehicle: answers the PIDs it declares it supports and `NO DATA` to the rest - exactly what a
 * real ECU does.
 */
class FakeVehicle implements ObdTransport {
  #data: ((chunk: string) => void) | null = null;
  #disconnected: (() => void) | null = null;
  /** Raw values per PID, in bytes. */
  readonly replies = new Map<number, readonly number[]>();
  /** Inventory masks, per range PID. */
  readonly masks = new Map<number, readonly number[]>();
  /** Measurement PIDs queried, in order - the inventory is not included. */
  readonly lus: number[] = [];

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async write(data: string): Promise<void> {
    const command = data.replace(/\r$/, '').toUpperCase();

    if (command.startsWith('AT')) {
      queueMicrotask(() => this.#emit(command === 'ATZ' ? 'ELM327 v1.5\r>' : 'OK\r>'));
      return;
    }

    if (command.startsWith('01') && command.length === 4) {
      const pid = Number.parseInt(command.slice(2), 16);
      const bytes = this.masks.get(pid) ?? this.replies.get(pid);
      if (!this.masks.has(pid)) this.lus.push(pid);

      if (bytes === undefined) {
        queueMicrotask(() => this.#emit('NO DATA\r>'));
        return;
      }
      const hex = [0x41, pid, ...bytes].map((o) => o.toString(16).padStart(2, '0')).join(' ');
      queueMicrotask(() => this.#emit(`${hex}\r>`));
      return;
    }

    queueMicrotask(() => this.#emit('NO DATA\r>'));
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

  perdreLaLiaison(): void {
    this.#disconnected?.();
  }

  #emit(chunk: string): void {
    this.#data?.(chunk);
  }
}

/** Common turbo car: speed, revs, throttle, pressures, mass air flow. */
function turboCar(): FakeVehicle {
  const v = new FakeVehicle();
  // Range 0x00: announces 0x04, 0x05, 0x0B, 0x0C, 0x0D, 0x10, 0x11 and 0x20.
  v.masks.set(0x00, [0x18, 0x3b, 0x80, 0x11]);
  // Range 0x20: announces 0x33, the barometric pressure.
  v.masks.set(0x20, [0x00, 0x00, 0x20, 0x00]);

  v.replies.set(0x0d, [0x32]); // 50 km/h
  v.replies.set(0x0c, [0x1a, 0xf8]); // 1726 tr/min
  v.replies.set(0x11, [0x80]); // ~50 %
  v.replies.set(0x0b, [0x96]); // 150 kPa
  v.replies.set(0x33, [0x65]); // 101 kPa
  v.replies.set(0x04, [0x80]);
  v.replies.set(0x10, [0x0b, 0xb8]); // 30 g/s
  v.replies.set(0x05, [0x5a]); // 50 °C
  return v;
}

/**
 * Connects without starting the loop: the test steps the cycles itself.
 *
 * `disconnect()` must not be used to stop the loop before a manual `readCycle()` - it closes the
 * transport listener, and every subsequent read would time out.
 */
async function connect(vehicle: FakeVehicle): Promise<ObdBleSource> {
  const source = new ObdBleSource(vehicle, { autoPoll: false });
  await source.connect();
  return source;
}

describe('channels inferred from the supported PIDs', () => {
  it('announces boost only if both pressures exist', () => {
    expect(derivedChannels(new Set([0x0b, 0x33])).has('boost')).toBe(true);
    // Manifold pressure alone: boost cannot be computed.
    expect(derivedChannels(new Set([0x0b])).has('boost')).toBe(false);
  });

  it('accepts fuel use whether measured or estimated', () => {
    expect(derivedChannels(new Set([0x5e])).has('consumption')).toBe(true);
    expect(derivedChannels(new Set([0x10])).has('consumption')).toBe(true);
    expect(derivedChannels(new Set([0x0d])).has('consumption')).toBe(false);
  });

  it('infers longitudinal acceleration from speed', () => {
    expect(derivedChannels(new Set([0x0d])).has('longitudinalG')).toBe(true);
  });

  it('announces nothing when the vehicle exposes nothing', () => {
    expect(derivedChannels(new Set()).size).toBe(0);
  });
});

describe('OBD source', () => {
  it('discovers the vehicle channels on connection', async () => {
    const source = await connect(turboCar());

    const channels = [...source.getAvailableChannels()];
    expect(channels).toContain('speed');
    expect(channels).toContain('rpm');
    expect(channels).toContain('boost');
    expect(channels).toContain('consumption');
    // 0x5E was not announced: consumption will come from mass air flow.
    expect(channels).not.toContain('fuelRate');

    await source.disconnect();
  });

  it('assembles a frame from the vehicle replies', async () => {
    const source = await connect(turboCar());

    const frame = await source.readCycle();

    expect(frame.speed).toBe(50);
    expect(frame.rpm).toBe(1726);
    expect(frame.map).toBe(150);
    expect(frame.throttle).toBeCloseTo(50.196, 2);

    await source.disconnect();
  });

  it('leaves absent the metrics the OBD does not provide', async () => {
    const source = await connect(turboCar());

    const frame = await source.readCycle();

    expect(frame.gear).toBeNull();
    expect(frame.lateralG).toBeNull();

    await source.disconnect();
  });

  it('queries only the fast metrics plus one slow one per cycle', async () => {
    const vehicle = turboCar();
    const source = await connect(vehicle);

    vehicle.lus.length = 0;
    await source.readCycle();

    // Four fast ones (speed, revs, throttle, manifold) and a single slow one.
    expect(vehicle.lus).toHaveLength(5);
    expect(vehicle.lus.slice(0, 4)).toEqual([0x0d, 0x0c, 0x11, 0x0b]);

    await source.disconnect();
  });

  it('rotates the slow metrics from one cycle to the next', async () => {
    const vehicle = turboCar();
    const source = await connect(vehicle);

    const slow: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      vehicle.lus.length = 0;
      await source.readCycle();
      slow.push(vehicle.lus[4] ?? -1);
    }

    // 0x5E is unsupported: the round-robin steps over it instead of wasting a round.
    expect(slow).toEqual([0x04, 0x10, 0x05, 0x33]);

    await source.disconnect();
  });

  it('keeps a slow metric between two turns of the carousel', async () => {
    const source = await connect(turboCar());

    // First cycle reads engine load. Second reads mass air flow.
    const first = await source.readCycle();
    const second = await source.readCycle();

    expect(first.engineLoad).not.toBeNull();
    // Without persistence, load would flicker to "unavailable" one cycle in five.
    expect(second.engineLoad).toBe(first.engineLoad);

    await source.disconnect();
  });

  it('derives longitudinal acceleration from two successive speeds', async () => {
    const vehicle = turboCar();
    const source = await connect(vehicle);

    await source.readCycle(); // No reference yet.
    vehicle.replies.set(0x0d, [0x3c]); // 60 km/h
    await new Promise((resolve) => setTimeout(resolve, 60));
    const frame = await source.readCycle();

    expect(frame.longitudinalG).not.toBeNull();
    // Acceleration: the sign is what matters, the magnitude depends on the interval.
    expect(frame.longitudinalG ?? 0).toBeGreaterThan(0);

    await source.disconnect();
  });

  it('reports the link going down', async () => {
    const vehicle = turboCar();
    const source = new ObdBleSource(vehicle, { autoPoll: false });
    const seen: string[] = [];
    source.onStatusChange((statut) => seen.push(statut));

    await source.connect();
    vehicle.perdreLaLiaison();

    expect(seen).toEqual(['connecting', 'connected', 'disconnected']);

    await source.disconnect();
  });

  it('stays silent on a vehicle that answers nothing', async () => {
    const silent = new FakeVehicle();
    silent.masks.set(0x00, [0x00, 0x00, 0x00, 0x00]);
    const source = await connect(silent);

    expect(source.getAvailableChannels().size).toBe(0);

    const frame = await source.readCycle();
    expect(frame.speed).toBeNull();
    expect(frame.rpm).toBeNull();

    await source.disconnect();
  });

  it('emits frames on its own while the loop runs', async () => {
    const source = new ObdBleSource(turboCar(), { cycleDelayMs: 1 });
    const frames: number[] = [];
    source.onFrame((frame) => frames.push(frame.speed ?? -1));

    await source.connect();
    await new Promise((resolve) => setTimeout(resolve, 80));
    await source.disconnect();

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((v) => v === 50)).toBe(true);
  });
});
