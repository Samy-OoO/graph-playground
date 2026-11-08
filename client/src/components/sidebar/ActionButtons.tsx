import { FolderOpen, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import styles from './cards.module.css';

interface ActionButtonsProps {
  onLoadSample: () => void;
  onClear: () => void;
}

export function ActionButtons({ onLoadSample, onClear }: ActionButtonsProps) {
  return (
    <Card title="Graph">
      <div className={styles.actions}>
        <Button variant="primary" icon={FolderOpen} onClick={onLoadSample}>
          Load sample
        </Button>
        <Button variant="danger" icon={Trash2} onClick={onClear}>
          Clear graph
        </Button>
      </div>
    </Card>
  );
}
