import { ALGORITHMS } from '../algorithms';
import type { AlgorithmDefinition, AlgorithmId } from '../algorithms/types';
import { Button } from './ui/Button';
import styles from './AlgorithmPicker.module.css';

interface AlgorithmPickerProps {
  selected: AlgorithmDefinition;
  onSelect: (id: AlgorithmId) => void;
}

export function AlgorithmPicker({ selected, onSelect }: AlgorithmPickerProps) {
  return (
    <section className={styles.panel} aria-labelledby="algorithms-title">
      <h2 id="algorithms-title" className={styles.title}>
        Algorithms
      </h2>

      <div className={styles.list} role="group" aria-label="Choose an algorithm">
        {ALGORITHMS.map((algorithm) => (
          <Button
            key={algorithm.id}
            pressed={algorithm.id === selected.id}
            disabled={algorithm.comingSoon}
            title={algorithm.comingSoon ? 'Coming soon' : undefined}
            onClick={() => onSelect(algorithm.id)}
          >
            {algorithm.label}
            {algorithm.comingSoon && <span className={styles.soon}>Soon</span>}
          </Button>
        ))}
      </div>

      {selected.summary && (
        <p className={styles.summary}>
          {selected.summary} <span className={styles.complexity}>Time: {selected.complexity}</span>
        </p>
      )}
    </section>
  );
}
