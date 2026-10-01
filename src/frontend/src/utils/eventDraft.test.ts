import { describe, it, expect } from 'vitest';
import type {
  EmotionalLine,
  EmotionalProcessEvent,
  FunctionalIndicatorDefinition,
  Partnership,
  Person,
} from '../types';
import {
  anchorTypeForOwner,
  applyEventDraftFieldChange,
  eventClassForOwner,
  withSyncedDateSlotCompanions,
  buildFamilyEventDraft,
  buildNewEventDraft,
  canonicalFamilyCategory,
  deleteEventFromOwner,
  normalizeEventForSave,
  saveEventOnOwner,
  syncSymptomIndicator,
} from './eventDraft';
import {
  synthesizePartnershipDateEvents,
  synthesizePersonDateEvents,
  synthesizePersonIndicatorEvents,
  withoutDateSlotCompanions,
} from './syntheticDateEvents';

const event = (overrides: Partial<EmotionalProcessEvent> = {}): EmotionalProcessEvent => ({
  id: 'e1',
  date: '2020-01-01',
  startDate: '2020-01-01',
  category: 'Relocation',
  eventType: 'NODAL',
  subtype: '',
  status: 'discrete',
  intensity: 0,
  howWell: 0,
  otherPersonName: 'None',
  wwwwh: '',
  observations: '',
  eventClass: 'individual',
  ...overrides,
});

const person = (overrides: Partial<Person> = {}): Person => ({
  id: 'p1',
  name: 'Ann',
  x: 0,
  y: 0,
  partnerships: [],
  ...overrides,
});

const partnership = (overrides: Partial<Partnership> = {}): Partnership => ({
  id: 'pr1',
  partner1_id: 'p1',
  partner2_id: 'p2',
  horizontalConnectorY: 0,
  relationshipType: 'married',
  relationshipStatus: 'married',
  children: [],
  ...overrides,
});

const context = { anchorType: 'PERSON' as const, anchorId: 'p1', eventClass: 'individual' as const };

describe('applyEventDraftFieldChange', () => {
  it('stores ratings as numbers (regression: the Timeline stored "3")', () => {
    const next = applyEventDraftFieldChange(event(), 'intensity', '3');
    expect(next.intensity).toBe(3);
    expect(applyEventDraftFieldChange(event(), 'howWell', 'x').howWell).toBe(0);
  });

  it('sets date and startDate together, and a cleared date stays cleared', () => {
    const next = applyEventDraftFieldChange(event(), 'startDate', '2021-02-03');
    expect(next).toMatchObject({ date: '2021-02-03', startDate: '2021-02-03' });
    const cleared = applyEventDraftFieldChange(next, 'startDate', '');
    expect(normalizeEventForSave(cleared, context).startDate).toBe('');
    expect(normalizeEventForSave(cleared, context).date).toBe('');
  });

  it('a symptom\'s Type field sets the symptom name (regression: symptomType kept the previous symptom)', () => {
    const draft = event({ eventType: 'SYMPTOM', category: 'Physical', symptomType: 'Back pain', subtype: 'Back pain' });
    const next = applyEventDraftFieldChange(draft, 'subtype', 'Headache');
    expect(next.symptomType).toBe('Headache');
    expect(next.subtype).toBe('Headache');
  });

  it('changing type clears a category that does not fit, instead of picking the first one', () => {
    const next = applyEventDraftFieldChange(event({ eventType: 'SYMPTOM', category: 'Physical' }), 'eventType', 'NODAL');
    expect(next.category).toBe('');
    expect(next.symptomType).toBeUndefined();
  });
});

