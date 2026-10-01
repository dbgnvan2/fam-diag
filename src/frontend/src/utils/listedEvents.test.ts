import { describe, it, expect } from 'vitest';
import type { EmotionalProcessEvent, Partnership, Person } from '../types';
import { listedPartnershipEvents, listedPersonEvents } from './listedEvents';
import { collectSystemEvents } from './systemEvents';
import { computeFamilyScope, defaultFocusForRoot } from './familyScope';

const event = (overrides: Partial<EmotionalProcessEvent>): EmotionalProcessEvent =>
  ({
    id: 'e',
    date: '2001-01-01',
    startDate: '2001-01-01',
    category: 'Relationship',
    eventType: 'NODAL',
    status: 'discrete',
    intensity: 0,
    howWell: 0,
    otherPersonName: 'None',
    wwwwh: '',
    observations: '',
    eventClass: 'relationship',
    ...overrides,
  }) as EmotionalProcessEvent;

const married: Partnership = {
  id: 'pr',
  partner1_id: 'a',
  partner2_id: 'b',
  horizontalConnectorY: 0,
  relationshipType: 'married',
  relationshipStatus: 'married',
  marriedStartDate: '1990-01-01',
  statusDates: { married: '1990-01-01' },
  children: [],
  events: [
    event({ id: 'status-record', subtype: 'Type changed to Married', date: '2026-09-19', startDate: '2026-09-19' }),
    event({ id: 'real', subtype: 'Moved house together' }),
  ],
};

describe('listed events — one rule for every view (review 2026-09-30 struct-06)', () => {
  it('a partnership lists its real events and its date fields, never its status-change records', () => {
    const ids = listedPartnershipEvents(married, 'A', 'B').map((entry) => entry.id);
    expect(ids).toContain('real');
    expect(ids).not.toContain('status-record');
    expect(ids.some((id) => id !== 'real')).toBe(true); // the synthesized Married date
  });

  it('a person lists one event per date field, and the field companion is not listed twice', () => {
    const person: Person = {
      id: 'p',
      name: 'P',
      x: 0,
      y: 0,
      partnerships: [],
      birthDate: '1950-01-01',
    };
    const listed = listedPersonEvents(person, []);
    const birth = listed.filter((entry) => entry.category === 'Birth');
    expect(birth).toHaveLength(1);
    // A companion stored under the slot's id (it holds the event's notes) is
    // shown through the synthesized event, not as a second row.
    const withCompanion = { ...person, events: [{ ...birth[0], observations: 'notes' }] };
    expect(listedPersonEvents(withCompanion, []).filter((entry) => entry.category === 'Birth')).toHaveLength(1);
  });

  it("a relative's date-field companion is not listed twice on someone else's lane (system events)", () => {
    const dad: Person = { id: 'dad', name: 'Dad', x: 0, y: 0, partnerships: ['prP'], birthSex: 'male', deathDate: '1998-04-01' };
    const mum: Person = { id: 'mum', name: 'Mum', x: 0, y: 0, partnerships: ['prP'], birthSex: 'female' };
    const root: Person = { id: 'root', name: 'Root', x: 0, y: 0, partnerships: [], parentPartnership: 'prP', birthDate: '1970-01-01' };
    const prP: Partnership = { id: 'prP', partner1_id: 'dad', partner2_id: 'mum', horizontalConnectorY: 0, relationshipType: 'married', relationshipStatus: 'married', children: ['root'] };
    const deathSlot = listedPersonEvents(dad, []).find((entry) => entry.category === 'Death')!;
    const dadWithCompanion = { ...dad, events: [{ ...deathSlot, observations: 'sudden' }] };
    const people = [dadWithCompanion, mum, root];
    const scope = computeFamilyScope(people, [prP], 'root', defaultFocusForRoot('root'));
    const result = collectSystemEvents({ personId: 'root', scope, people, partnerships: [prP], now: new Date('2026-09-30T00:00:00Z') });
    const dadDeaths = result.events.filter((entry) => entry.ownerEntityId === 'dad' && entry.event.category === 'Death');
    expect(dadDeaths).toHaveLength(1);
  });
});
