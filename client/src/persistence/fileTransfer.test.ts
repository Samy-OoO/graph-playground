// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocument } from './convert';
import { downloadText, fileNameFor, readGraphFile, serializeDocument } from './fileTransfer';
import { LIMITS } from '@graph-playground/shared';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const doc = createDocument(
  { directed: true, weighted: false, nodes: [{ id: 'a', x: 1, y: 2, label: 'A' }], edges: [] },
  'Road trip',
  'd1',
  new Date('2026-10-31T09:00:00.000Z'),
);

describe('fileNameFor', () => {
  it('turns a graph name into a safe file name', () => {
    expect(fileNameFor('Road trip #2')).toBe('road-trip-2.json');
    expect(fileNameFor('  Ünïcode / slashes \\ here  ')).toBe('n-code-slashes-here.json');
  });

  it('falls back to "graph" when nothing usable is left', () => {
    expect(fileNameFor('!!!')).toBe('graph.json');
    expect(fileNameFor('')).toBe('graph.json');
  });
});

describe('serializeDocument', () => {
  it('produces text that reads back as the same document', () => {
    expect(JSON.parse(serializeDocument(doc))).toEqual(doc);
  });

  it('is indented so a person can read it', () => {
    expect(serializeDocument(doc)).toContain('\n  "schemaVersion": 1');
  });
});

describe('downloadText', () => {
  it('offers the text to the browser as a named file', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake-address');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    let downloaded: { name: string; href: string } | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = { name: this.download, href: this.href };
    });

    downloadText('road-trip.json', '{"hello":"world"}');

    expect(downloaded).toEqual({ name: 'road-trip.json', href: 'blob:fake-address' });
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(await blob.text()).toBe('{"hello":"world"}');
    expect(document.querySelector('a[download]')).toBeNull(); // the temporary link was removed
  });
});

describe('readGraphFile', () => {
  it('reads and checks a good file', async () => {
    const file = new File([serializeDocument(doc)], 'road-trip.json', { type: 'application/json' });
    const result = await readGraphFile(file);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.name).toBe('Road trip');
  });

  it('reports a file that is not a graph, without throwing', async () => {
    const result = await readGraphFile(new File(['hello'], 'notes.txt'));
    expect(result).toEqual({ ok: false, errors: ['The file is not valid JSON.'] });
  });

  it('refuses a file that is too large before reading it', async () => {
    const file = new File(['{}'], 'big.json');
    Object.defineProperty(file, 'size', { value: LIMITS.maxFileBytes + 1 });
    const read = vi.spyOn(file, 'text');

    const result = await readGraphFile(file);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/too large/);
    expect(read).not.toHaveBeenCalled();
  });

  it('reports a file the browser cannot read', async () => {
    const file = new File(['{}'], 'locked.json');
    vi.spyOn(file, 'text').mockRejectedValue(new Error('denied'));
    expect(await readGraphFile(file)).toEqual({ ok: false, errors: ['The file could not be read.'] });
  });
});