describe('normalizeEventForSave — every Save creates a complete event', () => {
  it('sets date, startDate, anchorType, anchorId, eventClass, createdAt and numeric ratings', () => {
    const saved = normalizeEventForSave(
      { ...event({ anchorType: undefined, anchorId: undefined, createdAt: undefined }), intensity: '4' as unknown as number },
      context
    );
    expect(saved).toMatchObject({
      date: '2020-01-01',
      startDate: '2020-01-01',
      anchorType: 'PERSON',
      anchorId: 'p1',
      eventClass: 'individual',
      intensity: 4,
    });
    expect(saved.createdAt).toBeGreaterThan(0);
  });

  it('drops the indicator link when a symptom is retyped as another type', () => {
    const saved = normalizeEventForSave(event({ eventType: 'NODAL', sourceIndicatorId: 'def-1' }), context);
    expect(saved.sourceIndicatorId).toBeUndefined();
    const symptom = normalizeEventForSave(
      event({ eventType: 'SYMPTOM', category: 'physical', subtype: 'Cough', sourceIndicatorId: 'def-1' }),
      context
    );
    expect(symptom).toMatchObject({ sourceIndicatorId: 'def-1', category: 'Physical', symptomType: 'Cough' });
  });
});

describe('syncSymptomIndicator — blocker B1', () => {
  const definitions: FunctionalIndicatorDefinition[] = [{ id: 'back', label: 'Back pain', group: 'physical' }];

  it('a new symptom name never links to the first symptom in its group (regression: overwrote Back pain)', () => {
    const owner = person({
      functionalIndicators: [{ definitionId: 'back', status: 'current', impact: 2, frequency: 2, intensity: 2 }],
    });
    const ensured: string[] = [];
    const result = syncSymptomIndicator(
      owner,
      event({ eventType: 'SYMPTOM', category: 'Physical', subtype: 'Headache', symptomType: 'Headache', intensity: 5 }),
      definitions,
      (label) => {
        ensured.push(label);
        return 'headache';
      }
    );
    expect(ensured).toEqual(['Headache']);
    expect(result.event.sourceIndicatorId).toBe('headache');
    const back = result.functionalIndicators?.find((entry) => entry.definitionId === 'back');
    expect(back).toMatchObject({ intensity: 2, impact: 2, frequency: 2 });
  });

  it('a symptom with no name is not linked to anything', () => {
    const result = syncSymptomIndicator(person(), event({ eventType: 'SYMPTOM', category: 'Physical', subtype: '' }), definitions, () => 'x');
    expect(result.event.sourceIndicatorId).toBeUndefined();
    expect(result.functionalIndicators).toBeUndefined();
  });

  it('renaming a symptom moves its entry to the new type (how a type is reassigned before removal)', () => {
    const symptom = event({ id: 's1', eventType: 'SYMPTOM', category: 'Physical', subtype: 'Migraine', sourceIndicatorId: 'back' });
    const owner = person({
      events: [symptom],
      functionalIndicators: [{ definitionId: 'back', status: 'current', impact: 1 }],
    });
    const result = syncSymptomIndicator(owner, symptom, [...definitions, { id: 'mig', label: 'Migraine', group: 'physical' }]);
    expect(result.functionalIndicators?.map((entry) => entry.definitionId)).toEqual(['mig']);
  });
});

