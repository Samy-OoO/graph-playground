import type { MouseEvent } from 'react';
import type { EdgeStatus } from '../../algorithms/types';
import type { EdgeGeometry } from '../../utils/geometry';
import type { GraphEdge } from '../../types/graph';
import styles from './canvas.module.css';
import { getArrowMarkerId } from './markerIds';

interface EdgeViewProps {
  edge: GraphEdge;
  geometry: EdgeGeometry;
  status: EdgeStatus;
  directed: boolean;
  showWeight: boolean;
  /** Set while this edge is the one being walked; says which way the animation runs. */
  flow: 'forward' | 'reverse' | null;
  onClick: (event: MouseEvent<SVGGElement>) => void;
}

export function EdgeView({ edge, geometry, status, directed, showWeight, flow, onClick }: EdgeViewProps) {
  return (
    <g className={styles.edge} data-status={status} data-flow={flow ?? undefined} onClick={onClick}>
      {/* Wide invisible stroke so thin edges are easy to click. */}
      <path className={styles.edgeHit} d={geometry.path} />
      <path
        className={styles.line}
        d={geometry.path}
        markerEnd={directed ? `url(#${getArrowMarkerId(status)})` : undefined}
      />
      {showWeight && edge.weight !== undefined && (
        <text className={styles.weight} x={geometry.labelX} y={geometry.labelY} textAnchor="middle" dominantBaseline="central">
          {edge.weight}
        </text>
      )}
    </g>
  );
}
