import { useEffect, useState } from "react";
import type { DocumentSession } from "../../hooks/useDocumentSession";
import type { UnsavedGuard } from "../../hooks/useUnsavedGuard";
import type { GraphSummary } from "../../persistence/repository";
import { pluralize } from "../../utils/math";
import { useStorage } from "../../persistence/useStorage";
import { deleteGraph } from "../../persistence/libraryOperations";
import { Card } from "../ui/Card";
import styles from './documents.module.css';
import { Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ConfirmDialog";


interface LibraryCardProps {
    session: DocumentSession;
    guard: UnsavedGuard;
}

function describeGraph(graph: GraphSummary): string {
    return `${pluralize(graph.nodeCount, 'node')}, ${pluralize(graph.edgeCount, 'edge')} · ${new Date(graph.updatedAt).toLocaleDateString()}`;
}

export function LibraryCard({ session, guard }: LibraryCardProps) {
    const storage = useStorage();
    const [graphs, setGraphs] = useState<GraphSummary[] | null>(null);
    const [reloads, setReloads] = useState(0);
    const [toDelete, setToDelete] = useState<GraphSummary | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        storage.repository
            .list()
            .then((list) => {
                if (!cancelled) setGraphs(list)
            })
        .catch((problem: unknown) => {
            console.warn('Could not list the saved graphs: ', problem);
            if (!cancelled) setGraphs([]);
        });

        return () => {
            cancelled = true;
        };
    }, [storage, session.libraryRevision, reloads]);

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
        <Card title="My graphs">
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
                                onClick={() => guard.run(() => session.open(graph.id))}
                            >
                                <span className={styles.itemName}>{graph.name}</span>
                                <span className={styles.itemMeta}>{describeGraph(graph)}</span>
                            </button>
                            <Button variant="danger" icon= {Trash2} aria-label={`Delete ${graph.name}`} onClick={() => setToDelete(graph)} />
                        </li>
                    ))}
                </ul>
            )}

            {error && (
                <p className={styles.error} role="alert">{error}</p>
            )}

            <ConfirmDialog
                open={toDelete !== null}
                title={`Delete “${toDelete?.name ?? ''}”?`}
                onCancel={() => setToDelete(null)}
                actions={[{ label: 'Delete', variant: 'danger', onClick: () => void confirmDelete() }]}
            >
                This graph, and any unsaved changes to it, will be removed for good.
            </ConfirmDialog>
        </Card>
    );
}