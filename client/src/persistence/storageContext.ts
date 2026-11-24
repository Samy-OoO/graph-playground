import { createContext } from 'react';
import type { AppStorage } from './storage';

export const StorageContext = createContext<AppStorage | null>(null);

