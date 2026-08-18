import { describe, expect, it } from 'vitest';
import { createArchive } from '../board/archive';
import { createBackup, readBackup } from '../board/backup';
import { parseSettingsFile } from '../board/settingsFile';
import { parseTilePack } from '../board/tileImport';
import { readAvatarFile } from '../avatar/importAvatar';
import { toProfileState } from '../profiles/migrate';
import { DEFAULT_SETTINGS } from '../board/layout';
import { de } from './de';
import { fr } from './fr';

/**
 * The catalogue can be complete in all seven languages without the code using it: exactly the gap
 * the first imports left, French sentences hard-coded behind an impeccable catalogue.
 *
 * `i18n.test.ts` compares the catalogues against each other; here we check the other half, which no
 * catalogue review can catch: that the import paths actually TAKE the language passed to them.
 */

describe('import messages follow the language', () => {
  it('rejects an unreadable file in the requested language', () => {
    expect(parseSettingsFile('{ pas du json', fr).error).toBe(fr.errors.invalidJson);
    expect(parseSettingsFile('{ pas du json', de).error).toBe(de.errors.invalidJson);
  });

  it('names the foreign backup in the requested language', () => {
    const text = JSON.stringify({ format: 'other-appli', settings: {} });

    expect(parseSettingsFile(text, fr).error).toContain('other-appli');
    expect(parseSettingsFile(text, de).error).toContain('Sicherung');
  });

  it('refuses a file that is not an archive, in the requested language', async () => {
    const file = new File(['pas une archive'], 'x.tachsync');

    expect((await readBackup(file, fr)).error).toBe(fr.errors.notABackup);
    expect((await readBackup(file, de)).error).toBe(de.errors.notABackup);
  });

  it('reports an incomplete archive in the requested language', async () => {
    const broken = createArchive([{ name: 'avatars/x.glb', data: new Uint8Array([1]) }]);
    const file = new File([broken], 'x.tachsync');

    // The missing entry's name stays the same everywhere: it is a file name, not a sentence.
    expect((await readBackup(file, fr)).error).toContain('profiles.json');
    expect((await readBackup(file, de)).error).toContain('profiles.json');
  });

  it('writes the archive notice in the requested language', async () => {
    const noticeOf = async (t: typeof fr) => {
      const entries = await (await import('../board/archive')).readArchive(
        await createBackup(toProfileState(DEFAULT_SETTINGS), [], [], null, t),
      );
      return new TextDecoder().decode(entries.find((e) => e.name === 'README.txt')?.data);
    };

    expect(await noticeOf(fr)).toContain('SAUVEGARDE TACHSYNC');
    expect(await noticeOf(de)).toContain('TACHSYNC-SICHERUNG');
  });

  it('reports a pack with no tile in the requested language', () => {
    const text = JSON.stringify({ name: 'vide' });

    expect(parseTilePack(text, 'v.json', fr).errors[0]).toBe(fr.errors.noTilesFound);
    expect(parseTilePack(text, 'v.json', de).errors[0]).toBe(de.errors.noTilesFound);
  });

  it('names an unlabelled background in the requested language', () => {
    const text = JSON.stringify({ backgrounds: [{ css: 'body { color: red }' }] });

    expect(parseTilePack(text, 'f.json', fr).backgrounds[0]?.label).toBe(`${fr.settings.background} 1`);
    expect(parseTilePack(text, 'f.json', de).backgrounds[0]?.label).toBe(`${de.settings.background} 1`);
  });

  it('refuses an avatar of unknown format in the requested language', () => {
    const file = new File(['x'], 'note.txt');

    expect(readAvatarFile(file, fr).error).toContain('txt');
    expect(readAvatarFile(file, de).error).toBe(de.errors.unknownAvatarFormat.replace('{ext}', 'txt'));
  });
});
