import type { Translation } from '../i18n';
import type { ImportedAvatar } from './store';
import type { AvatarDefinition } from './types';

/**
 * Avatar registry.
 *
 * Two origins, presented alike to the user: built-in avatars drawn or modelled in code, which
 * depend on no file and work offline from first launch, and avatars imported by the user and kept
 * in IndexedDB.
 *
 * Nothing ships with the application any more - a single volumetric character weighed over 30 MB,
 * close to nine tenths of the install, for an avatar not everyone uses.
 *
 * Each entry imports its rendering engine on mount: neither three.js nor the Rive runtime is
 * downloaded until an avatar asks for it.
 */

/**
 * The built-in avatars.
 *
 * Their label is a translation key resolved at render time: the registry is a module built once, so
 * a translated name frozen here would stay in the startup language.
 */
const BUILT_IN: readonly AvatarDefinition[] = [
  {
    id: 'neon-face',
    labelKey: 'neonFaceLabel',
    descriptionKey: 'neonFaceDescription',
    kind: 'vector',
    mount: async (container, palette) =>
      (await import('./characters/neonFace')).mountNeonFace(container, palette),
  },
  {
    id: 'plush-companion',
    labelKey: 'plushLabel',
    descriptionKey: 'plushDescription',
    kind: 'volumetric',
    mount: async (container, palette) =>
      (await import('./characters/plushCompanion')).mountPlushCompanion(container, palette),
  },
];

/** Display name: the imported file name, or the translated built-in name. */
export function avatarLabel(avatar: AvatarDefinition, t: Translation): string {
  if (avatar.labelKey !== undefined) return t.avatars[avatar.labelKey];
  return avatar.label ?? avatar.id;
}

/** Object URLs for imported blobs, revoked when they go away. */
const urls = new Map<string, string>();

let imported: readonly AvatarDefinition[] = [];
const listeners = new Set<() => void>();

/**
 * Replaces the list of imported avatars.
 *
 * Stale object URLs are revoked - each one pins its blob in memory, and a volumetric model pins a
 * lot.
 */
export function setImportedAvatars(records: readonly ImportedAvatar[]): void {
  const kept = new Set(records.map((record) => record.id));
  for (const [id, url] of urls) {
    if (kept.has(id)) continue;
    URL.revokeObjectURL(url);
    urls.delete(id);
  }

  imported = records.map((record) => {
    let url = urls.get(record.id);
    if (url === undefined) {
      url = URL.createObjectURL(record.data);
      urls.set(record.id, url);
    }
    const objectUrl = url;

    return {
      id: record.id,
      label: record.label,
      description: record.fileName,
      kind: record.kind,
      imported: true,
      mount:
        record.kind === 'vector'
          ? async (container, palette) =>
              (await import('./characters/riveFace')).mountRiveFace(container, palette, objectUrl)
          : async (container, palette) =>
              (await import('./characters/gltfCompanion')).mountGltfCompanion(
                container,
                palette,
                objectUrl,
              ),
    };
  });

  for (const listener of [...listeners]) listener();
}

export function subscribeAvatars(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAvatars(): readonly AvatarDefinition[] {
  return [...BUILT_IN, ...imported];
}

export const DEFAULT_AVATAR_ID = 'neon-face';

export function findAvatar(id: string): AvatarDefinition {
  const avatars = getAvatars();
  // A removed avatar falls back to the first rather than leaving the screen empty.
  return avatars.find((avatar) => avatar.id === id) ?? avatars[0]!;
}

/** Next or previous avatar, wrapping around. */
export function cycleAvatar(id: string, direction: 1 | -1): string {
  const avatars = getAvatars();
  const index = avatars.findIndex((avatar) => avatar.id === id);
  const current = index === -1 ? 0 : index;
  const next = (current + direction + avatars.length) % avatars.length;
  return avatars[next]?.id ?? DEFAULT_AVATAR_ID;
}
