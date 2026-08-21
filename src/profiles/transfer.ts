import type { Appearance, Person, Vehicle } from './types';
import { ArchiveError, createArchive, readArchive, type ArchiveEntry } from '../board/archive';
import { isImage } from '../storage/image';
import type { VehiclePhoto } from './photo';
import { normalizeVehicleLayouts } from './layouts';
import { DEFAULT_RANGES } from './types';
import type { ProfileKind } from './actions';
import { format, type Translation } from '../i18n';

/**
 * Carrying one person, one vehicle or one appearance between installations.
 *
 * The full backup was never able to do this. It exports the FLAT settings - the active appearance
 * and the active vehicle's layouts, already resolved - so every other person, vehicle and
 * appearance is dropped on the way out. Restoring one rebuilds a single set from what survived.
 *
 * These files carry an entity whole and add it to whatever is already there, which is what lets a
 * layout composed on one phone be handed to another without taking the rest of the installation
 * with it.
 *
 * A distinct extension per kind, so a picker offers only what fits: dropping a vehicle onto the
 * appearance screen is a mistake worth catching before it is read, not after.
 *
 * An archive under that extension rather than bare JSON, exactly like the backup: a vehicle can
 * carry its photograph, which no amount of JSON was going to hold. The description inside stays
 * indented JSON, readable by eye once the file is renamed to `.zip`.
 *
 * Files written before this were bare JSON, and still read: renaming the format would have turned
 * every file already exported into an unreadable one, for no gain anybody can see.
 */

export const TRANSFER_EXTENSIONS = {
  people: 'tachperson',
  vehicles: 'tachvehicle',
  appearances: 'tachlook',
} as const satisfies Record<ProfileKind, string>;

const FORMAT = 'tachsync.entity';
const VERSION = 1;

interface Envelope {
  readonly format: string;
  readonly version: number;
  readonly kind: ProfileKind;
  readonly exportedAt: string;
  readonly entity: unknown;
}

/** File name offered for a given entity: its own name, so a folder of them stays readable. */
export function transferFileName(kind: ProfileKind, label: string): string {
  const stem = label.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'export';
  return `${stem.toLowerCase()}.${TRANSFER_EXTENSIONS[kind]}`;
}

const ENTITY_ENTRY = 'entity.json';
const PHOTO_FOLDER = 'photo/';

/**
 * @param photo The car's photograph, when there is one and the exporter kept it. Deleting it on
 * the screen that shows it is what leaves it out of the file.
 */
export async function buildTransferFile(
  kind: ProfileKind,
  entity: Person | Vehicle | Appearance,
  photo: VehiclePhoto | null = null,
): Promise<Blob> {
  const payload: Envelope = {
    format: FORMAT,
    version: VERSION,
    kind,
    exportedAt: new Date().toISOString(),
    entity,
  };

  const entries: ArchiveEntry[] = [
    { name: ENTITY_ENTRY, data: new TextEncoder().encode(JSON.stringify(payload, null, 2)) },
  ];

  if (photo !== null) {
    entries.push({
      name: `${PHOTO_FOLDER}${photo.fileName}`,
      data: new Uint8Array(await photo.data.arrayBuffer()),
    });
  }

  return createArchive(entries);
}

export interface TransferImport {
  /** The entity read, still carrying its original id - the caller assigns a fresh one. */
  readonly entity: Person | Vehicle | Appearance | null;
  /** The photograph the file carried, if any. Saved against the id the caller assigns. */
  readonly photo: File | null;
  readonly error: string | null;
}

/**
 * Reads one back.
 *
 * The kind is checked against the screen that asked for it. A vehicle file is a perfectly valid
 * file; it is only wrong HERE, and saying so beats a parse error about a missing field.
 */
export async function readTransferFile(
  kind: ProfileKind,
  file: Blob,
  t: Translation,
): Promise<TransferImport> {
  let text: string;
  let photo: File | null = null;

  try {
    const entries = await readArchive(file);
    const described = entries.find((entry) => entry.name === ENTITY_ENTRY);
    if (described === undefined) {
      return { entity: null, photo: null, error: t.errors.notAnEntity };
    }
    text = new TextDecoder().decode(described.data);

    // Only the first picture counts: a car has one photograph, so a hand-edited archive offering
    // several has to resolve to one rather than to whichever was written last.
    photo =
      entries
        .filter((entry) => entry.name.startsWith(PHOTO_FOLDER) && entry.data.length > 0)
        .map((entry) => new File([entry.data as BlobPart], entry.name.slice(PHOTO_FOLDER.length)))
        .find((candidate) => isImage(candidate)) ?? null;
  } catch (cause: unknown) {
    // Not an archive: a file written before these carried one. Read it as the JSON it is.
    if (!(cause instanceof ArchiveError) || cause.code !== 'notAnArchive') {
      return { entity: null, photo: null, error: t.errors.unreadableArchive };
    }
    text = await file.text();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { entity: null, photo: null, error: t.errors.invalidJson };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { entity: null, photo: null, error: t.errors.unexpectedObject };
  }

  const envelope = parsed as Partial<Envelope>;
  if (envelope.format !== FORMAT) {
    return { entity: null, photo: null, error: t.errors.notAnEntity };
  }

  if (envelope.kind !== kind) {
    return {
      entity: null,
      photo: null,
      error: format(t.errors.wrongEntityKind, { kind: t.transfer.kinds[kind] }),
    };
  }

  const entity = envelope.entity;
  if (typeof entity !== 'object' || entity === null) {
    return { entity: null, photo: null, error: t.errors.unexpectedObject };
  }

  return { entity: repair(kind, entity as Record<string, unknown>), photo, error: null };
}

/**
 * Fills in what a file may be missing.
 *
 * The same guards the stored state goes through: a file written by an older version, or edited by
 * hand, must not reach the collection half-formed.
 */
function repair(kind: ProfileKind, raw: Record<string, unknown>): Person | Vehicle | Appearance {
  const label = typeof raw['label'] === 'string' && raw['label'].trim() !== '' ? raw['label'] : '';

  if (kind === 'vehicles') {
    const vehicle = raw as unknown as Vehicle;
    return {
      ...vehicle,
      label,
      // An adapter belongs to the machine it was paired on, never to the file.
      adapterId: null,
      ranges: { ...DEFAULT_RANGES, ...vehicle.ranges },
      // A file may carry any age of vehicle, and its grids belong to people this machine has
      // never heard of: the names are dropped and the grid is offered to whoever imports it.
      layouts: normalizeVehicleLayouts(vehicle.layouts, '').map((layout) => ({
        ...layout,
        people: [],
      })),
      calibration: vehicle.calibration ?? null,
    };
  }

  if (kind === 'appearances') {
    const appearance = raw as unknown as Appearance;
    return {
      ...appearance,
      label,
      // A file written before objects could be hidden carries none, and so does one written by
      // hand. Absent, it would be indexed by avatar id on the first render of the panel.
      hiddenAvatarParts: appearance.hiddenAvatarParts ?? {},
    };
  }

  return { ...(raw as unknown as Person), label };
}
