/**
 * ELM327 protocol - entirely pure, no I/O.
 *
 * The adapter speaks a modem-derived AT dialect: write a line terminated by a carriage return, it
 * answers with lines, then emits the `>` prompt to say it is ready. This module does three things:
 * reassemble fragments, recognise what the adapter answered, and extract the data bytes.
 *
 * Everything is pure functions for one reason: this is the only part of the OBD stack verifiable
 * without a car, an adapter or Bluetooth. The awkward cases - command echo, `SEARCHING...`, replies
 * from several ECUs, missing spaces - are all tested here.
 */

/** Terminates a command sent to the adapter. */
export const COMMAND_TERMINATOR = '\r';

/** Prompt signalling the adapter has finished answering and awaits the next command. */
export const PROMPT = '>';

/**
 * Initialisation sequence.
 *
 * `ATE0` turns off echo, `ATL0` line feeds, `ATS0` spaces - three byte savings that matter on a
 * slow link polled ten times a second. `ATSP0` lets the adapter discover the vehicle protocol
 * itself, avoiding per-car configuration.
 *
 * Parsing depends on none of these settings: it tolerates echo and spaces alike, since an adapter
 * that warm-restarts may have restored them.
 */
export const INIT_COMMANDS: readonly string[] = ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0'];

/** Adapter reply, once recognised. */
export type Elm327Reply =
  | { readonly kind: 'data'; readonly lines: readonly string[] }
  /** The ECU returned nothing: unsupported PID, or engine off. */
  | { readonly kind: 'no-data' }
  /** Acknowledgement of an AT command. */
  | { readonly kind: 'ok' }
  | { readonly kind: 'error'; readonly message: string };

/**
 * Adapter error messages.
 *
 * `SEARCHING...` is not one: it is a waiting line emitted during protocol detection, followed by
 * the real answer. Mistaking it for an error would fail the very first read of every session.
 */
const ERROR_MARKERS: readonly string[] = [
  'UNABLE TO CONNECT',
  'BUS INIT',
  'BUS ERROR',
  'CAN ERROR',
  'DATA ERROR',
  'BUFFER FULL',
  'FB ERROR',
  'LV RESET',
  'STOPPED',
  'ACT ALERT',
];

const NOISE_LINES: readonly string[] = ['SEARCHING...', 'SEARCHING'];

/**
 * Reassembles received fragments into complete replies.
 *
 * A Bluetooth notification respects no boundary: one reply can arrive in five pieces, or five
 * replies in one. Only the `>` prompt delimits, hence this function - pure, and therefore
 * verifiable against deliberately absurd splits.
 *
 * Returns the completed replies and whatever is still pending.
 */
export function splitResponses(
  pending: string,
  chunk: string,
): { readonly responses: readonly string[]; readonly pending: string } {
  const buffer = pending + chunk;
  const parts = buffer.split(PROMPT);
  // The last piece is not terminated by a prompt: it stays pending.
  const pendingRest = parts.pop() ?? '';

  return {
    responses: parts.map((part) => part.trim()).filter((part) => part.length > 0),
    pending: pendingRest,
  };
}

/**
 * Splits a raw reply into useful lines.
 *
 * Discards the command echo, waiting lines and blanks. The echo is compared only after stripping
 * spaces: the adapter returns it as typed, but case and spacing are not guaranteed.
 */
export function cleanLines(raw: string, command?: string): readonly string[] {
  const echo = command === undefined ? null : normalize(command);

  return raw
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !NOISE_LINES.includes(line.toUpperCase()))
    .filter((line) => echo === null || normalize(line) !== echo);
}

/** Recognises what the adapter answered. */
export function parseReply(raw: string, command?: string): Elm327Reply {
  const lines = cleanLines(raw, command);

  if (lines.length === 0) return { kind: 'no-data' };

  const upper = lines.map((line) => line.toUpperCase());

  if (upper.some((line) => line.includes('NO DATA'))) return { kind: 'no-data' };

  // A lone `?`: command not understood. Useful for detecting an adapter that does not handle an AT
  // command believed universal.
  if (upper.some((line) => line === '?')) {
    return { kind: 'error', message: 'Command not recognised by the adapter.' };
  }

  const failure = upper.find((line) => ERROR_MARKERS.some((marker) => line.includes(marker)));
  if (failure !== undefined) return { kind: 'error', message: failure };

  if (upper.every((line) => line === 'OK')) return { kind: 'ok' };

  return { kind: 'data', lines };
}

/** Builds a mode 01 request: `010C` for engine speed. */
export function pidCommand(mode: number, pid: number): string {
  return byteToHex(mode) + byteToHex(pid);
}

/**
 * Extracts the data bytes from a mode 01 reply.
 *
 * A valid reply starts with the mode plus 0x40 followed by the PID: `41 0C 1A F8` for a `010C`
 * request. The rest is the payload.
 *
 * Several ECUs may answer the same request; the first matching line is kept. Choosing between them
 * would require knowing which is authoritative for that PID - a vehicle question, not a protocol
 * one.
 */
export function extractPidData(pid: number, reply: Elm327Reply): readonly number[] | null {
  if (reply.kind !== 'data') return null;

  const prefix = byteToHex(0x41) + byteToHex(pid);

  for (const line of reply.lines) {
    const bytes = hexToBytes(line);
    if (bytes === null) continue;

    const hex = bytes.map(byteToHex).join('');
    if (!hex.startsWith(prefix)) continue;

    return bytes.slice(2);
  }

  return null;
}

/**
 * Converts a hex line into bytes.
 *
 * Spaces are stripped first: depending on the `ATS0` setting the same reply reads `41 0C 1A F8` or
 * `410C1AF8`, and the adapter may have returned to its factory setting unnoticed. Returns `null` if
 * this is not hex in whole bytes, which incidentally rejects any text the error recognition did not
 * catch.
 */
export function hexToBytes(line: string): readonly number[] | null {
  const compact = line.replace(/\s+/g, '');
  if (compact.length === 0 || compact.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(compact)) return null;

  const bytes: number[] = [];
  for (let i = 0; i < compact.length; i += 2) {
    bytes.push(Number.parseInt(compact.slice(i, i + 2), 16));
  }
  return bytes;
}

export function byteToHex(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, '0');
}

function normalize(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}
