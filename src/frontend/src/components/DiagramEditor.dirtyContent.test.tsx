/**
 * Every part of the diagram that is saved to the file marks it unsaved when
 * it changes (REVIEW-gap-areas-2026-09-30 F-1). Prediction sets were saved to
 * the file but never made the diagram dirty, so File > Open replaced them
 * without the unsaved-changes prompt and the file autosave never ran.
 */
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import DiagramEditor from './DiagramEditor';
import { DIAGRAM_PAYLOAD_KEYS } from '../utils/diagramPayload';

const readBlob = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

const saveButtonColor = () =>
  (screen.getAllByRole('button').find((b) => b.textContent?.trim() === 'Save') as HTMLButtonElement)
    .style.backgroundColor;

const CLEAN = 'rgb(25, 118, 210)'; // #1976d2
const DIRTY = 'rgb(198, 40, 40)'; // #c62828

describe('DiagramEditor — prediction edits mark the diagram unsaved', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creating a prediction set turns Save red (regression F-1: stayed clean)', () => {
    render(<DiagramEditor />);
    expect(saveButtonColor()).toBe(CLEAN);

    fireEvent.click(screen.getByRole('button', { name: 'Options ▾' }));
    fireEvent.click(screen.getByText('Predictions'));
    const nameInput = screen.getByPlaceholderText('New set name...');
    fireEvent.change(nameInput, { target: { value: 'Hypotheses' } });
    const createRow = nameInput.parentElement as HTMLElement;
    fireEvent.click(within(createRow).getByText('+ Create'));

    expect(saveButtonColor()).toBe(DIRTY);
  });
});

describe('DiagramEditor — what Save writes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('the saved file has exactly the payload keys and no view state (replaces a source-text check)', async () => {
    const blobs: Blob[] = [];
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return 'blob:test';
    });
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      render(<DiagramEditor />);
      const saveButton = screen.getAllByRole('button').find((b) => b.textContent?.trim() === 'Save')!;
      fireEvent.click(saveButton);
      await waitFor(() => expect(blobs).toHaveLength(1));
      const saved = JSON.parse(await readBlob(blobs[0]));
      expect(Object.keys(saved).sort()).toEqual([...DIAGRAM_PAYLOAD_KEYS].sort());
      expect(JSON.stringify(saved).toLowerCase()).not.toContain('familyscope');
    } finally {
      createUrl.mockRestore();
      revokeUrl.mockRestore();
      anchorClick.mockRestore();
    }
  });
});
