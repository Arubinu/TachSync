import { useEffect, useState } from 'react';
import type { Orientation } from './layout';

/**
 * Current screen orientation.
 *
 * Derived from the width/height ratio rather than `screen.orientation`: in a resized desktop
 * window, or an embedded view that does not fill the screen, the orientation the system declares
 * does not describe the room actually available - and that is what drives the layout.
 *
 * A perfect square counts as landscape: a decision has to be made, and a landscape grid copes
 * better with a square screen than the reverse.
 */
export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(current);

  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)');
    const update = (): void => setOrientation(current());

    // `resize` on top of the media query: resizing a desktop window crosses the threshold without
    // the system orientation changing.
    query.addEventListener('change', update);
    window.addEventListener('resize', update);

    return () => {
      query.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return orientation;
}

function current(): Orientation {
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}
