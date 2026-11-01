import { z } from 'zod';
import { LIMITS } from './limits';
import { CURRENT_SCHEMA_VERSION, documentSchema, type GraphDocument } from './schema';

export type ParseResult = { ok: true; document: GraphDocument } | { ok: false; errors: string[] };

const MAX_REPORTED_ERRORS = 5;

// Only looks at the version, so we can decide what to do before checking everything else.
const versionProbe = z.object({ schemaVersion: z.number().int().positive() });

function fail(...errors: string[]): ParseResult {
    return { ok: false, errors };
}

function formatPath(path: PropertyKey[]): string {
    return path
        .map((part, index) => (typeof part === 'number' ? `[${part}]` : index === 0 ? String(part) : `.${String(part)}`))
        .join('');
}

export function parseDocumentData(data: unknown): ParseResult {
    const probe = versionProbe.safeParse(data);
    if (!probe.success) {
        return fail('This does not look like a Graph Playground file (missing or invalid schemaVersion).');
    }

    const { schemaVersion } = probe.data;
    if (schemaVersion > CURRENT_SCHEMA_VERSION) {
        return fail(`This file was made by a newer version of the app (file version ${schemaVersion}, this app understands up to ${CURRENT_SCHEMA_VERSION}).`);
    }

    // Later: files with an older schemaVersion get migrated up to the current one right here, before the validation below.
    const result = documentSchema.safeParse(data);
    if (result.success) return { ok: true, document: result.data };

    const messages = result.error.issues.map((issue) => {
        const where = formatPath(issue.path);
        return where ? `${where}: ${issue.message}` : issue.message;
    });
    const shown = messages.slice(0, MAX_REPORTED_ERRORS);
    const hidden = messages.length - shown.length;
    if (hidden > 0) shown.push(`...and ${hidden} more problem${hidden === 1 ? '' : 's'}`);
    return fail(...shown);
}

    // For raw text, such as the contents of an imported file.
    export function parseDocumentText(text: string): ParseResult {
        const bytes = new TextEncoder().encode(text).length;
        if (bytes > LIMITS.maxFileBytes) {
            return fail(`The file is too large (the limit is ${LIMITS.maxFileBytes / (1024 * 1024)} MB).`);
        }

        let data: unknown;
        try {
            data = JSON.parse(text);
        } catch {
            return fail('The file is not valid JSON.');
        }

        return parseDocumentData(data);
    }