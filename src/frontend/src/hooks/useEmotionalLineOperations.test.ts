import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import type { EmotionalLine, Triangle } from '../types';
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
