/**
 * Standard PID table (SAE J1979, mode 01) and their decoders.
 *
 * Pure as well: a decoder takes bytes and returns a physical quantity. The formulas come from the
 * standard and are therefore checkable by hand - hence the tests, which reuse the canonical
 * examples.
 *
 * Three `TelemetryFrame` channels deliberately have no PID here: `gear` is inferred from the
 * speed/rpm ratio, `lateralG` and `longitudinalG` come from the phone's accelerometer. OBD does not
 * expose them.
 */

import type { TelemetryChannel } from '../telemetry/types';

export interface PidSpec {
  /** PID number in mode 01. */
  readonly id: number;
  readonly label: string;
  /** Expected number of data bytes. */
  readonly bytes: number;
  readonly channel: TelemetryChannel;
  readonly unit: string;
  /** Converts the bytes into a physical quantity, or `null` if invalid. */
  readonly decode: (data: readonly number[]) => number | null;
}

/** One byte scaled to a percentage - a recurring pattern in the standard. */
function percent(data: readonly number[]): number | null {
  const a = data[0];
  return a === undefined ? null : (a * 100) / 255;
}

function single(data: readonly number[]): number | null {
  return data[0] ?? null;
}

function pair(data: readonly number[]): number | null {
  const a = data[0];
  const b = data[1];
  if (a === undefined || b === undefined) return null;
  return a * 256 + b;
}

export const PID_SPECS: readonly PidSpec[] = [
  {
    id: 0x04,
    label: 'Calculated engine load',
    bytes: 1,
    channel: 'engineLoad',
    unit: '%',
    decode: percent,
  },
  {
    id: 0x05,
    label: 'Engine coolant temperature',
    bytes: 1,
    channel: 'coolantTemp',
    unit: '°C',
    // Offset by 40: the standard encodes negative temperatures unsigned.
    decode: (data) => {
      const a = single(data);
      return a === null ? null : a - 40;
    },
  },
  {
    id: 0x0b,
    label: 'Intake manifold absolute pressure',
    bytes: 1,
    channel: 'map',
    unit: 'kPa',
    decode: single,
  },
  {
    id: 0x0c,
    label: 'Engine speed',
    bytes: 2,
    channel: 'rpm',
    unit: 'tr/min',
    // Encoded to the quarter, hence the division.
    decode: (data) => {
      const value = pair(data);
      return value === null ? null : value / 4;
    },
  },
  {
    id: 0x0d,
    label: 'Vehicle speed',
    bytes: 1,
    channel: 'speed',
    unit: 'km/h',
    decode: single,
  },
  {
    id: 0x10,
    label: 'Mass air flow rate',
    bytes: 2,
    channel: 'maf',
    unit: 'g/s',
    decode: (data) => {
      const value = pair(data);
      return value === null ? null : value / 100;
    },
  },
  {
    id: 0x11,
    label: 'Throttle position',
    bytes: 1,
    channel: 'throttle',
    unit: '%',
    decode: percent,
  },
  {
    id: 0x33,
    label: 'Absolute barometric pressure',
    bytes: 1,
    channel: 'barometric',
    unit: 'kPa',
    decode: single,
  },
  {
    id: 0x5e,
    label: 'Engine fuel rate',
    bytes: 2,
    channel: 'fuelRate',
    unit: 'L/h',
    decode: (data) => {
      const value = pair(data);
      return value === null ? null : value / 20;
    },
  },
];

export function findPid(id: number): PidSpec | null {
  return PID_SPECS.find((spec) => spec.id === id) ?? null;
}

/**
 * Inventory PIDs: each describes with a mask the 32 PIDs that follow it.
 *
 * 0x00 is queried first; if it announces 0x20 as supported, the next one follows, and so on. That
 * is how to know what the vehicle actually exposes - and therefore which tiles make sense on this
 * car.
 */
export const SUPPORT_PIDS: readonly number[] = [0x00, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0];

/**
 * Decodes a supported-PID mask.
 *
 * Four bytes, 32 bits, most significant first: the top bit of the first byte designates `base + 1`,
 * the bottom bit of the last designates `base + 32`.
 */
export function decodeSupportedPids(base: number, data: readonly number[]): Set<number> {
  const supported = new Set<number>();
  if (data.length < 4) return supported;

  for (let index = 0; index < 4; index += 1) {
    const byte = data[index];
    if (byte === undefined) continue;

    for (let bit = 0; bit < 8; bit += 1) {
      // Bit 7 first: the standard's order is reading order.
      const isSet = (byte & (0x80 >> bit)) !== 0;
      if (isSet) supported.add(base + index * 8 + bit + 1);
    }
  }

  return supported;
}

/** Channels reachable given the PIDs the vehicle declares it supports. */
export function channelsForPids(pids: ReadonlySet<number>): Set<TelemetryChannel> {
  const channels = new Set<TelemetryChannel>();
  for (const spec of PID_SPECS) {
    if (pids.has(spec.id)) channels.add(spec.channel);
  }
  return channels;
}
