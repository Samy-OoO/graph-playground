import type { LegendItem } from '../algorithms/types';
import styles from './Legend.module.css';

export function Legend({ items }: { items: LegendItem[] }) {
  if (items.length === 0) return null;

  return (
    <ul className={styles.legend} aria-label="Legend">
      {items.map((item) => (
        <li key={`${item.kind}-${item.status}`} className={styles.item}>
          <span className={item.kind === 'node' ? styles.nodeSwatch : styles.edgeSwatch} data-status={item.status} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
