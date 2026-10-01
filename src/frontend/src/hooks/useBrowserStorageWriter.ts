import { useEffect, useRef } from 'react';
import type { STORAGE_KEYS } from '../utils/storage';

type StorageKey = keyof typeof STORAGE_KEYS;

/** How long after the last change the browser copy is written. */
export const STORAGE_WRITE_DELAY_MS = 1000;

/**
 * Purpose: keep the browser-storage copy of the diagram current.
 * Spec:    n/a — review 2026-09-30 (DE1-02, DE1-03)
 * Tests:   src/frontend/src/hooks/useBrowserStorageWriter.test.ts
 *
 * Every key is written in the same pass, a second after the last change,
 * and once more when the page is hidden or closed. It replaced one timer per
 * key that ran on the file-autosave interval (a minute or more): steady
 * editing never reached storage, closing the tab lost it, and the keys could
 * be written at different times — stored partnerships pointing at people
 * that were never stored.
 *
 * Only keys whose value changed since the last write are serialised.
 * Strings are stored as they are; everything else as JSON.
 */
export const useBrowserStorageWriter = (
  values: Partial<Record<StorageKey, unknown>>,
  write: (key: StorageKey, value: string) => void,
  delay = STORAGE_WRITE_DELAY_MS
) => {
  const latestRef = useRef(values);
  latestRef.current = values;
  const writeRef = useRef(write);
  writeRef.current = write;
  const writtenRef = useRef<Partial<Record<StorageKey, unknown>>>({});
  const flushRef = useRef(() => {});
  flushRef.current = () => {
    const current = latestRef.current;
    (Object.keys(current) as StorageKey[]).forEach((key) => {
      const value = current[key];
      if (writtenRef.current[key] === value && key in writtenRef.current) return;
      writtenRef.current = { ...writtenRef.current, [key]: value };
      writeRef.current(key, typeof value === 'string' ? value : JSON.stringify(value));
    });
  };

  useEffect(() => {
    const timer = window.setTimeout(() => flushRef.current(), delay);
    return () => window.clearTimeout(timer);
  }, [values, delay]);

  useEffect(() => {
    const flush = () => flushRef.current();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
};
