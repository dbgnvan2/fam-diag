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

export const rotateDiagramBackups = async (key: string, backupJson: string) => {
  const db = await openDiagramHandleDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(DIAGRAM_BACKUP_STORE, 'readwrite');
    const store = tx.objectStore(DIAGRAM_BACKUP_STORE);
    const request = store.get(key);
    request.onsuccess = () => {
      const current =
        request.result && typeof request.result === 'object'
          ? request.result
          : { v1: null, v2: null, v3: null };
      const next = {
        v1: backupJson,
        v2: current.v1 ?? null,
        v3: current.v2 ?? null,
        updatedAt: new Date().toISOString(),
      };
      store.put(next, key);
    };
    request.onerror = () => {
      store.put({ v1: backupJson, v2: null, v3: null, updatedAt: new Date().toISOString() }, key);
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); resolve(); };
  });
};

export const loadDiagramBackups = async (
  key: string
): Promise<{ v1?: string | null; v2?: string | null; v3?: string | null } | null> => {
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
