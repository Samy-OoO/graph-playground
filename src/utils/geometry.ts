import { CANVAS_HEIGHT, CANVAS_WIDTH, NODE_RADIUS } from '../constants';
import type { Point } from '../types/graph';
import { clamp } from './math';

/** Gap between an arrow tip and the rim of the node it points at. */
const ARROW_GAP = 2;
/** Distance of a weight label from the edge. */
const LABEL_OFFSET = 12;

/** Converts a pointer position on screen into the SVG's own coordinate system. */
export function clientToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x: 0, y: 0 };
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}

/** Keeps a node fully inside the canvas. */
export function clampToCanvas(point: Point): Point {
  return {
    x: clamp(point.x, NODE_RADIUS, CANVAS_WIDTH - NODE_RADIUS),
    y: clamp(point.y, NODE_RADIUS, CANVAS_HEIGHT - NODE_RADIUS),
  };
}

export interface EdgeGeometry {
  /** SVG path, always drawn from source to destination. */
  path: string;
  labelX: number;
  labelY: number;
}

/**
 * Path + label position for an edge.
 * `curve` is how far the middle of the edge bows sideways (0 = straight line).
 * Directed edges stop at the rim of the destination node so the arrowhead stays visible.
 */
export function getEdgeGeometry(
  from: Point,
  to: Point,
  { directed, curve }: { directed: boolean; curve: number },
): EdgeGeometry {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;

  // Unit normal to the edge.
  const nx = -dy / length;
  const ny = dx / length;

  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const controlX = midX + nx * curve;
  const controlY = midY + ny * curve;

  let endX = to.x;
  let endY = to.y;

  if (directed) {
    // Back off along the direction the edge arrives from.
    const arrivalX = to.x - controlX;
    const arrivalY = to.y - controlY;
    const arrivalLength = Math.hypot(arrivalX, arrivalY) || 1;
    const backOff = NODE_RADIUS + ARROW_GAP;
    endX = to.x - (arrivalX / arrivalLength) * backOff;
    endY = to.y - (arrivalY / arrivalLength) * backOff;
  }

  const path =
    curve === 0
      ? `M ${from.x} ${from.y} L ${endX} ${endY}`
      : `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${endX} ${endY}`;

  const labelDistance = curve / 2 + LABEL_OFFSET;
  return {
    path,
    labelX: midX + nx * labelDistance,
    labelY: midY + ny * labelDistance,
  };
}
