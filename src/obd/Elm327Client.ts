import type { Unsubscribe } from '../telemetry/DataSource';
import {
  COMMAND_TERMINATOR,
  INIT_COMMANDS,
  extractPidData,
  parseReply,
  pidCommand,
  splitResponses,
  type Elm327Reply,
} from './elm327';
import { SUPPORT_PIDS, decodeSupportedPids, findPid } from './pids';
import type { ObdTransport } from './transport';

/**
 * Drives an ELM327 dialogue over any transport.
 *
 * Knows neither Bluetooth nor Android: it receives an `ObdTransport` and applies the protocol. The
 * same client plugs into Web Bluetooth in the browser and the native plugin in the app, without
 * changing a line.
 *
 * Two rules govern this file:
 *
 * - One command at a time. The adapter has no queue: sending a request before reading the previous
 * reply mixes the two. The serialisation is a necessity, not a precaution. - A timeout does not
 * break the session. In a car a lost reading is routine; return an error and keep polling.
 */

export interface Elm327Options {
  /** Timeout for an ordinary reply, ms. */
  readonly commandTimeoutMs?: number;
  /** Timeout for `ATZ`, which resets the adapter and takes far longer. */
  readonly resetTimeoutMs?: number;
}

export interface RequestOptions {
  readonly timeoutMs?: number;
  /**
   * Filters what may end the wait.
   *
   * Used to discard a late reply: after a timeout the abandoned one often arrives anyway, and
   * without this filter it would be served to the next request. The whole dialogue would then stay
   * one step out of phase until the end of the session - a failure made all the more confusing by
   * every displayed value staying plausible.
   *
   * A counter of replies to drop would not do: if the lost reply never arrives, it would eat the
   * next one, which would time out in turn, and the offset would become permanent. Recognising the
   * reply by its content repairs itself.
   */
  readonly accepts?: (reply: Elm327Reply) => boolean;
}

interface Waiter {
  readonly resolve: (reply: Elm327Reply) => void;
  readonly command: string;
  readonly accepts: ((reply: Elm327Reply) => boolean) | undefined;
  timer: ReturnType<typeof setTimeout> | null;
}

export class Elm327Client {
  readonly #transport: ObdTransport;
  readonly #commandTimeoutMs: number;
  readonly #resetTimeoutMs: number;

  #unsubscribe: Unsubscribe | null = null;
  #pending = '';
  #waiter: Waiter | null = null;
  /** Chain of pending commands: guarantees only one is in flight. */
  #queue: Promise<unknown> = Promise.resolve();

  constructor(transport: ObdTransport, options: Elm327Options = {}) {
    this.#transport = transport;
    this.#commandTimeoutMs = options.commandTimeoutMs ?? 1000;
    this.#resetTimeoutMs = options.resetTimeoutMs ?? 5000;
  }

  async connect(): Promise<void> {
    await this.#transport.connect();
    this.#unsubscribe = this.#transport.onData((chunk) => this.#receive(chunk));

    for (const command of INIT_COMMANDS) {
      // `ATZ` answers with the firmware version, not `OK`: check only that a reply came, not its
      // nature.
      await this.send(command, command === 'ATZ' ? { timeoutMs: this.#resetTimeoutMs } : {});
    }
  }

  async disconnect(): Promise<void> {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#settle({ kind: 'error', message: 'Link closed.' });
    this.#pending = '';
    await this.#transport.disconnect();
  }

  /** Sends a command and waits for its reply. Calls queue behind one another. */
  send(command: string, options: RequestOptions = {}): Promise<Elm327Reply> {
    const run = (): Promise<Elm327Reply> => this.#exchange(command, options);
    // `then(run, run)`: a failed command must not block the queue.
    const result = this.#queue.then(run, run);
    this.#queue = result.catch(() => undefined);
    return result;
  }

  /** Reads a PID and converts it to a physical quantity. `null` if unavailable. */
  async readPid(pid: number): Promise<number | null> {
    const spec = findPid(pid);
    if (spec === null) return null;

    const reply = await this.send(pidCommand(0x01, pid), { accepts: answersPid(pid) });
    const data = extractPidData(pid, reply);
    if (data === null || data.length < spec.bytes) return null;

    return spec.decode(data);
  }

  /**
   * Asks the vehicle which PIDs it supports.
   *
   * The masks chain: 0x00 describes 0x01-0x20 and says whether 0x20 exists, which describes the
   * next range. Stop as soon as a range is not announced, otherwise PIDs already known not to exist
   * would be queried.
   */
  async discoverSupportedPids(): Promise<Set<number>> {
    const supported = new Set<number>();

    for (const base of SUPPORT_PIDS) {
      if (base !== 0x00 && !supported.has(base)) break;

      const reply = await this.send(pidCommand(0x01, base), { accepts: answersPid(base) });
      const data = extractPidData(base, reply);
      if (data === null) break;

      for (const pid of decodeSupportedPids(base, data)) supported.add(pid);
    }

    return supported;
  }

  #exchange(command: string, options: RequestOptions): Promise<Elm327Reply> {
    return new Promise<Elm327Reply>((resolve) => {
      const waiter: Waiter = { resolve, command, accepts: options.accepts, timer: null };
      this.#waiter = waiter;

      waiter.timer = setTimeout(() => {
        // The partial fragment left in the buffer will never be completed.
        this.#pending = '';
        this.#settle({ kind: 'error', message: `Timed out on "${command}".` });
      }, options.timeoutMs ?? this.#commandTimeoutMs);

      this.#transport.write(command + COMMAND_TERMINATOR).catch((cause: unknown) => {
        this.#settle({
          kind: 'error',
          message: cause instanceof Error ? cause.message : 'Write failed.',
        });
      });
    });
  }

  #receive(chunk: string): void {
    const { responses, pending } = splitResponses(this.#pending, chunk);
    this.#pending = pending;

    for (const raw of responses) {
      const waiter = this.#waiter;
      // Nothing is waiting: a late reply to an abandoned request.
      if (waiter === null) continue;

      const reply = parseReply(raw, waiter.command);
      // Addressed to another request: let it pass and keep waiting.
      if (waiter.accepts !== undefined && !waiter.accepts(reply)) continue;

      this.#settle(reply);
    }
  }

  /** Ends the current wait, if any. */
  #settle(reply: Elm327Reply): void {
    const waiter = this.#waiter;
    if (waiter === null) return;

    this.#waiter = null;
    if (waiter.timer !== null) clearTimeout(waiter.timer);
    waiter.resolve(reply);
  }
}

/**
 * Accepts a reply that really concerns the requested PID.
 *
 * Non-numeric replies (`NO DATA`, errors) are accepted as-is: nothing says which request they
 * answered, and refusing them would make a reply that will never come be waited for until the
 * timeout.
 */
function answersPid(pid: number): (reply: Elm327Reply) => boolean {
  return (reply) => reply.kind !== 'data' || extractPidData(pid, reply) !== null;
}
