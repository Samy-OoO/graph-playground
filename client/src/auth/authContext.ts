import { createContext } from 'react';
import type { LoginInput, PublicUser, RegisterInput } from '@graph-playground/shared';
import type { AuthOutcome } from './authApi';

// Why a guest is a guest, when it is worth telling them.
export type AuthNotice = 'session-ended';

export type AuthState = | { status: 'loading' } // Still asking the server who is signed in.
                        // Nobody is signed in. Graphs stay in this browser.                        
                        | { status: 'guest'; notice: AuthNotice | null }
                        | { status: 'signedIn'; user: PublicUser };

export type AuthContextValue = {
    available: boolean;
    state: AuthState;
    login(input: LoginInput): Promise<AuthOutcome>;
    register(input: RegisterInput): Promise<AuthOutcome>;
    // Resolves to a message if signing out did not work, or null when it did.
    logout(): Promise<string | null>;
    // Called when the server says the session is no longer valid.
    sessionEnded(): void;
    // The person who has seen the notice.
    dismissNotice(): void;
};

const withoutAccounts: AuthContextValue = {
    available: false, 
    state: { status: 'guest', notice: null }, 
    login: async () => ({ ok: false, message: 'Accounts are not available here.' }), 
    register: async () => ({ ok: false, message: 'Accounts are not available here.' }), 
    logout: async () => null, 
    sessionEnded: () => {}, 
    dismissNotice: () => {}, 
};

export const AuthContext = createContext<AuthContextValue>(withoutAccounts);