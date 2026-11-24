import { describe, expect, it } from 'vitest';
import { createDocument } from './convert';
import { createDraft, draftSchema } from './draft';

const emptyGraph = { directed: true, weighted: false, nodes: [], edges: [] };
const doc = createDocument(emptyGraph, 'Work in progress', 'd1', new Date('2026-10-31T09:00:00.000Z'));

describe('createDraft', () => {
  it('wraps the document with its base version and the time of drafting', () => {
    const draft = createDraft(doc, '2026-10-31T08:00:00.000Z', new Date('2026-10-31T09:30:00.000Z'));
    expect(draft).toEqual({
      document: doc,
      basedOn: '2026-10-31T08:00:00.000Z',
      draftedAt: '2026-10-31T09:30:00.000Z',
    });
  });

  it('produces a draft that passes the schema, with or without a base version', () => {
    expect(draftSchema.safeParse(createDraft(doc, null)).success).toBe(true);
    expect(draftSchema.safeParse(createDraft(doc, '2026-10-31T08:00:00.000Z')).success).toBe(true);
  });
});

describe('draftSchema', () => {
  it('rejects a draft whose base version is not a real date', () => {
    expect(draftSchema.safeParse({ ...createDraft(doc, null), basedOn: 'earlier' }).success).toBe(false);
  });

  it('rejects a draft whose document breaks a graph rule', () => {
    const broken = {
      ...createDraft(doc, null),
      document: { ...doc, graph: { ...emptyGraph, edges: [{ id: 'e1', source: 'x', destination: 'y' }] } },
    };
    expect(draftSchema.safeParse(broken).success).toBe(false);
  });
});