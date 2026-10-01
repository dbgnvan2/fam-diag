import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useBrowserStorageWriter, STORAGE_WRITE_DELAY_MS } from './useBrowserStorageWriter';

describe('useBrowserStorageWriter (review 2026-09-30 DE1-02, DE1-03)', () => {
  afterEach(() => vi.useRealTimers());

  it('writes every key in the same pass, a second after the last change', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const { rerender } = renderHook(({ values }) => useBrowserStorageWriter(values, write), {
      initialProps: { values: { people: [{ id: 'a' }], partnerships: [] as unknown[] } },
    });
    act(() => vi.advanceTimersByTime(STORAGE_WRITE_DELAY_MS));
    expect(write.mock.calls.map(([key]) => key)).toEqual(['people', 'partnerships']);
    write.mockClear();
    // Add a partner: both keys change together and are written together.
    rerender({ values: { people: [{ id: 'a' }, { id: 'b' }], partnerships: [{ id: 'pr' }] } });
    act(() => vi.advanceTimersByTime(STORAGE_WRITE_DELAY_MS));
    expect(write.mock.calls.map(([key]) => key).sort()).toEqual(['partnerships', 'people']);
  });

  it('steady editing does not hold the write back by more than the delay after it stops', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const { rerender } = renderHook(({ values }) => useBrowserStorageWriter(values, write), {
      initialProps: { values: { people: [0] as unknown[] } },
    });
    for (let i = 1; i <= 5; i += 1) {
      rerender({ values: { people: [i] } });
      act(() => vi.advanceTimersByTime(500));
    }
    expect(write).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(STORAGE_WRITE_DELAY_MS));
    expect(write).toHaveBeenCalledWith('people', '[5]');
  });

  it('writes pending changes at once when the page is hidden or closed (regression: lost on tab close)', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    renderHook(() => useBrowserStorageWriter({ people: [{ id: 'unsaved' }], fileName: 'a.json' }, write));
    window.dispatchEvent(new Event('pagehide'));
    expect(write).toHaveBeenCalledWith('people', '[{"id":"unsaved"}]');
    expect(write).toHaveBeenCalledWith('fileName', 'a.json');
  });

  it('an unchanged key is not written again', () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const people = [{ id: 'a' }];
    const { rerender } = renderHook(({ values }) => useBrowserStorageWriter(values, write), {
      initialProps: { values: { people, pageNotes: [] as unknown[] } },
    });
    act(() => vi.advanceTimersByTime(STORAGE_WRITE_DELAY_MS));
    write.mockClear();
    rerender({ values: { people, pageNotes: [{ id: 'n' }] } });
    act(() => vi.advanceTimersByTime(STORAGE_WRITE_DELAY_MS));
    expect(write.mock.calls.map(([key]) => key)).toEqual(['pageNotes']);
  });
});
