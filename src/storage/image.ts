import { format, type Translation } from '../i18n';

/**
 * Taking an image file from the user, wherever it is going.
 *
 * The background image needed all of this first; the vehicle photo needs exactly the same, and two
 * copies would have drifted on the first cap anyone changed. Only WHERE the picture is stored
 * differs between them, which is what each store keeps for itself.
 */

/** Beyond this the file is refused outright, before anything tries to decode it. */
export const MAX_IMAGE_BYTES = 16 * 1024 * 1024;

/**
 * Longest edge kept, in pixels.
 *
 * The byte cap bounds the file, not the picture: a 16 MB PNG can hold 8000x6000 pixels - 192 MB
 * once decoded, on a phone already running the 3D avatar.
 */
export const MAX_IMAGE_EDGE = 2560;

/** Extensions accepted when the system reports no type, which happens on some Android pickers. */
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp', 'svg'];

export function isImage(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.includes(extension);
}

/**
 * Why a file cannot be used, or `null` when it can.
 *
 * Pure, and separate from the resampling below: what the name and size settle needs no canvas, and
 * stays testable without a browser.
 */
export function checkImage(file: File, t: Translation): string | null {
  if (!isImage(file)) return t.errors.notAnImage;

  if (file.size > MAX_IMAGE_BYTES) {
    return format(t.errors.imageTooLarge, { size: Math.round(file.size / 1024 / 1024) });
  }

  return null;
}

/**
 * Turns a picture into WebP, resampling it if it is oversized.
 *
 * One format for everything stored, not just for what had to be resized: a library holding JPEG,
 * PNG and WebP side by side asks every reader of it - the backup, the archive, the file name - to
 * carry the difference around for no benefit. WebP keeps transparency, which is the one thing PNG
 * was here for.
 *
 * A WebP already within the cap is returned untouched. Re-encoding it would cost a second
 * generation loss for a file that is already what is wanted.
 *
 * SVG is left alone: it has no pixels to lose, and rasterising it would throw away the one thing
 * it is good at.
 *
 * Every failure returns the original - no `createImageBitmap`, a decoder that refuses, a canvas
 * that will not export. Storing the picture as it came beats refusing it.
 */
export async function fitImage(file: File): Promise<Blob> {
  if (file.type === 'image/svg+xml') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);

    if (file.type === 'image/webp' && longest <= MAX_IMAGE_EDGE) {
      bitmap.close();
      return file;
    }

    const ratio = Math.min(1, MAX_IMAGE_EDGE / longest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);

    const context = canvas.getContext('2d');
    if (context === null) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const converted = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', 0.92);
    });

    // `toBlob` falls back to PNG where WebP is unsupported, which is still a picture: only the
    // promise of one format is lost, and only on a browser that cannot keep it.
    return converted ?? file;
  } catch {
    return file;
  }
}

/**
 * The name to store the result under.
 *
 * The extension follows the bytes, always: a `.png` holding WebP is a small lie told to whoever
 * opens the archive, and the whole point of converting was to stop having to ask.
 */
export function storedName(file: File, converted: boolean): string {
  return converted ? `${file.name.replace(/\.[^.]+$/, '')}.webp` : file.name;
}
