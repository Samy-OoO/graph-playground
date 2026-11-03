import { useEffect, useState, type ReactNode } from 'react';
import { getAppStorage, type AppStorage } from './storage';
import { StorageContext } from './storageContext';

type StorageProviderProps = {
    children: ReactNode;
    // Tests (and anything else that already has a storage) can hand one in instead of opening the real one.
    storage?: AppStorage;
};

export function StorageProvider({ children, storage }: StorageProviderProps) {
    const [opened, setOpened] = useState<AppStorage | null>(null);

    useEffect(() => {
        if (storage) return;

        let cancelled = false;
        getAppStorage().then((result) => {
            if (!cancelled) setOpened(result);
        });
        return () => {
            cancelled = true;
        };
    }, [storage]);

    const current = storage ?? opened;
    if (!current) return null;
    
    return <StorageContext.Provider value={current}>{children}</StorageContext.Provider>;
}