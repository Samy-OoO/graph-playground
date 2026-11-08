import { describe, expect, it } from 'vitest';
import { renderThumbnail, thumbnailSrc } from './thumbnail';

const node = (id: string, x: number, y: number) => ({ id, x, y, label: id.toUpperCase() });
const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;

/** Every number the picture draws with, so a test can check they all land inside the 64 x 64 box. */
function coordinates(svg: string): number[] {
  const circles = [...svg.matchAll(/c[xy]="([\d.]+)"/g)].map((match) => Number(match[1]));
  const paths = [...svg.matchAll(/d="([^"]+)"/g)].flatMap((match) => match[1].match(/[\d.]+/g) ?? []).map(Number);
  return [...circles, ...paths];
}

describe('renderThumbnail', () => {
  it('draws just the frame for an empty graph', () => {
    const svg = renderThumbnail({ directed: true, weighted: false, nodes: [], edges: [] });
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(count(svg, /<circle/g)).toBe(0);
    expect(count(svg, /<path/g)).toBe(0);
  });

  it('draws one circle per node and one line per edge', () => {
    const svg = renderThumbnail({
      directed: true,
      weighted: false,
      nodes: [node('a', 100, 100), node('b', 300, 100), node('c', 200, 300)],
      edges: [
        { id: 'e1', source: 'a', destination: 'b' },
        { id: 'e2', source: 'b', destination: 'c' },
      ],
    });
    expect(count(svg, /<circle/g)).toBe(3);
    expect(count(svg, /M/g)).toBe(2);
  });

  it('keeps everything inside the picture, however far apart the nodes are', () => {
    const svg = renderThumbnail({
      directed: false,
      weighted: false,
      nodes: [node('a', -500, -500), node('b', 4000, 90), node('c', 1200, 2500)],
      edges: [{ id: 'e1', source: 'a', destination: 'c' }],
    });
    for (const value of coordinates(svg)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(64);
    }
  });

  it('copes with a single node and with nodes in a straight line', () => {
    const single = renderThumbnail({ directed: true, weighted: false, nodes: [node('a', 50, 50)], edges: [] });
    expect(single).not.toContain('NaN');
    expect(count(single, /<circle/g)).toBe(1);

    const line = renderThumbnail({
      directed: true,
      weighted: false,
      nodes: [node('a', 10, 80), node('b', 400, 80)],
      edges: [{ id: 'e1', source: 'a', destination: 'b' }],
    });
    expect(line).not.toContain('NaN');
    expect(line).not.toContain('Infinity');
  });

  it('skips edges that point at nodes that are not there', () => {
    const svg = renderThumbnail({
      directed: true,
      weighted: false,
      nodes: [node('a', 0, 0), node('b', 100, 100)],
      edges: [{ id: 'e1', source: 'a', destination: 'ghost' }],
    });
    expect(count(svg, /<path/g)).toBe(0);
  });

  it('only draws a sample of the edges of a very dense graph, so the picture stays small', () => {
    const nodes = Array.from({ length: 100 }, (_, i) => node(`n${i}`, (i % 10) * 40, Math.floor(i / 10) * 40));
    const edges = [];
    for (let i = 0; i < 100; i++) for (let j = i + 1; j < 100; j++) edges.push({ id: `e${i}-${j}`, source: `n${i}`, destination: `n${j}` });

    const svg = renderThumbnail({ directed: false, weighted: false, nodes, edges });

    expect(edges.length).toBe(4950);
    expect(count(svg, /M/g)).toBeLessThanOrEqual(300);
    expect(svg.length).toBeLessThan(20_000);
  });
});

describe('thumbnailSrc', () => {
  it('makes an address an image can use', () => {
    const src = thumbnailSrc('<svg viewBox="0 0 1 1"></svg>');
    expect(src.startsWith('data:image/svg+xml,')).toBe(true);
    expect(decodeURIComponent(src.slice('data:image/svg+xml,'.length))).toBe('<svg viewBox="0 0 1 1"></svg>');
  });
});