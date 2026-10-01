/**
 * Refused browser-storage writes are shown to the user (TODO 2026-08-24):
 * the autosave loss, and a "don't show this again" choice that could not be
 * kept. Both used to reach the developer console at most.
 */
import { render, act, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DiagramEditor from './DiagramEditor';
import { STORAGE_KEYS } from '../utils/storage';
import { STORAGE_WRITE_FAILED_MESSAGE, HINT_PREFERENCE_NOT_SAVED_MESSAGE } from '../data/helpContent';

describe('DiagramEditor — refused storage writes are reported', () => {
  const originalSetItem = Storage.prototype.setItem;
  let refuse: (key: string) => boolean;

  beforeEach(() => {
    localStorage.clear();
    refuse = () => false;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (refuse(key)) throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    };
  });
  afterEach(() => {
    Storage.prototype.setItem = originalSetItem;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('a refused autosave shows the warning beside Save (regression: lost silently)', async () => {
    vi.useFakeTimers();
    refuse = (key) => key === STORAGE_KEYS.people;
    render(<DiagramEditor />);
    for (let i = 0; i < 20; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
    }
    expect(screen.getByRole('alert')).toHaveTextContent(STORAGE_WRITE_FAILED_MESSAGE);
  });

  it('the warning clears once storage accepts writes again, with no further edit (regression F-11)', async () => {
    vi.useFakeTimers();
    refuse = (key) => key === STORAGE_KEYS.people;
    render(<DiagramEditor />);
    for (let i = 0; i < 20; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
    }
    expect(screen.getByRole('alert')).toHaveTextContent(STORAGE_WRITE_FAILED_MESSAGE);
    refuse = () => false;
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.queryByText(STORAGE_WRITE_FAILED_MESSAGE)).toBeNull();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.people) || '[]').length).toBeGreaterThan(0);
  });

  it('no warning while every write succeeds', async () => {
    vi.useFakeTimers();
    render(<DiagramEditor />);
    for (let i = 0; i < 20; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(10_000);
      });
    }
    expect(screen.queryByText(STORAGE_WRITE_FAILED_MESSAGE)).toBeNull();
  });

  it('a "don\'t show this again" that cannot be stored is reported (regression: console only)', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    refuse = (key) => key === STORAGE_KEYS.hideRightClickHint;
    render(<DiagramEditor />);
    fireEvent.click(screen.getByLabelText("Don't show this again"));
    fireEvent.click(screen.getByText('Got it'));
    expect(alertSpy).toHaveBeenCalledWith(HINT_PREFERENCE_NOT_SAVED_MESSAGE);
  });
});
