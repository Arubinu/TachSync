import { describe, expect, it } from 'vitest';
import { parseTilePack } from './tileImport';

describe('tile import', () => {
  it('reads a complete pack', () => {
    const result = parseTilePack(
      JSON.stringify({
        name: 'Pack sportif',
        themeId: 'neon-miami',
        tiles: [
          { label: 'Moteur', metrics: ['rpm', 'boost'], colSpan: 2 },
          { metrics: ['speed'] },
        ],
      }),
      'pack.json',
    );

    expect(result.errors).toEqual([]);
    expect(result.presets).toHaveLength(2);
    expect(result.pack).toBe('Pack sportif');
    expect(result.presets[0]).toMatchObject({
      label: 'Moteur',
      metrics: ['rpm', 'boost'],
      colSpan: 2,
      themeId: 'neon-miami',
    });
    // The pack's theme is the default for tiles that declare none.
    expect(result.presets[1]?.themeId).toBe('neon-miami');
  });

  it('accepts a lone tile, with no envelope', () => {
    const result = parseTilePack(JSON.stringify({ metrics: ['speed'], label: 'Vitesse' }), 'v.json');
    expect(result.presets).toHaveLength(1);
    expect(result.presets[0]?.label).toBe('Vitesse');
  });

  it('accepts a plain array of tiles', () => {
    const result = parseTilePack(JSON.stringify([{ metrics: ['speed'] }, { metrics: ['rpm'] }]), 'a.json');
    expect(result.presets).toHaveLength(2);
  });

  it('takes the file name when the pack declares none', () => {
    const result = parseTilePack(JSON.stringify([{ metrics: ['speed'] }]), 'my-tiles.json');
    expect(result.presets[0]?.pack).toBe('my-tiles');
  });

  it('reports a file that is not JSON', () => {
    const result = parseTilePack('ceci nest pas du json', 'x.json');
    expect(result.presets).toEqual([]);
    expect(result.errors[0]).toContain('JSON');
  });

  it('drops the offending tile but keeps the others', () => {
    const result = parseTilePack(
      JSON.stringify({
        tiles: [{ metrics: ['speed'] }, { metrics: ['inexistant'] }, { metrics: ['rpm'] }],
      }),
      'p.json',
    );

    // A partially valid pack stays useful: refusing the whole for one isolated fault would mean
    // starting over.
    expect(result.presets).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('inexistant');
  });

  it('refuses a tile with no metric', () => {
    const result = parseTilePack(JSON.stringify({ tiles: [{ metrics: [] }] }), 'p.json');
    expect(result.presets).toEqual([]);
    expect(result.errors[0]).toContain('metrics');
  });

  it('clamps absurd footprints', () => {
    const result = parseTilePack(
      JSON.stringify({ tiles: [{ metrics: ['speed'], colSpan: 99, rowSpan: -4 }] }),
      'p.json',
    );
    expect(result.presets[0]).toMatchObject({ colSpan: 6, rowSpan: 1 });
  });

  it('refuses a wrapper that is not text', () => {
    const result = parseTilePack(
      JSON.stringify({ tiles: [{ metrics: ['speed'], css: { color: 'red' } }] }),
      'p.json',
    );
    expect(result.presets).toEqual([]);
    expect(result.errors[0]).toContain('css');
  });

  it('reads a nested template', () => {
    const result = parseTilePack(
      JSON.stringify({
        tiles: [
          {
            metrics: ['speed'],
            layout: [
              { tag: 'div', class: 'dial', children: [{ tag: 'span', class: 'needle' }] },
              { value: 'speed', class: 'big' },
              { unit: 'speed' },
              { text: 'GPS' },
            ],
          },
        ],
      }),
      'p.json',
    );

    expect(result.errors).toEqual([]);
    expect(result.presets[0]?.layout).toHaveLength(4);
  });

  it('refuses any tag other than div or span', () => {
    // The format's security point: a third-party file must not be able to introduce an image, a
    // frame or a link.
    for (const tag of ['img', 'iframe', 'a', 'script', 'object']) {
      const result = parseTilePack(
        JSON.stringify({ tiles: [{ metrics: ['speed'], layout: [{ tag }] }] }),
        'p.json',
      );
      expect(result.presets).toEqual([]);
      expect(result.errors[0]).toContain(tag);
    }
  });

  it('refuses a class containing selector characters', () => {
    const result = parseTilePack(
      JSON.stringify({ tiles: [{ metrics: ['speed'], layout: [{ text: 'x', class: 'a"] , *' }] }] }),
      'p.json',
    );
    expect(result.presets).toEqual([]);
    expect(result.errors[0]).toContain('class');
  });

  it('refuses an unknown metric in a template', () => {
    const result = parseTilePack(
      JSON.stringify({ tiles: [{ metrics: ['speed'], layout: [{ value: 'inexistant' }] }] }),
      'p.json',
    );
    expect(result.presets).toEqual([]);
    expect(result.errors[0]).toContain('inexistant');
  });

  it('refuses a template nested too deep', () => {
    let node: unknown = { tag: 'div' };
    for (let depth = 0; depth < 12; depth += 1) node = { tag: 'div', children: [node] };

    const result = parseTilePack(
      JSON.stringify({ tiles: [{ metrics: ['speed'], layout: [node] }] }),
      'p.json',
    );
    expect(result.presets).toEqual([]);
    expect(result.errors[0]).toContain('too deep');
  });

  it('refuses a template too large', () => {
    const many = Array.from({ length: 200 }, () => ({ text: 'x' }));
    const result = parseTilePack(
      JSON.stringify({ tiles: [{ metrics: ['speed'], layout: many }] }),
      'p.json',
    );
    expect(result.presets).toEqual([]);
    expect(result.errors[0]).toContain('too large');
  });

  it('reads the backgrounds of a pack', () => {
    const result = parseTilePack(
      JSON.stringify({
        name: 'Scenery',
        backgrounds: [
          { label: 'Nebula', css: '.backdrop { background: black; }' },
          { label: 'Trame', layout: [{ tag: 'div', class: 'grid' }] },
        ],
      }),
      'fonds.json',
    );

    expect(result.errors).toEqual([]);
    expect(result.backgrounds).toHaveLength(2);
    expect(result.backgrounds[0]?.label).toBe('Nebula');
    expect(result.backgrounds[1]?.layout).toHaveLength(1);
    // A file containing only backgrounds stays valid.
    expect(result.pack).toBe('Scenery');
  });

  it('attaches the backgrounds to the pack theme, unless stated otherwise', () => {
    const result = parseTilePack(
      JSON.stringify({
        themeId: 'rally',
        backgrounds: [
          { label: 'Inherited', css: 'a{}' },
          { label: 'Propre', themeId: 'stealth', css: 'a{}' },
        ],
      }),
      'f.json',
    );

    expect(result.backgrounds[0]?.themeId).toBe('rally');
    expect(result.backgrounds[1]?.themeId).toBe('stealth');
  });

  it('refuses a background with neither css nor layout', () => {
    const result = parseTilePack(
      JSON.stringify({ backgrounds: [{ label: 'Vide' }] }),
      'fonds.json',
    );
    expect(result.backgrounds).toEqual([]);
    expect(result.errors.some((message) => message.includes('css'))).toBe(true);
  });

  it('accepts a pack mixing tiles and backgrounds', () => {
    const result = parseTilePack(
      JSON.stringify({
        name: 'Complet',
        tiles: [{ metrics: ['speed'] }],
        backgrounds: [{ label: 'Halo', css: '.backdrop { opacity: 0.5; }' }],
      }),
      'c.json',
    );

    expect(result.presets).toHaveLength(1);
    expect(result.backgrounds).toHaveLength(1);
    expect(result.presets[0]?.pack).toBe('Complet');
    expect(result.backgrounds[0]?.pack).toBe('Complet');
  });

  it('regenerates the identifiers so the same pack can be imported twice', () => {
    const file = JSON.stringify({ tiles: [{ id: 'fixe', metrics: ['speed'] }] });
    const first = parseTilePack(file, 'p.json');
    const second = parseTilePack(file, 'p.json');

    expect(first.presets[0]?.id).not.toBe(second.presets[0]?.id);
  });
});
