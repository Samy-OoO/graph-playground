import { describe, expect, it } from 'vitest';
import { describeStatus, statusTone } from './documentStatus';

describe('describeStatus', () => {
  it('says a never-saved, untouched graph is new', () => {
    expect(describeStatus({ status: 'saved', isSaved: false, draftSavedAt: null })).toBe('New graph');
  });

  it('says a saved graph has all changes saved', () => {
    expect(describeStatus({ status: 'saved', isSaved: true, draftSavedAt: null })).toBe('All changes saved');
  });

  it('mentions the draft once one has been kept', () => {
    expect(describeStatus({ status: 'unsaved', isSaved: true, draftSavedAt: null })).toBe('Unsaved changes');
    expect(describeStatus({ status: 'unsaved', isSaved: true, draftSavedAt: new Date() })).toMatch(/Unsaved changes \(draft kept at .+\)/);
  });

  it('reports saving and failure', () => {
    expect(describeStatus({ status: 'saving', isSaved: true, draftSavedAt: null })).toBe('Saving…');
    expect(describeStatus({ status: 'error', isSaved: true, draftSavedAt: null })).toBe('Could not save');
  });
});

describe('statusTone', () => {
  it('is green for a saved graph and grey for a new one with nothing to save', () => {
    expect(statusTone({ status: 'saved', isSaved: true })).toBe('saved');
    expect(statusTone({ status: 'saved', isSaved: false })).toBe('new');
  });

  it('follows the status when there is something to say', () => {
    expect(statusTone({ status: 'unsaved', isSaved: true })).toBe('unsaved');
    expect(statusTone({ status: 'saving', isSaved: true })).toBe('saving');
    expect(statusTone({ status: 'error', isSaved: false })).toBe('error');
  });
});