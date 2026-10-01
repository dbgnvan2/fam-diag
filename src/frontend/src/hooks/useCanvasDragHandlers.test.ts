/**
 * A group drag leaves alone the lists it does not move (review 2026-09-30
 * struct-03): a new partnerships / lines / triangles array on every frame
 * re-ran everything keyed on them.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useCanvasDragHandlers } from './useCanvasDragHandlers';
import type { Person } from '../types';

const person = (id: string, x: number): Person => ({ id, name: id, x, y: 0, partnerships: [] });

describe('useCanvasDragHandlers — drag frames', () => {
  it('moving two unpartnered people does not touch partnerships, lines or triangles', () => {
    const deps = {
      selectedPeopleIds: ['a', 'b'],
      selectedPageNoteIds: [],
      people: [person('a', 0), person('b', 100)],
      partnerships: [],
      allEmotionalLines: [],
      pageNotes: [],
      dragGroupRef: { current: null },
      setPeopleAligned: vi.fn(),
      setPartnerships: vi.fn(),
      setEmotionalLines: vi.fn(),
      setTriangles: vi.fn(),
      setPageNotes: vi.fn(),
    };
    const { result } = renderHook(() => useCanvasDragHandlers(deps));
    act(() => {
      result.current.handlePersonDragStart('a', 0, 0);
      result.current.handlePersonDrag('a', 10, 5);
    });
    expect(deps.setPeopleAligned).toHaveBeenCalled();
    expect(deps.setPartnerships).not.toHaveBeenCalled();
    expect(deps.setEmotionalLines).not.toHaveBeenCalled();
    expect(deps.setTriangles).not.toHaveBeenCalled();
  });
});
