import {
  Emitter,
  type ConnectionStatus,
  type DataSource,
  type DataSourceInfo,
  type Unsubscribe,
} from '../telemetry/DataSource';
import { EMPTY_FRAME, type AnyChannel, type TelemetryFrame } from '../telemetry/types';
import { Elm327Client } from './Elm327Client';
import { channelsForPids, findPid } from './pids';
import type { ObdTransport } from './transport';

/**
 * Telemetry source backed by a real OBD-II adapter.
 *
 * Knows neither Bluetooth nor Android: it receives an `ObdTransport` and leans on the ELM327 client
 * for the whole protocol. That is what allows writing and verifying it entirely without an adapter,
 * by handing it a fake transport that replays replies.
 *
 * Two accepted differences from the simulator, coming from the vehicle rather than the code:
 *
 * - Throughput is slower. Each metric needs a round trip and the ELM327 handles one at a time.
 * Where the simulator produces 10 frames per second, a real setup gives two to four. - Some metrics
 * are missing. OBD exposes neither the engaged gear nor lateral acceleration. They stay `null`, so
 * the corresponding tiles do not show.
 */

/**
 * Metrics re-read every cycle: those that change moment to moment and on which reading behaviour
 * depends.
 */
const FAST_PIDS: readonly number[] = [
  0x0d, // vitesse
  0x0c, // engine speed
  0x11, // papillon
  0x0b, // pression collecteur
];

/**
 * Metrics re-read in turn, one per cycle.
 *
 * Querying them all every round would triple the cycle time and divide the freshness of speed and
 * revs accordingly - for values that drift slowly. Barometric pressure only changes with altitude
 * and weather; engine temperature takes minutes to rise.
 */
const SLOW_PIDS: readonly number[] = [
  0x04, // charge moteur
  0x10, // air flow
  0x5e, // fuel flow
  0x05, // coolant temperature
  0x33, // barometric pressure
];

export interface ObdBleSourceOptions {
  /** Rest between two polling cycles, ms. */
  readonly cycleDelayMs?: number;
  readonly commandTimeoutMs?: number;
  /**
   * Starts the polling loop on connect. True by default.
   *
   * Setting it false lets the caller step cycles one by one through `readCycle()` - what the tests
   * need to observe a precise round without racing a loop. Same intent as
   * `SimulatedSource.advance()`.
   */
  readonly autoPoll?: boolean;
}

export class ObdBleSource implements DataSource {
  readonly info: DataSourceInfo = {
    id: 'obd-ble',
    label: 'Adaptateur OBD-II',
    kind: 'obd-ble',
  };

  readonly #transport: ObdTransport;
  readonly #client: Elm327Client;
  readonly #cycleDelayMs: number;
  readonly #autoPoll: boolean;

  #status: ConnectionStatus = 'disconnected';
  #frames = new Emitter<[TelemetryFrame]>();
  #statuses = new Emitter<[ConnectionStatus, Error?]>();

  #supported = new Set<number>();
  #channels: ReadonlySet<AnyChannel> = new Set();
  #running = false;
  #slowIndex = 0;
  #unsubscribeTransport: Unsubscribe | null = null;

  /** Last known frame: slow metrics persist in it between rounds. */
  #latest: TelemetryFrame = EMPTY_FRAME;
  /** Previous speed and instant, used to derive longitudinal acceleration. */
  #previousSpeed: number | null = null;
  #previousAt = 0;

