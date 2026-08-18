import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '../i18n';
import { BackIcon, CloseIcon, TrashIcon } from './icons';

export interface ModalProps {
  readonly title: string;
  readonly onClose: () => void;
  /**
   * Absent when the window carries no deletable object - the settings, for instance. The space is
   * then held empty rather than reclaimed, or the title would stop being centred.
   */
  readonly onDelete?: () => void;
  /**
   * Back to the previous level, in the header's left corner.
   *
   * The same place as the bin, and for the same reason: it is the corner opposite the close button,
   * so it is not hit by mistake while aiming at the cross. The two never coexist - a two-level
   * window navigates, it does not delete.
   */
  readonly onBack?: () => void;
  /**
   * Window-specific controls, in the header's left corner. Ignored while a back action is offered:
   * one level down, going back takes precedence, and two roles in one slot would make the corner
   * unpredictable.
   */
  readonly leading?: ReactNode;
  /**
   * Extra controls, immediately after back.
   *
   * A ghost of the same width is added opposite each one, so the title keeps the middle: a header
   * that re-centres itself whenever a screen offers an extra action reads as unstable.
   */
  readonly actions?: readonly ReactNode[];
  /**
   * Controls at the other end, just before the close cross.
   *
   * Separate from `actions` because the side carries meaning: what sits by the cross acts on the
   * window one is leaving, what sits by back belongs to the level one is in.
   *
   * No ghost opposite, unlike `actions`: this control is already on the right, where it counts
   * against the left. Balancing it too pushed the title 24 px off centre - measured.
   */
  readonly trailing?: readonly ReactNode[];
  readonly children: ReactNode;
}

/**
 * Open windows, in the order they stacked.
 *
 * Escape must act only on the topmost. Each window listens on the browser window for want of an
 * element guaranteed to hold focus; without this stack, two stacked windows would both answer the
 * same key and one would close unseen.
 */
const opened: symbol[] = [];

/** Whether a window currently owns Escape. */
export function hasOpenModal(): boolean {
  return opened.length > 0;
}

/**
 * A centred window, for adjusting one object.
 *
 * Distinct from full-screen panels: it adjusts a precise object, not a whole category. Keeping the
 * board visible around it helps locate the tile being changed.
 *
 * The destructive and the neutral action sit at opposite ends of the header deliberately: the bin
 * must never fall under a thumb aiming at the close button.
 */
