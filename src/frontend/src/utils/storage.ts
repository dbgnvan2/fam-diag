/**
 * Storage utilities — extracted from DiagramEditor.tsx.
 * Handles localStorage keys, user settings, and IndexedDB file handle / backup persistence.
 */

import type { FunctionalIndicatorDefinition } from '../types';
import type { StoredUserSettings } from '../types/diagramEditor';

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

export const STORAGE_KEYS = {
  userSettings: 'family-diagram-user-settings',
  autoSave: 'family-diagram-autosave-minutes',
  people: 'family-diagram-people',
  partnerships: 'family-diagram-partnerships',
  emotionalLines: 'family-diagram-emotional-lines',
  triangles: 'family-diagram-triangles',
  eventCategories: 'family-diagram-event-categories',
  relationshipTypes: 'family-diagram-relationship-types',
  relationshipStatuses: 'family-diagram-relationship-statuses',
  indicatorDefinitions: 'family-diagram-functional-indicators',
  pageNotes: 'family-diagram-page-notes',
  fileName: 'family-diagram-file-name',
  ideas: 'family-diagram-ideas',
  predictions: 'family-diagram-predictions',
  sessionNotesLibrary: 'family-diagram-session-notes-library',
} as const;

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

export const getStoredValue = (key: keyof typeof STORAGE_KEYS) => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS[key]);
};

export const setStoredValue = (key: keyof typeof STORAGE_KEYS, value: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS[key], value);
};

export const parseStoredUserSettings = (): StoredUserSettings | null => {
  const raw = getStoredValue('userSettings');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredUserSettings;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const parseStoredArraySetting = (key: keyof typeof STORAGE_KEYS): string[] | null => {
  const raw = getStoredValue(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const parseStoredIndicatorDefinitions = (): FunctionalIndicatorDefinition[] | null => {
  const raw = getStoredValue('indicatorDefinitions');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FunctionalIndicatorDefinition[]) : null;
  } catch {
    return null;
  }
};

export const sortLabelsAZ = (values: string[]) =>
  [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

// ---------------------------------------------------------------------------
// IndexedDB — file handle + backup persistence
// ---------------------------------------------------------------------------

const DIAGRAM_HANDLE_DB = 'family-diagram-file-handle-db';
const DIAGRAM_HANDLE_STORE = 'handles';
const DIAGRAM_BACKUP_STORE = 'diagram-backups';
const DIAGRAM_HANDLE_KEY = 'current-diagram';

export const openDiagramHandleDb = (): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open(DIAGRAM_HANDLE_DB, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DIAGRAM_HANDLE_STORE)) {
        db.createObjectStore(DIAGRAM_HANDLE_STORE);
      }
      if (!db.objectStoreNames.contains(DIAGRAM_BACKUP_STORE)) {
        db.createObjectStore(DIAGRAM_BACKUP_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

export const persistDiagramFileHandle = async (handle: any | null) => {
  const db = await openDiagramHandleDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(DIAGRAM_HANDLE_STORE, 'readwrite');
    const store = tx.objectStore(DIAGRAM_HANDLE_STORE);
    if (handle) {
      store.put(handle, DIAGRAM_HANDLE_KEY);
    } else {
      store.delete(DIAGRAM_HANDLE_KEY);
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); resolve(); };
  });
};

export const restoreDiagramFileHandle = async (): Promise<any | null> => {
  const db = await openDiagramHandleDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(DIAGRAM_HANDLE_STORE, 'readonly');
    const store = tx.objectStore(DIAGRAM_HANDLE_STORE);
    const request = store.get(DIAGRAM_HANDLE_KEY);
    request.onsuccess = () => { db.close(); resolve(request.result || null); };
    request.onerror = () => { db.close(); resolve(null); };
  });
};

export const rotateDiagramBackups = async (key: string, backupJson: string, maxSlots = 3) => {
  const db = await openDiagramHandleDb();
  if (!db) return;
  const slots = Math.max(1, Math.min(maxSlots, 20));
  await new Promise<void>((resolve) => {
    const tx = db.transaction(DIAGRAM_BACKUP_STORE, 'readwrite');
    const store = tx.objectStore(DIAGRAM_BACKUP_STORE);
    const request = store.get(key);
    request.onsuccess = () => {
      const current =
        request.result && typeof request.result === 'object'
          ? request.result
          : {};
      const next: Record<string, string | null> = { updatedAt: new Date().toISOString() };
      next.v1 = backupJson;
      for (let i = 2; i <= slots; i++) {
        next[`v${i}`] = (current[`v${i - 1}`] as string | null) ?? null;
      }
      store.put(next, key);
    };
    request.onerror = () => {
      const fallback: Record<string, string | null> = { v1: backupJson, updatedAt: new Date().toISOString() };
      store.put(fallback, key);
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); resolve(); };
  });
};

