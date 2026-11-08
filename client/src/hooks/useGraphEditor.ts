import { useCallback, useEffect, useState } from 'react';
import { TOOLS } from '../tools';
import type { ToolId } from '../types/editor';
import type { GraphNode, Point } from '../types/graph';
import { clampToCanvas } from '../utils/geometry';
import { canAddEdge } from '../utils/graph';
import type { GraphApi } from './useGraph';

interface DragState {
  nodeId: string;
  /** Where inside the node the pointer grabbed it, so the node doesn't jump to the cursor. */
  offsetX: number;
  offsetY: number;
}

interface PendingEdge {
  source: string;
  destination: string;
}

function existingId(id: string | null, nodes: GraphNode[]): string | null {
  return id !== null && nodes.some((node) => node.id === id) ? id : null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))
  );
}

/**
 * Everything about *interacting* with the graph: which tool is active, what is selected,
 * dragging, and what a click means for each tool. Data changes go through `graph`.
 */
export function useGraphEditor(graph: GraphApi) {
  const { nodes, edges, directed, weighted, addNode, moveNode, deleteNode, deleteEdge, addEdge } = graph;

  const [activeTool, setToolState] = useState<ToolId>('select');
  const [rawSelectedId, setSelectedId] = useState<string | null>(null);
  const [rawEdgeSourceId, setEdgeSourceId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pendingEdge, setPendingEdge] = useState<PendingEdge | null>(null);

  // Ids can go stale when nodes are deleted or the graph is cleared; treat those as "none".
  const selectedNodeId = existingId(rawSelectedId, nodes);
  const edgeSourceId = existingId(rawEdgeSourceId, nodes);

  const setActiveTool = useCallback((tool: ToolId) => {
    setToolState(tool);
    setEdgeSourceId(null);
    setDrag(null);
  }, []);

  // Keyboard: tool shortcuts, Escape to cancel, Delete to remove the selected node.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === 'Escape') {
        setEdgeSourceId(null);
        setSelectedId(null);
        return;
      }
      if (event.key === 'Delete' && selectedNodeId) {
        deleteNode(selectedNodeId);
        return;
      }
      const tool = TOOLS.find((candidate) => candidate.hotkey === event.key.toLowerCase());
      if (tool) setActiveTool(tool.id);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNodeId, deleteNode, setActiveTool]);

  function requestEdge(source: string, destination: string) {
    setEdgeSourceId(null);
    if (!canAddEdge(edges, directed, source, destination)) return;

    if (weighted) setPendingEdge({ source, destination }); // ask for a weight first
    else addEdge(source, destination);
  }

  function confirmEdgeWeight(weight: number) {
    if (pendingEdge) addEdge(pendingEdge.source, pendingEdge.destination, weight);
    setPendingEdge(null);
  }

  function cancelEdge() {
    setPendingEdge(null);
  }

  function onCanvasClick(point: Point) {
    switch (activeTool) {
      case 'add-node': {
        const position = clampToCanvas(point);
        addNode(position.x, position.y);
        break;
      }
      case 'add-edge':
        setEdgeSourceId(null);
        break;
      case 'select':
        setSelectedId(null);
        break;
      default:
        break;
    }
  }

  function onNodePointerDown(node: GraphNode, point: Point) {
    if (activeTool === 'select') setSelectedId(node.id);

    if (activeTool === 'move') {
      setSelectedId(node.id);
      setDrag({ nodeId: node.id, offsetX: node.x - point.x, offsetY: node.y - point.y });
    }
  }

  function onNodeClick(nodeId: string) {
    switch (activeTool) {
      case 'select':
        setSelectedId(nodeId);
        break;
      case 'delete':
        deleteNode(nodeId);
        break;
      case 'add-edge':
        if (edgeSourceId === null) setEdgeSourceId(nodeId);
        else requestEdge(edgeSourceId, nodeId);
        break;
      default:
        break;
    }
  }

  function onEdgeClick(edgeId: string) {
    if (activeTool === 'delete') deleteEdge(edgeId);
  }

  function onPointerMove(point: Point) {
    if (activeTool !== 'move' || !drag) return;
    const position = clampToCanvas({ x: point.x + drag.offsetX, y: point.y + drag.offsetY });
    moveNode(drag.nodeId, position.x, position.y);
  }

  function endDrag() {
    setDrag(null);
  }

  return {
    activeTool,
    setActiveTool,
    selectedNodeId,
    edgeSourceId,
    isDragging: drag !== null,
    pendingEdge,
    confirmEdgeWeight,
    cancelEdge,
    onCanvasClick,
    onNodePointerDown,
    onNodeClick,
    onEdgeClick,
    onPointerMove,
    endDrag,
  };
}

export type EditorApi = ReturnType<typeof useGraphEditor>;
