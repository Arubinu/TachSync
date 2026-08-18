import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '../i18n';

export interface LayoutPickerProps {
  readonly columns: number;
  readonly rows: number;
  /**
   * The tile's corner on the board.
   *
   * The footprint used to be drawn at the grid's top-left corner whatever the real position: a tile
   * placed bottom-right showed top-left, flush against two edges it did not touch and detached from
   * the two it did. Flush contact was therefore shown backwards, even though the preview carried
   * the right markers.
   */
  readonly colStart: number;
  readonly rowStart: number;
  readonly colSpan: number;
  readonly rowSpan: number;
  readonly onChange: (colSpan: number, rowSpan: number) => void;
  /** Control heading, rendered with the numeric footprint on the same line. */
  readonly label: string;
  /**
   * What is shown inside the chosen footprint.
   *
   * Optional, deliberately: without it the picker shows a flat area, which answers "how many
   * cells". With it, it answers "what will it look like", which is a different question. The
   * content is supplied from outside so the picker needs to know nothing about tiles, themes or
   * telemetry.
   */
  readonly preview?: ReactNode;
}

/**
 * Footprint picker.
 *
 * The grid is the control, not a display of the result. It used to be flanked by two sliders and
 * merely showed what they decided, occupying the largest area of the block to do nothing. The
 * destination cell is now designated and the footprint extends to it, like selecting a range in a
 * spreadsheet: one gesture instead of two settings, and all the room returned to the cells.
 *
 * The keyboard is not sacrificed: arrows grow and shrink the footprint, and only one cell is
 * tabbable at a time - the chosen corner. A twelve-cell grid therefore adds one tab stop, not
 * twelve.
 */
