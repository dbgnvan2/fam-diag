import { describe, it, expect } from 'vitest';
import type { Person } from '../types';
import { buildSessionEventDraft, findMentionedPerson, isSessionNoteDirty } from './sessionNoteEvents';
import { normalizeEventForSave, saveEventOnOwner } from './eventDraft';

const people: Person[] = [
  { id: 'p1', name: 'Mary', x: 0, y: 0, partnerships: [] },
  { id: 'p2', name: 'Al', x: 0, y: 0, partnerships: [] },
  { id: 'p3', name: 'Ann Lee', x: 0, y: 0, partnerships: [] },
  { id: 'p4', name: 'Ann', x: 0, y: 0, partnerships: [] },
];

describe('buildSessionEventDraft', () => {
  const draft = () =>
    buildSessionEventDraft({
      snippet: '  Mary says in 1987 she also moved away  ',
      target: { type: 'person', id: 'p1' },
      people,
      partnerships: [],
      emotionalLines: [],
    });

  it('invents nothing: no date from a year in the text, no ratings (regression: 1987-01-01, intensity 5)', () => {
    expect(draft()).toMatchObject({ date: '', startDate: '', intensity: 0, howWell: 0, category: '' });
  });

  it('is anchored to its target and records the note text', () => {
    expect(draft()).toMatchObject({
      anchorType: 'PERSON',
      anchorId: 'p1',
      eventClass: 'individual',
      primaryPersonName: 'Mary',
      observations: 'Mary says in 1987 she also moved away',
    });
  });

  it('once saved, it has every field the event invariant requires', () => {
    const saved = normalizeEventForSave(
      { ...draft(), category: 'Relocation', startDate: '1987-06-01', date: '1987-06-01' },
      { anchorType: 'PERSON', anchorId: 'p1', eventClass: 'individual' }
    );
    const updates = saveEventOnOwner({ kind: 'person', id: 'p1' }, people[0], saved);
    const stored = (updates as { events: typeof saved[] }).events[0];
    expect(stored).toMatchObject({
      date: '1987-06-01',
      startDate: '1987-06-01',
      anchorType: 'PERSON',
      anchorId: 'p1',
      eventClass: 'individual',
    });
    expect(stored.createdAt).toBeGreaterThan(0);
    expect(typeof stored.subtype).toBe('string');
  });
});

describe('findMentionedPerson', () => {
  it('matches whole words only (regression: "Al" matched "also")', () => {
    expect(findMentionedPerson('she also moved', people)).toBeUndefined();
    expect(findMentionedPerson('Al moved', people)?.id).toBe('p2');
  });

  it('prefers the longer name and skips the target person', () => {
    expect(findMentionedPerson('talked to Ann Lee', people)?.id).toBe('p3');
    expect(findMentionedPerson('Mary and Ann', people, 'p1')?.id).toBe('p4');
  });
});

describe('isSessionNoteDirty', () => {
  const blank = { coachName: '', clientName: '', presentingIssue: '', noteContent: '' };
  it('a never-saved note is dirty once it has any content', () => {
    expect(isSessionNoteDirty(blank, null)).toBe(false);
    expect(isSessionNoteDirty({ ...blank, noteContent: 'x' }, null)).toBe(true);
  });
  it('a saved note is dirty when it differs from the record', () => {
    const saved = { ...blank, noteContent: 'x' };
    expect(isSessionNoteDirty({ ...blank, noteContent: 'x' }, saved)).toBe(false);
    expect(isSessionNoteDirty({ ...blank, noteContent: 'xy' }, saved)).toBe(true);
  });
});
