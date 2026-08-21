/**
 * Drawn icons.
 *
 * Preferred to typographic characters: a font's `+` varies from device to device, is almost never
 * centred on its box, and its weight depends on the available face. A path gives an identical
 * symbol everywhere, exactly centred, with rounding tuned to the thousandth.
 *
 * The two bars overlap, so the eight outer corners are softened and the four inner ones stay sharp.
 */

const CORNER_RADIUS = 0.9;

export function PlusIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <rect x="10" y="3.5" width="4" height="17" rx={CORNER_RADIUS} />
      <rect x="3.5" y="10" width="17" height="4" rx={CORNER_RADIUS} />
    </svg>
  );
}

export function CloseIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <rect x="10" y="3.5" width="4" height="17" rx={CORNER_RADIUS} transform="rotate(45 12 12)" />
      <rect x="10" y="3.5" width="4" height="17" rx={CORNER_RADIUS} transform="rotate(-45 12 12)" />
    </svg>
  );
}

/**
 * The check mark, which says "done" where the cross said "closed".
 *
 * The difference is not decorative: a cross promises to cancel, and leaving edit mode cancels
 * nothing - every change is saved as it is made.
 *
 * Same weight and rounding as the plus and the cross, since the three sit side by side in the
 * toolbar.
 */
export function CheckIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      {/*
        A continuous path, where the plus and the cross are made of rectangles. Two rotated bars
        met badly at the angle: a check has a bend, not a crossing, and a rounded join is what
        renders it.
      */}
      <path
        d="M4.8 12.6 L9.9 17.8 L19.2 6.6"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Circular arrow: back to the original size. */
export function ResetIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <path
        d="M12 5a7 7 0 1 0 6.6 4.7"
        fill="none"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path d="M12 1.6 8.4 5l3.6 3.4Z" />
    </svg>
  );
}

/** Bin: lid, body, and two grooves. */
export function TrashIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <rect x="4" y="5" width="16" height="2.2" rx={CORNER_RADIUS} />
      <rect x="9.5" y="2.6" width="5" height="2.2" rx={CORNER_RADIUS} />
      <path
        d="M6.2 8.6h11.6l-1 11.2a1.6 1.6 0 0 1-1.6 1.4H8.8a1.6 1.6 0 0 1-1.6-1.4Z"
        fillRule="evenodd"
      />
      <rect x="10.2" y="11" width="1.5" height="7" rx="0.7" className="icon__cut" />
      <rect x="12.3" y="11" width="1.5" height="7" rx="0.7" className="icon__cut" />
    </svg>
  );
}

/**
 * Navigation chevron.
 *
 * A font's single guillemets sit on neither the baseline nor the cap height: they float around the
 * median axis, at a place that varies between faces. No centring rule catches them, since the
 * browser centres the line box rather than the drawing. A path is symmetrical about the centre of
 * its box by construction.
 */
/** Warning triangle. Each colour carries its own halo, or the exclamation mark loses its outline. */
export function WarningIcon(): React.JSX.Element {
  return (
    <svg className="warning" viewBox="0 0 48 44" aria-hidden focusable="false">
      <path
        className="warning__triangle"
        d="M21.4 3.5a3 3 0 0 1 5.2 0l19.1 33.2a3 3 0 0 1-2.6 4.5H4.9a3 3 0 0 1-2.6-4.5Z"
      />
      <path className="warning__mark" d="M24 15v11" />
      <circle className="warning__mark warning__dot" cx="24" cy="33.2" r="1.9" />
    </svg>
  );
}

export function ChevronIcon({
  direction,
}: {
  readonly direction: 'left' | 'right';
}): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <path
        d={direction === 'left' ? 'M15 6 L9 12 L15 18' : 'M9 6 L15 12 L9 18'}
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** U-turn arrow to the left: back to the previous menu. */
export function BackIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <path
        d="M5 9 H13.5 a5 5 0 0 1 0 10 H10"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 4.5 L5 9 L9.5 13.5"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Arrow descending into a tray: import a file.
 *
 * Pointing down rather than up, although it is an upload: from the viewer's point of view the file
 * enters the application. That is the convention used everywhere else for an import.
 */
