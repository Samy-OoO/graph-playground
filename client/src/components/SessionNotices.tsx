import type { DocumentSession } from '../hooks/useDocumentSession';
import type { UnsavedGuard } from '../hooks/useUnsavedGuard';
import { pluralize } from '../utils/math';
import styles from './SessionNotices.module.css';
import { Button } from './ui/Button';

interface SessionNoticesProps {
    session: DocumentSession;
    guard: UnsavedGuard;
}


export function SessionNotices({ session, guard }: SessionNoticesProps) {
    const { pending, recoverableGraph } = session;

    return (
        <>
            {!session.persistent && (
                <p className={styles.notice} data-tone="warning" role="status">
                    This browser is not letting the app store anything, so your graphs will be lost when you close or refresh the page.
                </p>
            )}
            
            {session.problem && (
                <div className={styles.notice} data-tone="error" role="alert">
                    <span>{session.problem}</span>
                    <Button onClick={session.dismissProblem}>Dismiss</Button>
                </div>
            )}

            {recoverableGraph && (
                <div className={styles.notice} data-tone="warning" role="group" aria-label="Unsaved graph found">
                    <span>
                        You have an unsaved graph from an earlier visit: “{recoverableGraph.document.name}” (
                            {pluralize(recoverableGraph.document.graph.nodes.length, 'node')},{' '}
                            {pluralize(recoverableGraph.document.graph.edges.length, 'edge')}.
                            {session.recoverableCount > 1 && ` ${session.recoverableCount - 1} more after this one.`})
                    </span>
                    <div className={styles.actions}>
                        <Button variant="primary" onClick={() => guard.run(() => session.recover(recoverableGraph))}>
                            Recover it
                        </Button>
                        <Button onClick={() => void session.discardRecoverable(recoverableGraph)}>Discard it</Button>
                    </div>
                </div>
            )}

            {pending && (
                <div className={styles.notices} data-tone="warning" role="group" aria-label="Unsaved work found">
                    <span>
                        {pending.verdict === 'restore'
                        ? `“${session.name}” has unsaved changes from an earlier visit.`
                        : `“${session.name}” was saved again after these unsaved changes were started, maybe in another tab. Keeping your unsaved version and saving will replace the newer saved one.`}
                    </span>

                    <div className={styles.actions}>
                        <Button variant="primary" onClick={session.restoreDraft}>
                            {pending.verdict === 'restore' ? 'Restore changes' : 'Use my unsaved version'}
                        </Button>
                        <Button onClick={() => void session.discardDraft()}>
                            {pending.verdict === 'restore' ? 'Discard them' : 'Keep the saved version'}
                        </Button>
                    </div>
                </div>
            )}
        </>
    )
}