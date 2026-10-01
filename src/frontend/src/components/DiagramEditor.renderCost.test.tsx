/**
 * While the diagram is unsaved, only the ribbon re-renders on the
 * Save-button clock (review 2026-09-30 struct-01): the whole editor,
 * canvas included, used to re-render every 500 ms.
 */
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

let canvasRenders = 0;
vi.mock('./DiagramCanvas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./DiagramCanvas')>();
  const Real = actual.default as unknown as (props: Record<string, unknown>) => JSX.Element;
  return {
    ...actual,
    default: (props: Record<string, unknown>) => {
      canvasRenders += 1;
      return Real(props);
    },
  };
});

import DiagramEditor from './DiagramEditor';

describe('DiagramEditor — render cost while unsaved', () => {
  beforeEach(() => {
    localStorage.clear();
    canvasRenders = 0;
  });

  it('the canvas is not re-rendered by the Save-button clock', async () => {
    vi.useFakeTimers();
    render(<DiagramEditor />);
    // Make the diagram unsaved: create a prediction set.
    fireEvent.click(screen.getByRole('button', { name: 'Options ▾' }));
    fireEvent.click(screen.getByText('Predictions'));
    const nameInput = screen.getByPlaceholderText('New set name...');
    fireEvent.change(nameInput, { target: { value: 'Set' } });
    fireEvent.click(within(nameInput.parentElement as HTMLElement).getByText('+ Create'));
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    const before = canvasRenders;
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(canvasRenders - before).toBeLessThanOrEqual(1);
    vi.useRealTimers();
  });
});
