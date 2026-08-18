import { describe, expect, it } from 'vitest';
import { PID_SPECS, channelsForPids, decodeSupportedPids, findPid } from './pids';

/** Decodes by PID, as the client does. */
function decode(id: number, ...data: number[]): number | null {
  const spec = findPid(id);
  if (spec === null) throw new Error(`PID inconnu : ${id}`);
  return spec.decode(data);
}

describe('standard PID decoding', () => {
  it('engine speed: coded in quarter revolutions', () => {
    // 0x1AF8 = 6904 quarter-revs = 1726 rpm.
    expect(decode(0x0c, 0x1a, 0xf8)).toBe(1726);
    expect(decode(0x0c, 0x00, 0x00)).toBe(0);
  });

  it('speed: one byte, straight in km/h', () => {
    expect(decode(0x0d, 0x32)).toBe(50);
    expect(decode(0x0d, 0xff)).toBe(255);
  });

  it('temperature: offset by 40 to encode negatives', () => {
    expect(decode(0x05, 0x00)).toBe(-40);
    expect(decode(0x05, 0x28)).toBe(0);
    expect(decode(0x05, 0x5a)).toBe(50);
  });

  it('throttle and engine load: one byte scaled to a percentage', () => {
    expect(decode(0x11, 0xff)).toBeCloseTo(100, 6);
    expect(decode(0x11, 0x00)).toBe(0);
    expect(decode(0x04, 0x80)).toBeCloseTo(50.196, 3);
  });

  it('air flow: hundredths of a gram per second', () => {
    // 0x0BB8 = 3000 hundredths = 30 g/s.
    expect(decode(0x10, 0x0b, 0xb8)).toBe(30);
  });

  it('pressures: one byte in kilopascals', () => {
    expect(decode(0x0b, 0x64)).toBe(100);
    expect(decode(0x33, 0x65)).toBe(101);
  });

  it('fuel flow: twentieths of a litre per hour', () => {
    // 0x00C8 = 200 twentieths = 10 L/h.
    expect(decode(0x5e, 0x00, 0xc8)).toBe(10);
  });

  it('returns null if the bytes are missing', () => {
    expect(decode(0x0c, 0x1a)).toBeNull();
    expect(decode(0x0d)).toBeNull();
  });
});

describe('supported PID inventory', () => {
  it('reads the most significant bit as the first PID', () => {
    // 0x80 on the first byte and nothing elsewhere, so only PID 0x01.
    expect([...decodeSupportedPids(0x00, [0x80, 0x00, 0x00, 0x00])]).toEqual([0x01]);
  });

  it('reads the least significant bit as the thirty-second', () => {
    expect([...decodeSupportedPids(0x00, [0x00, 0x00, 0x00, 0x01])]).toEqual([0x20]);
  });

  it('shifts the numbering according to the range queried', () => {
    expect([...decodeSupportedPids(0x20, [0x80, 0x00, 0x00, 0x00])]).toEqual([0x21]);
  });

  it('decodes a realistic mask', () => {
    // Announces engine load (0x04), manifold pressure (0x0B), revs (0x0C), speed (0x0D), mass air
    // flow (0x10), throttle (0x11) and the 0x20 range.
    const supported = decodeSupportedPids(0x00, [0x98, 0x3b, 0x80, 0x11]);

    expect(supported.has(0x04)).toBe(true);
    expect(supported.has(0x0c)).toBe(true);
    expect(supported.has(0x0d)).toBe(true);
    expect(supported.has(0x11)).toBe(true);
    expect(supported.has(0x02)).toBe(false);
  });

  it('returns an empty set if the mask is truncated', () => {
    expect(decodeSupportedPids(0x00, [0x80, 0x00]).size).toBe(0);
  });
});

describe('reachable channels', () => {
  it('keeps only the channels whose PID is supported', () => {
    const channels = channelsForPids(new Set([0x0c, 0x0d]));

    expect([...channels].sort()).toEqual(['rpm', 'speed']);
  });

  it('promises nothing when the vehicle exposes nothing', () => {
    expect(channelsForPids(new Set()).size).toBe(0);
  });

  it('covers every PID in the table with a distinct channel', () => {
    const channels = new Set(PID_SPECS.map((spec) => spec.channel));

    // Two PIDs must not target the same channel: the second would overwrite the first with no way
    // of knowing which spoke.
    expect(channels.size).toBe(PID_SPECS.length);
  });
});