export function ImportIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <path
        d="M12 3.5 V14"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M7.5 10 L12 14.5 L16.5 10"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 16.5 V19 a1.5 1.5 0 0 0 1.5 1.5 H18 a1.5 1.5 0 0 0 1.5 -1.5 V16.5"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Funnel: the metric filter. */
export function FilterIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <path
        d="M3.5 5 H20.5 L14 12.5 V19.5 L10 17.5 V12.5 Z"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A bust: who is driving.
 *
 * A head and shoulders, no face. An avatar would have designated the character shown on the board,
 * which is a different setting entirely; this bust designates the real person, and its lack of
 * features is what avoids the confusion.
 */
export function PersonIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <circle cx="12" cy="8" r="3.6" fill="none" strokeWidth="1.9" />
      <path
        d="M4.8 20.2 C4.8 16.1 8 14 12 14 C16 14 19.2 16.1 19.2 20.2"
        fill="none"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A dial being set: the arc of a gauge, and a needle placed on it.
 *
 * Drawn at the same weight as the others so the menu keeps one hand. The needle sits off centre on
 * purpose - a needle at rest would read as a gauge, where this is the act of setting one.
 */
export function CalibrateIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 48 44" className="calibrate" aria-hidden focusable="false">
      {/*
        Centre (24, 30), radius 16, swept 240 degrees from lower left to lower right through the
        top - the opening of a rev counter. The needle starts at that exact centre, so it turns
        about the middle of the dial instead of about a point that merely looked close.
      */}
      <path
        className="calibrate__arc"
        d="M10.14 38A16 16 0 1 1 37.86 38"
        fill="none"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {/*
        Stops short of the arc, and thinner than it. At full length and full weight the tip met the
        inner edge of the dial and the two strokes merged into one shape - measured, a reach of
        14.76 against an inner edge at 14.3.
      */}
      <path
        className="calibrate__needle"
        d="M24 30 30.6 22.2"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle className="calibrate__hub" cx="24" cy="30" r="2.2" />
    </svg>
  );
}

/** Three offset planes, for the layer switch. */
export function LayersIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <rect x="4" y="4" width="12" height="12" rx="2" fill="none" strokeWidth="1.8" />
      <rect x="8" y="8" width="12" height="12" rx="2" fill="none" strokeWidth="1.8" />
    </svg>
  );
}

/**
 * A car seen from the side, for the vehicle list.
 *
 * The silhouette carries the view: a bonnet rising to a cabin, a boot falling away, two wheels on
 * one line. The first attempt drew a symmetrical arch over two wheels, which reads as a car in the
 * abstract and from no angle in particular - a profile is asymmetric, and that is the whole cue.
 */
export function VehicleIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <path
        d="M2.4 15.2v-2.1c0-.6.42-1.12 1.01-1.24l2.55-.52 2.42-2.62a2 2 0 0 1 1.47-.64h4.3a2 2 0 0 1 1.5.67l2.16 2.42 2.24.55c.56.14.95.64.95 1.21v2.27"
        fill="none"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The road, broken where each wheel sits: the gaps are what read as arches. */}
      <path
        d="M2.4 15.2h2.1M9.6 15.2h4.8M19.5 15.2h2.1"
        fill="none"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="7" cy="15.2" r="2.4" fill="none" strokeWidth="1.7" />
      <circle cx="17" cy="15.2" r="2.4" fill="none" strokeWidth="1.7" />
    </svg>
  );
}

/**
 * Three swatches, for the appearance list.
 *
 * An appearance is a set of choices - theme, background, avatar, type size - and no single object
 * stands for it. Overlapping swatches say "a combination" without naming any one of its parts.
 */
