import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from './ConfirmDialog.module.css';
import { Button } from "./ui/Button";

type ConfirmAction = {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'danger' | 'secondary';
};

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    children: ReactNode;
    // The choices beside cancel, which is always offered.
    actions: ConfirmAction[];
    onCancel: () => void;
}

// A question with a few answers. Built like WeightDialog.
export function ConfirmDialog({ open, title, children, actions, onCancel }: ConfirmDialogProps) {
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
                event.preventDefault(); // we close it ourselves, via `open`
                onCancel();
            }}
            onClick={(event) => {
                if (event.target === event.currentTarget) onCancel(); // click on the backdrop
            }}
        >
            {open && (
                <div className={styles.body}>
                    <h2 id={titleId} className={styles.title}>
                        {title}
                    </h2>
                    <div className={styles.message}>{children}</div>
                    <div className={styles.actions}>
                        <Button onClick={onCancel}>Cancel</Button>
                        {actions.map((action) => (
                            <Button key={action.label} variant={action.variant ?? 'secondary'} onClick={action.onClick}>
                                {action.label}
                            </Button>
                        ))}
                    </div>
                </div>
            )}
        </dialog>
    )
}