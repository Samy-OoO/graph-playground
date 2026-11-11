import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createStorage, getAppStorage, storageNameFor, type AppStorage } from './storage';
import { StorageContext } from './storageContext';

type StorageProviderProps = {
    children: ReactNode;
    // Tests (and anything else that already has a storage) can hand one in instead of opening the real one.
    storage?: AppStorage;
    // Who is signed in. null (the default) means a guest: graphs stay in this browser.
    // A user id means graphs are saved to that account on the server.
    userId?: string | null;
    // Called when the server says the session has ended.
    onUnauthorized?: () => void;
};

export function StorageProvider({ children, storage, userId = null, onUnauthorized }: StorageProviderProps) {
    const [opened, setOpened] = useState<{ scope: string; storage: AppStorage } | null>(null);

    // The storage must not be rebuilt just because the parent made a new callback function on a re-render,
    // so the storage calls whatever the latest callback is through this ref.
    const unauthorizedRef = useRef(onUnauthorized);
    useEffect(() => {
        unauthorizedRef.current = onUnauthorized;
    });

    const scope = userId ?? 'guest';

    useEffect(() => {
        if (storage) return;

        let cancelled = false;
        const opening = 
            userId === null
                ? getAppStorage()
                : createStorage(storageNameFor(userId), {
                        useServer: true, 
                        onUnauthorized: () => unauthorizedRef.current?.(),
                });
        opening.then((result) => {
            if (!cancelled) setOpened({ scope, storage: result });
        });
        return () => {
            cancelled = true;
        };
    }, [storage, userId, scope]);

    // Storage that was opened for somebody else (the last user) is never handed to the current one.
    const current = storage ?? (opened?.scope === scope ? opened.storage : null);
    if (!current) return null;
    
    return (
        <StorageContext.Provider key={scope} value={current}>
        {children}
        </StorageContext.Provider>
    );
}