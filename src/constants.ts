/** Logical size of the SVG canvas (the viewBox). The element itself scales to fit. */
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 500;

export const NODE_RADIUS = 22;

/** How far reciprocal directed edges (A→B and B→A) bow away from each other. */
export const EDGE_CURVE = 40;

/** Animation speed, in algorithm steps per second. */
export const SPEED = { min: 0.5, max: 5, step: 0.25, initial: 1.25 } as const;