export function LookIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <circle cx="9" cy="9" r="5" fill="none" strokeWidth="1.8" />
      <circle cx="15" cy="9" r="5" fill="none" strokeWidth="1.8" opacity="0.7" />
      <circle cx="12" cy="15" r="5" fill="none" strokeWidth="1.8" opacity="0.45" />
    </svg>
  );
}

/** Two arrows passing, for moving something in or out. */
/** An open eye: what was taken out of the drawing comes back. */
export function EyeIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <path
        d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        fill="none"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.8" fill="none" strokeWidth="1.7" />
    </svg>
  );
}

/**
 * Eyedropper, drawn as photo editors draw it: a sharp point at the lower left, a thin shaft, the
 * ferrule where the bulb is fitted, and the bulb closed by a half-round cap.
 *
 * One closed outline rather than assembled pieces. Built from a single diagonal axis, each vertex
 * being a half-width offset perpendicular to it, which is what keeps the two sides parallel - an
 * earlier attempt drew them freehand and came out reading as a pair of tweezers.
 *
 * Stroked rather than solid, unlike the toolbar icon it borrows from: in the header it sits between
 * the back chevron and the close cross, and a filled silhouette there would read as heavier than
 * its neighbours. `fill="none"` is the only thing separating the two.
 */
export function DropperIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <path
        d="M3 21 4.09 19.27 9.97 12.41 9.08 10.82 10.14 9.76 10.49 9.83 14.95 5.37
           A2.6 2.6 0 1 1 18.63 9.05
           L14.17 13.51 14.24 13.86 13.18 14.92 11.59 14.03 4.73 19.91Z"
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SwapIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <path
        d="M4 8.5h13m-3.5-3.5 3.5 3.5-3.5 3.5"
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 15.5H7m3.5-3.5L7 15.5l3.5 3.5"
        fill="none"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Flipping across a vertical axis.
 *
 * The axis is dashed and the two shapes are the same shape faced the other way: that IS the
 * operation, drawn. `SwapIcon` next door is two arrows trading places, which says exchange rather
 * than reflect - close enough to reach for by mistake, far enough to mislead.
 */
export function MirrorIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <path
        d="M12 3 V21"
        fill="none"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeDasharray="2.4 2.6"
      />
      <path
        d="M9.3 6.6 L3.6 12 L9.3 17.4 Z"
        fill="none"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M14.7 6.6 L20.4 12 L14.7 17.4 Z"
        fill="none"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Text alignment, as every editor draws it: bars of unequal length, ranged the way the text is.
 *
 * `null` is the theme's own, and gets full-width bars - the one variant that ranges nothing, which
 * is what "not chosen" looks like. Drawing it as left would have claimed a choice nobody made.
 */
export function AlignIcon({ align }: { readonly align: string | null }): React.JSX.Element {
  // Each row is a bar: [start, end] across the 24 box. Short bars alternate with long ones so the
  // ranging is legible at a glance rather than by comparing two similar shapes.
  const rows =
    align === 'left'
      ? [
          [4, 20],
          [4, 14],
          [4, 20],
          [4, 12],
        ]
      : align === 'center'
        ? [
            [4, 20],
            [7, 17],
            [4, 20],
            [8, 16],
          ]
        : align === 'right'
          ? [
              [4, 20],
              [10, 20],
              [4, 20],
              [12, 20],
            ]
          : /*
             * The theme's own: bars that range no particular way.
             *
             * Four full-width ones - the classic "justify" glyph - read as a hamburger menu in a
             * header full of icons. Alternating short ends says "not set" without borrowing a
             * shape that already means something else here.
             */
            [
              [4, 20],
              [4, 13],
              [11, 20],
              [4, 20],
            ];

  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      {rows.map(([from, to], index) => (
        <path
          key={index}
          d={`M${from} ${6.5 + index * 3.7} H${to}`}
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/**
 * A pencil, for entering edit mode.
 *
 * Paired with `CheckIcon` on the way out - the same pair the edit bar already uses, so the gesture
 * reads the same wherever it is offered.
 */
export function EditIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden focusable="false">
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
        fill="none"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14.5 6.5 17.5 9.5" fill="none" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
