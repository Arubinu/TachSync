import type { Appearance, Person, Vehicle } from './types';
import { normalizeLayouts } from '../board/layout';
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

export function buildTransferFile(kind: ProfileKind, entity: Person | Vehicle | Appearance): string {
  const payload: Envelope = {
    format: FORMAT,
    version: VERSION,
    kind,
    exportedAt: new Date().toISOString(),
    entity,
  };
  return JSON.stringify(payload, null, 2);
}

export interface TransferImport {
  /** The entity read, still carrying its original id - the caller assigns a fresh one. */
  readonly entity: Person | Vehicle | Appearance | null;
  readonly error: string | null;
}

/**
 * Reads one back.
 *
 * The kind is checked against the screen that asked for it. A vehicle file is a perfectly valid
 * file; it is only wrong HERE, and saying so beats a parse error about a missing field.
 */
export function readTransferFile(
  kind: ProfileKind,
  text: string,
  t: Translation,
): TransferImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { entity: null, error: t.errors.invalidJson };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { entity: null, error: t.errors.unexpectedObject };
  }

  const envelope = parsed as Partial<Envelope>;
  if (envelope.format !== FORMAT) {
    return { entity: null, error: t.errors.notAnEntity };
  }

  if (envelope.kind !== kind) {
    return {
      entity: null,
      error: format(t.errors.wrongEntityKind, { kind: t.transfer.kinds[kind] }),
    };
  }

  const entity = envelope.entity;
  if (typeof entity !== 'object' || entity === null) {
    return { entity: null, error: t.errors.unexpectedObject };
  }

  return { entity: repair(kind, entity as Record<string, unknown>), error: null };
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
      layouts: normalizeLayouts({ layouts: vehicle.layouts }),
      calibration: vehicle.calibration ?? null,
    };
  }

  return { ...(raw as unknown as Person | Appearance), label };
}
