import { describe, it, expect, vi } from 'vitest';
import type { EmotionalLine, EmotionalProcessEvent, Partnership, Person, PredictionSet, Triangle } from '../types';
import {
  categoryInUseMessage,
  categoryNameError,
  categoryRenames,
  categoryUsage,
  confirmCategoryDelete,
  renameSymptomTypeOnPeople,
  saveCategoryList,
  type CategoryHolders,
  type CategoryRenameSetters,
} from './categoryRename';

const event = (id: string, extra: Partial<EmotionalProcessEvent>): EmotionalProcessEvent =>
  ({
    id,
    date: '2020-01-01',
    startDate: '2020-01-01',
    category: '',
    intensity: 0,
    frequency: 0,
    impact: 0,
    howWell: 0,
    otherPersonName: '',
    primaryPersonName: '',
    wwwwh: '',
    observations: '',
    eventClass: 'individual',
    createdAt: 1,
    ...extra,
  }) as EmotionalProcessEvent;

const holders = (): CategoryHolders => ({
  people: [
    {
      id: 'ann',
      name: 'Ann',
      x: 0,
      y: 0,
      partnerships: ['p1'],
      events: [
        event('e1', { eventType: 'SIR', category: 'Defining Self', subtype: 'spoke up' }),
        event('e2', { eventType: 'NODAL', category: 'Job Change' }),
        event('e3', { eventType: 'FF', category: 'Work' }),
        // Same name, other event type: not this category.
        event('e4', { eventType: 'EPE', category: 'Job Change' }),
      ],
    },
    { id: 'bob', name: 'Bob', x: 0, y: 0, partnerships: ['p1'], events: [] },
  ] as Person[],
  partnerships: [
    {
      id: 'p1',
      partner1_id: 'ann',
      partner2_id: 'bob',
      horizontalConnectorY: 0,
      relationshipType: 'married',
      relationshipStatus: 'married',
      children: [],
      events: [event('e5', { eventType: 'NODAL', category: 'job change' })],
      familyEvents: [event('e6', { eventType: 'NODAL', category: 'Job Change' })],
    },
  ] as Partnership[],
  emotionalLines: [
    { id: 'l1', person1_id: 'ann', person2_id: 'bob', events: [event('e7', { eventType: 'SIR', category: 'Defining Self' })] },
  ] as EmotionalLine[],
  triangles: [
    {
      id: 't1',
      person1_id: 'ann',
      person2_id: 'bob',
      person3_id: 'ann',
      tpls: [{ id: 'tl1', person1_id: 'ann', person2_id: 'bob', events: [event('e8', { eventType: 'FF', category: 'Work' })] }],
    },
  ] as Triangle[],
  predictionSets: [
    {
      id: 's1',
      name: 'Set',
      createdDate: '2020',
      predictions: [
        {
          id: 'pr1',
          title: 'Ann holds steady',
          status: 'active',
          createdDate: '2020',
          conditions: [{ id: 'c1', type: 'sir', description: '', linkedSIRCategory: 'Defining Self', evidence: [] }],
          outcomes: [],
          notes: '',
        },
      ],
    },
  ] as PredictionSet[],
});

/** Setters that apply each updater to a plain copy of the holders. */
const recordingSetters = (state: CategoryHolders): CategoryRenameSetters => ({
  setPeople: (u) => { state.people = u(state.people); },
  setPartnerships: (u) => { state.partnerships = u(state.partnerships); },
  setEmotionalLines: (u) => { state.emotionalLines = u(state.emotionalLines); },
  setTriangles: (u) => { state.triangles = u(state.triangles); },
  setPredictionSets: (u) => { state.predictionSets = u(state.predictionSets || []); },
});

const allEvents = (state: CategoryHolders) => [
  ...state.people.flatMap((p) => p.events || []),
  ...state.partnerships.flatMap((p) => [...(p.events || []), ...(p.familyEvents || [])]),
  ...state.emotionalLines.flatMap((l) => l.events || []),
  ...state.triangles.flatMap((t) => [...(t.events || []), ...(t.tpls || []).flatMap((l) => l.events || [])]),
];
const categoryOf = (state: CategoryHolders, id: string) => allEvents(state).find((e) => e.id === id)?.category;

