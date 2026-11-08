import type { MouseEvent, PointerEvent } from 'react';
import type { NodeStatus } from '../../algorithms/types';
import { NODE_RADIUS } from '../../constants';
import type { GraphNode } from '../../types/graph';
import styles from './canvas.module.css';

interface NodeViewProps {
  node: GraphNode;
  status: NodeStatus;
  selected: boolean;
  isEdgeSource: boolean;
  cursor: string;
  onPointerDown: (event: PointerEvent<SVGGElement>) => void;
  onClick: (event: MouseEvent<SVGGElement>) => void;
}

export function NodeView({ node, status, selected, isEdgeSource, cursor, onPointerDown, onClick }: NodeViewProps) {
  return (
    <g
      className={styles.node}
      data-status={status}
      data-selected={selected}
      data-edge-source={isEdgeSource}
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <circle className={styles.circle} cx={node.x} cy={node.y} r={NODE_RADIUS} />
      <text className={styles.nodeLabel} x={node.x} y={node.y} textAnchor="middle" dominantBaseline="central">
        {node.label}
      </text>
    </g>
  );
}
