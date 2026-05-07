import { describe, it, expect } from 'vitest';
import {
  synthesizePersonDateEvents,
  synthesizePartnershipDateEvents,
  synthesizeEmotionalLineDateEvents,
  isSyntheticEventId,
} from './syntheticDateEvents';
import type { Person, Partnership, EmotionalLine, EmotionalProcessEvent } from '../types';

const makePerson = (overrides: Partial<Person> = {}): Person => ({
  id: 'p1',
  name: 'Alice',
  x: 0,
  y: 0,
  gender: 'female',
  partnerships: [],
  events: [],
  ...overrides,
});

const makePartnership = (overrides: Partial<Partnership> = {}): Partnership => ({
  id: 'pr1',
  partner1_id: 'p1',
  partner2_id: 'p2',
  relationshipType: 'married',
  horizontalConnectorY: 0,
  children: [],
  events: [],
  ...overrides,
});

const makeEPL = (overrides: Partial<EmotionalLine> = {}): EmotionalLine => ({
  id: 'epl1',
  person1_id: 'p1',
  person2_id: 'p2',
  relationshipType: 'fusion',
  lineStyle: 'one-line',
  events: [],
  ...overrides,
});

const realBirthEvent = (date = '1985-01-01'): EmotionalProcessEvent => ({
  id: 'real-birth',
  eventType: 'NODAL',
  eventClass: 'individual',
  anchorType: 'PERSON',
  anchorId: 'p1',
  category: 'Birth',
  subtype: '',
  status: 'discrete',
  intensity: 0,
  frequency: 0,
  impact: 0,
  howWell: 0,
  date,
  startDate: date,
  wwwwh: '',
  observations: '',
  primaryPersonName: 'Alice',
  otherPersonName: 'None',
});

describe('synthesizePersonDateEvents', () => {
  it('synthesizes Birth and Death events from date fields when no real events exist', () => {
    const events = synthesizePersonDateEvents(makePerson({
      birthDate: '1985-01-01',
      deathDate: '2050-06-15',
    }));
    expect(events.map((e) => e.category)).toEqual(['Birth', 'Death']);
    expect(events.every((e) => e.id.startsWith('synth-'))).toBe(true);
  });

  it('skips synthesis when a real Birth event already exists', () => {
    const events = synthesizePersonDateEvents(makePerson({
      birthDate: '1985-01-01',
      events: [realBirthEvent()],
    }));
    expect(events.find((e) => e.category === 'Birth')).toBeUndefined();
  });

  it('skips invalid / partial dates', () => {
    const events = synthesizePersonDateEvents(makePerson({
      birthDate: '1985',  // partial — not full ISO
    }));
    expect(events).toHaveLength(0);
  });

  it('returns empty array when no relevant date fields are set', () => {
    expect(synthesizePersonDateEvents(makePerson())).toEqual([]);
  });
});

describe('synthesizePartnershipDateEvents', () => {
  it('synthesizes Marriage / Separation / Divorce / Relationship Started events', () => {
    const events = synthesizePartnershipDateEvents(
      makePartnership({
        relationshipStartDate: '1980-01-01',
        marriedStartDate: '1982-06-01',
        separationDate: '2010-03-01',
        divorceDate: '2011-09-01',
      }),
      'Alice',
      'Bob',
    );
    expect(events.map((e) => e.category).sort()).toEqual([
      'Divorce',
      'Marriage',
      'Relationship Started',
      'Separation',
    ]);
    expect(events.every((e) => e.anchorType === 'RELATIONSHIP_PRL')).toBe(true);
  });

  it('skips synthesis for fields that already have real events', () => {
    const realMarriage: EmotionalProcessEvent = {
      ...realBirthEvent('1982-06-01'),
      id: 'real-marriage',
      category: 'Marriage',
      anchorType: 'RELATIONSHIP_PRL',
      anchorId: 'pr1',
    };
    const events = synthesizePartnershipDateEvents(
      makePartnership({
        marriedStartDate: '1982-06-01',
        events: [realMarriage],
      }),
    );
    expect(events.find((e) => e.category === 'Marriage')).toBeUndefined();
  });
});

describe('synthesizeEmotionalLineDateEvents', () => {
  it('synthesizes Pattern Started / Pattern Ended events', () => {
    const events = synthesizeEmotionalLineDateEvents(
      makeEPL({ startDate: '1990-01-01', endDate: '2000-01-01' }),
      'Alice',
      'Bob',
    );
    expect(events.map((e) => e.category)).toEqual(['Pattern Started', 'Pattern Ended']);
    expect(events.every((e) => e.eventType === 'EPE')).toBe(true);
  });
});

describe('isSyntheticEventId', () => {
  it('detects synthesized event ids by prefix', () => {
    expect(isSyntheticEventId('synth-birth-p1')).toBe(true);
    expect(isSyntheticEventId('real-birth')).toBe(false);
    expect(isSyntheticEventId('xyz')).toBe(false);
  });
});
