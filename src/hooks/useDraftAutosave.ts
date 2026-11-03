import { useEffect, useRef, useState } from "react";
import { autosaveDraft, type SessionInfo } from "../persistence/sessionOperations";
import type { AppStorage } from "../persistence/storage";
import type { GraphData } from "../types/graph";
import { hasUnsavedChanges } from "../persistence/session";

export const AUTOSAVE_DELAY_MS = 1500;

type AutosaveInput = {
    stores: Pick<AppStorage, 'repository' | 'drafts'>;
    info: SessionInfo;
    graph: GraphData;
    enabled: boolean;
    delayMs: number;
};

// Writes a draft of the unsaved work shortly after the user stops editing.
// Returns when the draft was last written for the open graph, or null.

export function useDraftAutosave({ stores, info, graph, enabled, delayMs }: AutosaveInput): Date | null {
    const [lastWritten, setLastWritten] = useState<{ id: string; at: Date } | null>(null);
    const draftWrittenFor = useRef<string | null>(null);

    useEffect (() => {
        if (!enabled) return;

        const working = { name: info.name, graph };
        const dirty = hasUnsavedChanges(working, info.saved);
        if (!dirty && draftWrittenFor.current !== info.id) return;

        const write = async () => {
            try {
                const outcome = await autosaveDraft(stores, info, working);
                if (outcome === 'written') {
                    draftWrittenFor.current = info.id;
                    setLastWritten({ id: info.id, at: new Date() });
                } else {
                    draftWrittenFor.current = null;
                    setLastWritten(null);
                }
            } catch (e) {
                console.warn('Autosave could not update the draft: ', e);
            }
        };

        // Every change runs this effect again, and the cleanup below cancels the previous timer.
        // So the write only happens once the edits have stopped for `delayMs`. That is a debounce.
        const timer = setTimeout(write, delayMs);

        // When the tab is hidden (switched away, minimised, closing) there may be no later chance.
        const writeNowIfHidden = () => {
            if (document.visibilityState === 'hidden') {
                clearTimeout(timer);
                void write();
            }
        };
        document.addEventListener('visibilitychange', writeNowIfHidden);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', writeNowIfHidden);
        };
    }, [enabled, delayMs, stores, info, graph]);

    return lastWritten !== null && lastWritten.id === info.id ? lastWritten.at : null;
}
