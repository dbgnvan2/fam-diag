/**
 * Session Notes (review 2026-09-30 DE1-14): a note restored after a reload
 * keeps its library id, so Save updates its entry instead of adding a copy.
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import DiagramEditor from './DiagramEditor';
import { STORAGE_KEYS } from '../utils/storage';
import Konva from 'konva';

describe('DiagramEditor — session notes after a reload', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('Save updates the restored note instead of adding a second library entry', async () => {
    const note = {
      id: 'note-1',
      noteFileName: 'session-note.json',
      coachName: 'C',
      clientName: 'K',
      presentingIssue: '',
      noteContent: 'first session',
      startedAt: 1,
      updatedAt: 2,
    };
    localStorage.setItem(STORAGE_KEYS.sessionNotesLibrary, JSON.stringify([note]));
    localStorage.setItem(STORAGE_KEYS.sessionNotePrimary, JSON.stringify(note));
    render(<DiagramEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Options ▾' }));
    fireEvent.click(screen.getByText('Session Notes'));
    const panel = screen.getByRole('dialog', { name: 'Session notes' });
    const save = Array.from(panel.querySelectorAll('button')).find((b) => b.textContent === 'Save')!;
    await act(async () => {
      fireEvent.click(save);
      await new Promise((r) => setTimeout(r, 0));
    });
    const library = JSON.parse(localStorage.getItem(STORAGE_KEYS.sessionNotesLibrary) as string) as Array<{ id: string }>;
    expect(library.map((entry) => entry.id)).toEqual(['note-1']);
    vi.restoreAllMocks();
  });

  it('a target picked in Session Notes is kept when someone else is edited (review DE1-13)', () => {
    render(<DiagramEditor />);
    const stage = Konva.stages[Konva.stages.length - 1];
    act(() => {
      stage.findOne('#demo-dad')!.fire('click', { evt: new MouseEvent('click', { button: 0 }) }, true);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Options ▾' }));
    fireEvent.click(screen.getByText('Session Notes'));
    const panel = screen.getByRole('dialog', { name: 'Session notes' });
    const selects = Array.from(panel.querySelectorAll('select'));
    const target = selects.find((select) =>
      Array.from(select.options).some((option) => option.value.startsWith('partnership:'))
    ) as HTMLSelectElement;
    const partnershipValue = Array.from(target.options).find((option) => option.value.startsWith('partnership:'))!.value;
    fireEvent.change(target, { target: { value: partnershipValue } });
    expect(target.value).toBe(partnershipValue);
    // Edit the selected person in the Properties panel: people change, the
    // selection does not.
    fireEvent.change(screen.getByLabelText('First Name:'), { target: { value: 'Alexander' } });
    expect(target.value).toBe(partnershipValue);
  });
});
