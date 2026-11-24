import type { DocumentSession } from "../../hooks/useDocumentSession";

type StatusInfo = Pick<DocumentSession, 'status' | 'isSaved' | 'draftSavedAt'>;

function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function describeStatus({ status, isSaved, draftSavedAt }: StatusInfo): string {
    switch (status) {
        case 'saving':
            return 'Saving…';
        case 'error':
            return 'Could not save';
        case 'unsaved':
            return draftSavedAt ? `Unsaved changes (draft kept at ${formatTime(draftSavedAt)})` : 'Unsaved changes';
        case 'saved':
            return isSaved ? 'All changes saved' : 'New graph';
    }
}

export type StatusTone = 'saved' | 'new' | 'unsaved' | 'saving' | 'error';

// Which colour the little dot beside the status words takes.
export function statusTone({ status, isSaved }: Pick<DocumentSession, 'status' | 'isSaved'>): StatusTone {
  if (status === 'saved') return isSaved ? 'saved' : 'new';
  return status;
}