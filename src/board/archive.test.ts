import { describe, expect, it } from 'vitest';
import { createArchive, crc32, readArchive } from './archive';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function textEntry(name: string, content: string): { name: string; data: Uint8Array } {
  return { name: name, data: encoder.encode(content) };
}

describe('archive', () => {
  it('reads back exactly what it wrote', async () => {
    const archive = createArchive([
      textEntry('README.txt', 'notice'),
      textEntry('settings.json', '{"a":1}'),
    ]);

    const entries = await readArchive(archive);

    expect(entries.map((e) => e.name)).toEqual(['README.txt', 'settings.json']);
    expect(decoder.decode(entries[1]?.data)).toBe('{"a":1}');
  });

  it('preserves the bytes of a binary', async () => {
    // Every byte value, including those resembling ZIP signatures.
    const binary = new Uint8Array(1024);
    for (let i = 0; i < binary.length; i += 1) binary[i] = i % 256;

    const entries = await readArchive(createArchive([{ name: 'avatars/x.glb', data: binary }]));

    expect(entries[0]?.data).toEqual(binary);
  });

  it('handles accents in entry names', async () => {
    const entries = await readArchive(createArchive([textEntry('avatars/tête néon.riv', 'x')]));

    expect(entries[0]?.name).toBe('avatars/tête néon.riv');
  });

  it('accepts an empty archive', async () => {
    expect(await readArchive(createArchive([]))).toEqual([]);
  });

  it('refuses a file that is not an archive', async () => {
    await expect(readArchive(new Blob([encoder.encode('pas une archive')]))).rejects.toThrow();
  });

  it('produces a conforming redundancy check', () => {
    // The standard's reference value for `123456789`.
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926);
  });

  it('stays readable by a third-party tool', async () => {
    // Local header signature at the start of the file: this is what system tools look for to
    // recognise an archive.
    const bytes = new Uint8Array(await createArchive([textEntry('a.txt', 'b')]).arrayBuffer());

    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});
