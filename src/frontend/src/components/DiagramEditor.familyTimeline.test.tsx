/**
 * Spec: docs/implementation_plan_2026-09-19.md#M3.A.1, #M4.A.2
 *
 * Right-click a person on the real canvas, choose Focus Family › "Timeline for
 * this family", then change the focus from inside the Timeline. This replaces
 * a check that read DiagramEditor's source for the menu wiring, and gives the
 * Timeline's follow-focus effect its first behavioural test (it could not be
 * reached from the UI at all before gap review F-4).
 */
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import Konva from 'konva';
import DiagramEditor from './DiagramEditor';

const rightClickPerson = (personId: string) => {
  const stage = Konva.stages[Konva.stages.length - 1];
  const node = stage.findOne(`#${personId}`);
  expect(node).toBeTruthy();
  act(() => {
    node!.fire('contextmenu', { evt: new MouseEvent('contextmenu', { clientX: 120, clientY: 120, button: 2 }) }, true);
  });
};

const laneCount = (board: HTMLElement) => {
  const label = within(board).getByText(/\d+ lanes$/);
  return Number(label.textContent!.match(/(\d+) lanes$/)![1]);
};

describe('DiagramEditor — Timeline for a focused family', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens from the person menu with the focus lanes, and follows focus changes made inside it', () => {
    render(<DiagramEditor />);
    rightClickPerson('demo-dad');
    fireEvent.click(screen.getByText('Focus Family'));
    fireEvent.click(screen.getByText(/^Timeline for this family/));

    const board = screen.getByRole('dialog', { name: 'Timeline board' });
    const before = laneCount(board);
    expect(before).toBeGreaterThan(1);
    expect(within(board).getByText(/^People: /).textContent).toContain('Alex Carter');

    // The focus controls are inside the board (the ribbon's are under its
    // backdrop). Narrowing the focus to no generations down re-derives the lanes.
    const fewerDown = within(board).getByLabelText('Fewer generations down');
    fireEvent.click(fewerDown);
    fireEvent.click(fewerDown);
    expect(laneCount(board)).toBeLessThan(before);
  });
});
