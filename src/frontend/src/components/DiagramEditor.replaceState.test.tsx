/**
 * Replacing the diagram (Open / Restore / Import / Load Demo) forgets the
 * Properties panel item and selections that pointed at the old one (review
 * 2026-09-30 DE1-07). A stale panel item could write an old snapshot back
 * over the restored person.
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Konva from 'konva';
import DiagramEditor from './DiagramEditor';

describe('DiagramEditor — replacing the diagram clears what pointed at the old one', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('Load Demo Diagram closes the Properties panel of the previous selection', () => {
    render(<DiagramEditor />);
    const stage = Konva.stages[Konva.stages.length - 1];
    act(() => {
      stage.findOne('#demo-dad')!.fire('click', { evt: new MouseEvent('click', { button: 0 }) }, true);
    });
    expect(screen.getByText('Properties Panel for Alex Carter')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'File ▾' }));
    fireEvent.click(screen.getByText('Load Demo Diagram'));

    expect(screen.queryByText('Properties Panel for Alex Carter')).toBeNull();
  });
});

describe('DiagramEditor — Quit (review 2026-09-30 DE2-11)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not warn about unsaved changes when there are none, and says when the tab cannot be closed', async () => {
    vi.useFakeTimers();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'close').mockImplementation(() => {});
    render(<DiagramEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'File ▾' }));
    fireEvent.click(screen.getByText('Quit'));
    expect(confirmSpy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('does not let the app close this tab'));
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
