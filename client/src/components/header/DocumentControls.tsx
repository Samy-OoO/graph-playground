import { Copy, FilePlus, RotateCcw, Save } from "lucide-react";
import type { DocumentSession } from "../../hooks/useDocumentSession";
import type { UnsavedGuard } from "../../hooks/useUnsavedGuard";
import { LIMITS } from "@graph-playground/shared";
import { Button } from "../ui/Button";
import styles from './header.module.css';
import { describeStatus, statusTone } from "./documentStatus";
import { ConfirmDialog } from "../ConfirmDialog";
import { useState } from "react";
import { copyName } from "../../persistence/session";
import { NameDialog } from "../NameDialog";

interface DocumentControlsProps {
    session: DocumentSession;
    guard: UnsavedGuard;
}

export function DocumentControls({ session, guard }: DocumentControlsProps) {
    const [confirmingRevert, setConfirmingRevert] = useState(false);
    const [namingCopy, setNamingCopy] = useState(false);

    const canSave = session.status !== 'saving' && (session.dirty || session.status === 'error');

    return (
        <div className={styles.controls}>
            <input
                className={styles.nameInput}
                aria-label="Graph name"
                placeholder="Graph name"
                value={session.name}
                maxLength={LIMITS.maxNameLength}
                onChange={(event) => session.setName(event.target.value)}
            />

            <p className={styles.status} data-status={session.status} role="status">
                <span className={styles.dot} data-tone={statusTone(session)} data-testid="status-dot" aria-hidden="true" />
                {describeStatus(session)}
            </p>

            <div className={styles.buttons}>
                <Button variant="primary" icon={Save} disabled={!canSave} onClick={() => void session.save()}>
                    Save
                </Button>
                <Button icon={Copy} disabled={session.status === 'saving'} onClick={() => setNamingCopy(true)}>
                    Save a copy
                </Button>
                <Button icon={RotateCcw} disabled={!session.dirty} onClick={() => setConfirmingRevert(true)}>
                    Revert
                </Button>
                <Button icon={FilePlus} onClick={() => guard.run(session.newGraph)}>
                    New graph
                </Button>
            </div>

            <NameDialog
                open={namingCopy}
                title="Save a copy"
                label= "Name for the copy"
                initialName={copyName(session.name)}
                submitLabel="Save copy"
                onCancel={() => setNamingCopy(false)}
                onSubmit={(name) => {
                    setNamingCopy(false);
                    void session.saveAs(name);
                }}
            >
                The copy gets everything you see now, including unsaved changes. The original stays as it was last saved.
            </NameDialog>

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
        </div>
    );
}