import { describe, expect, it } from 'vitest';
import {
  ALL_METRICS,
  DEFAULT_CAPTION,
  DEFAULT_FLUSH,
  DEFAULT_LAYOUT,
  DEFAULT_PORTRAIT_LAYOUT,
  GRID_COLUMNS,
  GRID_ROWS,
  normalizeLayouts,
  defaultSpanFor,
  SPACING_MIN,
  normalizeAlign,
  stepAlign,
  SPACING_STEP,
  flushEdges,
  forcedEdges,
  type FlushMode,
  type FlushSide,
  normalizeFlush,
  isCellFree,
  occupancyGrid,
  planInsert,
  planMove,
  reflowIntoGrid,
  SPACING_MAX,
  stepSpacing,
  type LayerIndex,
  type TileConfig,
} from './layout';

describe('contact with the board edges', () => {
  const corner = { ...tile('t', 1, 1, 1, 1), flush: DEFAULT_FLUSH };

  it('declares the sides actually touched', () => {
    expect(flushEdges(corner, 4, 3)).toBe('top left');
    expect(flushEdges({ ...corner, colStart: 4, rowStart: 3 }, 4, 3)).toBe('right bottom');
  });

  it('takes the footprint into account, not only the origin', () => {
    // A wide tile touches the right edge with its far end.
    expect(flushEdges({ ...corner, colStart: 3, colSpan: 2 }, 4, 3)).toBe('top right');
  });

  it('forces a contact that position does not give', () => {
    const floating = { ...corner, colStart: 2, rowStart: 2 };

    expect(flushEdges(floating, 4, 3)).toBe('');
    // `force` allows trying a tile drawn for an edge somewhere else.
    expect(flushEdges({ ...floating, flush: { ...DEFAULT_FLUSH, left: 'force' } }, 4, 3)).toBe(
      'left',
    );
  });

  it('silences a contact that position does give', () => {
    // `off` stops an ordinary tile bleeding just because it was placed against an edge.
    expect(flushEdges({ ...corner, flush: { ...DEFAULT_FLUSH, top: 'off' } }, 4, 3)).toBe('left');
  });

  it('brings an unknown setting back to automatic', () => {
    // An earlier backup has no such field: behaviour must be exactly what it had.
    expect(normalizeFlush(undefined)).toEqual(DEFAULT_FLUSH);
    expect(normalizeFlush({ top: 'anything' })).toEqual(DEFAULT_FLUSH);
    expect(normalizeFlush({ top: 'off' }).top).toBe('off');
  });
});

describe('tile-specific spacing', () => {
  it('starts from the theme, then advances by steps', () => {
    expect(stepSpacing(null, 1)).toBe(0);
    expect(stepSpacing(0, 1)).toBe(2);
  });

  it('hands back to the theme on the way down past zero', () => {
    // The default sits between the last positive step and the first negative one, so it is
    // reachable without a control of its own. Going further gives a negative margin - see the
    // ladder below, which is where that behaviour is pinned.
    expect(stepSpacing(0, -1)).toBeNull();
  });

  it('caps the spacing at its maximum', () => {
    expect(stepSpacing(SPACING_MAX, 1)).toBe(SPACING_MAX);
  });
});

describe('default footprint of a metric', () => {
  it('gives more room to what is read while driving than to what is consulted at a standstill', () => {
    const surface = (metric: Parameters<typeof defaultSpanFor>[0]): number => {
      const { colSpan, rowSpan } = defaultSpanFor(metric);
      return colSpan * rowSpan;
    };

    // A dashboard's hierarchy is set first by the room a tile occupies, well before the size of the
    // figure.
    expect(surface('speed')).toBeGreaterThan(surface('tripDuration'));
    expect(surface('avatar')).toBeGreaterThan(surface('coolant'));
  });

  it('stays within the grid bounds for every known metric', () => {
    for (const metric of ALL_METRICS) {
      const { colSpan, rowSpan } = defaultSpanFor(metric);
      // An out-of-bounds footprint would place a tile impossible to move back.
      expect(colSpan).toBeGreaterThanOrEqual(1);
      expect(rowSpan).toBeGreaterThanOrEqual(1);
      expect(colSpan).toBeLessThanOrEqual(6);
      expect(rowSpan).toBeLessThanOrEqual(6);
    }
  });
});

