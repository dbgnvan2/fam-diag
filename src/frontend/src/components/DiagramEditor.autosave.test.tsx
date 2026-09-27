/**
 * Regression tests: autosave must fire while the diagram is dirty.
 *
 * While dirty, DiagramEditor re-renders every 500 ms (the "unsaved for Ns"
 * clock). Both autosave timers used to be keyed on callbacks that got a new
 * identity every render, so each re-render cleared and restarted them and
 * neither the localStorage autosave nor the linked-file autosave ever ran.
 *
 * The tests advance time in 500 ms steps so those re-renders actually happen;
 * advancing in one jump would hide the bug.
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { STORAGE_KEYS, restoreDiagramFileHandle } from '../utils/storage';

const fakeHandleWrites: string[] = [];
const fakeFileHandle = {
  name: 'autosave-test.json',
  kind: 'file',
  queryPermission: async () => 'granted',
  requestPermission: async () => 'granted',
  getFile: async () => ({ text: async () => '' }),
  createWritable: async () => ({
    write: async (blob: Blob) => {
      // jsdom's Blob has no .text(); read it the long way.
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(blob);
      });
      fakeHandleWrites.push(text);
    },
    close: async () => undefined,
  }),
};

vi.mock('../utils/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/storage')>();
  return {
    ...actual,
    // Simulate a diagram previously linked to a file on disk.
    restoreDiagramFileHandle: vi.fn(async () => fakeFileHandle),
    restoreBackupDirectoryHandle: vi.fn(async () => null),
    persistDiagramFileHandle: vi.fn(async () => undefined),
    rotateDiagramBackups: vi.fn(async () => undefined),
  };
});

import DiagramEditor from './DiagramEditor';

const AUTOSAVE_MINUTES = 1;

const stepThrough = async (ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 500) {
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
  }
};

const addPersonViaContextMenu = () => {
  fireEvent.contextMenu(screen.getByRole('presentation'));
  fireEvent.click(screen.getByText('Add Person'));
};

describe('DiagramEditor autosave while dirty', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.autoSave, String(AUTOSAVE_MINUTES));
    fakeHandleWrites.length = 0;
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as Record<string, unknown>).showOpenFilePicker;
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
  });

  it('writes people to localStorage after the autosave delay', async () => {
    vi.useFakeTimers();
    render(<DiagramEditor />);
    addPersonViaContextMenu();

    await stepThrough(AUTOSAVE_MINUTES * 60_000 * 1.5);

    const stored = localStorage.getItem(STORAGE_KEYS.people);
    expect(stored).not.toBeNull();
    const people = JSON.parse(stored as string) as Array<{ name: string }>;
    expect(people.some((person) => person.name === 'New Person')).toBe(true);
  }, 60_000);

  it('writes the diagram to the linked file after the autosave delay', async () => {
    // File System Access API present, so the editor restores the linked handle.
    Object.assign(window, { showOpenFilePicker: vi.fn(), showSaveFilePicker: vi.fn() });
    vi.useFakeTimers();
    render(<DiagramEditor />);
    // Let the async handle restore settle.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(restoreDiagramFileHandle).toHaveBeenCalled();

    addPersonViaContextMenu();
    await stepThrough(AUTOSAVE_MINUTES * 60_000 * 1.5);
    // Flush the async write chain started by the autosave timer.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fakeHandleWrites.length).toBeGreaterThan(0);
    const written = JSON.parse(fakeHandleWrites[fakeHandleWrites.length - 1]) as {
      people: Array<{ name: string }>;
    };
    expect(written.people.some((person) => person.name === 'New Person')).toBe(true);
  }, 60_000);
});
