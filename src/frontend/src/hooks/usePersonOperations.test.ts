/**
 * Tests for the delete paths of usePersonOperations, run against real React
 * state (useState) so stale-closure bugs show up.
 */
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { EmotionalLine, Partnership, Person, Triangle } from '../types';
import type { AddFamilyDraft } from '../types/diagramEditor';
import { usePersonOperations } from './usePersonOperations';

const person = (id: string, extra: Partial<Person> = {}): Person => ({
  id,
  name: id,
  x: 0,
  y: 0,
  partnerships: [],
  ...extra,
});
const partnership = (id: string, a: string, b: string, children: string[] = []): Partnership => ({
  id,
  partner1_id: a,
  partner2_id: b,
  horizontalConnectorY: 0,
  relationshipType: 'married',
  relationshipStatus: 'married',
  children,
});

// Sam has two partnerships (with Ann and with Bea); Kid is Sam+Ann's child.
const initialPeople = (): Person[] => [
  person('sam', { partnerships: ['sa', 'sb'] }),
  person('ann', { partnerships: ['sa'] }),
  person('bea', { partnerships: ['sb'] }),
  person('kid', { parentPartnership: 'sa' }),
];
const initialPartnerships = (): Partnership[] => [partnership('sa', 'sam', 'ann', ['kid']), partnership('sb', 'sam', 'bea')];

const setup = (startPeople: () => Person[] = initialPeople, startPartnerships: () => Partnership[] = initialPartnerships) =>
  renderHook(() => {
    const [people, setPeople] = useState<Person[]>(startPeople);
    const [partnerships, setPartnerships] = useState<Partnership[]>(startPartnerships);
    const [emotionalLines, setEmotionalLines] = useState<EmotionalLine[]>([
      { id: 'l1', person1_id: 'ann', person2_id: 'bea' } as EmotionalLine,
      { id: 'l2', person1_id: 'sam', person2_id: 'ann' } as EmotionalLine,
    ]);
    const [triangles, setTriangles] = useState<Triangle[]>([
      { id: 't1', person1_id: 'sam', person2_id: 'ann', person3_id: 'kid' } as Triangle,
    ]);
    const ops = usePersonOperations({
      people,
      partnerships,
      selectedPeopleIds: [],
      propertiesPanelItem: null,
      setPeople,
      setPeopleAligned: (updater) => setPeople(updater),
      alignAllAnchors: (list) => list,
      setPartnerships,
      setEmotionalLines,
      setTriangles,
      setSelectedPeopleIds: vi.fn(),
      setSelectedPartnershipId: vi.fn(),
      setSelectedEmotionalLineId: vi.fn(),
      setSelectedChildId: vi.fn(),
      setPropertiesPanelItem: vi.fn(),
      setContextMenu: vi.fn(),
    });
    return { ops, people, partnerships, emotionalLines, triangles };
  });

const byId = <T extends { id: string }>(list: T[], id: string) => list.find((entry) => entry.id === id);

describe('usePersonOperations — removePerson', () => {
  it('removes the deleted person\'s partnership ids from surviving partners (regression: left dangling)', () => {
    const { result } = setup();
    act(() => result.current.ops.removePerson('sam'));
    expect(result.current.partnerships).toEqual([]);
    expect(byId(result.current.people, 'ann')?.partnerships).toEqual([]);
    expect(byId(result.current.people, 'bea')?.partnerships).toEqual([]);
  });

  it('unlinks the children of removed partnerships and drops lines and triangles that used the person', () => {
    const { result } = setup();
    act(() => result.current.ops.removePerson('sam'));
    expect(byId(result.current.people, 'sam')).toBeUndefined();
    expect(byId(result.current.people, 'kid')?.parentPartnership).toBeUndefined();
    expect(result.current.emotionalLines.map((line) => line.id)).toEqual(['l1']);
    expect(result.current.triangles).toEqual([]);
  });
});

describe('usePersonOperations — stale state', () => {
  it('two removePartnership calls in one update both apply (regression: second overwrote first)', () => {
    const { result } = setup();
    act(() => {
      result.current.ops.removePartnership('sa');
      result.current.ops.removePartnership('sb');
    });
    expect(result.current.partnerships).toEqual([]);
    expect(byId(result.current.people, 'sam')?.partnerships).toEqual([]);
  });

  it('removeChildFromPartnership works from the latest partnerships', () => {
    const { result } = setup();
    act(() => {
      result.current.ops.removePartnership('sb');
      result.current.ops.removeChildFromPartnership('kid', 'sa');
    });
    expect(result.current.partnerships.map((p) => p.id)).toEqual(['sa']);
    expect(byId(result.current.partnerships, 'sa')?.children).toEqual([]);
    expect(byId(result.current.people, 'kid')?.parentPartnership).toBeUndefined();
  });
});