  constructor(transport: ObdTransport, options: ObdBleSourceOptions = {}) {
    this.#transport = transport;
    this.#cycleDelayMs = options.cycleDelayMs ?? 0;
    this.#autoPoll = options.autoPoll ?? true;
    this.#client = new Elm327Client(transport, {
      ...(options.commandTimeoutMs === undefined
        ? {}
        : { commandTimeoutMs: options.commandTimeoutMs }),
    });
  }

  getStatus(): ConnectionStatus {
    return this.#status;
  }

  getAvailableChannels(): ReadonlySet<AnyChannel> {
    return this.#channels;
  }

  async connect(): Promise<void> {
    if (this.#status === 'connected' || this.#status === 'connecting') return;
    this.#setStatus('connecting');

    try {
      await this.#client.connect();
      this.#unsubscribeTransport = this.#transport.onDisconnect(() => {
        this.#running = false;
        this.#setStatus('disconnected');
      });

      this.#supported = await this.#client.discoverSupportedPids();
      this.#channels = derivedChannels(this.#supported);

      this.#setStatus('connected');
      if (this.#autoPoll) {
        this.#running = true;
        void this.#loop();
      }
    } catch (cause: unknown) {
      this.#running = false;
      const error = cause instanceof Error ? cause : new Error('Connection failed.');
      this.#setStatus('error', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.#running = false;
    this.#unsubscribeTransport?.();
    this.#unsubscribeTransport = null;
    await this.#client.disconnect();
    this.#setStatus('disconnected');
  }

  onFrame(listener: (frame: TelemetryFrame) => void): Unsubscribe {
    return this.#frames.add(listener);
  }

  onStatusChange(listener: (status: ConnectionStatus, error?: Error) => void): Unsubscribe {
    return this.#statuses.add(listener);
  }

  /**
   * Polls one cycle and produces the corresponding frame.
   *
   * Exposed for tests, which step cycles one by one with no clock or loop to stop.
   */
  async readCycle(): Promise<TelemetryFrame> {
    const values = new Map<number, number | null>();

    for (const pid of FAST_PIDS) {
      if (this.#supported.has(pid)) values.set(pid, await this.#client.readPid(pid));
    }

    const slow = this.#nextSlowPid();
    if (slow !== null) values.set(slow, await this.#client.readPid(slow));

    this.#latest = this.#assemble(values);
    return this.#latest;
  }

  /**
   * Picks the round's slow metric, skipping those the vehicle does not expose - otherwise one round
   * in five would be spent asking for nothing.
   */
  #nextSlowPid(): number | null {
    for (let attempt = 0; attempt < SLOW_PIDS.length; attempt += 1) {
      const pid = SLOW_PIDS[this.#slowIndex % SLOW_PIDS.length];
      this.#slowIndex = (this.#slowIndex + 1) % SLOW_PIDS.length;
      if (pid !== undefined && this.#supported.has(pid)) return pid;
    }
    return null;
  }

  /**
   * Builds the frame.
   *
   * Metrics not re-read this round keep their previous value: a temperature flickering between its
   * value and "unavailable" at the rate of the round-robin would be unreadable.
   */
  #assemble(values: ReadonlyMap<number, number | null>): TelemetryFrame {
    const timestamp = Date.now();
    const previous = this.#latest;

    const read = (pid: number): number | null => {
      const spec = findPid(pid);
      if (spec === null) return null;
      if (!values.has(pid)) return previous[spec.channel];
      return values.get(pid) ?? null;
    };

    const speed = read(0x0d);

    return {
      ...EMPTY_FRAME,
      timestamp,
      speed,
      rpm: read(0x0c),
      throttle: read(0x11),
      engineLoad: read(0x04),
      map: read(0x0b),
      barometric: read(0x33),
      maf: read(0x10),
      fuelRate: read(0x5e),
      coolantTemp: read(0x05),
      // Neither engaged gear nor lateral acceleration exist in standard OBD: they stay absent
      // rather than being invented.
      gear: null,
      lateralG: null,
      longitudinalG: this.#longitudinalG(speed, timestamp),
    };
  }

  /**
   * Longitudinal acceleration, derived from speed.
   *
   * OBD does not provide it, but deriving it is legitimate: it is exactly the same quantity,
   * measured differently. The time step is bounded - an abnormally long cycle would produce an
   * absurd acceleration.
   */
  #longitudinalG(speed: number | null, timestamp: number): number | null {
    if (speed === null) {
      this.#previousSpeed = null;
      return null;
    }

    const previousSpeed = this.#previousSpeed;
    const dt = (timestamp - this.#previousAt) / 1000;
    this.#previousSpeed = speed;
    this.#previousAt = timestamp;

    if (previousSpeed === null || dt <= 0 || dt > 2) return null;

    const deltaMs = (speed - previousSpeed) / 3.6;
    return deltaMs / dt / 9.80665;
  }

  async #loop(): Promise<void> {
    while (this.#running) {
      try {
        this.#frames.emit(await this.readCycle());
      } catch (cause: unknown) {
        this.#running = false;
        this.#setStatus('error', cause instanceof Error ? cause : new Error('Read interrupted.'));
        return;
      }
      if (this.#cycleDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.#cycleDelayMs));
      }
    }
  }

  #setStatus(status: ConnectionStatus, error?: Error): void {
    this.#status = status;
    this.#statuses.emit(status, error);
  }
}

/**
 * Channels actually displayable, derived ones included.
 *
 * A boost tile only makes sense if boost can be computed, which needs two PIDs: manifold pressure
 * and barometric pressure. A naturally aspirated car often supplies only one, hence the joint
 * check, without which the gauge would show and never read anything.
 */
export function derivedChannels(supported: ReadonlySet<number>): ReadonlySet<AnyChannel> {
  const channels = new Set<AnyChannel>(channelsForPids(supported));

  if (supported.has(0x0b) && supported.has(0x33)) channels.add('boost');

  // Consumption is either measured (PID 0x5E) or estimated from mass air flow - the second case
  // being the common one, most vehicles not exposing the first.
  if (supported.has(0x5e) || supported.has(0x10)) channels.add('consumption');

  // Derived from speed, so available whenever that is.
  if (supported.has(0x0d)) channels.add('longitudinalG');

  return channels;
}
