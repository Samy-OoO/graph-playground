import { AdjacencyPanel } from './components/AdjacencyPanel';
import { AlgorithmPicker } from './components/AlgorithmPicker';
import { AppHeader } from './components/AppHeader';
import { CanvasPanel } from './components/CanvasPanel';
import { Sidebar } from './components/sidebar/Sidebar';
import { WeightDialog } from './components/WeightDialog';
import { useAlgorithm } from './hooks/useAlgorithm';
import { useGraph } from './hooks/useGraph';
import { useGraphEditor } from './hooks/useGraphEditor';
import styles from './App.module.css';
import { SessionNotices } from './components/SessionNotices';
import { useDocumentSession } from './hooks/useDocumentSession';
import { useUnsavedGuard } from './hooks/useUnsavedGuard';
import { ConfirmDialog } from './components/ConfirmDialog';

/**
 * App only wires things together:
 *   useGraph        – the graph's data and how it can change
 *   useGraphEditor  – tools, selection, dragging
 *   useAlgorithm    – which algorithm runs, and playback of its steps
 */
export default function App() {
  const graph = useGraph();
  const editor = useGraphEditor(graph);
  const algorithm = useAlgorithm(graph);
  const session = useDocumentSession(graph);
  const guard = useUnsavedGuard(session);

  return (
    <main className={styles.app}>
      <AppHeader />

      <SessionNotices session={session} />

      <div className={styles.workspace}>
        <AdjacencyPanel graph={graph.data} />
        <CanvasPanel graph={graph} editor={editor} algorithm={algorithm} />
        <Sidebar graph={graph} editor={editor} algorithm={algorithm} session={session} guard={guard} />
      </div>

      <AlgorithmPicker selected={algorithm.definition} onSelect={algorithm.select} />

      <WeightDialog
        open={editor.pendingEdge !== null}
        onSubmit={editor.confirmEdgeWeight}
        onCancel={editor.cancelEdge}
      />

      <ConfirmDialog
        open={guard.asking}
        title="Unsaved changes"
        onCancel={guard.cancel}
        actions={[
          { label: 'Save and continue', variant: 'primary', onClick: () => void guard.saveAndContinue() },
          { label: 'Discard changes', variant: 'danger', onClick: () => void guard.discardAndContinue() },
        ]}
      >
        "${session.name}" has changes that are not saved yet.
      </ConfirmDialog>
    </main>
  );
}
