import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import type { UnsavedGuard } from "../../hooks/useUnsavedGuard";
import styles from './account.module.css';
import { Button } from "../ui/Button";
import { LogIn, LogOut, User } from "lucide-react";
import { AuthDialog } from "../AuthDialog";

interface AccountMenuProps {
    guard: UnsavedGuard;
}

// The account control in the title bar: "Sign in" for a guest, a small menu with "Sign out" for a signed-in user.
export function AccountMenu({ guard }: AccountMenuProps) {
    const auth = useAuth();
    const panelId = useId();
    const rootRef = useRef<HTMLDivElement>(null);

    const [menuOpen, setMenuOpen] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);

    // Close the menu with Esc, or by clicking outside it.
    useEffect(() => {
        if (!menuOpen) return;
        const closeOnOutsideClick = (event: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) setMenuOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMenuOpen(false);
        };

        document.addEventListener('pointerdown', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [menuOpen]);

     // Without an AuthProvider (or while still finding out who is signed in) there is nothing to show.
    if (!auth.available || auth.state.status === 'loading') return null;

    const { state } = auth;
    const sessionEnded = state.status === 'guest' && state.notice === 'session-ended';
    // The dialog also opens by itself when the session ended, so the person is not left wondering why saving stopped.
    const showDialog = dialogOpen || sessionEnded;

    function closeDialog() {
        setDialogOpen(false);
        auth.dismissNotice();
    }

    async function signOut() {
        const message = await auth.logout();
        setProblem(message);
        if (message === null) setMenuOpen(false);
    }

    return (
        <div className={styles.account} ref={rootRef}>
            {state.status === 'guest' ? (
                // The guard comes first: the graph on screen is about to be replaced by the other storage's graphs.
                <Button icon={LogIn} title="Sign in to save your graphs to an account" onClick={() => guard.run(() => setDialogOpen(true))}>
                    Sign in
                </Button>
            ) : (
                <Button 
                    icon={User}
                    iconSize={18}
                    aria-label="Account"
                    title={state.user.email}
                    aria-expanded={menuOpen}
                    aria-controls={menuOpen ? panelId : undefined}
                    onClick={() => setMenuOpen((isOpen) => !isOpen)}
                />
            )}

            {menuOpen && state.status === 'signedIn' && (
                <section id={panelId} className={styles.popover} aria-label="Account">
                    <div>
                        <p className={styles.label}>Signed in as</p>
                        <p className={styles.email}>{state.user.email}</p>
                    </div>
                    <p className={styles.hint}>Your graphs are saved to your account, so you can open them on any device.</p>
                    {problem && (
                        <p className={styles.error} role="alert">
                            {problem}
                        </p>
                    )}
                    <Button icon={LogOut} onClick={() => guard.run(signOut)}>
                        Sign out
                    </Button>
                </section>
            )}

            <AuthDialog
                open={showDialog}
                notice={sessionEnded ? 'Your session ended. Sign in again to keep saving to your account.' : null} 
                onClose={closeDialog}
            />
        </div>
    );
}