describe('saveEventOnOwner — a date field has exactly one event', () => {
  it('editing the Birth block writes the birth date, and the block shows the new date once', () => {
    const owner = person({ birthDate: '1980-01-01', events: [] });
    const [birth] = synthesizePersonDateEvents(owner);
    const edited = normalizeEventForSave({ ...birth, startDate: '1981-02-02', date: '1981-02-02', observations: 'home birth' }, context);
    const updates = saveEventOnOwner({ kind: 'person', id: 'p1' }, owner, edited) as Partial<Person>;
    expect(updates.birthDate).toBe('1981-02-02');
    const after = { ...owner, ...updates };
    const births = synthesizePersonDateEvents(after).filter((e) => e.category === 'Birth');
    expect(births).toHaveLength(1);
    expect(births[0]).toMatchObject({ startDate: '1981-02-02', observations: 'home birth' });
    // The companion is not listed a second time among the stored events.
    expect(withoutDateSlotCompanions(after.events)).toHaveLength(0);
  });

  it('the field stays the record: a later field edit moves the block (regression: the promoted copy froze it)', () => {
    const owner = person({ birthDate: '1980-01-01', events: [] });
    const [birth] = synthesizePersonDateEvents(owner);
    const updates = saveEventOnOwner({ kind: 'person', id: 'p1' }, owner, normalizeEventForSave({ ...birth, observations: 'note' }, context));
    const later = { ...owner, ...updates, birthDate: '1979-09-09' } as Person;
    expect(synthesizePersonDateEvents(later).find((e) => e.category === 'Birth')?.startDate).toBe('1979-09-09');
  });

  it('a new event whose category names the field records the field instead of adding a second event', () => {
    const owner = person({ events: [] });
    const updates = saveEventOnOwner(
      { kind: 'person', id: 'p1' },
      owner,
      normalizeEventForSave(event({ id: 'new', category: 'Death', startDate: '2001-01-01', date: '2001-01-01' }), context)
    ) as Partial<Person>;
    expect(updates.deathDate).toBe('2001-01-01');
    expect(updates.events).toHaveLength(1);
    expect(synthesizePersonDateEvents({ ...owner, ...updates } as Person).filter((e) => e.category === 'Death')).toHaveLength(1);
  });

  it('an undated event with a date-field category is stored as it is', () => {
    const owner = person({ events: [] });
    const updates = saveEventOnOwner(
      { kind: 'person', id: 'p1' },
      owner,
      normalizeEventForSave(event({ id: 'new', category: 'Death', startDate: '', date: '' }), context)
    ) as Partial<Person>;
    expect(updates.deathDate).toBeUndefined();
    expect(updates.events?.map((e) => e.id)).toEqual(['new']);
  });

  it('editing a marriage block writes the status date and its legacy mirror', () => {
    const owner = partnership({ marriedStartDate: '1990-05-05', events: [] });
    const marriage = synthesizePartnershipDateEvents(owner, 'Ann', 'Bob').find((e) => e.category === 'Marriage')!;
    const updates = saveEventOnOwner(
      { kind: 'partnership', id: 'pr1' },
      owner,
      normalizeEventForSave({ ...marriage, startDate: '1991-06-06', date: '1991-06-06' }, { ...context, anchorType: 'RELATIONSHIP_PRL', anchorId: 'pr1', eventClass: 'relationship' })
    ) as Partial<Partnership>;
    expect(updates.marriedStartDate).toBe('1991-06-06');
    expect(updates.statusDates?.married).toBe('1991-06-06');
  });

  it('deleting a date field\'s event clears the date', () => {
    const owner = person({ deathDate: '2001-01-01', events: [] });
    const updates = deleteEventFromOwner({ kind: 'person', id: 'p1' }, owner, 'synth-death-p1') as Partial<Person>;
    expect(updates).toHaveProperty('deathDate', undefined);
  });

  it('editing an indicator-backed symptom row creates one real symptom event and stops the synthesized one', () => {
    const owner = person({
      functionalIndicators: [{ definitionId: 'cough', status: 'current', impact: 1, date: '2022-02-02' }],
      events: [],
    });
    const definitions = [{ id: 'cough', label: 'Cough', group: 'physical' as const }];
    const [row] = synthesizePersonIndicatorEvents(owner, definitions);
    const updates = saveEventOnOwner(
      { kind: 'person', id: 'p1' },
      owner,
      normalizeEventForSave({ ...row, category: 'Physical', observations: 'dry' }, context),
      { definitions }
    ) as Partial<Person>;
    expect(updates.events).toHaveLength(1);
    expect(updates.events?.[0].id.startsWith('synth-')).toBe(false);
    expect(synthesizePersonIndicatorEvents({ ...owner, ...updates } as Person, definitions)).toHaveLength(0);
  });

  it('an event on a partner\'s pattern is saved on the pattern (regression: copied onto the person)', () => {
    const line = {
      id: 'l1', person1_id: 'p1', person2_id: 'p2', relationshipType: 'conflict', lineStyle: 'conflict-dotted-wide',
      lineEnding: 'none', events: [event({ id: 'epe1', eventType: 'EPE', category: 'Conflict' })],
    } as EmotionalLine;
    const updates = saveEventOnOwner(
      { kind: 'emotional', id: 'l1' },
      line,
      normalizeEventForSave(event({ id: 'epe1', eventType: 'EPE', category: 'Conflict', observations: 'edited' }), context)
    ) as Partial<EmotionalLine>;
    expect(updates.events).toHaveLength(1);
    expect(updates.events?.[0].observations).toBe('edited');
  });
});

