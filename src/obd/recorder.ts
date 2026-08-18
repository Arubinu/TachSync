import type { Unsubscribe } from '../telemetry/DataSource';
import type { ObdTransport } from './transport';

/**
 * Session recorder, wrapped around a transport.
 *
 * A decorator rather than a client option: recording concerns neither the ELM327 nor Bluetooth,
 * only what crosses the wire. It therefore works over any transport - real Bluetooth or a test fake
 * - and disappears entirely when unused.
 *
 * What it produces is not a development convenience: it is the only material that will make
 * connecting a real vehicle possible. The exact replies of a given adapter on a given car cannot be
 * guessed, and a hand-copied value loses precisely what matters - the timing, the incomplete
 * frames, the failures.
 */

export type CaptureEvent =
  /** Command sent to the adapter. */
  | { readonly at: number; readonly kind: 'sent'; readonly data: string }
  /** Fragment received, as-is: the splits are the link's own. */
  | { readonly at: number; readonly kind: 'received'; readonly data: string }
  /** Marker placed by the user: the start of a capture step. */
  | { readonly at: number; readonly kind: 'mark'; readonly label: string }
  | { readonly at: number; readonly kind: 'note'; readonly label: string };

export interface RecorderOptions {
  /**
   * Number of events kept. A ten-minute session produces a few thousand; the bound guards against
   * an oversight, not normal use, and truncation is declared in the log rather than silent.
   */
  readonly limit?: number;
  /** Injectable clock: tests must not depend on real time. */
  readonly now?: () => number;
}

const DEFAULT_LIMIT = 200_000;

/**
 * Reply to mode 09 PID 02 - the vehicle identification number.
 *
 * The application never asks for it, but logs get shared and the VIN ties a trace to a car by name.
 * Masked on write rather than on send: by then it would already have reached the disk.
 */
const VIN_RESPONSE = /\b49\s*02\b[\s0-9A-F]*/gi;

export class TransportRecorder implements ObdTransport {
  readonly #inner: ObdTransport;
  readonly #now: () => number;
  readonly #limit: number;
  readonly #events: CaptureEvent[] = [];
  readonly #startedAt = new Date();
  #origin: number;
  #dropped = 0;

  constructor(inner: ObdTransport, options: RecorderOptions = {}) {
    this.#inner = inner;
    this.#now = options.now ?? (() => Date.now());
    this.#limit = options.limit ?? DEFAULT_LIMIT;
    this.#origin = this.#now();

    // Hooked up at construction: the ELM327 handshake goes out before anyone thinks to listen, and
    // it is exactly the part worth having.
    this.#inner.onData((chunk) => {
      this.#push({ at: this.#elapsed(), kind: 'received', data: redact(chunk) });
    });
  }

  async connect(): Promise<void> {
    // Reset here: time zero must be the connection, not the construction, which can precede it by
    // several seconds.
    this.#origin = this.#now();
    this.#push({ at: 0, kind: 'note', label: 'connect' });
    return this.#inner.connect();
  }

  async disconnect(): Promise<void> {
    this.#push({ at: this.#elapsed(), kind: 'note', label: 'disconnect' });
    return this.#inner.disconnect();
  }

  async write(data: string): Promise<void> {
    this.#push({ at: this.#elapsed(), kind: 'sent', data: data.trim() });
    return this.#inner.write(data);
  }

  onData(listener: (chunk: string) => void): Unsubscribe {
    return this.#inner.onData(listener);
  }

  onDisconnect(listener: () => void): Unsubscribe {
    return this.#inner.onDisconnect(listener);
  }

  /** Marks a step of the capture protocol. Called by the assistant. */
  mark(label: string): void {
    this.#push({ at: this.#elapsed(), kind: 'mark', label });
  }

  get events(): readonly CaptureEvent[] {
    return this.#events;
  }

  #elapsed(): number {
    return this.#now() - this.#origin;
  }

  #push(event: CaptureEvent): void {
    if (this.#events.length >= this.#limit) {
      this.#dropped += 1;
      return;
    }
    this.#events.push(event);
  }

  /**
   * Log as text, one line per event.
   *
   * Text rather than JSON: it reads without tooling, truncates without breaking, and stays
   * greppable. A file needing a special editor ends up never being opened.
   */
  toLog(vehicle = ''): string {
    const head = [
      'TACHSYNC - OBD-II CAPTURE LOG',
      `Started    : ${this.#startedAt.toISOString()}`,
      `Events     : ${this.#events.length}${this.#dropped > 0 ? ` (+${this.#dropped} dropped)` : ''}`,
      `Vehicle    : ${vehicle}`,
      '',
      'Legend: > command sent   < reply received   # marker   ! state',
      'Times are in seconds since the connection.',
      '',
    ];

    const lines = this.#events.map((event) => {
      const stamp = (event.at / 1000).toFixed(3).padStart(9, ' ');
      if (event.kind === 'sent') return `${stamp} > ${event.data}`;
      if (event.kind === 'received') return `${stamp} < ${visible(event.data)}`;
      if (event.kind === 'mark') return `${stamp} # ${event.label}`;
      return `${stamp} ! ${event.label}`;
    });

    return [...head, ...lines, ''].join('\n');
  }
}

function redact(chunk: string): string {
  return chunk.replace(VIN_RESPONSE, '49 02 [VIN redacted]');
}

/** Makes the terminators visible, since they carry framing information. */
function visible(data: string): string {
  return data.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}
