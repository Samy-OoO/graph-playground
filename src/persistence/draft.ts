import { z } from 'zod';
import { documentSchema, type GraphDocument } from './schema';

export const draftSchema = z.object({
    document: documentSchema,
    basedOn: z.iso.datetime().nullable(),
    draftedAt: z.iso.datetime(),
});

export type Draft = z.infer<typeof draftSchema>;

// Wraps  working copy s a draft. `basedOn` is the `updatedAt` of the saved graph the work started from, or null if it was never saved.
export function createDraft(document: GraphDocument, basedOn: string | null, now: Date = new Date()): Draft {
    return { document, basedOn, draftedAt: now.toISOString() };
}