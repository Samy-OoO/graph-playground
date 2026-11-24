import type { GraphData } from "../types/graph";

const SIZE = 64;
const PADDING = 7;
// A thumbnail is tiny, so a huge graph only needs a sample of its edges to look the part.
const MAX_EDGES_DRAWN = 300;

// Same colors as the editor.
const BACKGROUND = '#050505';
const EDGE_COLOR = '#636670';
const NODE_FILL = '#050505';
const NODE_STROKE = '#9aa0aa';

const round = (value: number) => Math.round(value * 10) / 10;

// A small SVG pic, as text.
export function renderThumbnail(graph: GraphData): string {
    const frame = (content: string) => 
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">` + 
        `<rect width="${SIZE}" height="${SIZE}" rx="8" fill="${BACKGROUND}"/>${content}</svg>`;

    if (graph.nodes.length === 0) return frame('');

    const xs = graph.nodes.map((node) => node.x);
    const ys = graph.nodes.map((node) => node.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);

    // A graph that is a single point, or a straight line, has no width or height to divide by.
    const width = Math.max(Math.max(...xs) - minX, 1);
    const height = Math.max(Math.max(...ys) - minY, 1);

    const room = SIZE - PADDING * 2;
    const scale = Math.min(room / width, room / height);
    const offsetX = (SIZE - width * scale) / 2;
    const offsetY = (SIZE - height * scale) / 2;

    const place = (node: { x: number; y: number }) => ({
        x: round(offsetX + (node.x - minX) * scale),
        y: round(offsetY + (node.y - minY) * scale),
    });
    const placed = new Map(graph.nodes.map((node) => [node.id, place(node)]));

    const step = Math.max(1, Math.ceil(graph.edges.length / MAX_EDGES_DRAWN));
    let path = '';
    for (let i = 0; i < graph.edges.length; i += step) {
        const from = placed.get(graph.edges[i].source);
        const to = placed.get(graph.edges[i].destination);
        if (from && to) path += `M${from.x} ${from.y}L${to.x} ${to.y}`;
    }

    const radius = graph.nodes.length > 60 ? 1.5 : 3;
    const circles = [...placed.values()]
        .map((point) => `<circle cx="${point.x}" cy="${point.y}" r="${radius}"/>`)
        .join('');
    
    const edges = path ? `<path d="${path}" stroke="${EDGE_COLOR}" stroke-width="1" fill="none"/>` : '';
    const nodes = `<g fill="${NODE_FILL}" stroke="${NODE_STROKE}" stroke-width="${1}">${circles}</g>`;

    return frame(edges + nodes);
}

// The text of an SVG, as an address that an <img> can show.
export function thumbnailSrc(svg: string): string {
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}