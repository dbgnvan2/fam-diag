import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  isCanvasScrollHintHidden,
  setCanvasScrollHintHidden,
  STORAGE_KEYS,
  trySetStoredValue,
  isRightClickHintHidden,
  setRightClickHintHidden,
  clearDiagramLocalStorage,
  parseStoredDiagramArray,
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

describe('storage — diagram entity arrays', () => {
  afterEach(() => localStorage.clear());

  it('parseStoredDiagramArray keeps a stored empty array (an emptied diagram)', () => {
    localStorage.setItem(STORAGE_KEYS.people, '[]');
    expect(parseStoredDiagramArray('people')).toEqual([]);
  });

  it('parseStoredDiagramArray returns null for a missing, non-array or unreadable value', () => {
    expect(parseStoredDiagramArray('people')).toBeNull();
    localStorage.setItem(STORAGE_KEYS.people, '{"a":1}');
    expect(parseStoredDiagramArray('people')).toBeNull();
    localStorage.setItem(STORAGE_KEYS.people, 'not json');
    expect(parseStoredDiagramArray('people')).toBeNull();
  });

  it('clearDiagramLocalStorage stores an empty diagram rather than removing the keys', () => {
    // Removing them meant "first run" on reload and brought the default family back.
    localStorage.setItem(STORAGE_KEYS.people, '[{"id":"x"}]');
    localStorage.setItem(STORAGE_KEYS.fileName, 'old.json');
    localStorage.setItem(STORAGE_KEYS.ideas, 'kept');
    clearDiagramLocalStorage();
    for (const key of ['people', 'partnerships', 'emotionalLines', 'triangles', 'pageNotes'] as const) {
      expect(localStorage.getItem(STORAGE_KEYS[key])).toBe('[]');
    }
    expect(localStorage.getItem(STORAGE_KEYS.fileName)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.ideas)).toBe('kept');
  });
});

describe('canvas scroll hint preference', () => {
  it('round-trips like the right-click hint preference', () => {
    localStorage.clear();
    expect(isCanvasScrollHintHidden()).toBe(false);
    expect(setCanvasScrollHintHidden(true)).toBe(true);
    expect(isCanvasScrollHintHidden()).toBe(true);
  });
});
