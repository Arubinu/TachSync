import { useCallback, useEffect, useState } from 'react';
import { format, type Translation } from '../i18n';
import { readAvatarFile } from './importAvatar';
import { useTipMessage } from '../board/Tip';
import { getAvatars, setImportedAvatars, subscribeAvatars } from './registry';
import { deleteAvatar, listAvatars, saveAvatar, type ImportedAvatar } from './store';
import type { AvatarDefinition } from './types';

export interface AvatarLibrary {
  readonly avatars: readonly AvatarDefinition[];
  /** Why an import was refused, or what it brought in. Withdrawn on its own, like every answer. */
  readonly report: string | null;
  /** Changes on every answer, so the same words twice show twice. */
  readonly reportId: number;
  importFile(file: File): Promise<void>;
  remove(id: string): Promise<void>;
  /** The raw records, for slipping into a backup. */
  records(): Promise<readonly ImportedAvatar[]>;
}

/**
 * Avatar library: the built-ins, plus those imported from IndexedDB.
 *
 * The registry stays the source of truth and notifies its changes; this hook only wakes React.
 * Going through state would react badly to `findAvatar` also being called outside components, when
 * mounting the avatar.
 *
 * The catalogue is handed in, not read from the context: `App` provides that context, so a hook
 * called from its body would read the default one - English - whatever the interface is set to.
 */
export function useAvatars(t: Translation): AvatarLibrary {
  const [avatars, setAvatars] = useState<readonly AvatarDefinition[]>(getAvatars);
  const { text: report, id: reportId, say: setReport } = useTipMessage();

  useEffect(() => {
    const unsubscribe = subscribeAvatars(() => setAvatars(getAvatars()));
    void listAvatars().then((records) => setImportedAvatars(records));
    return unsubscribe;
  }, []);

  const importFile = useCallback(
    async (file: File): Promise<void> => {
      const { avatar, error } = readAvatarFile(file, t);
      if (avatar === null) {
        setReport(error);
        return;
      }

      try {
        await saveAvatar(avatar);
        setImportedAvatars(await listAvatars());
        setReport(format(t.settings.avatarImported, { name: avatar.label }));
      } catch (cause: unknown) {
        // Quota exceeded, private browsing: the reason matters, the user can do nothing with a bare
        // "failed".
        setReport(cause instanceof Error ? cause.message : t.settings.importFailed);
      }
    },
    [t],
  );

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteAvatar(id);
    setImportedAvatars(await listAvatars());
    setReport(null);
  }, []);

  const records = useCallback((): Promise<readonly ImportedAvatar[]> => listAvatars(), []);

  return { avatars, report, reportId, importFile, remove, records };
}
