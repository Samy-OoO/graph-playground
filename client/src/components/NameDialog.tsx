import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import styles from './NameDialog.module.css';
import { LIMITS } from "../persistence/limits";
import { Button } from "./ui/Button";

interface NameDialogProps {
    open: boolean;
    title: string;
    label: string;
    initialName: string;
    submitLabel: string;
    children?: ReactNode;
    onSubmit: (name: string) => void;
    onCancel: () => void;
}

interface NameFormProps extends Omit<NameDialogProps, 'open'> {
    titleId: string;
}

function NameForm({ title, titleId, label, initialName, submitLabel, children, onSubmit, onCancel }: NameFormProps) {
    const [name, setName] = useState(initialName);

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        if (name.trim() !== '') onSubmit(name);
    }

    return (
        <form className={styles.form} onSubmit={handleSubmit}>
            <h2 id={titleId} className={styles.title}>
                {title}
            </h2>
            {children && <p className={styles.description}>{children}</p>}
            <label className={styles.label}>
                {label}
                <input
                    className={styles.input} 
                    value={name} 
                    maxLength={LIMITS.maxNameLength} 
                    autoFocus 
                    onFocus={(event) => event.target.select()} 
                    onChange={(event) => setName(event.target.value)}
                />
            </label>
            <div className={styles.actions}>
                <Button onClick={onCancel}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={name.trim() === ''}>
                    {submitLabel}
                </Button>
            </div>
        </form>
    );
}

export function NameDialog({ open, onCancel, ...form }: NameDialogProps) {
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
                onCancel();
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget) onCancel();
            }}
        >
            {open && <NameForm {...form} titleId={titleId} onCancel={onCancel} />}
        </dialog>
    );
}