function tile(
  id: string,
  colStart: number,
  rowStart: number,
  colSpan = 1,
  rowSpan = 1,
  layer: LayerIndex = 1,
): TileConfig {
  return {
    id,
    layer,
    colStart,
    rowStart,
    colSpan,
    rowSpan,
    fontScale: 1,
    mirrored: false,
    whenUnavailable: 'hide',
    presetId: null,
    themeId: null,
    flush: DEFAULT_FLUSH,
    spacing: null,
    chrome: 'default',
    align: null,
    caption: DEFAULT_CAPTION,
    metrics: ['speed'],
  };
}

function at(tiles: readonly TileConfig[], id: string): TileConfig {
  const found = tiles.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`tile ${id} missing`);
  return found;
}

describe('grid occupancy', () => {
  it('marks the cells covered by a spanning tile', () => {
    const grid = occupancyGrid([tile('a', 1, 1, 2, 2)], 1, 4, 3);
    expect(grid[0]).toEqual([true, true, false, false]);
    expect(grid[1]).toEqual([true, true, false, false]);
    expect(grid[2]).toEqual([false, false, false, false]);
  });

  it('ignores the tiles of the other layers', () => {
    const tiles = [tile('fond', 1, 1, 4, 3, 0)];
    expect(isCellFree(tiles, 1, 1, 1, 4, 3)).toBe(true);
    expect(isCellFree(tiles, 0, 1, 1, 4, 3)).toBe(false);
  });

  it('treats outside the grid as not free', () => {
    expect(isCellFree([], 1, 5, 1, 4, 3)).toBe(false);
    expect(isCellFree([], 1, 1, 4, 4, 3)).toBe(false);
  });
});

describe('planMove', () => {
  it('moves a tile onto a free cell without touching the others', () => {
    const tiles = [tile('a', 1, 1), tile('b', 2, 1)];
    const result = planMove(tiles, 'a', 4, 3, 4, 3);

    expect(result).not.toBeNull();
    expect(at(result!, 'a')).toMatchObject({ colStart: 4, rowStart: 3 });
    expect(at(result!, 'b')).toMatchObject({ colStart: 2, rowStart: 1 });
  });

  it('pushes the covered tile to the first free slot', () => {
    const tiles = [tile('a', 1, 1), tile('b', 2, 1)];
    const result = planMove(tiles, 'a', 2, 1, 4, 3);

    expect(result).not.toBeNull();
    expect(at(result!, 'a')).toMatchObject({ colStart: 2, rowStart: 1 });
    // `b` was displaced; it lands on the first free cell, which is the one `a` just left.
    expect(at(result!, 'b')).toMatchObject({ colStart: 1, rowStart: 1 });
  });

  it('pushes aside several tiles when the moved tile spans', () => {
    const tiles = [tile('big', 1, 1, 2, 1), tile('x', 3, 1), tile('y', 4, 1)];
    const result = planMove(tiles, 'big', 3, 1, 4, 3);

    expect(result).not.toBeNull();
    expect(at(result!, 'big')).toMatchObject({ colStart: 3, rowStart: 1 });
    // Both displaced tiles must have found a place, and distinct ones.
    const x = at(result!, 'x');
    const y = at(result!, 'y');
    expect(`${x.colStart},${x.rowStart}`).not.toBe(`${y.colStart},${y.rowStart}`);
    for (const moved of [x, y]) {
      expect(moved.colStart).toBeGreaterThanOrEqual(1);
      expect(moved.colStart).toBeLessThanOrEqual(4);
    }
  });

  it('clamps the target so a spanning tile stays inside the grid', () => {
    const tiles = [tile('wide', 1, 1, 2, 1)];
    const result = planMove(tiles, 'wide', 4, 1, 4, 3);

    expect(result).not.toBeNull();
    // Column 4 overflowed: the tile is brought back to column 3.
    expect(at(result!, 'wide')).toMatchObject({ colStart: 3 });
  });

  it('refuses the move when the displaced ones have nowhere to go', () => {
    // Full 2x1 grid: moving `a` onto `b` leaves `b` nowhere to go.
    const tiles = [tile('a', 1, 1, 2, 1), tile('b', 1, 1)];
    const result = planMove(tiles, 'a', 1, 1, 2, 1);
    // `a` already fills the grid: `b` cannot be rehoused anywhere.
    expect(result).toBeNull();
  });

  it('does not touch the tiles of the other layers', () => {
    const tiles = [tile('a', 1, 1), tile('fond', 1, 1, 1, 1, 0)];
    const result = planMove(tiles, 'a', 2, 1, 4, 3);

    expect(result).not.toBeNull();
    expect(at(result!, 'fond')).toMatchObject({ colStart: 1, rowStart: 1, layer: 0 });
  });
});