describe('deleteEventFromOwner', () => {
  it('deleting a symptom removes the indicator it recorded (regression: the Timeline brought it back)', () => {
    const owner = person({
      events: [event({ id: 's1', eventType: 'SYMPTOM', category: 'Physical', sourceIndicatorId: 'cough' })],
      functionalIndicators: [{ definitionId: 'cough', status: 'current', impact: 1, date: '2022-02-02' }],
    });
    const updates = deleteEventFromOwner({ kind: 'person', id: 'p1' }, owner, 's1') as Partial<Person>;
    expect(updates.events).toEqual([]);
    expect(updates.functionalIndicators).toEqual([]);
  });

  it('removes a family event from familyEvents, not events', () => {
    const owner = partnership({ familyEvents: [event({ id: 'f1', eventType: 'FAMILY', category: 'Stress' })], events: [] });
    const updates = deleteEventFromOwner({ kind: 'partnership', id: 'pr1', list: 'familyEvents' }, owner, 'f1');
    expect(updates).toEqual({ familyEvents: [] });
  });
});

describe('buildNewEventDraft — nothing the user did not give (author decisions 2026-09-30)', () => {
  it('starts with no date, no rating and no category', () => {
    const draft = buildNewEventDraft({
      eventType: 'NODAL',
      anchorType: 'PERSON',
      anchorId: 'p1',
      eventClass: 'individual',
      primaryPersonName: 'Ann',
    });
    expect(draft).toMatchObject({
      date: '',
      startDate: '',
      category: '',
      intensity: 0,
      frequency: 0,
      impact: 0,
      howWell: 0,
      observations: '',
      anchorType: 'PERSON',
      anchorId: 'p1',
      eventClass: 'individual',
    });
    expect(draft.createdAt).toBeGreaterThan(0);
  });

  it('takes what the seed gives', () => {
    const draft = buildNewEventDraft({
      eventType: 'FOO',
      anchorType: 'PERSON',
      anchorId: 'p1',
      eventClass: 'individual',
      seed: { category: 'Triangle Functioning', startDate: '2010-10-10', intensity: 2 },
    });
    expect(draft).toMatchObject({ category: 'Triangle Functioning', date: '2010-10-10', intensity: 2 });
  });
});

describe('withSyncedDateSlotCompanions', () => {
  const companion = event({ id: 'synth-birth-p1', category: 'Birth', date: '1980-01-01', startDate: '1980-01-01', observations: 'home' });

  it('re-dates a companion when its field changes elsewhere (regression: stored date went stale)', () => {
    const synced = withSyncedDateSlotCompanions('person', person({ birthDate: '1985-05-05', events: [companion] }));
    expect(synced.events?.[0]).toMatchObject({ date: '1985-05-05', startDate: '1985-05-05', observations: 'home' });
  });

  it('drops the companion when the field is cleared', () => {
    expect(withSyncedDateSlotCompanions('person', person({ events: [companion] })).events).toEqual([]);
  });

  it('returns the same object when nothing changed', () => {
    const owner = person({ birthDate: '1980-01-01', events: [companion] });
    expect(withSyncedDateSlotCompanions('person', owner)).toBe(owner);
  });
});

