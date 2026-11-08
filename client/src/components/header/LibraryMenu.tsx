import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Copy, Download, FolderOpen, Pencil, Trash2, Upload } from "lucide-react";
import type { DocumentSession } from "../../hooks/useDocumentSession";
import type { UnsavedGuard } from "../../hooks/useUnsavedGuard";
import type { GraphSummary } from "../../persistence/repository";
import { pluralize } from "../../utils/math";
import { useStorage } from "../../persistence/useStorage";
import { deleteGraph, duplicateGraph, renameGraph } from "../../persistence/libraryOperations";
import styles from './header.module.css';
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ConfirmDialog";
import { downloadText, fileNameFor, readGraphFile, serializeDocument } from "../../persistence/fileTransfer";
import { thumbnailSrc } from "../../persistence/thumbnail";
import { NameDialog } from "../NameDialog";

interface LibraryMenuProps {
    session: DocumentSession;
    guard: UnsavedGuard;
}

function describeGraph(graph: GraphSummary): string {
    return `${pluralize(graph.nodeCount, 'node')}, ${pluralize(graph.edgeCount, 'edge')} · ${new Date(graph.updatedAt).toLocaleDateString()}`;
}

function describeProblem(problem: unknown, fallback: string): string {
    return problem instanceof Error ? problem.message : fallback;
}

// "My graphs": an icon in the title bar that opens a list of saved graphs.
export function LibraryMenu({ session, guard }: LibraryMenuProps) {
    const storage = useStorage();
    const panelId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [open, setOpen] = useState(false);
    const [graphs, setGraphs] = useState<GraphSummary[] | null>(null);
    const [reloads, setReloads] = useState(0);
    const [toDelete, setToDelete] = useState<GraphSummary | null>(null);
    const [toRename, setToRename] = useState<GraphSummary | null>(null);
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

    // Close the panel with Esc, or by clicking outside it.
    const questionOpen = toDelete !== null || toRename !== null;
    useEffect(() => {
        if (!open) return;
        const closeOnOutsideClick = (event: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            // While a question is showing, Escape belongs to that question.
            if (event.key === 'Escape' && !questionOpen) setOpen(false);
        };
        document.addEventListener('pointerdown', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open, questionOpen]);

    const reload = () => setReloads((count) => count + 1);

    async function confirmDelete() {
        const target = toDelete;
        setToDelete(null);
        if (target === null) return;
        try {
            await deleteGraph(storage, target.id);
            setError(null);
            if (target.id === session.id) session.newGraph();
            reload();
        } catch (problem) {
            setError(describeProblem(problem, 'The graph could not be deleted.'));
        }
    }

    async function duplicate(graph: GraphSummary) {
        try {
            await duplicateGraph(storage, graph.id);
            setError(null);
            reload();
        } catch(problem) {
            setError(describeProblem(problem, 'The graph could not be duplicated.'));
        }
    }

    async function rename(name: string) {
        const target = toRename;
        setToRename(null);
        if (target === null) return;
        try {
            if (target.id === session.id) {
                // The open graph is renamed on screen, and saved with the next Save like any other edit.
                session.setName(name);
            } else {
                await renameGraph(storage, target.id, name);
                reload();
            }
            setError(null);
        } catch (problem) {
            setError(describeProblem(problem, 'The graph could not be renamed.'));
        }
    }

    function exportCurrentGraph() {
        const document = session.snapshot();
        downloadText(fileNameFor(document.name), serializeDocument(document));
        setOpen(false);
    }

    async function importFile(event: ChangeEvent<HTMLInputElement>) {
        const input = event.target;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;

        // Check the file first, so the user is only asked about unsaved changes for a file that will work.
        const result = await readGraphFile(file);
        if (!result.ok) {
            session.reportProblem(`Could not import "${file.name}": ${result.errors.join(' ')}`);
            return;
        }
        guard.run(() => session.importDocument(result.document));
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
                                        <img className={styles.thumbnail} src={thumbnailSrc(graph.thumbnail)} alt="" />
                                        <span className={styles.itemText}>
                                            <span className={styles.itemName}>{graph.name}</span>
                                            <span className={styles.itemMeta}>{describeGraph(graph)}</span>
                                        </span>
                                    </button>
                                    <Button
                                        icon={Pencil}
                                        aria-label={`Rename ${graph.name}`}
                                        title="Rename"
                                        onClick={() => setToRename(graph)}
                                    />
                                    <Button
                                        icon={Copy}
                                        aria-label={`Duplicate ${graph.name}`}
                                        title="Duplicate (copies the last saved version)"
                                        onClick={() => void duplicate(graph)}
                                    />
                                    <Button 
                                        variant="danger"
                                        icon={Trash2}
                                        aria-label={`Delete ${graph.name}`}
                                        title="Delete"
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

                    <div className={styles.footer}>
                        <Button icon={Upload} onClick={() => fileInputRef.current?.click()}>
                            Import file
                        </Button>
                        <Button icon={Download} onClick={exportCurrentGraph}>
                            Export this graph
                        </Button>
                    </div>
                </section>
            )}

            {/* Outside the panel, so choosing a file still works after the panel has closed. */}
            <input 
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                aria-label="Import graph file"
                hidden
                onChange={(event) => void importFile(event)}
            />

            <NameDialog
                open={toRename !== null}
                title="Rename graph"
                label="New name"
                initialName={toRename?.name ?? ''}
                submitLabel="Rename"
                onCancel={() => setToRename(null)}
                onSubmit={(name) => void rename(name)}
            >
                {toRename?.id === session.id && 'This graph is open, so the new name is saved with your next Save.'}
            </NameDialog>

            <ConfirmDialog
                open={toDelete !== null}
                title={`Delete “${toDelete?.name ?? ''}”?`}
                onCancel={() => setToDelete(null)}
                actions={[{ label: 'Delete', variant: 'danger', onClick: () => void confirmDelete() }]}
            >
                This graph, and any unsaved changes to it, will be removed forever.
            </ConfirmDialog>
        </div>
    );
}