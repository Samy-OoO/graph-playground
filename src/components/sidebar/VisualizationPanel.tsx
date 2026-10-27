import type { AlgorithmApi } from '../../hooks/useAlgorithm';
import type { GraphNode } from '../../types/graph';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { PlaybackControls } from './PlaybackControls';
import { StructureView } from './StructureView';
import styles from './VisualizationPanel.module.css';

interface VisualizationPanelProps {
  nodes: GraphNode[];
  algorithm: AlgorithmApi;
}

export function VisualizationPanel({ nodes, algorithm }: VisualizationPanelProps) {
  const { definition, player, step } = algorithm;

  return (
    <Card title="Visualization">
      {definition.generateSteps === null ? (
        <p className={styles.hint}>Choose an algorithm below to watch it run step by step.</p>
      ) : (
        <div className={styles.body}>
          {definition.randomStart ? (
              <p className={styles.hint}>{definition.startHint ?? 'Starts from a random node each time you generate the steps.'}</p>
            ) : (
            <div className={styles.field}>
              <label htmlFor="start-node">Start node</label>
              <select
                id="start-node"
                className={styles.select}
                value={algorithm.startNodeId}
                disabled={nodes.length === 0}
                onChange={(event) => algorithm.setStartNodeId(event.target.value)}
              >
                <option value="">{nodes.length === 0 ? 'Add a node first' : 'Choose a node'}</option>
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button variant="primary" onClick={algorithm.run} disabled={!algorithm.canRun}>
            Generate {definition.label} steps
          </Button>

          {algorithm.wasInvalidated && !step && (
            <p className={styles.hint}>The graph changed, so the previous run was cleared. Generate it again to continue.</p>
          )}

          {step && (
            <>
              <PlaybackControls player={player} speed={algorithm.speed} onSpeedChange={algorithm.setSpeed} />
              {step.structure && <StructureView structure={step.structure} />}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
