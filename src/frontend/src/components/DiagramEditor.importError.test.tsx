/**
 * A failed import says what failed and leaves the diagram as it was (review
 * 2026-09-30 DE2-09: it was a bare "Error importing data").
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../utils/diagramMerge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/diagramMerge')>();
  return {
    ...actual,
    mergeDiagramData: () => {
      throw new Error('partner id missing');
    },
  };
});

import DiagramEditor from './DiagramEditor';

describe('DiagramEditor — a failed import', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reports the reason', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(<DiagramEditor />);
    const importInput = container.querySelectorAll<HTMLInputElement>('input[type="file"][accept=".json"]')[1];
    const file = new File(
      [JSON.stringify({ people: [{ id: 'x', name: 'X', x: 0, y: 0, partnerships: [] }], partnerships: [], emotionalLines: [] })],
      'other.json',
      { type: 'application/json' }
    );
    await act(async () => {
      fireEvent.change(importInput, { target: { files: [file] } });
      await new Promise((r) => setTimeout(r, 20));
    });
    fireEvent.click(screen.getByText('Add To Existing Family'));
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('partner id missing'));
    vi.restoreAllMocks();
  });
});
