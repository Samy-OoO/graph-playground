import type { AlgorithmApi } from '../../hooks/useAlgorithm';
import type { GraphApi } from '../../hooks/useGraph';
import type { EditorApi } from '../../hooks/useGraphEditor';
import { ActionButtons } from './ActionButtons';
import { GraphSettings } from './GraphSettings';
import styles from './Sidebar.module.css';
import { ToolPicker } from './ToolPicker';
import { VisualizationPanel } from './VisualizationPanel';

interface SidebarProps {
  graph: GraphApi;
  editor: EditorApi;
  algorithm: AlgorithmApi;
}

export function Sidebar({ graph, editor, algorithm }: SidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="Controls">
      <ToolPicker activeTool={editor.activeTool} onSelect={editor.setActiveTool} />
      <GraphSettings
        directed={graph.directed}
        weighted={graph.weighted}
        onToggleDirected={graph.toggleDirected}
        onToggleWeighted={graph.toggleWeighted}
      />
      <VisualizationPanel nodes={graph.nodes} algorithm={algorithm} />
      <ActionButtons onLoadSample={graph.loadSample} onClear={graph.clear} />
    </aside>
  );
}
