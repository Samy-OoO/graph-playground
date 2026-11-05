import type { GraphData } from "../types/graph";
import { createId } from "../utils/id";
import { createDocument, documentToGraph } from "./convert";
import { createDraft, type Draft } from "./draft";
import type { GraphDocument } from "./schema";
import { classifyDraft, DEFAULT_GRAPH_NAME, hasUnsavedChanges, normalizeName, type WorkingCopy } from "./session";
import type { AppStorage } from "./storage";

type Stores = Pick<AppStorage, 'repository' | 'drafts'>;

export type SessionInfo = {
    id: string;
    name: string;
    createdAt: string;
    saved: GraphDocument | null;
};

export type OpenedGraph = {
    info: SessionInfo;
    graph: GraphData;
};

export type PendingDraft = {
    draft: Draft;
    verdict: 'restore' | 'conflict';
};

export type OpenResult = {
    opened: OpenedGraph;
    pending: PendingDraft | null;
};

function blankGraph(): GraphData {
    return { directed: true, weighted: false, nodes: [], edges: [] };
}

export function openedFromDocument(document: GraphDocument): OpenedGraph {
    return {
        info: { id: document.id, name: document.name, createdAt: document.createdAt, saved: document },
        graph: documentToGraph(document),
    };
}

// A graph from an imported file: it always gets a new id, so it can never overwrite the one right now.
export function openedFromImport(
    document: GraphDocument,
    id: string = createId(),
    now: Date = new Date(),
): OpenedGraph {
    return {
        info: { id, name: document.name, createdAt: now.toISOString(), saved: null },
        graph: documentToGraph(document),
    };
}

// A fresh, blank, never-saved graph.
export function startNewGraph(id: string = createId(), now: Date = new Date()): OpenedGraph {
    return {
        info: { id, name: DEFAULT_GRAPH_NAME, createdAt: now.toISOString(), saved: null },
        graph: blankGraph(),
    };
}

// Rebuilds a never-saved graph from its leftover draft (like, after crashes).
export function recoverFromDraft(draft: Draft): OpenedGraph {
    const { document } = draft;
    return {
        info: { id: document.id, name: document.name, createdAt: document.createdAt, saved: null },
        graph: documentToGraph(document),
    };
}

export async function openGraph(stores: Stores, id: string): Promise<OpenResult> {
    const saved = await stores.repository.get(id);
    if (saved === null) throw new Error(`There is no saved graph with the id "${id}".`);

    const opened = openedFromDocument(saved);

    const draft = await stores.drafts.get(id);
    if (draft === null) return { opened, pending: null };

    const verdict = classifyDraft(draft, saved);
    if (verdict === 'discard') {
        await stores.drafts.delete(id);
        return { opened, pending: null };
    }
    return { opened, pending: { draft, verdict } };
}

// The user chose to keep their unsaved work: the draft's content on top of the saved graph.
export function applyDraft(opened: OpenedGraph, draft: Draft): OpenedGraph {
    return {
        info: { ...opened.info, name: draft.document.name },
        graph: documentToGraph(draft.document),
    };
}


export function buildDocument(info: SessionInfo, working: WorkingCopy, now: Date = new Date()): GraphDocument {
    const document = createDocument(working.graph, normalizeName(working.name), info.id, now);
    return { ...document, createdAt: info.createdAt };
}


// Saves the working copy to its graph, and clears the draft.
export async function saveGraph(
    stores: Stores,
    info: SessionInfo,
    working: WorkingCopy,
    now: Date = new Date(),
): Promise<SessionInfo> {
    const document = buildDocument(info, working, now);
    await stores.repository.save(document);

    // The graph is safely saved now. If the draft cannot be removed, that is not worth reporting
    // as a failed save: next time it is opened, the leftover draft is recognised as redundant.
    try {
        await stores.drafts.delete(info.id);
    } catch (error) {
        console.warn('The graph was saved, but its draft could not be removed: ', error);
    }

    return { id: info.id, name: document.name, createdAt: info.createdAt, saved: document };
}


// Saves the working copy as a NEW graph. The original keeps its last saved content.
export async function saveGraphAs(
    stores: Stores,
    info: SessionInfo,
    working: WorkingCopy,
    newName: string,
    now: Date = new Date(),
    newId: string = createId(),
): Promise<SessionInfo> {
    const document = createDocument(working.graph, normalizeName(newName), newId, now);
    await stores.repository.save(document);

    // The unsaved changes move to the new graph, so they must not come back to haunt the original.
    try {
        await stores.drafts.delete(info.id);
    } catch (e) {
        console.warn('The graph was saved, but the old draft could not be removed: ', e);
    }

    return { id: document.id, name: document.name, createdAt: document.createdAt, saved: document };
}

export async function revertGraph(stores: Stores, info: SessionInfo): Promise<OpenedGraph> {
    await stores.drafts.delete(info.id);
    if (info.saved === null) {
        return {
            info: { id: info.id, name: DEFAULT_GRAPH_NAME, createdAt: info.createdAt, saved: null },
            graph: blankGraph(),
        }
    }
    return openedFromDocument(info.saved);
}

export async function autosaveDraft(
    stores: Stores,
    info: SessionInfo,
    working: WorkingCopy,
    now: Date = new Date(),
): Promise<'written' | 'cleared'> {
    if (!hasUnsavedChanges(working, info.saved)) {
        await stores.drafts.delete(info.id);
        return 'cleared';
    }

    const document = buildDocument(info, working, now);
    await stores.drafts.save(createDraft(document, info.saved?.updatedAt ?? null, now));
    return 'written';
}