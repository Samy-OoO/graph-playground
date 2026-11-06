import { useCallback, useState, useEffect } from "react";
import type { GraphDocument } from '../persistence/schema';
import type { Draft } from '../persistence/draft';
import { 
    applyDraft, 
    buildDocument, 
    findRecoverableDrafts, 
    openedFromImport, 
    openGraph, 
    recoverFromDraft, 
    revertGraph, 
    saveGraph, 
    saveGraphAs, 
    startNewGraph, 
    type OpenedGraph, 
    type PendingDraft, 
    type SessionInfo 
} from "../persistence/sessionOperations";
import { useStorage } from "../persistence/useStorage";
import type { GraphApi } from "./useGraph";
import { getSaveStatus, hasUnsavedChanges, type SaveActivity } from "../persistence/session";
import { AUTOSAVE_DELAY_MS, useDraftAutosave } from "./useDraftAutosave";

type SessionOptions = {
    // For how long must editing stop before draft is written?
    autosaveDelayMs?: number;
};

function describeProblem(error: unknown): string {
    return error instanceof Error ? error.message : 'Something went wrong.';
}

export function useDocumentSession(graph: GraphApi, { autosaveDelayMs = AUTOSAVE_DELAY_MS }: SessionOptions = {}) {
    const storage = useStorage();
    const { replaceGraph } = graph;

    const [info, setInfo] = useState<SessionInfo>(() => startNewGraph().info);
    const [activity, setActivity] = useState<SaveActivity>('idle');
    const [problem, setProblem] = useState<string | null>(null);
    const [pending, setPending] = useState<PendingDraft | null>(null);
      // Unsaved graphs left over from an earlier visit, found once when the app starts.
    const [recoverable, setRecoverable] = useState<Draft[]>([]);
    // Goes up whenever a save changes what is stored, so lists of saved graphs know to reload.
    const [libraryRevision, setLibraryRevision] = useState(0);

    const dirty = hasUnsavedChanges({ name: info.name, graph: graph.data }, info.saved);
    const status = getSaveStatus(dirty, activity);

    // While a draft is waiting for the user's decision, or a save is running, autosave stays out of the way.
    const draftSavedAt = useDraftAutosave({
        stores: storage,
        info,
        graph: graph.data,
        enabled: pending === null && activity !== 'saving',
        delayMs: autosaveDelayMs,
    });

    useEffect(() => {
        let cancelled = false;
        findRecoverableDrafts(storage)
            .then((found) => {
                if (!cancelled) setRecoverable(found);
            })
            .catch((error: unknown) => console.warn('Could not look for unsaved graphs from an earlier visit:', error));
        return () => { cancelled = true; };
    }, [storage]);

    // Puts a graph into the editor and makes it the open one.
    const load = useCallback(
        (opened: OpenedGraph) => {
            setInfo(opened.info);
            replaceGraph(opened.graph);
            setActivity('idle');
            setProblem(null);
        },
        [replaceGraph],
    );

    const setName = useCallback((name: string) => {
        setInfo((cur) => ({ ...cur, name }));
    }, []);

    const newGraph = useCallback(() => {
        load(startNewGraph());
        setPending(null);
    }, [load]);

    const open = useCallback(
        async (id: string): Promise<boolean> => {
            try {
                const result = await openGraph(storage, id);
                load(result.opened);
                setPending(result.pending);
                return true;
            } catch (e) {
                setProblem(describeProblem(e));
                return false;
            }
        },
        [storage, load],
    );

    const save = useCallback(async (): Promise<boolean> => {
        if (activity === 'saving') return false;
        setActivity('saving');
        setProblem(null);

        try {
            const next = await saveGraph(storage, info, { name: info.name, graph: graph.data });

            // Only take over the new saved snapshot. A name typed while the save was running stays,
            // and so does a different graph that was opened in the meantime.
            setInfo((cur) => (cur.id === next.id ? { ...cur, saved: next.saved } : cur ));
            setPending(null);
            setActivity('idle');
                  setLibraryRevision((revision) => revision + 1);
            return true;
        }
        catch (e) {
            setActivity('failed');
            setProblem(describeProblem(e));
            return false;
        }
    }, [activity, storage, info, graph.data]);


    const saveAs = useCallback(
        async (newName: string): Promise<boolean> => {
            if (activity === 'saving') return false;
            setActivity('saving');
            setProblem(null);

            try {
                const next = await saveGraphAs(storage, info, { name: info.name, graph: graph.data }, newName);
                setInfo(next);
                setPending(null);
                setActivity('idle');
                      setLibraryRevision((revision) => revision + 1);
                return true;
            } catch (e) {
                setActivity('failed');
                setProblem(describeProblem(e));
                return false;
            }
        },
        [activity, storage, info, graph.data],
    );

    const revert = useCallback(async (): Promise<boolean> => {
        try {
            load(await revertGraph(storage, info));
            setPending(null);
            return true;
        } catch (e) {
            setProblem(describeProblem(e));
            return false;
        }
    }, [storage, info, load]);


    // The user chose to bring back the unsaved work found when the graph was opened.
    const restoreDraft = useCallback(() => {
        if (pending === null) return;

        // The opened graph is what the editor holds right now, so only the draft's content is needed.
        load(applyDraft({ info, graph: graph.data }, pending.draft));
        setPending(null);
    }, [pending, info, graph.data, load]);

    
    // The user chose to throw away the unsaved work found when the graph was opened.
    const discardDraft = useCallback(async (): Promise<boolean> => {
        try {
            await storage.drafts.delete(info.id);
            setPending(null);
            return true;
        } catch (e) {
            setProblem(describeProblem(e));
            return false;
        }
    }, [storage, info.id]);

    const dismissProblem = useCallback(() => setProblem(null), []);

    // The user chose to bring back an unsaved graph from an earlier visit.
    const recover = useCallback(
        (draft: Draft) => {
            load(recoverFromDraft(draft));
            setPending(null);
            setRecoverable((list) => list.filter((item) => item.document.id !== draft.document.id));
        },
        [load],
    );

    // The user chose to throw away an unsaved graph from an earlier visit.
    const discardRecoverable = useCallback(
        async (draft: Draft): Promise<boolean> => {
            try {
                await storage.drafts.delete(draft.document.id);
                setRecoverable((list) => list.filter((item) => item.document.id !== draft.document.id));
                return true;
            } catch (error) {
                setProblem(describeProblem(error));
                return false;
            }
        }, [storage],
    );

    // Lets other parts of the page (like file import) show a message in the problem banner.
    const reportProblem = useCallback((message: string) => setProblem(message), []);

    // Makes a graph from an imported file the open graph. It is new and not saved until the user saves.
    const importDocument = useCallback(
        (document: GraphDocument) => {
            load(openedFromImport(document));
            setPending(null);
        },
        [load],
    );

    // What saving would write right now, including unsaved changes. Used for exporting.
    const snapshot = useCallback(
        (): GraphDocument => buildDocument(info, { name: info.name, graph: graph.data }),
        [info, graph.data],
    );

    return {
        id: info.id,
        name: info.name,
        isSaved: info.saved !== null,
        status,
        dirty,
        problem,
        pending,
        draftSavedAt,
        recoverableGraph: recoverable[0] ?? null,
        recoverableCount: recoverable.length,
        libraryRevision,
        persistent: storage.persistent,
        setName,
        newGraph,
        open,
        save,
        saveAs,
        revert,
        restoreDraft,
        discardDraft,
        dismissProblem,
        reportProblem, 
        recover, 
        discardRecoverable, 
        importDocument, 
        snapshot, 
    };
}

export type DocumentSession = ReturnType<typeof useDocumentSession>;