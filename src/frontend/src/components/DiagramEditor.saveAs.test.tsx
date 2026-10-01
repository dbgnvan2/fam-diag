/**
 * Save As says why it could not use the chosen file before offering the
 * download fallback. The error used to be swallowed (review 2026-09-30 DE2-08).
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DiagramEditor from './DiagramEditor';

describe('DiagramEditor — Save As errors', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
    vi.restoreAllMocks();
  });

  it('reports a file-picker failure, then offers the download name dialog', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    Object.assign(window, {
      showSaveFilePicker: vi.fn(async () => {
        throw new DOMException('The file is locked', 'NotAllowedError');
      }),
    });
    render(<DiagramEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'File ▾' }));
    await act(async () => {
      fireEvent.click(screen.getByText('Save As'));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('The file is locked'));
  });

  it('a cancelled picker says nothing', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    Object.assign(window, {
      showSaveFilePicker: vi.fn(async () => {
        throw new DOMException('cancelled', 'AbortError');
      }),
    });
    render(<DiagramEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'File ▾' }));
    await act(async () => {
      fireEvent.click(screen.getByText('Save As'));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
