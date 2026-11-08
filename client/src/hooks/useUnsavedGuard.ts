import { useCallback, useState } from "react";
import type { DocumentSession } from "./useDocumentSession";

type Continuation = () => void | Promise<unknown>;

export function useUnsavedGuard(session: DocumentSession) {
    const [waiting, setWaiting] = useState<Continuation | null>(null);
    const { dirty, save, discardDraft } = session;

    const run = useCallback(
        (action: Continuation) => {
            if (!dirty) {
                void action();
                return;
            }
            // Wrapped in a function: React treats a function passed to a setter as an "updater".
            setWaiting(() => action);
        },
        [dirty],
    );
    
    const cancel = useCallback(() => setWaiting(null), []);

    const saveAndContinue = useCallback(async () => {
        const action = waiting;
        setWaiting(null);
        if (action === null) return;
        if (await save()) await action();
    }, [waiting, save]);

    const discardAndContinue = useCallback(async () => {
        const action = waiting;
        setWaiting(null);
        if (action == null) return;
        await discardDraft();
        await action();
    }, [waiting, discardDraft]);

    return { run, asking: waiting !== null, cancel, saveAndContinue, discardAndContinue };
}

export type UnsavedGuard = ReturnType<typeof useUnsavedGuard>;