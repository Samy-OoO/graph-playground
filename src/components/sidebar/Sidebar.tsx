import type { AlgorithmApi } from '../../hooks/useAlgorithm';
import type { DocumentSession } from '../../hooks/useDocumentSession';
import type { GraphApi } from '../../hooks/useGraph';
import type { EditorApi } from '../../hooks/useGraphEditor';
import type { UnsavedGuard } from '../../hooks/useUnsavedGuard';
import { ActionButtons } from './ActionButtons';
import { DocumentCard } from './DocumentCard';
import { GraphSettings } from './GraphSettings';
import { LibraryCard } from './LibraryCard';
import styles from './Sidebar.module.css';
import { ToolPicker } from './ToolPicker';
import { VisualizationPanel } from './VisualizationPanel';

interface SidebarProps {
  graph: GraphApi;
  editor: EditorApi;
  algorithm: AlgorithmApi;
  session: DocumentSession;
  guard: UnsavedGuard;
}

export function Sidebar({ graph, editor, algorithm, session, guard }: SidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="Controls">
      <DocumentCard session={session} guard={guard} />
      <LibraryCard session={session} guard={guard} />
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
