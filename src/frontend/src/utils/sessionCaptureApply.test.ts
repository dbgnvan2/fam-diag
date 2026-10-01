import { describe, it, expect } from 'vitest';
import type { Partnership, Person } from '../types';
import type { SessionCaptureImportData, SessionCaptureOperation } from '../types/diagramEditor';
import {
  applySessionCaptureOperations,
  matchCapturePerson,
  sessionCaptureSummary,
  withUniqueOperationIds,
} from './sessionCaptureApply';

const person = (id: string, name: string, overrides: Partial<Person> = {}): Person => ({
  id,
  name,
  x: 0,
  y: 0,
  partnerships: [],
  events: [],
  ...overrides,
});
let counter = 0;
const makeId = () => `new-${(counter += 1)}`;
const op = (overrides: Partial<SessionCaptureOperation>): SessionCaptureOperation => ({
  id: 'op',
  type: 'add_person_event',
  ...overrides,
});

describe('session capture apply (review 2026-09-30)', () => {
  it('DE2-01: upsert_partnership creates the partnership and links both partners', () => {
    const result = applySessionCaptureOperations(
      [],
      [],
      [op({ type: 'upsert_partnership', payload: { partner1Name: 'Rowan Lee', partner2Name: 'Sky Lee', relationshipType: 'married' } })],
      makeId
    );
    expect(result.partnerships).toHaveLength(1);
    const [pr] = result.partnerships;
    const rowan = result.people.find((p) => p.name === 'Rowan Lee')!;
    const sky = result.people.find((p) => p.name === 'Sky Lee')!;
    expect([pr.partner1_id, pr.partner2_id].sort()).toEqual([rowan.id, sky.id].sort());
    expect(pr.relationshipType).toBe('married');
    expect(rowan.partnerships).toContain(pr.id);
    expect(sky.partnerships).toContain(pr.id);
    expect(result.applied).toBe(1);
  });

  it('DE2-01: an existing partnership is updated, not duplicated', () => {
    const people = [person('a', 'Ann', { partnerships: ['pr'] }), person('b', 'Bob', { partnerships: ['pr'] })];
    const partnerships: Partnership[] = [
      { id: 'pr', partner1_id: 'a', partner2_id: 'b', horizontalConnectorY: 0, relationshipType: 'dating', relationshipStatus: 'ongoing', children: [] },
    ];
    const result = applySessionCaptureOperations(
      people,
      partnerships,
      [op({ type: 'upsert_partnership', payload: { partner1Name: 'Bob', partner2Name: 'Ann', relationshipType: 'married' } })],
      makeId
    );
    expect(result.partnerships).toHaveLength(1);
    expect(result.partnerships[0].relationshipType).toBe('married');
  });

  it('DE2-02 / capture-04: events are complete, keep no invented category, and an unknown type is refused', () => {
    const people = [person('q', 'Quinlan')];
    const result = applySessionCaptureOperations(
      people,
      [],
      [
        op({ id: 'e1', matchHints: { personName: 'Quinlan' }, payload: { eventType: 'NODAL', observations: 'moved out' } }),
        op({ id: 'e2', matchHints: { personName: 'Quinlan' }, payload: { eventType: 'BOGUS' } }),
      ],
      makeId
    );
    const [event] = result.people[0].events!;
    expect(event).toMatchObject({
      date: '',
      startDate: '',
      anchorType: 'PERSON',
      anchorId: 'q',
      eventClass: 'individual',
      eventType: 'NODAL',
      category: '',
      intensity: 0,
    });
    expect(typeof event.createdAt).toBe('number');
    expect(result.skipped).toEqual([{ id: 'e2', reason: 'unknown event type "BOGUS"' }]);
  });

  it('capture-04: payload values of the wrong type are not copied onto a person', () => {
    const result = applySessionCaptureOperations(
      [],
      [],
      [op({ type: 'upsert_person', payload: { name: 'Pat', birthDate: 1950, deathDate: 'last year' } })],
      makeId
    );
    expect(result.people[0].birthDate).toBeUndefined();
    expect(result.people[0].deathDate).toBeUndefined();
  });

  it('DE2-07: two people who both match a first name are ambiguous; nothing is attached', () => {
    const people = [person('s', 'John Smith'), person('d', 'John Doe')];
    expect(matchCapturePerson(people, { names: ['John'] })).toEqual({ kind: 'ambiguous', names: ['John Smith', 'John Doe'] });
    const result = applySessionCaptureOperations(people, [], [op({ matchHints: { personName: 'John' } })], makeId);
    expect(result.people.every((p) => (p.events || []).length === 0)).toBe(true);
    expect(result.skipped[0].reason).toContain('matches John Smith, John Doe');
    expect(sessionCaptureSummary(result)).toContain('1 not applied');
  });

  it('DE2-07: an exact name wins over a first-name match; non-Latin names match', () => {
    const people = [person('s', 'John Smith'), person('j', 'John'), person('l', '李明')];
    expect(matchCapturePerson(people, { names: ['John'] })).toEqual({ kind: 'found', index: 1 });
    expect(matchCapturePerson(people, { names: ['李明'] })).toEqual({ kind: 'found', index: 2 });
    expect(matchCapturePerson(people, { names: ['Ann'] })).toEqual({ kind: 'none' });
  });

  it('capture-03: repeated operation ids get unique ids so each has its own checkbox', () => {
    const data = {
      kind: 'fam-diag-session-capture',
      version: 1,
      operations: [op({ id: 'op1' }), op({ id: 'op1' }), op({ id: 'op2' })],
    } as SessionCaptureImportData;
    expect(withUniqueOperationIds(data).operations.map((o) => o.id)).toEqual(['op1', 'op1#1', 'op2']);
  });
});
