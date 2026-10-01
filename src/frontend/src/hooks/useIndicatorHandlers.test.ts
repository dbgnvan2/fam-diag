import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import type { FunctionalIndicatorDefinition, Person } from '../types';
import { indicatorDefinitionUsage, useIndicatorHandlers } from './useIndicatorHandlers';
import { sanitizePeopleIndicators } from '../utils/dataNormalization';

const definitions: FunctionalIndicatorDefinition[] = [
  { id: 'cough', label: 'Cough', group: 'physical' },
  { id: 'worry', label: 'Worry', group: 'emotional' },
];
const ann: Person = {
  id: 'p1',
  name: 'Ann',
  x: 0,
  y: 0,
  partnerships: [],
  functionalIndicators: [
    { definitionId: 'cough', status: 'current', impact: 2 },
    { definitionId: 'worry', status: 'current', impact: 1 },
  ],
};

const useHarness = (initialPeople: Person[]) => {
  const [people, setPeople] = useState(initialPeople);
  const [defs, setDefs] = useState(definitions);
  const handlers = useIndicatorHandlers({
    people,
    functionalIndicatorDefinitions: defs,
    indicatorDraftLabel: '',
    defaultSymptomColorByGroup: { physical: '#111', emotional: '#222', social: '#333' },
    setFunctionalIndicatorDefinitions: setDefs,
    setPeople,
    setPropertiesPanelItem: vi.fn(),
    setIndicatorDraftLabel: vi.fn(),
  });
  return { people, defs, handlers };
};

describe('removing a symptom type (M20)', () => {
  it('is refused while anyone still records it, and nothing is deleted (regression: wiped every person\'s entries)', () => {
    const alertFn = vi.fn();
    const { result } = renderHook(() => useHarness([ann]));
    let removed = true;
    act(() => {
      removed = result.current.handlers.removeFunctionalIndicatorDefinition('cough', alertFn);
    });
    expect(removed).toBe(false);
    expect(alertFn.mock.calls[0][0]).toContain('Ann');
    expect(result.current.defs.map((d) => d.id)).toEqual(['cough', 'worry']);
    expect(result.current.people[0].functionalIndicators).toHaveLength(2);
  });

  it('goes ahead once no one records it', () => {
    const alertFn = vi.fn();
    const onlyWorry = { ...ann, functionalIndicators: [ann.functionalIndicators![1]] };
    const { result } = renderHook(() => useHarness([onlyWorry]));
    act(() => {
      result.current.handlers.removeFunctionalIndicatorDefinition('cough', alertFn);
    });
    expect(alertFn).not.toHaveBeenCalled();
    expect(result.current.defs.map((d) => d.id)).toEqual(['worry']);
    expect(result.current.people[0].functionalIndicators?.map((e) => e.definitionId)).toEqual(['worry']);
  });

  it('counts a symptom event linked to the type as a use', () => {
    const withEvent: Person = {
      ...ann,
      functionalIndicators: [],
      events: [{ id: 'e', date: '', category: 'Physical', eventType: 'SYMPTOM', status: 'discrete', intensity: 0, howWell: 0, otherPersonName: '', wwwwh: '', observations: '', eventClass: 'individual', sourceIndicatorId: 'cough' }],
    };
    expect(indicatorDefinitionUsage([withEvent], 'cough')).toEqual({ peopleNames: ['Ann'], entryCount: 1 });
  });
});

describe('ensureSymptomDefinition', () => {
  it('returns null for a symptom with no name (regression: fell back to the group\'s first type)', () => {
    const { result } = renderHook(() => useHarness([ann]));
    expect(result.current.handlers.ensureSymptomDefinition('  ', 'physical')).toBeNull();
  });

  it('reuses a type whose name matches in any letter case instead of adding a duplicate', () => {
    const { result } = renderHook(() => useHarness([ann]));
    let id: string | null = null;
    act(() => {
      id = result.current.handlers.ensureSymptomDefinition('cOUGH', 'physical');
    });
    expect(id).toBe('cough');
    expect(result.current.defs).toHaveLength(2);
  });
});

describe('sanitizePeopleIndicators', () => {
  it('keeps entries whose type still exists and drops the rest', () => {
    const [clean] = sanitizePeopleIndicators([ann], [definitions[1]]);
    expect(clean.functionalIndicators?.map((e) => e.definitionId)).toEqual(['worry']);
  });
});

describe('renaming a symptom type (settings-01, settings-07)', () => {
  const withCoughEvent: Person = {
    ...ann,
    events: [
      { id: 'e', date: '2020-01-01', startDate: '2020-01-01', category: 'physical', eventType: 'SYMPTOM', status: 'discrete', intensity: 0, howWell: 0, otherPersonName: '', wwwwh: '', observations: '', eventClass: 'individual', subtype: 'Cough', symptomType: 'Cough', sourceIndicatorId: 'cough' },
    ],
  };

  it('renames the events linked to the type with it (regression: the symptom showed under two names)', () => {
    const { result } = renderHook(() => useHarness([withCoughEvent]));
    let error: string | null = 'unset';
    act(() => {
      error = result.current.handlers.updateFunctionalIndicatorLabel('cough', '  Chronic cough ');
    });
    expect(error).toBeNull();
    expect(result.current.defs.find((d) => d.id === 'cough')?.label).toBe('Chronic cough');
    expect(result.current.people[0].events?.[0]).toMatchObject({ symptomType: 'Chronic cough', subtype: 'Chronic cough' });
  });

  it('refuses an empty name and a duplicate of another type in any letter case', () => {
    const { result } = renderHook(() => useHarness([withCoughEvent]));
    let empty: string | null = null;
    let duplicate: string | null = null;
    act(() => {
      empty = result.current.handlers.updateFunctionalIndicatorLabel('cough', '   ');
      duplicate = result.current.handlers.updateFunctionalIndicatorLabel('cough', 'WORRY');
    });
    expect(empty).toBe('Enter a name.');
    expect(duplicate).toContain('already in the list');
    expect(result.current.defs.map((d) => d.label)).toEqual(['Cough', 'Worry']);
    expect(result.current.people[0].events?.[0].symptomType).toBe('Cough');
  });

  it('a second "Add Type" gets a numbered placeholder, not a duplicate name', () => {
    const { result } = renderHook(() => useHarness([ann]));
    act(() => result.current.handlers.addFunctionalIndicatorDefinitionForGroup('physical'));
    act(() => result.current.handlers.addFunctionalIndicatorDefinitionForGroup('physical'));
    expect(result.current.defs.map((d) => d.label).slice(2)).toEqual(['New Symptom Type', 'New Symptom Type 2']);
  });
});
