import { FilePlus, RotateCcw, Save } from "lucide-react";
import type { DocumentSession } from "../../hooks/useDocumentSession";
import type { UnsavedGuard } from "../../hooks/useUnsavedGuard";
import { LIMITS } from "../../persistence/limits";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import styles from './documents.module.css';
import { describeStatus } from "./documentStatus";
import { ConfirmDialog } from "../ConfirmDialog";
import { useState } from "react";

interface DocumentCardProps {
    session: DocumentSession;
    guard: UnsavedGuard;
}

export function DocumentCard({ session, guard }: DocumentCardProps) {
    const [confirmingRevert, setConfirmingRevert] = useState(false);

    const canSave = session.status !== 'saving' && (session.dirty || session.status === 'error');

    return (
        <Card title="Document">
            <div className={styles.stack}>
                <div className={styles.field}>
                    <label htmlFor="graph-name">Graph name</label>
                    <input 
                        id="graph-name"
                        className={styles.input}
                        value={session.name}
                        maxLength={LIMITS.maxNameLength}
                        onChange={(event) => session.setName(event.target.value)}
                    />
                </div>

                <p className={styles.status} data-status={session.status} role="status">
                    {describeStatus(session)}
                </p>

                <div className={styles.buttons}>
                    <Button variant="primary" icon={Save} disabled={!canSave} onClick={() => void session.save()}>
                        Save
                    </Button>
                    <Button icon={RotateCcw} disabled={!session.dirty} onClick={() => setConfirmingRevert(true)}>
                        Revert
                    </Button>
                    <Button icon={FilePlus} onClick={() => guard.run(session.newGraph)}>
                        New graph
                    </Button>
                </div>
            </div>

            <ConfirmDialog
                open={confirmingRevert}
                title="Discard your changes?"
                onCancel={() => setConfirmingRevert(false)}
                actions={[
                    {
                        label: 'Discard changes',
                        variant: 'danger',
                        onClick: () => {
                            setConfirmingRevert(false);
                            void session.revert();
                        },
                    },
                ]}
            >
                Everything since the last save will be thrown away.
            </ConfirmDialog>
        </Card>
    );
}