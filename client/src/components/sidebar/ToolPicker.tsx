import { TOOLS } from '../../tools';
import type { ToolId } from '../../types/editor';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import styles from './cards.module.css';

interface ToolPickerProps {
  activeTool: ToolId;
  onSelect: (tool: ToolId) => void;
}

export function ToolPicker({ activeTool, onSelect }: ToolPickerProps) {
  return (
    <Card title="Tools">
      <div className={styles.toolGrid} role="group" aria-label="Editing tools">
        {TOOLS.map((tool) => (
          <Button
            key={tool.id}
            variant="tile"
            icon={tool.icon}
            iconSize={18}
            pressed={activeTool === tool.id}
            title={`${tool.label} (${tool.hotkey.toUpperCase()})`}
            onClick={() => onSelect(tool.id)}
          >
            {tool.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}
