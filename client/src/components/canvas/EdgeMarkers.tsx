import type { EdgeStatus } from '../../algorithms/types';
import styles from './canvas.module.css';
import { getArrowMarkerId } from './markerIds';

const STATUSES: EdgeStatus[] = ['default', 'active', 'settled', 'skipped'];

/** SVG <marker> definitions for edge arrowheads, one per edge state. */
export function EdgeMarkers() {
  return (
    <>
      {STATUSES.map((status) => (
        <marker
          key={status}
          id={getArrowMarkerId(status)}
          viewBox="0 0 14 14"
          markerWidth="14"
          markerHeight="14"
          markerUnits="userSpaceOnUse"
          refX="14"
          refY="7"
          orient="auto"
        >
          <path className={styles.arrowhead} data-status={status} d="M0,1 L14,7 L0,13 Z" />
        </marker>
      ))}
    </>
  );
}
