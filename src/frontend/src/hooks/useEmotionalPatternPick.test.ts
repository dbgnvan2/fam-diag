/**
 * The one-person route to an Emotional Pattern: right-click a person,
 * choose Emotional Pattern, click the second person.
 */
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Person } from '../types';
import { useEmotionalPatternPick } from './useEmotionalPatternPick';

const person = (id: string): Person => ({ id, name: id, x: 0, y: 0, partnerships: [] });

const setup = (people: Person[] = [person('a'), person('b')]) => {
  const openAddEmotionalPatternModal = vi.fn();
  const hook = renderHook(
    ({ list }) => useEmotionalPatternPick({ people: list, openAddEmotionalPatternModal }),
    { initialProps: { list: people } }
  );
  return { ...hook, openAddEmotionalPatternModal };
};

describe('useEmotionalPatternPick', () => {
  it('with no pick started, a person click is not taken', () => {
    const { result, openAddEmotionalPatternModal } = setup();
    expect(result.current.handlePickClick('b')).toBe(false);
    expect(openAddEmotionalPatternModal).not.toHaveBeenCalled();
  });

  it('the second person clicked opens the existing Add Emotional Pattern dialog for both', () => {
    const { result, openAddEmotionalPatternModal } = setup();
    act(() => result.current.startPick('a'));
    expect(result.current.patternPickFirstPerson?.id).toBe('a');
    let taken = false;
    act(() => { taken = result.current.handlePickClick('b'); });
    expect(taken).toBe(true);
    expect(openAddEmotionalPatternModal).toHaveBeenCalledWith('a', 'b');
    expect(result.current.patternPickFirstPerson).toBeNull();
  });

  it('clicking the first person again keeps waiting and opens nothing', () => {
    const { result, openAddEmotionalPatternModal } = setup();
    act(() => result.current.startPick('a'));
    let taken = false;
    act(() => { taken = result.current.handlePickClick('a'); });
    expect(taken).toBe(true);
    expect(openAddEmotionalPatternModal).not.toHaveBeenCalled();
    expect(result.current.patternPickFirstPerson?.id).toBe('a');
  });

  it('Escape cancels the pick; the next click is a normal click', () => {
    const { result, openAddEmotionalPatternModal } = setup();
    act(() => result.current.startPick('a'));
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(result.current.patternPickFirstPerson).toBeNull();
    expect(result.current.handlePickClick('b')).toBe(false);
    expect(openAddEmotionalPatternModal).not.toHaveBeenCalled();
  });

  it('cancelPick ends the pick', () => {
    const { result } = setup();
    act(() => result.current.startPick('a'));
    act(() => result.current.cancelPick());
    expect(result.current.patternPickFirstPerson).toBeNull();
  });

  it('a pick whose first person was deleted is dropped, not completed', () => {
    const { result, rerender, openAddEmotionalPatternModal } = setup();
    act(() => result.current.startPick('a'));
    rerender({ list: [person('b')] });
    expect(result.current.patternPickFirstPerson).toBeNull();
    expect(result.current.handlePickClick('b')).toBe(false);
    expect(openAddEmotionalPatternModal).not.toHaveBeenCalled();
  });
});
