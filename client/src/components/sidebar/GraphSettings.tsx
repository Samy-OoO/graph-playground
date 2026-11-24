import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import styles from './cards.module.css';

interface GraphSettingsProps {
  directed: boolean;
  weighted: boolean;
  onToggleDirected: () => void;
  onToggleWeighted: () => void;
}

export function GraphSettings({ directed, weighted, onToggleDirected, onToggleWeighted }: GraphSettingsProps) {
  return (
    <Card title="Graph settings">
      <div className={styles.toggleRow}>
        <Button variant="toggle" pressed={directed} onClick={onToggleDirected}>
          Directed
        </Button>
        <Button variant="toggle" pressed={weighted} onClick={onToggleWeighted}>
          Weighted
        </Button>
      </div>
    </Card>
  );
}
