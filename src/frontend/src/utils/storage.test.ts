import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  STORAGE_KEYS,
  trySetStoredValue,
  isRightClickHintHidden,
  setRightClickHintHidden,
} from './storage';

describe('storage — guarded writes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(STORAGE_KEYS.hideRightClickHint);
  });

  it('trySetStoredValue reports true and writes the value on success', () => {
    expect(trySetStoredValue('hideRightClickHint', 'true')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.hideRightClickHint)).toBe('true');
  });

  it('trySetStoredValue reports false instead of throwing when the store refuses', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(trySetStoredValue('hideRightClickHint', 'true')).toBe(false);
  });

  it('setRightClickHintHidden round-trips the preference', () => {
    expect(setRightClickHintHidden(true)).toBe(true);
    expect(isRightClickHintHidden()).toBe(true);
    expect(setRightClickHintHidden(false)).toBe(true);
    expect(isRightClickHintHidden()).toBe(false);
  });

  it('setRightClickHintHidden reports false when the write is refused', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(setRightClickHintHidden(true)).toBe(false);
  });

  it('setRightClickHintHidden reports false when the value does not read back', () => {
    // A store that accepts the write but does not keep it (some private modes).
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    expect(setRightClickHintHidden(true)).toBe(false);
  });
});
