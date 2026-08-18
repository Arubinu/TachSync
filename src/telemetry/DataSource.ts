import type { AnyChannel, TelemetryFrame } from './types';

/**
 * Telemetry source abstraction.
 *
 * The whole application is written against this interface, never against a particular transport.
 * Two implementations coexist:
 *
 * - `SimulatedSource`: vehicle physics model, the main development source until the OBD adapter
 * arrives - and afterwards, the basis for reproducible tests. - `ObdBleSource`: Web Bluetooth to an
 * ELM327/OBDLink adapter.
 *
 * Connecting real hardware therefore touches no UI component.
 */

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type Unsubscribe = () => void;

export interface DataSourceInfo {
  readonly id: string;
  readonly label: string;
  readonly kind: 'simulated' | 'obd-ble';
}

export interface DataSource {
  readonly info: DataSourceInfo;

  getStatus(): ConnectionStatus;

  /**
   * Channels this source can supply, derived ones included. On a real vehicle the list of supported
   * PIDs is only known after querying the ECU (PID 0x00/0x20/0x40).
   *
   * This list decides which tiles exist: a tile whose channel is missing is not greyed out, it is
   * not rendered at all.
   */
  getAvailableChannels(): ReadonlySet<AnyChannel>;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  onFrame(listener: (frame: TelemetryFrame) => void): Unsubscribe;
  onStatusChange(listener: (status: ConnectionStatus, error?: Error) => void): Unsubscribe;
}

/** Minimal typed emitter, no dependencies. */
export class Emitter<Args extends unknown[]> {
  #listeners = new Set<(...args: Args) => void>();

  add(listener: (...args: Args) => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  emit(...args: Args): void {
    // Defensive copy: a listener may unsubscribe during emission.
    for (const listener of [...this.#listeners]) listener(...args);
  }

  clear(): void {
    this.#listeners.clear();
  }
}
