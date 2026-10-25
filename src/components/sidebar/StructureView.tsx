import type { StructureSnapshot } from '../../algorithms/types';
import styles from './StructureView.module.css';

/** Shows the helper structure of the current step: the call stack (top first) or the queue (front first). */
export function StructureView({ structure }: { structure: StructureSnapshot }) {
  const isStack = structure.kind === 'stack';
  const items = isStack ? [...structure.items].reverse() : structure.items;
  const endLabel = isStack ? 'top' : 'front';

  return (
    <div className={styles.structure}>
      <h3 className={styles.title}>{structure.title}</h3>
      {items.length === 0 ? (
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
      )}
    </div>
  );
}
