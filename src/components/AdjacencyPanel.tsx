import { useMemo, useState } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { GraphData } from '../types/graph';
import { cx } from '../utils/cx';
import { formatAdjacencyRows } from '../utils/graph';
import styles from './AdjacencyPanel.module.css';

export function AdjacencyPanel({ graph }: { graph: GraphData }) {
  const [collapsed, setCollapsed] = useState(false);
  const rows = useMemo(() => formatAdjacencyRows(graph), [graph]);
  const ToggleIcon = collapsed ? ChevronsRight : ChevronsLeft;

  return (
    <aside className={cx(styles.panel, collapsed && styles.collapsed)} aria-label="Adjacency list">
      <div className={styles.header}>
        {!collapsed && <h2 className={styles.title}>Adjacency list</h2>}
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setCollapsed((current) => !current)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand adjacency list' : 'Collapse adjacency list'}
        >
          <ToggleIcon size={16} aria-hidden="true" />
        </button>
      </div>

      {!collapsed &&
        (rows.length === 0 ? (
          <p className={styles.empty}>Nodes and their neighbors will be listed here.</p>
        ) : (
          <ul className={styles.list}>
            {rows.map((row) => (
              <li key={row.id} className={styles.row}>
                <strong className={styles.node}>{row.label}</strong>
                <span className={styles.neighbors}>{row.neighbors.length > 0 ? row.neighbors.join(', ') : '—'}</span>
              </li>
            ))}
          </ul>
        ))}
    </aside>
  );
}
