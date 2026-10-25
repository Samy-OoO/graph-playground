import { CirclePlus, CircleX, GitBranch, MousePointer2, Move } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ToolId } from './types/editor';

export interface ToolDefinition {
  id: ToolId;
  label: string;
  icon: LucideIcon;
  /** Single-key shortcut (lowercase). */
  hotkey: string;
  /** One line shown under the canvas while the tool is active. */
  hint: string;
}

export const TOOLS: ToolDefinition[] = [
  { id: 'select', label: 'Select', icon: MousePointer2, hotkey: 'v', hint: 'Click a node to select it. Press Delete to remove it.' },
  { id: 'add-node', label: 'Add node', icon: CirclePlus, hotkey: 'n', hint: 'Click anywhere on the canvas to place a node.' },
  { id: 'add-edge', label: 'Add edge', icon: GitBranch, hotkey: 'e', hint: 'Click a source node, then click the node it should point to.' },
  { id: 'move', label: 'Move', icon: Move, hotkey: 'm', hint: 'Drag a node to reposition it.' },
  { id: 'delete', label: 'Delete', icon: CircleX, hotkey: 'x', hint: 'Click a node or an edge to remove it.' },
];