describe('usePersonOperations — addParentsForPerson (G-TEST-08)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('gives a person with no parents a raising family, not marked adopted', () => {
    const { result } = setup();
    act(() => result.current.ops.addParentsForPerson(byId(result.current.people, 'ann')!));
    const ann = byId(result.current.people, 'ann')!;
    expect(ann.parentPartnership).toBeDefined();
    expect(ann.birthParentPartnership).toBeUndefined();
    expect(ann.adoptionStatus).toBeUndefined();
  });

  it('adding parents to someone with a raising family adds a birth family and marks them adopted', () => {
    const { result } = setup();
    act(() => result.current.ops.addParentsForPerson(byId(result.current.people, 'kid')!));
    const kid = byId(result.current.people, 'kid')!;
    expect(kid.parentPartnership).toBe('sa');
    expect(kid.birthParentPartnership).toBeDefined();
    expect(kid.birthParentPartnership).not.toBe('sa');
    expect(kid.adoptionStatus).toBe('adopted');
    expect(byId(result.current.partnerships, kid.birthParentPartnership!)?.children).toEqual(['kid']);
  });

  it('refuses when the person already has both a raising and a birth family (regression: overwrote the birth family)', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const people = () => [
      ...initialPeople().filter((p) => p.id !== 'kid'),
      person('kid', { parentPartnership: 'sa', birthParentPartnership: 'sb', adoptionStatus: 'adopted' }),
    ];
    const partnerships = () => [partnership('sa', 'sam', 'ann', ['kid']), partnership('sb', 'sam', 'bea', ['kid'])];
    const { result } = setup(people, partnerships);
    act(() => result.current.ops.addParentsForPerson(byId(result.current.people, 'kid')!));
    expect(alertSpy.mock.calls[0][0]).toContain('already has both a raising and a birth family');
    const kid = byId(result.current.people, 'kid')!;
    expect(kid.birthParentPartnership).toBe('sb');
    expect(result.current.partnerships.map((p) => p.id)).toEqual(['sa', 'sb']);
    expect(result.current.people).toHaveLength(4);
  });

  it('refuses birth parents for someone who already has a birth family', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const people = () => [
      ...initialPeople().filter((p) => p.id !== 'kid'),
      person('kid', { birthParentPartnership: 'sb' }),
    ];
    const { result } = setup(people);
    act(() => result.current.ops.addParentsForPerson(byId(result.current.people, 'kid')!, { forceBirthParents: true }));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(byId(result.current.people, 'kid')?.birthParentPartnership).toBe('sb');
  });
});

describe('usePersonOperations — createFamilyFromDraft (settings-03, G-TEST-07)', () => {
  const draft = (children: AddFamilyDraft['children'], familySurname = 'Smith'): AddFamilyDraft => ({
    parent1: { sex: 'male', firstName: ' Tom ', birthDate: '' },
    parent2: { sex: 'female', firstName: 'Ann', birthDate: '' },
    familySurname,
    children,
  });

  it('creates no child for a blank row (regression: blank rows became " Smith" children)', () => {
    const { result } = setup(() => [], () => []);
    act(() =>
      result.current.ops.createFamilyFromDraft(
        draft([
          { sex: 'male', firstName: '', birthDate: '' },
          { sex: 'female', firstName: '  ', birthDate: '' },
          { sex: 'female', firstName: 'Liz', birthDate: '' },
        ]),
        { x: 0, y: 0 },
      ),
    );
    expect(result.current.people.map((p) => p.name)).toEqual(['Tom Smith', 'Ann Smith', 'Liz Smith']);
    expect(result.current.partnerships[0].children).toHaveLength(1);
  });

  it('keeps a child row that has only a birth date, named by the surname alone', () => {
    const { result } = setup(() => [], () => []);
    act(() =>
      result.current.ops.createFamilyFromDraft(draft([{ sex: 'female', firstName: '', birthDate: '2001-02-03' }]), { x: 0, y: 0 }),
    );
    const child = result.current.people[2];
    expect(child.name).toBe('Smith');
    expect(child.birthDate).toBe('2001-02-03');
  });

  it('trims names when there is no surname', () => {
    const { result } = setup(() => [], () => []);
    act(() => result.current.ops.createFamilyFromDraft(draft([], '  '), { x: 0, y: 0 }));
    expect(result.current.people.map((p) => p.name)).toEqual(['Tom', 'Ann']);
  });
});
