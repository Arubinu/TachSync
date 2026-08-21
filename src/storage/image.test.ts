import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { checkImage, isImage, MAX_IMAGE_BYTES, storedName } from './image';

/** A file of a stated size, without allocating it. */
function file(name: string, type: string, size = 10): File {
  const made = new File([new Uint8Array(1)], name, { type });
  Object.defineProperty(made, 'size', { value: size });
  return made;
}

describe('taking an image file', () => {
  it('accepts what the system declares as an image', () => {
    expect(isImage(file('sunset.jpg', 'image/jpeg'))).toBe(true);
    expect(isImage(file('logo.svg', 'image/svg+xml'))).toBe(true);
  });

  it('falls back to the extension when the system declares nothing', () => {
    // Measured on Android pickers: some hand over a file with an empty `type`. Refusing it would
    // refuse an ordinary photo for a reason the user cannot see, let alone fix.
    expect(isImage(file('sunset.jpg', ''))).toBe(true);
  });

  it('refuses what is not an image', () => {
    expect(checkImage(file('notes.pdf', 'application/pdf'), en)).toBe(en.errors.notAnImage);
  });

  it('refuses a file above the cap, and accepts one exactly at it', () => {
    expect(checkImage(file('huge.png', 'image/png', MAX_IMAGE_BYTES + 1), en)).not.toBeNull();
    expect(checkImage(file('fine.png', 'image/png', MAX_IMAGE_BYTES), en)).toBeNull();
  });

  it('renames only what resampling changed the format of', () => {
    // A `.png` holding WebP would be a small lie told to whoever opens the backup archive.
    expect(storedName(file('mont blanc.png', 'image/png'), true)).toBe('mont blanc.webp');
    expect(storedName(file('mont blanc.png', 'image/png'), false)).toBe('mont blanc.png');
  });
});
