import { useRef, useState } from 'react';
import { format, useTranslation } from '../i18n';
import {
  buildTransferFile,
  readTransferFile,
  transferFileName,
  TRANSFER_EXTENSIONS,
} from '../profiles/transfer';
import type { ProfileKind } from '../profiles/actions';
import type { Appearance, Person, Vehicle } from '../profiles/types';
import { downloadBackup } from './backup';
import { Sentences } from './Sentences';
import { Tip, useTipMessage } from './Tip';
import type { VehiclePhoto } from '../profiles/photo';

export interface TransferPanelProps {
  readonly kind: ProfileKind;
  /** The entity on screen when the panel was opened. */
  readonly current: Person | Vehicle | Appearance;
  /**
   * Its name as the list shows it, fallback included.
   *
   * Entities start unnamed - the list writes "Person 1" for them - so reading `label` straight off
   * gave a button saying "Export " and a file with no stem.
   */
  readonly label: string;
  /** Adds an imported entity to the collection and selects it. */
  /** The photograph travels with a vehicle; the caller stores it against the id it assigns. */
  readonly onImport: (entity: Person | Vehicle | Appearance, photo: File | null) => void;
  /** The active car's photograph, put into the file it exports. `null` for the other kinds. */
  readonly photo: VehiclePhoto | null;
  /** The icon of the section this was opened from, so the panel says where it belongs. */
  readonly icon: React.ReactNode;
}

/**
 * Carrying one person, vehicle or look in or out.
 *
 * Laid out like the backup section it stands next to - what is to be read fills the space, what
 * acts sits at the foot - because it is the same errand at a smaller scale. What differs is the
 * target: a backup takes the whole installation, this takes the one entity you were looking at.
 *
 * The drop zone shows that section's own icon inside a dashed frame. Same shape as the button that
 * led here, which is what says the file belongs to THIS list and not to the two next to it - a
 * point worth making, since the three screens are otherwise identical.
 */
export function TransferPanel({
  kind,
  current,
  label,
  onImport,
  photo,
  icon,
}: TransferPanelProps): React.JSX.Element {
  const t = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const answer = useTipMessage();

  const noun = t.transfer.kinds[kind];

  async function accept(file: File | undefined): Promise<void> {
    if (file === undefined) return;

    const result = await readTransferFile(kind, file, t);
    if (result.entity === null) {
      answer.say(result.error);
      return;
    }

    onImport(result.entity, result.photo);
    answer.say(format(t.transfer.added, { name: result.entity.label }));
  }

  return (
    <div className="backup">
      {/*
        The answer floats clear of the panel rather than sitting in it: it replies to a gesture and
        has nothing to add once read, where the frame below is a standing instruction. A line
        appearing between the two pushed that instruction down the moment a file landed, moving the
        thing the eye was already on.
      */}
      {answer.text !== null && <Tip key={answer.id} main={answer.text} />}
      {/*
        The frame is the panel, and the panel is the control.

        A label wrapping a hidden input, so a tap anywhere inside opens the picker and a drop lands
        on the same target. Filling the space rather than sitting as a box in the middle: a target
        one aims at from a moving vehicle should be as large as the room allows.
      */}
      <label
        className={
          over ? 'backup__notice transfer__zone is-over' : 'backup__notice transfer__zone'
        }
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void accept(event.dataTransfer.files[0]);
        }}
      >
        <span className="transfer__icon">{icon}</span>
        <span className="backup__warning">{format(t.transfer.drop, { kind: noun })}</span>

        <input
          ref={input}
          type="file"
          accept={`.${TRANSFER_EXTENSIONS[kind]}`}
          className="visually-hidden"
          onChange={(event) => {
            void accept(event.target.files?.[0]);
            // Reset, so the same file can be dropped again after a correction.
            event.target.value = '';
          }}
        />
      </label>

      {/*
        Outside the frame, between it and the button. It qualifies the whole exchange rather than
        the target: inside the dashed edge it read as part of what one is asked to drop.
      */}
      <p className="transfer__hint">
        <Sentences text={format(t.transfer.scope, { kind: noun })} />
      </p>

      <div className="avatar-actions">
        <button
          type="button"
          className="chip"
          onClick={() =>
            void buildTransferFile(kind, current, photo).then((file) =>
              downloadBackup(file, transferFileName(kind, label)),
            )
          }
        >
          {format(t.transfer.export, { name: label })}
        </button>
      </div>
    </div>
  );
}
