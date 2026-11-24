import { AUTH_LIMITS, loginSchema, registerSchema } from "@graph-playground/shared";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import styles from './AuthDialog.module.css';
import { Button } from "./ui/Button";
import { useAuth } from "../auth/useAuth";

type Mode = 'login' | 'register';

interface AuthDialogProps {
    open: boolean;
    // Why the dialog opened on its own, if it did (for example: the session ended).
    notice?: string | null;
    onClose: () => void;
}

interface AuthFormProps {
    titleId: string;
    notice: string | null;
    onClose: () => void;
}

function AuthForm({ titleId, notice, onClose }: AuthFormProps) {
    const auth = useAuth();
    const [mode, setMode] = useState<Mode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [problem, setProblem] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const registering = mode === 'register';

    function switchMode() {
        setMode(registering ? 'login' : 'register');
        setProblem(null);
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (pending) return;

        // The same rules the server applies, checked first so mistakes are explained without a round trip.
        // The server checks again anyway: this is a convenience, never the protection.
        const parsed = (registering ? registerSchema : loginSchema ).safeParse({ email, password });
        if (!parsed.success) {
            setProblem(parsed.error.issues.map((issue) => issue.message).join(' '));
            return;
        }

        setPending(true);
        setProblem(null);
        const outcome = registering ? await auth.register(parsed.data) : await auth.login(parsed.data);
        setPending(false);

        if (outcome.ok) onClose();
        else setProblem(outcome.message);
    }

    return (
        <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
            <h2 id={titleId} className={styles.title}>
                {registering ? 'Create an account' : 'Sign in' }
            </h2>

            {notice && (
                <p className={styles.notice} role="status">{notice}</p>
            )}

            <label className={styles.label}>
                Email
                <input 
                    className={styles.input}
                    type="email"
                    autoComplete="username"
                    autoFocus
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                />
            </label>

            <label className={styles.label}>
                Password
                <input
                    className={styles.input}
                    type="password"
                    // Tells the browser's password manager whether to fill in a saved password or offer to save a new one.
                    autoComplete={registering ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                />
            </label>

            {registering && <p className={styles.hint}>At least {AUTH_LIMITS.minPasswordLength} characters.</p>}

            {problem && (
                <p className={styles.error} role="alert">
                    {problem}
                </p>
            )}

            <button type="button" className={styles.switch} onClick={switchMode}>
                {registering ? 'I already have an account' : 'Create an account'}
            </button>

            <div className={styles.actions}>
                <Button onClick={onClose}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={pending}>
                    {pending ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}
                </Button>
            </div>
        </form>
    );
}


// Sign in or create an account. Built like NameDialog: a real <dialog>, with the form inside it mounted only
// while it is open, so every opening starts with empty fields.
export function AuthDialog({ open, notice = null, onClose }: AuthDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);

    return (
        <dialog
            ref={dialogRef}
            className={styles.dialog}
            aria-labelledby={titleId}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            {open && <AuthForm titleId={titleId} notice={notice} onClose={onClose} />}
        </dialog>
    );
}