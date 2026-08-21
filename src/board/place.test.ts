import { describe, expect, it } from 'vitest';
import { DEFAULT_CAPTION, DEFAULT_CHROME, DEFAULT_FLUSH, hasRoomFor, type TileConfig } from './layout';

function tile(id: string, col: number, row: number, colSpan = 1, rowSpan = 1, layer = 1): TileConfig {
  return {
    id,
    layer: layer as TileConfig['layer'],
    colStart: col,
    rowStart: row,
    colSpan,
    rowSpan,
    fontScale: 1,
    mirrored: false,
    whenUnavailable: 'hide',
    presetId: null,
    themeId: null,
    flush: DEFAULT_FLUSH,
    spacing: null,
    chrome: DEFAULT_CHROME,
    align: null,
    caption: DEFAULT_CAPTION,
    metrics: ['speed'],
  };
}

describe('hasRoomFor', () => {
  const grid = { columns: 4, rows: 3 };

  it('accepts a footprint that meets nobody', () => {
    const tiles = [tile('a', 1, 1), tile('b', 3, 1)];
    expect(hasRoomFor(tiles, tiles[0]!, 2, 1, grid.columns, grid.rows)).toBe(true);
  });

  it('refuses to encroach on a neighbour of the same layer', () => {
    const tiles = [tile('a', 1, 1), tile('b', 3, 1)];
    // Three columns from the first reach the third, which is occupied.
    expect(hasRoomFor(tiles, tiles[0]!, 3, 1, grid.columns, grid.rows)).toBe(false);
  });

  it('ignores the other layers, which never show together', () => {
    const tiles = [tile('a', 1, 1), tile('b', 3, 1, 1, 1, 2)];
    expect(hasRoomFor(tiles, tiles[0]!, 4, 1, grid.columns, grid.rows)).toBe(true);
  });

  it('refuses to leave the grid', () => {
    const tiles = [tile('a', 3, 1)];
    expect(hasRoomFor(tiles, tiles[0]!, 3, 1, grid.columns, grid.rows)).toBe(false);
    expect(hasRoomFor(tiles, tiles[0]!, 2, 4, grid.columns, grid.rows)).toBe(false);
  });

  it('does not count itself', () => {
    const tiles = [tile('a', 1, 1, 2, 2)];
    // Shrinking must always be allowed: the room freed is its own.
    expect(hasRoomFor(tiles, tiles[0]!, 1, 1, grid.columns, grid.rows)).toBe(true);
  });
});