describe('anchor helpers follow the partnership list (gate 2026-09-30 LOW #1)', () => {
  it('a family event without its own anchor is saved as a family event', () => {
    const saved = normalizeEventForSave(event({ anchorType: undefined, eventClass: undefined as never }), {
      anchorType: anchorTypeForOwner('partnership', 'familyEvents'),
      anchorId: 'pr1',
      eventClass: eventClassForOwner('partnership', 'familyEvents'),
    });
    expect(saved).toMatchObject({ anchorType: 'FAMILY', eventClass: 'family' });
    expect(anchorTypeForOwner('partnership')).toBe('RELATIONSHIP_PRL');
  });
});

describe('a death recorded without a date (TODO 2026-09-27)', () => {
  const deceased = () => person({ deathDateKnown: true, events: [] });

  it('is listed as one undated Death event instead of nowhere', () => {
    const deaths = synthesizePersonDateEvents(deceased()).filter((e) => e.category === 'Death');
    expect(deaths).toHaveLength(1);
    expect(deaths[0]).toMatchObject({ id: 'synth-death-p1', date: '', startDate: '' });
  });

  it('giving it a date records the death date', () => {
    const owner = deceased();
    const [death] = synthesizePersonDateEvents(owner);
    const updates = saveEventOnOwner(
      { kind: 'person', id: 'p1' },
      owner,
      normalizeEventForSave({ ...death, startDate: '2001-02-03', date: '2001-02-03' }, context)
    ) as Partial<Person>;
    expect(updates.deathDate).toBe('2001-02-03');
  });

  it('a note on it is kept while it stays undated', () => {
    const owner = deceased();
    const [death] = synthesizePersonDateEvents(owner);
    const updates = saveEventOnOwner(
      { kind: 'person', id: 'p1' },
      owner,
      normalizeEventForSave({ ...death, observations: 'in the war' }, context)
    ) as Partial<Person>;
    const after = { ...owner, ...updates } as Person;
    expect(synthesizePersonDateEvents(after)[0].observations).toBe('in the war');
    expect(withSyncedDateSlotCompanions('person', after).events).toHaveLength(1);
  });

  it('deleting it removes the death record', () => {
    const updates = deleteEventFromOwner({ kind: 'person', id: 'p1' }, deceased(), 'synth-death-p1') as Partial<Person>;
    expect(updates).toMatchObject({ deathDateKnown: undefined, deathDate: undefined });
    expect(updates).toHaveProperty('deathDateKnown', undefined);
  });
});

describe('family event drafts (review 2026-09-30 DE2-03)', () => {
  it('carry the chosen category and type, no ratings, and FAMILY / family', () => {
    const draft = buildFamilyEventDraft({
      partnershipId: 'pr',
      partner1Name: 'Ann',
      partner2Name: 'Bob',
      category: 'Triangles',
      subtype: 'Functioning',
    });
    expect(draft).toMatchObject({
      eventType: 'FAMILY',
      eventClass: 'family',
      anchorType: 'FAMILY',
      anchorId: 'pr',
      category: 'Triangles',
      subtype: 'Functioning',
      intensity: 0,
      frequency: 0,
      impact: 0,
      date: '',
      startDate: '',
    });
  });

  it('"Add Event" starts with no category and no type', () => {
    expect(buildFamilyEventDraft({ partnershipId: 'pr' })).toMatchObject({ category: '', subtype: '' });
  });

  it('a category is put in its canonical spelling, but an empty one is not defaulted', () => {
    expect(canonicalFamilyCategory('triangles')).toBe('Triangles');
    expect(canonicalFamilyCategory('STRESS')).toBe('Stress');
    expect(canonicalFamilyCategory('')).toBe('');
  });
});
