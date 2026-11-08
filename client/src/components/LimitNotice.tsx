import { LIMITS } from '@graph-playground/shared';
import styles from './SessionNotices.module.css';

interface LimitNoticeProps {
    nodeCount: number;
    edgeCount: number;
}

// Explains why nothing happens when a graph is as big as it is allowed to get.
export function LimitNotice({ nodeCount, edgeCount }: LimitNoticeProps) {
    const messages: string[] = [];
    if (nodeCount >= LIMITS.maxNodes) {
        messages.push(`This graph has reached its limit of ${LIMITS.maxNodes} nodes, so no more can be added.`);
    }
    if (edgeCount >= LIMITS.maxEdges) {
        messages.push(`This graph has reached the limit of ${LIMITS.maxEdges} edges, so no more can be added.`);
    }
    if (messages.length === 0) return null;

    return (
        <p className={styles.notice} data-tone="warning" role="status">
            {messages.join(' ')}
        </p>
    );
}