export function LayoutPicker({
  columns,
  rows,
  colStart,
  rowStart,
  colSpan,
  rowSpan,
  onChange,
  label,
  preview,
}: LayoutPickerProps): React.JSX.Element {
  const t = useTranslation();
  const gridRef = useRef<HTMLDivElement>(null);

  /**
   * The board in numbers, and the reduction ratio that goes with it.
   *
   * The grid is a scale model: it takes the board's shape, and the tile is drawn at real size
   * before being reduced. Two measurements cover everything: the screen dimensions, whose surface
   * the board occupies exactly, and the grid's rendered width.
   *
   * Measured rather than derived in CSS, for want of a way: `aspect-ratio` wants two numbers and
   * refuses two lengths, and no unit can divide one length by another to obtain the reduction
   * ratio.
   *
   * A `ResizeObserver` rather than a single measurement: the window sometimes opens before its
   * fonts land, and devices rotate.
   */
  const [board, setBoard] = useState({ width: 0, height: 0, scale: 0 });

  useEffect(() => {
    const grid = gridRef.current;
    if (grid === null) return;

    const measure = (gridWidth: number): void => {
      const { innerWidth: width, innerHeight: height } = window;
      setBoard({ width, height, scale: width === 0 ? 0 : gridWidth / width });
    };

    const observer = new ResizeObserver(([entry]) => measure(entry?.contentRect.width ?? 0));
    observer.observe(grid);

    // Rotation changes the height without touching the grid: the observer would say nothing, and
    // the model would keep the previous orientation's shape.
    const onResize = (): void => measure(grid.getBoundingClientRect().width);
    window.addEventListener('resize', onResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  /**
   * The cell under the pointer, computed rather than hit-tested.
   *
   * A containment test would fail as soon as the finger left the grid mid-gesture, which is exactly
   * when tracking must continue - so the value is clamped and the footprint stops at the last row.
   */
  function cellAt(clientX: number, clientY: number): { col: number; row: number } | null {
    const grid = gridRef.current;
    if (grid === null) return null;

    const box = grid.getBoundingClientRect();
    // Clamped to the tile's corner: aiming before it would reduce the footprint to zero, and the
    // preceding cells do not belong to it anyway.
    return {
      col: clamp(Math.ceil(((clientX - box.left) / box.width) * columns), colStart, columns),
      row: clamp(Math.ceil(((clientY - box.top) / box.height) * rows), rowStart, rows),
    };
  }

  /** Maximum footprint from the tile's corner, in cells. */
  const maxColSpan = columns - colStart + 1;
  const maxRowSpan = rows - rowStart + 1;

  function extendTo(clientX: number, clientY: number): void {
    const cell = cellAt(clientX, clientY);
    if (cell === null) return;

    const wantedCols = cell.col - colStart + 1;
    const wantedRows = cell.row - rowStart + 1;
    if (wantedCols !== colSpan || wantedRows !== rowSpan) onChange(wantedCols, wantedRows);
  }

  return (
    <div
      className="layout-picker"
      style={
        {
          '--cols': columns,
          '--rows': rows,
          '--board-w': board.width,
          '--board-h': board.height,
          '--miniature': board.scale,
        } as React.CSSProperties
      }
    >
      {/*
        Heading and footprint at either end of one line: the first says what this is, the second
        what was chosen. Grouped above the drawing, they frame it instead of preceding then
        following it.
      */}
      <div className="layout-picker__head">
        <h3>{label}</h3>
        <span className="layout-picker__readout" aria-hidden>
          {colSpan} × {rowSpan}
        </span>
      </div>

      <div
        className="layout-picker__grid"
        ref={gridRef}
        onPointerDown={(event) => {
          // Capture keeps the gesture on the grid when the finger leaves it, which happens
          // constantly when aiming at the last column.
          event.currentTarget.setPointerCapture(event.pointerId);
          extendTo(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.buttons === 0) return;
          extendTo(event.clientX, event.clientY);
        }}
        onKeyDown={(event) => {
          const step = KEYS[event.key];
          if (step === undefined) return;
          event.preventDefault();
          onChange(
            clamp(colSpan + step.col, 1, maxColSpan),
            clamp(rowSpan + step.row, 1, maxRowSpan),
          );
        }}
      >
        {Array.from({ length: columns * rows }, (_, index) => {
          const col = (index % columns) + 1;
          const row = Math.floor(index / columns) + 1;
          const corner = col === colStart + colSpan - 1 && row === rowStart + rowSpan - 1;

          return (
            <button
              key={index}
              type="button"
              className="layout-picker__cell"
              // Placed explicitly, and it is essential.
              //
              // The footprint is a grid item like any other: it occupies its cells, and
              // auto-placement pushed the buttons along, which then created extra rows.
              // Zero-height, they stacked their dotted strokes under the last row. Measured: three
              // rows declared, six computed in 4 x 3.
              style={{ gridColumn: col, gridRow: row }}
              // One cell on the keyboard path: the chosen corner, from which the arrows take over.
              tabIndex={corner ? 0 : -1}
              aria-label={`${col} × ${row}`}
              aria-pressed={corner}
              // The pointer is already handled by the whole grid, which follows the finger outside
              // the cells; letting it act here too would double the gesture.
              onPointerDown={(event) => event.preventDefault()}
            />
          );
        })}

        <div
          className="layout-picker__area"
          style={
            {
              gridColumn: `${colStart} / span ${colSpan}`,
              gridRow: `${rowStart} / span ${rowSpan}`,
              // The footprint carries the span: the scale model uses it to reconstruct the tile's
              // size on the board.
              //
              // Not `--tile-cols`: the tile already uses that name for its own internal template,
              // and its declaration beat the one inherited from here. The model read "minmax(0,
              // 1fr)" where it expected a cell count and computed to nothing - measured: 11 x 15
              // pixels instead of 112 x 90.
              '--span-cols': colSpan,
              '--span-rows': rowSpan,
            } as React.CSSProperties
          }
        >
          {preview}
        </div>
      </div>

      <span className="visually-hidden" role="status">
        {t.editor.layout} {colSpan} × {rowSpan}
      </span>
    </div>
  );
}

/** Arrows, in footprint steps. */
const KEYS: Record<string, { col: number; row: number } | undefined> = {
  ArrowRight: { col: 1, row: 0 },
  ArrowLeft: { col: -1, row: 0 },
  ArrowDown: { col: 0, row: 1 },
  ArrowUp: { col: 0, row: -1 },
};

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
