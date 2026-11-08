import { createId } from "../utils/id";
import { createDocument } from "./convert";
import type { GraphDocument } from "./schema";
import { copyName, normalizeName } from "./session";
import type { AppStorage } from "./storage";

type Stores = Pick<AppStorage, 'repository' | 'drafts'>;

async function getSavedOrThrow(stores: Stores, id: string): Promise<GraphDocument> {
    const saved = await stores.repository.get(id);
    if (saved == null) {
        throw new Error(`There is no saved graph with the id "${id}".`);
    }
    return saved;
}

// Makes a new saved graph from the last saved version of another one. Unsaved changes are not copied.
export async function duplicateGraph(
    stores: Stores,
    id: string,
    now: Date = new Date(),
    newId: string = createId(),
): Promise<GraphDocument> {
    const original = await getSavedOrThrow(stores, id);
    const copy = createDocument(original.graph, copyName(original.name), newId, now);
    await stores.repository.save(copy);
    return copy;
}


// Renames a saved graph. For the graph that is currently open in the editor, change the working
// name instead, so the rename goes through the normal unsaved-changes and Save flow.

export async function renameGraph(
    stores: Stores,
    id: string,
    newName: string,
    now: Date = new Date(),
): Promise<GraphDocument> {
    const saved = await getSavedOrThrow(stores, id);
    const name = normalizeName(newName);
    if (name === saved.name) return saved;
    
    const renamed: GraphDocument = { ...saved, name, updatedAt: now.toISOString() };
    await stores.repository.save(renamed);

    // Renaming moves updatedAt forward. A leftover draft would then look like it was started from an older version, and be reported as a conflict. Keep it in step with the rename instead.
    const draft = await stores.drafts.get(id);
    if (draft !== null) {
        await stores.drafts.save({
            ...draft,
            basedOn: renamed.updatedAt,
            document: { ...draft.document, name },
        });
    }

    return renamed;
}

// Deletes a saved graph and its draft.
export async function deleteGraph(stores: Stores, id: string): Promise<void> {
    // Draft first: if the second step fails, the graph is still there and the user sees the error.
    // The other order could leave a draft of a deleted graph, which would later be offered back as "unsaved work" the user deliberately threw away.
    await stores.drafts.delete(id);
    await stores.repository.delete(id);
}