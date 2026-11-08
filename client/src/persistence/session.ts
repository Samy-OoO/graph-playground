import type { GraphData } from "../types/graph";
import { extractGraph } from "./convert";
import type { Draft } from "./draft";
import type { GraphDocument } from "@graph-playground/shared";
import { LIMITS } from '@graph-playground/shared';

export const DEFAULT_GRAPH_NAME = 'Untitled graph';

export function normalizeName(name: string): string {
    const trimmed = name.trim();
    if (trimmed === '') return DEFAULT_GRAPH_NAME;
    return trimmed.slice(0, LIMITS.maxNameLength).trimEnd();
}

const COPY_SUFFIX = ' (copy)';

// "Graph" becomes "Graph (copy)"
export function copyName(name: string): string {
    const room = LIMITS.maxNameLength - COPY_SUFFIX.length;
    return normalizeName(name).slice(0, room).trimEnd() + COPY_SUFFIX;
}

export type WorkingCopy = {
    name: string;
    graph: GraphData;
};


export function contentKey(copy: WorkingCopy): string {
    return JSON.stringify({ name: copy.name.trim(), graph: extractGraph(copy.graph) });
}

export function hasUnsavedChanges(copy: WorkingCopy, saved: GraphDocument | null): boolean {
    if (saved === null) {
        return copy.graph.nodes.length > 0 || copy.name.trim() !== DEFAULT_GRAPH_NAME;
    }
    return contentKey(copy) !== contentKey(saved);
}

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';
export type SaveActivity = 'idle' | 'saving' | 'failed';

export function getSaveStatus(dirty: boolean, activity: SaveActivity): SaveStatus {
    if (activity === 'saving') return 'saving';
    if (activity === 'failed') return 'error';
    return dirty ? 'unsaved' : 'saved';
}

export type DraftVerdict = 'restore' | 'discard' | 'conflict';

export function classifyDraft(draft: Draft, saved: GraphDocument | null): DraftVerdict {
    const work = draft.document;

    if (saved === null) {
        return hasUnsavedChanges(work, null) ? 'restore' : 'discard';
    }
    if (contentKey(work) === contentKey(saved)) return 'discard';
    if (draft.basedOn === saved.updatedAt) return 'restore';
    return 'conflict';
}