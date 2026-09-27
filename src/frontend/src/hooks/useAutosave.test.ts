/**
 * Regression tests for useAutosave.
 *
 * Bug: the timer was keyed on the onSave callback's identity. DiagramEditor
 * passes an inline arrow (new identity every render) and re-renders every
 * 500 ms while dirty, so the timer was cleared and restarted before it could
 * fire — the autosave never ran while there were unsaved changes.
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAutosave } from './useAutosave';

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires after the delay even when re-rendered with a new onSave every 500 ms', () => {
    const saved: string[] = [];
    const { rerender } = renderHook(
      ({ data, tick }: { data: string; tick: number }) =>
        // A fresh arrow on every render, exactly as DiagramEditor passes it.
        useAutosave(data, (value) => saved.push(`${value}@${tick}`), 2000),
      { initialProps: { data: 'v1', tick: 0 } }
    );

    for (let tick = 1; tick <= 6; tick += 1) {
      act(() => {
        vi.advanceTimersByTime(500);
      });
      rerender({ data: 'v1', tick });
    }

    expect(saved).toHaveLength(1);
    expect(saved[0].startsWith('v1@')).toBe(true);
  });

  it('calls the latest onSave, not the one captured when the timer started', () => {
    const calls: string[] = [];
    const { rerender } = renderHook(
      ({ label }: { label: string }) => useAutosave('same-data', () => calls.push(label), 1000),
      { initialProps: { label: 'first' } }
    );
    rerender({ label: 'second' });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(calls).toEqual(['second']);
  });

  it('restarts the delay when the data changes (debounce)', () => {
    const onSave = vi.fn();
    const { rerender } = renderHook(({ data }: { data: string }) => useAutosave(data, onSave, 1000), {
      initialProps: { data: 'a' },
    });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    rerender({ data: 'b' });
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(onSave).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('b');
  });

  it('does not fire after unmount', () => {
    const onSave = vi.fn();
    const { unmount } = renderHook(() => useAutosave('a', onSave, 1000));
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onSave).not.toHaveBeenCalled();
  });
});
