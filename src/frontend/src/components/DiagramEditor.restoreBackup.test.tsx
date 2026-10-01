/**
 * A restored backup is an older version than the last save, so it counts as
 * unsaved: Save turns red, autosave writes it to a linked file, and Open /
 * New ask before discarding it. It used to be marked saved (gate 2026-10-01
 * #4).
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const backupDiagram = {
  people: [{ id: 'old', name: 'Older Version', x: 100, y: 100, partnerships: [] }],
  partnerships: [],
  emotionalLines: [],
};

vi.mock('../utils/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/storage')>();
  return {
    ...actual,
    loadDiagramBackups: vi.fn(async () => ({ v1: JSON.stringify(backupDiagram), v2: null, v3: null })),
  };
});

import DiagramEditor from './DiagramEditor';

const saveButtonColor = () =>
  (screen.getAllByRole('button').find((b) => b.textContent?.trim() === 'Save') as HTMLButtonElement)
    .style.backgroundColor;
const CLEAN = 'rgb(25, 118, 210)'; // #1976d2
const DIRTY = 'rgb(198, 40, 40)'; // #c62828

describe('DiagramEditor — restoring a browser backup', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  it('leaves the restored diagram unsaved', async () => {
    render(<DiagramEditor />);
    expect(saveButtonColor()).toBe(CLEAN);
    fireEvent.click(screen.getByRole('button', { name: 'File ▾' }));
    await act(async () => {
      fireEvent.click(screen.getByText('Restore Backup (Browser)'));
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/^V1 /));
    });
    expect(screen.queryByRole('dialog', { name: 'Restore backup' })).toBeNull();
    expect(saveButtonColor()).toBe(DIRTY);
  });
});
