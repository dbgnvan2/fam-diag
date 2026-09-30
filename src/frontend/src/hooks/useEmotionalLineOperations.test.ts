import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import type { EmotionalLine, Person, Triangle } from '../types';
import { useEmotionalLineOperations } from './useEmotionalLineOperations';

describe('useEmotionalLineOperations — removeEmotionalLine', () => {
  it('two removals in one update both apply (regression: second overwrote first)', () => {
    const { result } = renderHook(() => {
      const [emotionalLines, setEmotionalLines] = useState<EmotionalLine[]>([
        { id: 'l1', person1_id: 'a', person2_id: 'b' } as EmotionalLine,
        { id: 'l2', person1_id: 'a', person2_id: 'c' } as EmotionalLine,
        { id: 'l3', person1_id: 'b', person2_id: 'c' } as EmotionalLine,
      ]);
      const [triangles, setTriangles] = useState<Triangle[]>([]);
      const ops = useEmotionalLineOperations({
        people: [],
        triangles,
        emotionalPatternDraft: null,
        setEmotionalLines,
        setPeople: vi.fn(),
        setTriangles,
        setEmotionalPatternDraft: vi.fn(),
        setEmotionalPatternModalOpen: vi.fn(),
        setSelectedPeopleIds: vi.fn(),
        setSelectedPartnershipId: vi.fn(),
        setSelectedEmotionalLineId: vi.fn(),
        setSelectedChildId: vi.fn(),
        setPropertiesPanelItem: vi.fn(),
        setContextMenu: vi.fn(),
      });
      return { ops, emotionalLines };
    });
    act(() => {
      result.current.ops.removeEmotionalLine('l1');
      result.current.ops.removeEmotionalLine('l2');
    });
    expect(result.current.emotionalLines.map((line) => line.id)).toEqual(['l3']);
  });
});

describe('useEmotionalLineOperations — deleting a family cutoff line', () => {
  it('clears the child\'s reference to it (regression: pointed at a deleted line)', () => {
    const { result } = renderHook(() => {
      const [emotionalLines, setEmotionalLines] = useState<EmotionalLine[]>([
        { id: 'cut', person1_id: 'kid', person2_id: 'mum' } as EmotionalLine,
      ]);
      const [people, setPeople] = useState<Person[]>([
        { id: 'kid', name: 'Kid', x: 0, y: 0, partnerships: [], familyCutoffLineId: 'cut' },
        { id: 'other', name: 'Other', x: 0, y: 0, partnerships: [], familyCutoffLineId: 'else' },
      ]);
      const [triangles, setTriangles] = useState<Triangle[]>([]);
      const ops = useEmotionalLineOperations({
        people,
        triangles,
        emotionalPatternDraft: null,
        setEmotionalLines,
        setPeople,
        setTriangles,
        setEmotionalPatternDraft: vi.fn(),
        setEmotionalPatternModalOpen: vi.fn(),
        setSelectedPeopleIds: vi.fn(),
        setSelectedPartnershipId: vi.fn(),
        setSelectedEmotionalLineId: vi.fn(),
        setSelectedChildId: vi.fn(),
        setPropertiesPanelItem: vi.fn(),
        setContextMenu: vi.fn(),
      });
      return { ops, emotionalLines, people };
    });
    act(() => result.current.ops.removeEmotionalLine('cut'));
    expect(result.current.emotionalLines).toEqual([]);
    expect(result.current.people.find((p) => p.id === 'kid')?.familyCutoffLineId).toBeUndefined();
    expect(result.current.people.find((p) => p.id === 'other')?.familyCutoffLineId).toBe('else');
  });
});
