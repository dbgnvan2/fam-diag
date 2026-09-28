/**
 * Tests for the delete paths of usePersonOperations, run against real React
 * state (useState) so stale-closure bugs show up.
 */
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import type { EmotionalLine, Partnership, Person, Triangle } from '../types';
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

const setup = () =>
  renderHook(() => {
    const [people, setPeople] = useState<Person[]>(initialPeople);
    const [partnerships, setPartnerships] = useState<Partnership[]>(initialPartnerships);
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
