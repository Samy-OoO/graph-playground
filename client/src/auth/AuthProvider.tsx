import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createAuthApi, type AuthApi } from "./authApi";
import type { LoginInput, RegisterInput } from "@graph-playground/shared";
import { AuthContext, type AuthContextValue, type AuthState } from "./authContext";

type AuthProviderProps = {
    children: ReactNode;
    // Tests hand in a fake. Normally the real one is used.
    api?: AuthApi;
};


// Knows who is signed in. It asks the server once at startup, and after that it changes only
// when the person signs in, registers, signs out, or the server says the session has ended.
export function AuthProvider({ children, api }: AuthProviderProps) {
    const [authApi] = useState(() => api ?? createAuthApi());
    const [state, setState] = useState<AuthState>({ status: 'loading' });

    useEffect(() => {
        let cancelled = false;
        authApi
            .me()
            .then((user) => {
                if (!cancelled) setState(user ? { status: 'signedIn', user } : { status: 'guest', notice: null });
            })
            .catch((problem: unknown) => {
                // The server being down must never lock anybody out of their own browser's graphs.
                console.warn('Could not find out who is signed in, continuing as a guest.', problem);
                if (!cancelled) setState({ status: 'guest', notice: null });
            });
        return () => {
            cancelled = true;
        };
    }, [authApi]);

    const login = useCallback(
        async (input: LoginInput) => {
            const outcome = await authApi.login(input);
            if (outcome.ok) setState({ status: 'signedIn', user: outcome.user });
            return outcome;
        }, 
        [authApi],
    );

    const register = useCallback(
        async (input: RegisterInput) => {
            const outcome = await authApi.register(input);
            if (outcome.ok) setState({ status: 'signedIn', user: outcome.user });
            return outcome;
        },
        [authApi], 
    );

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch (problem) {
            return problem instanceof Error ? problem.message : 'Could not sign out.';
        }

        setState({ status: 'guest', notice: null });
        return null;
    }, [authApi]);

    // Only matters while somebody is signed in. Many requests can fail at once, and the rest change nothing.
    const sessionEnded = useCallback(() => {
        setState((previous) =>
            previous.status === 'signedIn' ? { status: 'guest', notice: 'session-ended' } : previous,
        );
    }, []);

    const dismissNotice = useCallback(() => {
        setState((previous) => (previous.status === 'guest' ? { status: 'guest', notice: null } : previous));
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({ available: true, state, login, register, logout, sessionEnded, dismissNotice }), 
        [state, login, register, logout, sessionEnded, dismissNotice],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}