describe('planInsert', () => {
  it('adds a tile on a free cell', () => {
    const tiles = [tile('a', 1, 1)];
    const result = planInsert(tiles, tile('neuve', 1, 1), 3, 2, 4, 3);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(at(result!, 'neuve')).toMatchObject({ colStart: 3, rowStart: 2 });
    expect(at(result!, 'a')).toMatchObject({ colStart: 1, rowStart: 1 });
  });

  it('pushes aside the tile occupying the target cell', () => {
    const tiles = [tile('a', 2, 1)];
    const result = planInsert(tiles, tile('neuve', 1, 1), 2, 1, 4, 3);

    expect(result).not.toBeNull();
    expect(at(result!, 'neuve')).toMatchObject({ colStart: 2, rowStart: 1 });
    // `a` was displaced to the first free cell.
    expect(at(result!, 'a')).toMatchObject({ colStart: 1, rowStart: 1 });
  });

  it('refuses insertion into a full grid', () => {
    const tiles = [tile('plein', 1, 1, 2, 1)];
    expect(planInsert(tiles, tile('neuve', 1, 1), 1, 1, 2, 1)).toBeNull();
  });

  it('pushes aside the way a move does, at equal position', () => {
    // The guarantee that matters: dropping a new tile and dragging an existing one there must
    // produce the same rearrangement around them.
    const existing = [tile('a', 1, 1), tile('b', 2, 1), tile('mobile', 4, 3)];
    const moved = planMove(existing, 'mobile', 2, 1, 4, 3);
    const inserted = planInsert([tile('a', 1, 1), tile('b', 2, 1)], tile('neuve', 1, 1), 2, 1, 4, 3);

    expect(moved).not.toBeNull();
    expect(inserted).not.toBeNull();
    expect(at(inserted!, 'b')).toMatchObject({
      colStart: at(moved!, 'b').colStart,
      rowStart: at(moved!, 'b').rowStart,
    });
  });
});

describe('reflowIntoGrid', () => {
  it('brings back into the grid the tiles left outside by a shrink', () => {
    const tiles = [tile('a', 1, 1), tile('b', 4, 3)];
    const result = reflowIntoGrid(tiles, 2, 2);

    for (const moved of result) {
      expect(moved.colStart).toBeLessThanOrEqual(2);
      expect(moved.rowStart).toBeLessThanOrEqual(2);
    }
    expect(result).toHaveLength(2);
  });

  it('shrinks a tile wider than the grid', () => {
    const result = reflowIntoGrid([tile('wide', 1, 1, 4, 1)], 2, 2);
    expect(at(result, 'wide').colSpan).toBe(2);
  });

  it('leaves untouched a layout that already fits', () => {
    const tiles = [tile('a', 1, 1), tile('b', 2, 1)];
    expect(reflowIntoGrid(tiles, 4, 3)).toEqual(tiles);
  });

  it('separates two tiles overlapping on the same layer', () => {
    // The non-overlap rule prevents creating overlaps, not inheriting them.
    const tiles = [tile('dessous', 1, 1, 2, 2), tile('dessus', 2, 2, 1, 1)];
    const result = reflowIntoGrid(tiles, 4, 3);

    expect(result).toHaveLength(2);
    expect(overlapping(result)).toEqual([]);
    // The larger keeps its place: it is the one that would be noticed moving.
    expect(at(result, 'dessous')).toMatchObject({ colStart: 1, rowStart: 1 });
  });

  it('lets two tiles of different layers overlap', () => {
    // They are never displayed at the same time: separating them would undo a deliberate
    // composition.
    const tiles = [tile('back', 1, 1, 2, 2, 0), tile('front', 1, 1, 2, 2, 2)];
    expect(reflowIntoGrid(tiles, 4, 3)).toEqual(tiles);
  });
});

