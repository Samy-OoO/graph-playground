import { LIMITS } from './limits';
import { parseDocumentText, type ParseResult } from './parse';
import type { GraphDocument } from './schema';

// The text that goes into an exported file. Indented, so it is readable if someone opens it.
export function serializeDocument(document: GraphDocument): string {
    return JSON.stringify(document, null, 2);
}

// "Road trip #2" becomes "road-trip-2.json".
export function fileNameFor(graphName: string): string {
    const slug = graphName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `${slug || 'graph'}.json`;
}

// Hands the browser some text as a file to download.
export function downloadText(fileName: string, text: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();

    // Give the browser a moment to start the download before the address is thrown away.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Reads a file the user picked and checks it, without ever throwing.
export async function readGraphFile(file: File): Promise<ParseResult> {
    // Check the size first.
    if (file.size > LIMITS.maxFileBytes) {
        return { ok: false, errors: [`The file is too large (the limit is ${LIMITS.maxFileBytes / (1024 * 1024)} MB).`] };
    }

    let text: string;
    try {
        text = await file.text();
    } catch {
        return { ok: false, errors: ['The file could not be read.'] };
    }
    return parseDocumentText(text);
}