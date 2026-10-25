import { useState } from 'react';
import { getAlgorithm } from '../algorithms';
import type { AlgorithmId, AlgorithmStep } from '../algorithms/types';
import { SPEED } from '../constants';
import type { GraphApi } from './useGraph';
import { useStepPlayer } from './useStepPlayer';

/** Which algorithm is selected, where it starts, and the playback of its steps. */
export function useAlgorithm(graph: GraphApi) {
  const [selectedId, setSelectedId] = useState<AlgorithmId>('none');
  const [startNodeId, setStartNodeId] = useState('');
  const [speed, setSpeed] = useState<number>(SPEED.initial);
  const [runVersion, setRunVersion] = useState<number | null>(null);
  const [wasInvalidated, setWasInvalidated] = useState(false);

  const player = useStepPlayer<AlgorithmStep>(1000 / speed);
  const definition = getAlgorithm(selectedId);

  // A run describes one specific graph. If the graph's structure changes, the run no longer
  // matches what is on screen, so drop it. (Adjusting state during render is React's
  // documented way to reset state when something it depends on changes.)
  if (runVersion !== null && runVersion !== graph.version) {
    setRunVersion(null);
    setWasInvalidated(true);
    player.clear();
  }

  // The chosen start node may have been deleted since it was picked.
  const validStartNodeId = graph.nodes.some((node) => node.id === startNodeId) ? startNodeId : '';
  const canRun = definition.generateSteps !== null && validStartNodeId !== '';

  function select(id: AlgorithmId) {
    setSelectedId(id);
    setRunVersion(null);
    setWasInvalidated(false);
    player.clear();
  }

  function run() {
    if (!definition.generateSteps || !validStartNodeId) return;
    player.load(definition.generateSteps(graph.data, validStartNodeId));
    setRunVersion(graph.version);
    setWasInvalidated(false);
  }

  return {
    definition,
    selectedId,
    select,
    startNodeId: validStartNodeId,
    setStartNodeId,
    speed,
    setSpeed,
    canRun,
    run,
    wasInvalidated,
    player,
    step: player.currentStep,
  };
}

export type AlgorithmApi = ReturnType<typeof useAlgorithm>;
