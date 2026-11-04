import { useEffect, useId, useRef, useState } from "react";
import type { DocumentSession } from "../../hooks/useDocumentSession";
import type { UnsavedGuard } from "../../hooks/useUnsavedGuard";
import type { GraphSummary } from "../../persistence/repository";
import { pluralize } from "../../utils/math";
import { useStorage } from "../../persistence/useStorage";
import { deleteGraph } from "../../persistence/libraryOperations";
import styles from './header.module.css';
import { Button } from "../ui/Button";
import { FolderOpen, Trash2 } from "lucide-react";
import { ConfirmDialog } from "../ConfirmDialog";

interface LibraryMenuProps {
    session: DocumentSession;
    guard: UnsavedGuard;
}

function describeGraph(graph: GraphSummary): string {
    return `${pluralize(graph.nodeCount, 'node')}, ${pluralize(graph.edgeCount, 'edge')} · ${new Date(graph.updatedAt).toLocaleDateString()}`;
}

// "My graphs": an icon in the title bar that opens a list of saved graphs.
export function LibraryMenu({ session, guard }: LibraryMenuProps) {
    const storage = useStorage();
    const panelId = useId();
    const rootRef = useRef<HTMLDivElement>(null);

    const [open, setOpen] = useState(false);
    const [graphs, setGraphs] = useState<GraphSummary[] | null>(null);
    const [reloads, setReloads] = useState(0);
    const [toDelete, setToDelete] = useState<GraphSummary | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Load the list whenever the panel opens, after every save, and after a delete.
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        storage.repository
            .list()
            .then((list) => {
                if (!cancelled) setGraphs(list);
            })
            .catch((problem: unknown) => {
                console.warn('Could not list the saved graphs: ', problem);
                if (!cancelled) setGraphs([]);
            });
        return () => {
            cancelled = true;
        };
    }, [open, storage, session.libraryRevision, reloads]);

    // Close the panel with Esc, or by clicking outside.
    const deleting = toDelete !== null;
    useEffect(() => {
        if (!open) return;
        const closeOnOutsideClick = (event: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            // While the delete question is showing, Escape belongs to that question.
            if (event.key === 'Escape' && !deleting) setOpen(false);
        };
        document.addEventListener('pointerdown', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open, deleting]);

    async function confirmDelete() {
        const target = toDelete;
        setToDelete(null);
        if (target === null) return;
        try {
            await deleteGraph(storage, target.id);
            setError(null);
            if (target.id === session.id) session.newGraph();
            setReloads((count) => count + 1);
        } catch (problem) {
            setError(problem instanceof Error ? problem.message : 'The graph could not be deleted.');
        }
    }

    return (
        <div className={styles.library} ref={rootRef}>
            <Button
                icon={FolderOpen}
                iconSize={18}
                aria-label="My graphs"
                title="My graphs"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                onClick={() => setOpen((isOpen) => !isOpen)}
            />
            {open && (
                <section id={panelId} className={styles.popover} aria-label="Saved graphs">
                    <h2 className={styles.popoverTitle}>My graphs</h2>

                    {graphs === null ? (
                        <p className={styles.hint}>Loading…</p>
                    ) : graphs.length === 0 ? (
                        <p className={styles.hint}>Nothing saved yet. Build a graph and press Save to keep it here.</p>
                    ) : (
                        <ul className={styles.list}>
                            {graphs.map((graph) => (
                                <li key={graph.id} className={styles.item} data-current={graph.id === session.id}>
                                    <button
                                        type="button"
                                        className={styles.openButton}
                                        aria-label={`Open ${graph.name}`}
                                        aria-current={graph.id === session.id ? 'true' : undefined}
                                        disabled={graph.id === session.id}
                                        onClick={() => {
                                            setOpen(false);
                                            guard.run(() => session.open(graph.id));
                                        }}
                                    >
                                        <span className={styles.itemName}>{graph.name}</span>
                                        <span className={styles.itemMeta}>{describeGraph(graph)}</span>
                                    </button>

                                    <Button 
                                        variant="danger"
                                        icon={Trash2}
                                        aria-label={`Delete ${graph.name}`}
                                        onClick={() => setToDelete(graph)}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}

                    {error && (
                        <p className={styles.error} role="alert">
                            {error}
                        </p>
                    )}
                </section>
            )}

            <ConfirmDialog
                open={toDelete !== null}
                title={`Delete “${toDelete?.name ?? ''}”?`}
                onCancel={() => setToDelete(null)}
                actions={[{ label: 'Delete', variant: 'danger', onClick: () => void confirmDelete() }]}
            >
                This graph, and any unsaved changes to it, will be removed for good.
            </ConfirmDialog>
        </div>
    );
}