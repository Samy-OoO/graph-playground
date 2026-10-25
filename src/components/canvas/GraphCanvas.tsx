import { useMemo, useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import type { AlgorithmStep, EdgeStatus } from '../../algorithms/types';
import { CANVAS_HEIGHT, CANVAS_WIDTH, EDGE_CURVE } from '../../constants';
import type { EditorApi } from '../../hooks/useGraphEditor';
import type { GraphApi } from '../../hooks/useGraph';
import type { Point } from '../../types/graph';
import { clientToSvgPoint, getEdgeGeometry } from '../../utils/geometry';
import { findReciprocalEdgeIds } from '../../utils/graph';
import { pluralize } from '../../utils/math';
import styles from './canvas.module.css';
import { EdgeMarkers } from './EdgeMarkers';
import { EdgeView } from './EdgeView';
import { NodeView } from './NodeView';

interface GraphCanvasProps {
  graph: GraphApi;
  editor: EditorApi;
  step: AlgorithmStep | null;
}

// Edges later in this order are painted on top, so active edges are never hidden under idle ones.
const EDGE_PAINT_ORDER: Record<EdgeStatus, number> = { default: 0, settled: 1, skipped: 2, active: 3 };

const NODE_CURSOR = { select: 'pointer', 'add-node': 'default', 'add-edge': 'pointer', move: 'grab', delete: 'pointer' } as const;

export function GraphCanvas({ graph, editor, step }: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { nodes, edges, directed, weighted } = graph;

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const reciprocalEdgeIds = useMemo(() => (directed ? findReciprocalEdgeIds(edges) : new Set<string>()), [edges, directed]);

  function toSvgPoint(event: { clientX: number; clientY: number }): Point {
    return svgRef.current ? clientToSvgPoint(svgRef.current, event.clientX, event.clientY) : { x: 0, y: 0 };
  }

  const drawnEdges = edges
    .map((edge) => ({ edge, status: step?.edgeStatus[edge.id] ?? 'default' }))
    .sort((a, b) => EDGE_PAINT_ORDER[a.status] - EDGE_PAINT_ORDER[b.status]);

  return (
    <svg
      ref={svgRef}
      className={styles.canvas}
      data-tool={editor.activeTool}
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
      role="img"
      aria-label={`Graph canvas with ${pluralize(nodes.length, 'node')} and ${pluralize(edges.length, 'edge')}`}
      onClick={(event) => editor.onCanvasClick(toSvgPoint(event))}
      onPointerMove={(event) => editor.onPointerMove(toSvgPoint(event))}
      onPointerUp={editor.endDrag}
      onPointerCancel={editor.endDrag}
      onLostPointerCapture={editor.endDrag}
    >
      <defs>
        <pattern id="canvas-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle className={styles.gridDot} cx="1" cy="1" r="1" />
        </pattern>
        <EdgeMarkers />
      </defs>

      <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#canvas-grid)" pointerEvents="none" />

      {nodes.length === 0 && (
        <g pointerEvents="none">
          <text className={styles.emptyTitle} x={CANVAS_WIDTH / 2} y={CANVAS_HEIGHT / 2 - 10}>
            Your graph is empty
          </text>
          <text className={styles.emptyHint} x={CANVAS_WIDTH / 2} y={CANVAS_HEIGHT / 2 + 20}>
            Choose “Add node” and click here, or load the sample graph.
          </text>
        </g>
      )}

      {drawnEdges.map(({ edge, status }) => {
        const source = nodesById.get(edge.source);
        const destination = nodesById.get(edge.destination);
        if (!source || !destination) return null;

        const geometry = getEdgeGeometry(source, destination, {
          directed,
          curve: reciprocalEdgeIds.has(edge.id) ? EDGE_CURVE : 0,
        });

        const traversal = step?.traversal && step.traversal.edgeId === edge.id ? step.traversal : null;
        const flow = traversal ? (traversal.fromNodeId === edge.destination ? 'reverse' : 'forward') : null;

        return (
          <EdgeView
            key={edge.id}
            edge={edge}
            geometry={geometry}
            status={status}
            directed={directed}
            showWeight={weighted}
            flow={flow}
            onClick={(event: MouseEvent) => {
              event.stopPropagation();
              editor.onEdgeClick(edge.id);
            }}
          />
        );
      })}

      {nodes.map((node) => (
        <NodeView
          key={node.id}
          node={node}
          status={step?.nodeStatus[node.id] ?? 'default'}
          selected={editor.selectedNodeId === node.id}
          isEdgeSource={editor.edgeSourceId === node.id}
          cursor={NODE_CURSOR[editor.activeTool]}
          onPointerDown={(event: PointerEvent<SVGGElement>) => {
            event.stopPropagation();
            editor.onNodePointerDown(node, toSvgPoint(event));
            // While dragging, keep receiving moves even if the pointer leaves the canvas.
            if (editor.activeTool === 'move') svgRef.current?.setPointerCapture(event.pointerId);
          }}
          onClick={(event: MouseEvent) => {
            event.stopPropagation();
            editor.onNodeClick(node.id);
          }}
        />
      ))}
    </svg>
  );
}