describe('repair on load', () => {
  const inheritedOverlap = {
    layouts: {
      landscape: {
        columns: 4,
        rows: 3,
        tiles: [tile('dessous', 1, 1, 2, 2), tile('dessus', 2, 2, 1, 1)],
      },
    },
  };

  it('repairs an inherited layout that overlaps', () => {
    const { landscape } = normalizeLayouts(inheritedOverlap);

    expect(landscape.tiles).toHaveLength(2);
    expect(overlapping(landscape.tiles)).toEqual([]);
  });

  it('does not touch a sound layout', () => {
    const sound = {
      layouts: {
        landscape: { columns: 4, rows: 3, tiles: [tile('a', 1, 1), tile('b', 2, 1)] },
      },
    };

    expect(normalizeLayouts(sound).landscape).toEqual(sound.layouts.landscape);
  });

  it('brings an absurd grid back within its bounds', () => {
    // A hand-edited or truncated file: the grid would try to draw what it is told.
    const { landscape } = normalizeLayouts({
      layouts: { landscape: { columns: 5000, rows: 0, tiles: [tile('a', 1, 1)] } },
    });

    expect(landscape.columns).toBe(GRID_COLUMNS.max);
    expect(landscape.rows).toBe(GRID_ROWS.min);
  });

  it('ships default layouts with no overlap', () => {
    for (const layout of [DEFAULT_LAYOUT, DEFAULT_PORTRAIT_LAYOUT]) {
      expect(overlapping(layout.tiles)).toEqual([]);
    }
  });
});

/** Pairs of same-layer tiles that overlap, by id. */
function overlapping(tiles: readonly TileConfig[]): readonly string[] {
  const pairs: string[] = [];
  for (let i = 0; i < tiles.length; i += 1) {
    for (let j = i + 1; j < tiles.length; j += 1) {
      const a = tiles[i];
      const b = tiles[j];
      if (a === undefined || b === undefined || a.layer !== b.layer) continue;
      const touche =
        a.colStart < b.colStart + b.colSpan &&
        b.colStart < a.colStart + a.colSpan &&
        a.rowStart < b.rowStart + b.rowSpan &&
        b.rowStart < a.rowStart + a.rowSpan;
      if (touche) pairs.push(a.id + '/' + b.id);
    }
  }
  return pairs;
}

describe('tile caption', () => {
  /** One tile through the normaliser, whatever it was given as a caption. */
  function caption(given: unknown): string | undefined {
    const stored = { ...tile('a', 1, 1) } as Record<string, unknown>;
    if (given === undefined) delete stored['caption'];
    else stored['caption'] = given;

    const { landscape } = normalizeLayouts({
      layouts: { landscape: { columns: 4, rows: 3, tiles: [stored] } },
    } as unknown as Parameters<typeof normalizeLayouts>[0]);

    return landscape.tiles[0]?.caption;
  }

  it('keeps a setting it recognises', () => {
    expect(caption('spread')).toBe('spread');
    expect(caption('hide')).toBe('hide');
  });

  it('shows the caption on a tile placed before the setting existed', () => {
    // An earlier backup has no such field, and showing it is exactly what those tiles did.
    expect(caption(undefined)).toBe('show');
  });

  it('refuses a setting it does not know', () => {
    // A hand-edited file, or one from a later version: an unknown word must not reach the tile.
    expect(caption('wherever')).toBe('show');
  });
});

