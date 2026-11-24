import type { AlgorithmApi } from '../hooks/useAlgorithm';
import type { GraphApi } from '../hooks/useGraph';
import type { EditorApi } from '../hooks/useGraphEditor';
import { TOOLS } from '../tools';
import { pluralize } from '../utils/math';
import { GraphCanvas } from './canvas/GraphCanvas';
import { Legend } from './Legend';
import styles from './CanvasPanel.module.css';

interface CanvasPanelProps {
  graph: GraphApi;
  editor: EditorApi;
  algorithm: AlgorithmApi;
}

export function CanvasPanel({ graph, editor, algorithm }: CanvasPanelProps) {
  const { step, definition } = algorithm;
  const tool = TOOLS.find((candidate) => candidate.id === editor.activeTool);

  // While an algorithm is running the caption explains the step; otherwise it hints at the active tool.
  let caption = tool?.hint ?? '';
  if (editor.activeTool === 'add-edge' && editor.edgeSourceId !== null) {
    caption = 'Now click the node it should point to. Press Esc to cancel.';
  }
  if (step) caption = step.message;

  return (
    <section className={styles.panel} aria-label="Canvas">
      <header className={styles.header}>
        <h2 className={styles.title}>Canvas</h2>
        <span className={styles.counts}>
          {pluralize(graph.nodes.length, 'node')}, {pluralize(graph.edges.length, 'edge')}
        </span>
      </header>

      <GraphCanvas graph={graph} editor={editor} step={step} />

      <footer className={styles.footer}>
        <p className={styles.caption} data-running={step !== null} aria-live="polite">
          {caption}
        </p>
        {step && <Legend items={definition.legend} />}
      </footer>
    </section>
  );
}
