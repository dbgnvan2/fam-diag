/**
 * Image import (review 2026-09-30 DE2-05, DE2-06): the result goes through
 * the same Replace / Merge choice as every other import, the reader's
 * uncertainties are shown, and a Cancel means nothing is added.
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FactsImportData } from '../types/diagramEditor';

let resolveImport: ((facts: FactsImportData) => void) | null = null;
vi.mock('../utils/genogram/vlmImport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/genogram/vlmImport')>();
  return {
    ...actual,
    vlmImport: vi.fn(
      () =>
        new Promise<FactsImportData>((resolve) => {
          resolveImport = resolve;
        })
    ),
  };
});

import DiagramEditor from './DiagramEditor';

const facts: FactsImportData = {
  people: [
    { name: 'Ada Vale', sex: 'female', x: 30, y: 30 },
    { name: 'Bo Vale', sex: 'male', x: 60, y: 30 },
  ],
  relationships: [{ a: 'Ada Vale', b: 'Bo Vale', type: 'married', children: [] }],
  uncertainties: ['the second name may be "Bo" or "Ro"'],
} as FactsImportData;

const saveButtonColor = () =>
  (screen.getAllByRole('button').find((b) => b.textContent?.trim() === 'Save') as HTMLButtonElement)
    .style.backgroundColor;
const CLEAN = 'rgb(25, 118, 210)'; // #1976d2

const startImport = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'File ▾' }));
  fireEvent.click(screen.getByText('Import Family Diagram'));
  const dialog = screen.getByRole('dialog', { name: 'Upload diagram image' });
  const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['png'], 'genogram.png', { type: 'image/png' });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
  await act(async () => {
    fireEvent.click(screen.getByText('Analyze'));
    await Promise.resolve();
  });
  for (let i = 0; i < 20 && !resolveImport; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
};

describe('DiagramEditor — image import', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('anthropic_api_key', 'test-key');
    localStorage.setItem('selected_model_id', 'claude-opus-5-5');
    resolveImport = null;
  });

  it('offers Replace / Merge and shows what the reader was unsure of; nothing is added before the choice', async () => {
    render(<DiagramEditor />);
    await startImport();
    expect(resolveImport).not.toBeNull();
    await act(async () => {
      resolveImport!(facts);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByRole('dialog', { name: 'Import mode' })).toBeTruthy();
    expect(screen.getByText(/unsure of 1 thing/)).toBeTruthy();
  });

  it('a Cancel while the image is being read adds nothing and reports no failure', async () => {
    render(<DiagramEditor />);
    expect(saveButtonColor()).toBe(CLEAN);
    await startImport();
    expect(resolveImport).not.toBeNull();
    fireEvent.click(screen.getByText('Stop'));
    await act(async () => {
      resolveImport!(facts);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.queryByRole('dialog', { name: 'Import mode' })).toBeNull();
    expect(screen.queryByText(/Analysis failed/)).toBeNull();
    // Nothing was added, so the diagram is still saved (regression: the
    // people were appended after Stop).
    expect(saveButtonColor()).toBe(CLEAN);
  });
});