describe('settings-02 — renaming a category moves its events with it', () => {
  it('a Nodal rename rewrites person, partnership and family events, in any letter case, and only Nodal ones', () => {
    const state = holders();
    const setList = vi.fn();
    const prev = [{ id: 'n1', name: 'Job Change' }];
    const next = [{ id: 'n1', name: 'Career Move' }];
    saveCategoryList('NODAL', prev, next, setList, recordingSetters(state));
    expect(setList).toHaveBeenCalledWith(next);
    expect(categoryOf(state, 'e2')).toBe('Career Move');
    expect(categoryOf(state, 'e5')).toBe('Career Move');
    expect(categoryOf(state, 'e6')).toBe('Career Move');
    // An EPE event that happens to share the name is not a Nodal event.
    expect(categoryOf(state, 'e4')).toBe('Job Change');
  });

  it('an SIR rename rewrites events on people and patterns, and prediction conditions', () => {
    const state = holders();
    saveCategoryList('SIR', [{ id: 's', name: 'Defining Self' }], [{ id: 's', name: 'Self Definition' }], vi.fn(), recordingSetters(state));
    expect(categoryOf(state, 'e1')).toBe('Self Definition');
    expect(categoryOf(state, 'e7')).toBe('Self Definition');
    expect(state.predictionSets?.[0].predictions[0].conditions[0].linkedSIRCategory).toBe('Self Definition');
  });

  it('an FF rename reaches triangle pattern lines', () => {
    const state = holders();
    saveCategoryList('FF', [{ id: 'f', name: 'Work' }], [{ id: 'f', name: 'Employment' }], vi.fn(), recordingSetters(state));
    expect(categoryOf(state, 'e3')).toBe('Employment');
    expect(categoryOf(state, 'e8')).toBe('Employment');
  });

  it('a reorder or an add renames nothing', () => {
    expect(categoryRenames([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], [{ id: 'b', name: 'B' }, { id: 'a', name: 'A' }, { id: 'c', name: 'C' }])).toEqual([]);
  });

  it('also renames the copy held by the Properties panel', () => {
    const state = holders();
    let panel: Person | Partnership | EmotionalLine | null = state.people[0];
    saveCategoryList('NODAL', [{ id: 'n', name: 'Job Change' }], [{ id: 'n', name: 'Career Move' }], vi.fn(), {
      ...recordingSetters(state),
      setPropertiesPanelItem: (u) => { panel = u(panel); },
    });
    expect((panel as Person).events?.find((e) => e.id === 'e2')?.category).toBe('Career Move');
  });
});

describe('settings-02 — deleting a used category is refused', () => {
  it('names everyone who still uses it', () => {
    const usage = categoryUsage(holders(), 'NODAL', 'Job Change');
    expect(usage.eventCount).toBe(3);
    expect(usage.ownerNames).toEqual(['Ann', 'Ann & Bob']);
    const alertFn = vi.fn();
    const confirmFn = vi.fn(() => true);
    expect(confirmCategoryDelete('Job Change', usage, alertFn, confirmFn)).toBe(false);
    expect(alertFn.mock.calls[0][0]).toContain('Ann & Bob');
    expect(confirmFn).not.toHaveBeenCalled();
  });

  it('counts a prediction condition linked to an SIR category as a use', () => {
    const state = holders();
    state.people = state.people.map((p) => ({ ...p, events: [] }));
    state.emotionalLines = [];
    const usage = categoryUsage(state, 'SIR', 'Defining Self');
    expect(usage.eventCount).toBe(0);
    expect(usage.predictionConditionCount).toBe(1);
    expect(categoryInUseMessage('Defining Self', usage)).toContain('Ann holds steady');
  });

  it('asks before deleting an unused category', () => {
    const alertFn = vi.fn();
    const confirmFn = vi.fn(() => false);
    const usage = categoryUsage(holders(), 'NODAL', 'Retirement');
    expect(confirmCategoryDelete('Retirement', usage, alertFn, confirmFn)).toBe(false);
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(alertFn).not.toHaveBeenCalled();
  });
});

describe('settings-07 / settings-08 — category names', () => {
  it('refuses an empty name', () => {
    expect(categoryNameError('   ', [])).toBe('Enter a name.');
  });

  it('refuses a duplicate in any letter case', () => {
    expect(categoryNameError('  work ', ['Work'])).toContain('already in the list');
  });

  it('refuses a Nodal or SIR name that is another event type\'s built-in category', () => {
    expect(categoryNameError('Stress', [], 'NODAL')).toContain('Family');
    expect(categoryNameError('distance', [], 'SIR')).toContain('built-in');
  });

  it('allows a new name', () => {
    expect(categoryNameError('Job Change', ['Relocation'], 'NODAL')).toBeNull();
  });
});

describe('settings-01 — renaming a symptom type renames its events', () => {
  const people = (): Person[] => [
    {
      id: 'ann',
      name: 'Ann',
      x: 0,
      y: 0,
      partnerships: [],
      events: [
        event('s1', { eventType: 'SYMPTOM', category: 'emotional', subtype: 'Anxiety', symptomType: 'Anxiety', sourceIndicatorId: 'd1' }),
        // A free-text subtype that is not the old label is left alone.
        event('s2', { eventType: 'SYMPTOM', category: 'emotional', subtype: 'panic at night', symptomType: 'Anxiety', sourceIndicatorId: 'd1' }),
        // Linked to another type.
        event('s3', { eventType: 'SYMPTOM', category: 'emotional', subtype: 'Anxiety', symptomType: 'Anxiety', sourceIndicatorId: 'd2' }),
      ],
    },
  ];

  it('moves symptomType, and subtype when it was the old name, on linked events only', () => {
    const [ann] = renameSymptomTypeOnPeople(people(), 'd1', 'Anxiety', 'Worry');
    const byId = (id: string) => ann.events?.find((e) => e.id === id);
    expect(byId('s1')).toMatchObject({ symptomType: 'Worry', subtype: 'Worry' });
    expect(byId('s2')).toMatchObject({ symptomType: 'Worry', subtype: 'panic at night' });
    expect(byId('s3')).toMatchObject({ symptomType: 'Anxiety', subtype: 'Anxiety' });
  });
});
