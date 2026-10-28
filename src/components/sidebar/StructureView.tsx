import type { StructureSnapshot } from '../../algorithms/types';
import styles from './StructureView.module.css';
import { MatrixTable } from './MatrixTable';

/** Shows the helper structure of the current step: the call stack (top first) or the queue (front first). */
export function StructureView({ structure }: { structure: StructureSnapshot }) {
  if (structure.matrix) {
    return(
      <div className={styles.structure}>
        <h3 className={styles.title}>{structure.title}</h3>
        <MatrixTable matrix={structure.matrix} />
      </div>
    );
  }
  const isStack = structure.kind === 'stack';
  const items = isStack ? [...structure.items].reverse() : structure.items;
  const endLabel = isStack ? 'top' : 'front';

  return (
    <div className={styles.structure}>
      <h3 className={styles.title}>{structure.title}</h3>
      {structure.kind !== 'matrix' && (items.length === 0 ? (
        <p className={styles.empty}>Empty</p>
      ) : (
        <ol className={styles.items} data-kind={structure.kind}>
          {items.map((label, position) => (
            // Labels are unique per graph, so they make a stable key.
            <li key={label} className={styles.item} data-end={position === 0}>
              {label}
              {position === 0 && <span className={styles.tag}>{endLabel}</span>}
            </li>
          ))}
        </ol>
      ))}
      {structure.matrix && <MatrixTable matrix={structure.matrix} />}
    </div>
  );
}
