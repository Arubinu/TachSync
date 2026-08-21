import { useMemo, useState } from 'react';
import { useTranslation } from '../i18n';
import { tripDuration } from '../trips/format';
import type { TraceChannel, TripTrace } from '../trips/trace';

/**
 * What a trip looked like, one panel per measure.
 *
 * Small multiples rather than curves stacked on one pair of axes. Speed, engine speed, throttle and
 * boost share nothing but their clock: drawn together they would need a second y-scale, and two
 * scales on one frame let anyone read a crossing that is an artefact of where the scales were put.
 * Four panels answer the same question and cannot lie about it.
 *
 * No library. A polyline is a string, and shipping a charting dependency into a car dashboard would
 * cost more than every gauge on the board put together.
 */

/** Drawing box of one panel, in user units. The panel is stretched to the pane's width. */
const W = 1000;
const H = 110;

/** Room under the curve for the baseline, so a value of zero does not sit on the frame. */
const PAD = 6;

interface Panel {
  readonly channel: TraceChannel;
  readonly label: string;
  readonly unit: string;
}

interface Drawn extends Panel {
  readonly path: string;
  readonly low: number;
  readonly high: number;
  readonly values: Float32Array;
}

/**
 * Turns readings into a path, cutting it wherever they stop.
 *
 * A gap is a channel the car does not publish, or a reply that did not come. Joining across it
 * would invent a straight line between two readings that never followed one another - the one thing
 * a curve must never do.
 */
export function plot(values: Float32Array, at: Float32Array, low: number, high: number): string {
  const span = high - low || 1;
  const last = at[at.length - 1] ?? 1;
  let path = '';
  let pen = false;

  for (let i = 0; i < values.length; i += 1) {
    const value = values[i] as number;
    if (!Number.isFinite(value)) {
      pen = false;
      continue;
    }
    const x = ((at[i] as number) / (last || 1)) * W;
    const y = H - PAD - ((value - low) / span) * (H - PAD * 2);
    path += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    pen = true;
  }
  return path;
}

export function TripChart({ trace }: { readonly trace: TripTrace }): React.JSX.Element | null {
  const t = useTranslation();
  // Where the crosshair sits, as an index into the readings. `null` while nothing is pointed at.
  const [at, setAt] = useState<number | null>(null);

  const panels = useMemo<Drawn[]>(() => {
    const wanted: Panel[] = [
      { channel: 'speed', label: t.metrics.speed, unit: 'km/h' },
      { channel: 'rpm', label: t.metrics.rpm, unit: 'rpm' },
      { channel: 'throttle', label: t.metrics.throttle, unit: '%' },
      { channel: 'boost', label: t.metrics.boost, unit: 'kPa' },
    ];

    return wanted.flatMap((panel) => {
      const values = trace[panel.channel];
      const readings = [...values].filter((value) => Number.isFinite(value));
      // A channel the car never answered on gets no panel at all: an empty frame with a title
      // states an absence the driver can do nothing about.
      if (readings.length === 0) return [];

      // From zero, so the height of the curve means something on its own. Boost is the exception:
      // it goes below atmospheric, and clipping the vacuum would hide half of what it does.
      const high = Math.max(...readings);
      const low = Math.min(0, ...readings);

      return [{ ...panel, values, low, high, path: plot(values, trace.at, low, high) }];
    });
  }, [trace, t]);

  if (panels.length === 0) return null;

  const duration = trace.at[trace.at.length - 1] ?? 0;

  /** Nearest reading to where the finger is, along the shared clock. */
  function point(event: React.PointerEvent<HTMLDivElement>): void {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    setAt(Math.round(ratio * (trace.at.length - 1)));
  }

  return (
    <div className="chart" onPointerMove={point} onPointerLeave={() => setAt(null)}>
      {panels.map((panel) => {
        const reading = at === null ? Number.NaN : (panel.values[at] as number);
        const shown = Number.isFinite(reading) ? reading : panel.high;

        return (
          <figure className="chart__panel" key={panel.channel}>
            <figcaption className="chart__head">
              <span className="chart__label">{panel.label}</span>
              {/*
                One number, and it is the one being pointed at - or the peak while nothing is. A
                value on every reading would be a wall of digits over the shape they describe.
              */}
              {/*
                The same slot says two things, so it says which: the peak while nothing is
                pointed at, the reading under the finger once something is. Unmarked, a figure
                that changed meaning on hover would be read as the peak and quietly not be.
              */}
              <span className="chart__value">
                {at === null && <span className="chart__tag">{t.metrics.peak} </span>}
                {Math.round(shown)}
                <span className="chart__unit"> {panel.unit}</span>
              </span>
            </figcaption>

            <svg
              className="chart__plot"
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={panel.label}
            >
              {/* Zero, drawn only where it falls inside the panel - which is only boost's case. */}
              {panel.low < 0 && (
                <line
                  className="chart__zero"
                  x1="0"
                  x2={W}
                  y1={H - PAD - ((0 - panel.low) / (panel.high - panel.low || 1)) * (H - PAD * 2)}
                  y2={H - PAD - ((0 - panel.low) / (panel.high - panel.low || 1)) * (H - PAD * 2)}
                />
              )}

              <path className="chart__line" d={panel.path} />

              {at !== null && (
                <line
                  className="chart__cursor"
                  x1={((trace.at[at] as number) / (duration || 1)) * W}
                  x2={((trace.at[at] as number) / (duration || 1)) * W}
                  y1="0"
                  y2={H}
                />
              )}
            </svg>
          </figure>
        );
      })}

      {/*
        The ends of the clock, and between them where the finger is - nothing while it is nowhere.
        Repeating the total in the middle made the axis read "0, 10 min, 10 min".
      */}
      <p className="chart__axis">
        <span>0</span>
        <span>{at === null ? '' : tripDuration(trace.at[at] as number)}</span>
        <span>{tripDuration(duration)}</span>
      </p>
    </div>
  );
}
