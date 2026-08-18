/**
 * Minimal ZIP archive, stored (uncompressed) format.
 *
 * Written here rather than pulled from a library: the need is packing a few files, and a dependency
 * of tens of kilobytes for that would weigh down a shell meant to stay light.
 *
 * No compression. Avatars are `.glb` and `.riv`, already compressed: running them through a
 * compressor would cost time and memory for nothing. Only the settings file would lose a few
 * kilobytes, which is negligible.
 *
 * On read, compressed entries are accepted too: a user can open the archive, change it and close it
 * with their system tool, which will compress. Refusing their file for that alone would be
 * incomprehensible from their point of view.
 */

export interface ArchiveEntry {
  readonly name: string;
  readonly data: Uint8Array;
}

/**
 * Carries a translation key rather than a sentence.
 *
 * This module knows nothing of the interface language; the caller turns the
 * code into a message the reader understands.
 */
export class ArchiveError extends Error {
  constructor(readonly code: 'notAnArchive' | 'unsupportedCompression') {
    super(code);
    this.name = 'ArchiveError';
  }
}

const SIGNATURE_LOCAL = 0x04034b50;
const SIGNATURE_CENTRAL = 0x02014b50;
const SIGNATURE_END = 0x06054b50;
/** Names are UTF-8: the flag declares it, otherwise accents are lost. */
const FLAG_UTF8 = 0x0800;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

export function createArchive(entries: readonly ArchiveEntry[]): Blob {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const { time, date } = dosStamp(new Date());

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);

    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, SIGNATURE_LOCAL, true);
    view.setUint16(4, 20, true); // version needed to extract
    view.setUint16(6, FLAG_UTF8, true);
    view.setUint16(8, METHOD_STORED, true);
    view.setUint16(10, time, true);
    view.setUint16(12, date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, entry.data.length, true); // compressed size
    view.setUint32(22, entry.data.length, true); // uncompressed size
    view.setUint16(26, name.length, true);
    view.setUint16(28, 0, true); // no extra field
    local.set(name, 30);

    parts.push(local, entry.data);

    const head = new Uint8Array(46 + name.length);
    const headView = new DataView(head.buffer);
    headView.setUint32(0, SIGNATURE_CENTRAL, true);
    headView.setUint16(4, 20, true); // version made by
    headView.setUint16(6, 20, true);
    headView.setUint16(8, FLAG_UTF8, true);
    headView.setUint16(10, METHOD_STORED, true);
    headView.setUint16(12, time, true);
    headView.setUint16(14, date, true);
    headView.setUint32(16, crc, true);
    headView.setUint32(20, entry.data.length, true);
    headView.setUint32(24, entry.data.length, true);
    headView.setUint16(28, name.length, true);
    headView.setUint32(42, offset, true); // offset of the local header
    head.set(name, 46);
    central.push(head);

    offset += local.length + entry.data.length;
  }

  const centralSize = central.reduce((total, part) => total + part.length, 0);

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, SIGNATURE_END, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end] as BlobPart[], {
    type: 'application/octet-stream',
  });
}

export async function readArchive(blob: Blob): Promise<readonly ArchiveEntry[]> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);

  const end = findEnd(view, bytes.length);
  if (end === -1) throw new ArchiveError('notAnArchive');

  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries: ArchiveEntry[] = [];

  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== SIGNATURE_CENTRAL) break;

    const method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const local = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));

    // The local header repeats the length of the variable fields: those are the ones to follow, and
    // they can differ from the directory's.
    const localName = view.getUint16(local + 26, true);
    const localExtra = view.getUint16(local + 28, true);
    const start = local + 30 + localName + localExtra;
    const raw = bytes.subarray(start, start + compressed);

    entries.push({ name, data: await inflate(raw, method) });

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

async function inflate(raw: Uint8Array, method: number): Promise<Uint8Array> {
  if (method === METHOD_STORED) return raw;
  if (method !== METHOD_DEFLATE) throw new ArchiveError('unsupportedCompression');

  const stream = new Blob([raw as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Locates the end of the central directory.
 *
 * Searched backwards because an archive comment of arbitrary length can follow it, so its position
 * cannot be derived from the file size.
 */
function findEnd(view: DataView, length: number): number {
  const limit = Math.max(0, length - 22 - 0xffff);
  for (let index = length - 22; index >= limit; index -= 1) {
    if (view.getUint32(index, true) === SIGNATURE_END) return index;
  }
  return -1;
}

/** MS-DOS timestamp, the only format the ZIP header accepts. */
function dosStamp(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
