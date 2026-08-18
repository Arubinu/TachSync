import { useEffect } from 'react';
import { hasOpenModal } from '../board/Modal';

/**
 * Escape gives focus back, when it has nothing else to do.
 *
 * A focus ring that stays lit after the thing it marked has been used reads as stuck - the skip
 * button in the corner of the board is the clearest case, since it only exists while focused and
 * would otherwise sit there until the next Tab.
 *
 * Windows come first: while one is open, Escape belongs to it - going up a level, then closing.
 * Blurring underneath would fight that, and worse, would clear the focus of a field being typed in.
 *
 * Only what the keyboard focused is dropped. A pointer never leaves a visible ring, so blurring
 * after a tap would take away something nobody could see anyway - and would break the one case
 * where a click legitimately keeps focus, a text field being edited.
 */
export function useEscapeBlur(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !event.isTrusted) return;
      if (hasOpenModal()) return;

      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || active === document.body) return;
      if (!active.matches(':focus-visible')) return;

      active.blur();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
