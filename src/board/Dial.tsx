import type { RefObject } from 'react';
import { ARC_LENGTH, arcPath, CENTER, RADIUS, tick, ticks } from './dialGeometry';

/** Major graduations, numbered on a real dial. Eleven strokes, ten intervals. */
const MAJOR = 10;

/** Minor graduations: five per major interval. */
const MINOR = 50;

/** Start and tip of the needle, in units of the hundred-square. */
const NEEDLE_FROM = 18;
const NEEDLE_TO = RADIUS - 5;

export interface DialProps {
  /** The needle, rotated each frame by the store subscription. */
  readonly needleRef: RefObject<SVGGElement | null>;
  /** The fill arc, of which only the travelled part is shown. */
  readonly progressRef: RefObject<SVGPathElement | null>;
  /**
   * Start of the red zone, as a fraction of the range. Absent means none.
   *
   * Supplied by the metric shown, since only it knows whether it has a limit: engine speed has a
   * redline, boost pressure does not.
   */
  readonly redlineFrom?: number;
}

/**
 * Graduated dial with a centre needle.
 *
 * Everything static is drawn once: the track, the graduations, the red zone. Only the needle and
 * the fill arc are touched while driving, through the same subscription as the rest of the tiles -
 * two attributes per frame, without going through React.
 *
 * The travelled arc is produced with a dash pattern rather than by redrawing the path: changing a
 * `stroke-dashoffset` only asks the browser to repaint, where recomputing a `d` redoes the path
 * geometry every frame.
 */
export function Dial({ needleRef, progressRef, redlineFrom }: DialProps): React.JSX.Element {
  return (
    <svg className="tile__dial" viewBox="0 0 100 100" aria-hidden focusable="false">
      <path className="tile__dial-track" d={arcPath(0, 1)} />

      {/*
        The red zone sits under the graduations: they must stay readable over it, otherwise the top
        of the range becomes a flat block.
      */}
      {redlineFrom !== undefined && (
        <path className="tile__dial-redline" d={arcPath(redlineFrom, 1)} />
      )}

      {ticks(MINOR).map((ratio) => (
        <line key={`m${ratio}`} className="tile__dial-tick" {...tick(ratio, 4)} />
      ))}

      {ticks(MAJOR).map((ratio) => (
        <line key={`M${ratio}`} className="tile__dial-tick tile__dial-tick--major" {...tick(ratio, 8)} />
      ))}

      <path
        ref={progressRef}
        className="tile__dial-progress"
        d={arcPath(0, 1)}
        strokeDasharray={ARC_LENGTH}
        // Fully hidden at first: the first frame will reveal it.
        strokeDashoffset={ARC_LENGTH}
      />

      {/*
        A crown needle that does not reach the centre.

        A full needle crossed the figure written in the middle: the two fought over the same
        pixels. Reduced to the spindle running along the graduations it points just as well without
        covering anything, and the centre goes back to the value. It points right at rest, at zero
        degrees, so the dial angle applies as-is.
      */}
      <g ref={needleRef} className="tile__dial-needle">
        <polygon
          points={`${CENTER.x + NEEDLE_FROM} ${CENTER.y - 1.9} ${CENTER.x + NEEDLE_TO} ${CENTER.y - 0.5} ${CENTER.x + NEEDLE_TO} ${CENTER.y + 0.5} ${CENTER.x + NEEDLE_FROM} ${CENTER.y + 1.9}`}
        />
      </g>

    </svg>
  );
}
