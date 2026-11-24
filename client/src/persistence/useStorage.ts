import { useContext } from "react";
import type { AppStorage } from "./storage";
import { StorageContext } from "./storageContext";

export function useStorage(): AppStorage {
    const storage = useContext(StorageContext);
    if (storage === null) {
        throw new Error('useStorage must be used inside a <StorageProvider>');
    }
    return storage;
}