describe('the edges a carried tile keeps', () => {
  const tile = (flush: Partial<Record<FlushSide, FlushMode>>, at: Partial<TileConfig> = {}) =>
    ({
      ...DEFAULT_LAYOUT.tiles[0]!,
      colStart: 1,
      rowStart: 1,
      colSpan: 1,
      rowSpan: 1,
      ...at,
      flush: { top: 'auto', left: 'auto', right: 'auto', bottom: 'auto', ...flush },
    }) as TileConfig;

  it('drops the sides it only touched by being where it was', () => {
    // In the air it touches nothing: `auto` describes contact with a board the tile has left, and
    // keeping it would graft the tile onto an edge it is no longer against.
    const corner = tile({});

    expect(flushEdges(corner, 4, 3)).toContain('top');
    expect(forcedEdges(corner)).toBe('');
  });

  it('keeps the sides that were asked for outright', () => {
    expect(forcedEdges(tile({ right: 'force' }))).toBe('right');
  });

  it('keeps a forced side even where the tile never touched one', () => {
    // Middle of the board, forced left: the intent is the tile's, not the grid's.
    const middle = tile({ left: 'force' }, { colStart: 2, rowStart: 2 });

    expect(flushEdges(middle, 4, 3)).toBe('left');
    expect(forcedEdges(middle)).toBe('left');
  });

  it('lists several in the order the sides are declared', () => {
    expect(forcedEdges(tile({ top: 'force', bottom: 'force' }))).toBe('top bottom');
  });
});

describe('the spacing ladder', () => {
  it('steps down through the theme value, never past it', () => {
    // The default has to be reachable, and reachable from the side one is on.
    expect(stepSpacing(2, -1)).toBe(0);
    expect(stepSpacing(0, -1)).toBeNull();
    expect(stepSpacing(null, -1)).toBe(-SPACING_STEP);
  });

  it('steps back up through it the same way', () => {
    expect(stepSpacing(-SPACING_STEP, 1)).toBeNull();
    expect(stepSpacing(null, 1)).toBe(0);
    expect(stepSpacing(0, 1)).toBe(SPACING_STEP);
  });

  it('goes negative, which is what lets a tile spill over its neighbours', () => {
    expect(stepSpacing(-4, -1)).toBe(-6);
  });

  it('stops at both ends', () => {
    expect(stepSpacing(SPACING_MAX, 1)).toBe(SPACING_MAX);
    expect(stepSpacing(SPACING_MIN, -1)).toBe(SPACING_MIN);
  });

  it('never skips the theme value while climbing from the floor', () => {
    // Walking the whole ladder: the default must appear exactly once.
    let value: number | null = SPACING_MIN;
    const seen: (number | null)[] = [value];
    for (let i = 0; i < 40; i += 1) {
      value = stepSpacing(value, 1);
      seen.push(value);
    }

    expect(seen.filter((step) => step === null)).toHaveLength(1);
    expect(seen).toContain(SPACING_MAX);
  });
});

describe('per-tile alignment', () => {
  it('cycles through the three, then back to the theme', () => {
    expect(stepAlign(null)).toBe('left');
    expect(stepAlign('left')).toBe('center');
    expect(stepAlign('center')).toBe('right');
    expect(stepAlign('right')).toBeNull();
  });

  it('keeps the theme value reachable, exactly once round the cycle', () => {
    // Without it a round tile could never get its centring back: the `centered` arrangement exists
    // because left-aligned text against a curve reads as a template error.
    const seen: (string | null)[] = [];
    let value = null as string | null;
    for (let i = 0; i < 4; i += 1) {
      value = stepAlign(value as never);
      seen.push(value);
    }

    expect(seen).toEqual(['left', 'center', 'right', null]);
  });

  it('reads an unknown value back as the theme, never as an alignment', () => {
    // A hand-edited file, or one from a later version: it must defer, not invent a ranging.
    expect(normalizeAlign('justify')).toBeNull();
    expect(normalizeAlign(undefined)).toBeNull();
    expect(normalizeAlign('center')).toBe('center');
  });
});
