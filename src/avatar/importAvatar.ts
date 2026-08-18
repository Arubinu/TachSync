import { format, type Translation } from '../i18n';
import type { ImportedAvatar } from './store';
import type { AvatarKind } from './types';

/**
 * Reading an avatar file.
 *
 * Two formats only, because two rendering engines only: `.riv` for an animated vector face, `.glb`
 * or `.gltf` for a volumetric character. The extension is enough to pick the engine - the content
 * is not inspected: these formats cannot be validated cheaply, and the engine will reject a corrupt
 * file with a far more useful message than anything produced here.
 */

/** Beyond this, the device will struggle to display it as much as storage to keep it. */
export const MAX_AVATAR_BYTES = 64 * 1024 * 1024;

const EXTENSIONS: Record<string, AvatarKind> = {
  riv: 'vector',
  glb: 'volumetric',
  gltf: 'volumetric',
};

export interface AvatarImport {
  readonly avatar: ImportedAvatar | null;
  readonly error: string | null;
}

export function readAvatarFile(file: File, t: Translation): AvatarImport {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const kind = EXTENSIONS[extension];

  if (kind === undefined) {
    return { avatar: null, error: format(t.errors.unknownAvatarFormat, { ext: extension }) };
  }

  if (file.size > MAX_AVATAR_BYTES) {
    const size = Math.round(file.size / 1024 / 1024);
    return { avatar: null, error: format(t.errors.avatarTooLarge, { size }) };
  }

  const label = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();

  return {
    avatar: {
      // The timestamp stops a re-imported file overwriting the previous one: two variants from the
      // same export may both be wanted.
      id: `import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      // A file name reduced to its extension leaves nothing to display: the generic label stands
      // in, in the interface language.
      label: label.length > 0 ? label : t.settings.avatar,
      kind,
      fileName: file.name,
      size: file.size,
      data: file,
    },
    error: null,
  };
}
