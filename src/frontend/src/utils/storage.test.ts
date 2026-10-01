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
  nextBackupVersions,
  type BackupVersions,
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
    localStorage.setItem(STORAGE_KEYS.ideas, 'old client ideas');
    localStorage.setItem(STORAGE_KEYS.predictions, '[{"id":"s"}]');
    clearDiagramLocalStorage();
    for (const key of ['people', 'partnerships', 'emotionalLines', 'triangles', 'pageNotes', 'predictions'] as const) {
      expect(localStorage.getItem(STORAGE_KEYS[key])).toBe('[]');
    }
    expect(localStorage.getItem(STORAGE_KEYS.fileName)).toBeNull();
    // Ideas and predictions are saved in the diagram file, so a new diagram
    // starts without the previous one's (gap review F-2).
    expect(localStorage.getItem(STORAGE_KEYS.ideas)).toBe('');
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

describe('nextBackupVersions — V1 is the version the last save replaced (review 2026-09-30 settings-06)', () => {
  it('download saves (no file content to read) back up the version the previous save wrote', () => {
    let record: BackupVersions = {};
    let step = nextBackupVersions(record, 'first', null, 3, 't1');
    expect(step.backedUp).toBeNull();
    expect(step.versions.v1).toBeUndefined();
    record = step.versions;
    step = nextBackupVersions(record, 'second', null, 3, 't2');
    expect(step.backedUp).toBe('first');
    expect(step.versions.v1).toBe('first');
    expect(step.versions.replacedAt1).toBe('t2');
    record = step.versions;
    step = nextBackupVersions(record, 'third', null, 3, 't3');
    expect([step.versions.v1, step.versions.v2]).toEqual(['second', 'first']);
    expect([step.versions.replacedAt1, step.versions.replacedAt2]).toEqual(['t3', 't2']);
    expect(step.versions.latest).toBe('third');
  });

  it('a linked-file save backs up the file content it replaced', () => {
    const step = nextBackupVersions({ latest: 'what this browser saved' }, 'new', 'on disk', 3, 't');
    expect(step.versions.v1).toBe('on disk');
    expect(step.versions.latest).toBe('new');
  });

  it('keeps no more than the slot count', () => {
    let record: BackupVersions = {};
    for (const [i, json] of ['a', 'b', 'c', 'd', 'e'].entries()) {
      record = nextBackupVersions(record, json, null, 2, `t${i}`).versions;
    }
    expect([record.v1, record.v2, record.v3]).toEqual(['d', 'c', undefined]);
  });
});

describe('rotateDiagramBackups — a failed read keeps the existing backups (gate 2026-10-01 #5)', () => {
  it('writes nothing when the stored record cannot be read', async () => {
    const { rotateDiagramBackups } = await import('./storage');
    const puts: unknown[] = [];
    type Handlers = { onsuccess?: () => void; onerror?: () => void; oncomplete?: () => void };
    const tx: Handlers & { objectStore: () => unknown } = {
      objectStore: () => ({
        get: () => {
          const request: Handlers & { error: Error } = { error: new Error('read failed') };
          setTimeout(() => {
            request.onerror?.();
            setTimeout(() => tx.oncomplete?.(), 0);
          }, 0);
          return request;
        },
        put: (value: unknown) => {
          puts.push(value);
        },
      }),
    };
    const db = { transaction: () => tx, close: () => undefined, objectStoreNames: { contains: () => true } };
    const fakeIndexedDb = {
      open: () => {
        const request: Handlers & { result: unknown } = { result: db };
        setTimeout(() => request.onsuccess?.(), 0);
        return request;
      },
    };
    vi.stubGlobal('indexedDB', fakeIndexedDb);
    try {
      const backedUp = await rotateDiagramBackups('diagram.json', '{"new":1}', null, 3);
      expect(puts).toEqual([]);
      expect(backedUp).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
