import type { GraphDocument } from "@graph-playground/shared";

export class ConflictError extends Error {
    readonly current: GraphDocument;

    constructor(current: GraphDocument) {
        super('This graph was changed somewhere else since you opened it. Reload it to see the latest version.');
        this.name = 'ConflictError';
        this.current = current;
    }
}