export type BackupVersions = Record<string, string | null>;

export const loadDiagramBackups = async (
  key: string
): Promise<BackupVersions | null> => {
  const db = await openDiagramHandleDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(DIAGRAM_BACKUP_STORE, 'readonly');
    const store = tx.objectStore(DIAGRAM_BACKUP_STORE);
    const request = store.get(key);
    request.onsuccess = () => { db.close(); resolve(request.result || null); };
    request.onerror = () => { db.close(); resolve(null); };
  });
};

// ---------------------------------------------------------------------------
// IndexedDB — backup directory handle persistence
// ---------------------------------------------------------------------------

const BACKUP_DIR_HANDLE_KEY = 'backup-directory';

export const persistBackupDirectoryHandle = async (handle: FileSystemDirectoryHandle | null) => {
  const db = await openDiagramHandleDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(DIAGRAM_HANDLE_STORE, 'readwrite');
    const store = tx.objectStore(DIAGRAM_HANDLE_STORE);
    if (handle) {
      store.put(handle, BACKUP_DIR_HANDLE_KEY);
    } else {
      store.delete(BACKUP_DIR_HANDLE_KEY);
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); resolve(); };
  });
};

export const restoreBackupDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  const db = await openDiagramHandleDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(DIAGRAM_HANDLE_STORE, 'readonly');
    const store = tx.objectStore(DIAGRAM_HANDLE_STORE);
    const request = store.get(BACKUP_DIR_HANDLE_KEY);
    request.onsuccess = () => { db.close(); resolve(request.result || null); };
    request.onerror = () => { db.close(); resolve(null); };
  });
};

/**
 * Write round-robin backup files to a user-chosen directory.
 * Files are named: `{baseName}.backup-1.json` ... `{baseName}.backup-{N}.json`
 * Returns the slot number that was written (1-based).
 */
export const writeFileBackup = async (
  dirHandle: FileSystemDirectoryHandle,
  diagramFileName: string,
  jsonContent: string,
  maxSlots: number
): Promise<number> => {
  const baseName = diagramFileName.replace(/\.json$/i, '');
  const slotCount = Math.max(1, Math.min(maxSlots, 20));

  // Determine which slot to write: find the oldest or first empty slot
  let oldestSlot = 1;
  let oldestTime = Infinity;
  for (let i = 1; i <= slotCount; i++) {
    const backupName = `${baseName}.backup-${i}.json`;
    try {
      const fh = await dirHandle.getFileHandle(backupName);
      const file = await fh.getFile();
      if (file.lastModified < oldestTime) {
        oldestTime = file.lastModified;
        oldestSlot = i;
      }
    } catch {
      // File doesn't exist — use this slot
      oldestSlot = i;
      break;
    }
  }

  const backupName = `${baseName}.backup-${oldestSlot}.json`;
  const fh = await dirHandle.getFileHandle(backupName, { create: true });
  const writable = await (fh as any).createWritable();
  await writable.write(new Blob([jsonContent], { type: 'application/json' }));
  await writable.close();
  return oldestSlot;
};

/**
 * List backup files found in the directory for a given diagram.
 * Returns array of { slot, fileName, lastModified, handle }.
 */
export const listFileBackups = async (
  dirHandle: FileSystemDirectoryHandle,
  diagramFileName: string,
  maxSlots: number
): Promise<{ slot: number; fileName: string; lastModified: number; handle: FileSystemFileHandle }[]> => {
  const baseName = diagramFileName.replace(/\.json$/i, '');
  const results: { slot: number; fileName: string; lastModified: number; handle: FileSystemFileHandle }[] = [];
  for (let i = 1; i <= Math.min(maxSlots, 20); i++) {
    const backupName = `${baseName}.backup-${i}.json`;
    try {
      const fh = await dirHandle.getFileHandle(backupName);
      const file = await fh.getFile();
      if (file.size > 0) {
        results.push({ slot: i, fileName: backupName, lastModified: file.lastModified, handle: fh });
      }
    } catch {
      // File doesn't exist
    }
  }
  // Sort most recent first
  results.sort((a, b) => b.lastModified - a.lastModified);
  return results;
};

/** Clear all localStorage keys holding diagram entity data (people, partnerships, etc.). */
export const clearDiagramLocalStorage = () => {
  if (typeof window === 'undefined') return;
  const diagramKeys: (keyof typeof STORAGE_KEYS)[] = [
    'people', 'partnerships', 'emotionalLines', 'triangles', 'pageNotes', 'fileName',
  ];
  for (const k of diagramKeys) {
    localStorage.removeItem(STORAGE_KEYS[k]);
  }
};