export function Modal({
  title,
  onClose,
  onDelete,
  onBack,
  leading,
  actions,
  trailing,
  children,
}: ModalProps): React.JSX.Element {
  const t = useTranslation();
  const [closing, setClosing] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  /**
   * Focus steps into the window, and goes back where it came from.
   *
   * Opened from a keyboard, the window used to appear with focus still on whatever button summoned
   * it: Tab then walked the board behind before ever reaching the menu.
   *
   * The body rather than the header, because the header holds the ways out - handing focus to a
   * close button offers leaving before arriving. The frame itself is the fallback, so a window with
   * nothing to focus still takes the keyboard rather than leaving it behind.
   */
  useEffect(() => {
    const opener = document.activeElement;
    const region = frame.current;
    if (region === null) return;

    const body = region.querySelector<HTMLElement>('.modal__body');
    const first = body === null ? undefined : focusablesIn(body)[0];
    (first ?? region).focus();

    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  /**
   * Arrows walk the window, where Tab already did.
   *
   * A menu answers to arrows - that is what a list of choices is - and Tab keeps working for anyone
   * who expects it.
   *
   * Anything that reads arrows itself keeps them: a text field, and the footprint picker, whose
   * cells call `preventDefault` before this handler sees the event. Checking that rather than
   * naming the exceptions means a control added later is right without touching this.
   */
  function handleArrows(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.defaultPrevented || consumesArrows(event.target as Element)) return;

    const step =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? -1
          : 0;
    if (step === 0 || frame.current === null) return;

    const items = focusablesIn(frame.current);
    if (items.length === 0) return;

    event.preventDefault();
    const here = items.indexOf(document.activeElement as HTMLElement);
    // Wrapping, and starting from the top when focus sits on the frame itself.
    const next = here === -1 ? 0 : (here + step + items.length) % items.length;
    items[next]?.focus();
  }
  const requestClose = useCallback(() => setClosing(true), []);

  // Re-read on each keystroke rather than added as a dependency: `onBack` is a function created on
  // every render, and subscribing to it would churn the stack several times a second for nothing.
  const latest = useRef({ onBack, requestClose });
  latest.current = { onBack, requestClose };

  /**
   * Escape goes up one level, and closes when there is no level left. The same gesture as the
   * header arrow, except that it falls under the finger without aiming.
   */
  useEffect(() => {
    const token = Symbol('modal');
    opened.push(token);

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || opened.at(-1) !== token) return;
      // Only a real keystroke counts.
      //
      // The board fabricates an Escape on the document every time a panel opens: it is the only way
      // to make dnd-kit let go, which exposes no imperative abort. That event bubbled up here and
      // closed the window in the instant after it opened - measured at nineteen milliseconds.
      // `isTrusted` separates the keystroke from the feint.
      if (!event.isTrusted) return;
      event.preventDefault();

      const { onBack: back, requestClose: close } = latest.current;
      if (back === undefined) close();
      else back();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      opened.splice(opened.indexOf(token), 1);
    };
  }, []);

  return (
    <div
      className={closing ? 'modal-backdrop is-closing' : 'modal-backdrop'}
      onPointerDown={requestClose}
      onAnimationEnd={(event) => {
        if (closing && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={frame}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // The frame takes focus only when nothing inside can; it is not a tab stop of its own.
        tabIndex={-1}
        onKeyDown={handleArrows}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          {onBack !== undefined ? (
            <button
              type="button"
              className="modal__action"
              onClick={onBack}
              aria-label={t.editBar.back}
            >
              <BackIcon />
            </button>
          ) : leading !== undefined ? (
            <span className="modal__leading">{leading}</span>
          ) : onDelete === undefined ? (
            <span className="modal__action modal__action--ghost" aria-hidden />
          ) : (
            <button
              type="button"
              className="modal__action modal__action--danger"
              onClick={onDelete}
              aria-label={t.editor.delete}
            >
              <TrashIcon />
            </button>
          )}

          {/* Both buttons having the same width, the title centres itself. */}
          {actions?.map((control, index) => (
            <Fragment key={index}>{control}</Fragment>
          ))}

          <h2 className="modal__title">{title}</h2>

          {/* One ghost per action, so the title keeps the middle whatever a screen offers. */}
          {actions?.map((_unused, index) => (
            <span key={index} className="modal__action modal__action--ghost" aria-hidden />
          ))}

          {trailing?.map((control, index) => (
            <Fragment key={index}>{control}</Fragment>
          ))}

          <button
            type="button"
            className="modal__action"
            onClick={requestClose}
            aria-label={t.editor.close}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

/**
 * What a keyboard can land on inside a window, in the order it would reach them.
 *
 * Hidden branches are dropped through `offsetParent`, not through measured size. Size was the first
 * attempt and it misfired: on the frame a window opens, the footprint picker has not been measured
 * yet - its grid is sized from a `ResizeObserver` - so its cells were zero by zero and the focus
 * skipped past them to a stepper further down. `offsetParent` answers "is this rendered at all",
 * which is the actual question and does not depend on when it is asked.
 */
function focusablesIn(root: HTMLElement): HTMLElement[] {
  const selector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]),' +
    ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return [...root.querySelectorAll<HTMLElement>(selector)].filter(
    (element) => element.offsetParent !== null && element.tabIndex >= 0,
  );
}

/** Whether the element reads arrow keys itself, and should keep them. */
function consumesArrows(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  const tag = element.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return element.isContentEditable;
}
