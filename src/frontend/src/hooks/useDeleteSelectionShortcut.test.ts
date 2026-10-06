import { renderHook, render, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import type { PageNote, Person } from '../types';
import { useDeleteSelectionShortcut } from './useDeleteSelectionShortcut';
import { useDialogFocus } from './useDialogFocus';

const person = (id: string, extra: Partial<Person> = {}): Person => ({ id, name: id, x: 0, y: 0, partnerships: [], ...extra });
const people = [person('ann', { firstName: 'Ann', lastName: 'Lee' }), person('sam'), person('kid')];

const note = (id: string, title = id): PageNote => ({ id, x: 0, y: 0, title, text: '' });
const pageNotes = [note('n1', 'Intake'), note('n2', 'Plan')];

const setup = (selectedPeopleIds: string[], confirmResult = true, selectedPageNoteIds: string[] = []) => {
  const removePeople = vi.fn();
  const removePageNotes = vi.fn();
  const confirmFn = vi.fn(() => confirmResult);
  const hook = renderHook(
    ({ ids, noteIds }) =>
      useDeleteSelectionShortcut({
        people,
        selectedPeopleIds: ids,
        removePeople,
        pageNotes,
        selectedPageNoteIds: noteIds,
        removePageNotes,
        confirmFn,
      }),
    { initialProps: { ids: selectedPeopleIds, noteIds: selectedPageNoteIds } }
  );
  return { removePeople, removePageNotes, confirmFn, hook };
};

const pressCmdX = (target: EventTarget = window) => fireEvent.keyDown(target, { key: 'x', metaKey: true });

describe('useDeleteSelectionShortcut', () => {
  it('CMD-X deletes the whole selected group in one call after the confirm names them', () => {
    const { removePeople, confirmFn } = setup(['ann', 'sam']);
    pressCmdX();
    expect(confirmFn).toHaveBeenCalledWith(expect.stringMatching(/^Delete 2 people: Ann Lee, sam\?/));
    expect(removePeople).toHaveBeenCalledTimes(1);
    expect(removePeople).toHaveBeenCalledWith(['ann', 'sam']);
  });

  it('Ctrl-X works too', () => {
    const { removePeople } = setup(['kid']);
    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });
    expect(removePeople).toHaveBeenCalledWith(['kid']);
  });

  it('deletes nothing when the user cancels', () => {
    const { removePeople } = setup(['ann'], false);
    pressCmdX();
    expect(removePeople).not.toHaveBeenCalled();
  });

  it('does nothing with nothing selected (no confirm either)', () => {
    const { removePeople, confirmFn } = setup([]);
    pressCmdX();
    expect(confirmFn).not.toHaveBeenCalled();
    expect(removePeople).not.toHaveBeenCalled();
  });

  it('skips selected ids that no longer exist', () => {
    const { removePeople } = setup(['gone', 'sam']);
    pressCmdX();
    expect(removePeople).toHaveBeenCalledWith(['sam']);
  });

  it('uses the latest selection, not the one at mount', () => {
    const { removePeople, hook } = setup(['ann']);
    hook.rerender({ ids: ['kid'], noteIds: [] });
    pressCmdX();
    expect(removePeople).toHaveBeenCalledWith(['kid']);
  });

  it('does nothing in a text field, where CMD-X cuts text', () => {
    const { removePeople, confirmFn } = setup(['ann']);
    const input = document.createElement('input');
    document.body.appendChild(input);
    try {
      pressCmdX(input);
    } finally {
      input.remove();
    }
    expect(confirmFn).not.toHaveBeenCalled();
    expect(removePeople).not.toHaveBeenCalled();
  });

  it('does nothing while a dialog is open, and works again once it closes', () => {
    const { removePeople } = setup(['ann']);
    const Dialog = ({ open }: { open: boolean }) => {
      const ref = useDialogFocus(open, () => undefined);
      return open ? createElement('div', { ref, role: 'dialog', tabIndex: -1 }) : null;
    };
    const dialog = render(createElement(Dialog, { open: true }));
    pressCmdX();
    expect(removePeople).not.toHaveBeenCalled();
    dialog.rerender(createElement(Dialog, { open: false }));
    pressCmdX();
    expect(removePeople).toHaveBeenCalledWith(['ann']);
    dialog.unmount();
  });

  it('removes its listener on unmount', () => {
    const { removePeople, hook } = setup(['ann']);
    hook.unmount();
    pressCmdX();
    expect(removePeople).not.toHaveBeenCalled();
  });
});

describe('useDeleteSelectionShortcut — page notes', () => {
  it('deletes selected page notes on their own', () => {
    const { removePeople, removePageNotes, confirmFn } = setup([], true, ['n2']);
    pressCmdX();
    expect(confirmFn).toHaveBeenCalledWith(expect.stringMatching(/^Delete 1 page note: "Plan"\?/));
    expect(removePageNotes).toHaveBeenCalledWith(['n2']);
    expect(removePeople).not.toHaveBeenCalled();
  });

  it('deletes people and notes together after one confirm', () => {
    const { removePeople, removePageNotes, confirmFn } = setup(['sam'], true, ['n1', 'n2']);
    pressCmdX();
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(confirmFn).toHaveBeenCalledWith(expect.stringMatching(/^Delete 1 person: sam; and 2 page notes: "Intake", "Plan"\?/));
    expect(removePeople).toHaveBeenCalledWith(['sam']);
    expect(removePageNotes).toHaveBeenCalledWith(['n1', 'n2']);
  });

  it('cancel deletes neither', () => {
    const { removePeople, removePageNotes } = setup(['sam'], false, ['n1']);
    pressCmdX();
    expect(removePeople).not.toHaveBeenCalled();
    expect(removePageNotes).not.toHaveBeenCalled();
  });

  it('skips note ids that no longer exist, and asks nothing when none remain', () => {
    const { removePageNotes, confirmFn } = setup([], true, ['gone']);
    pressCmdX();
    expect(confirmFn).not.toHaveBeenCalled();
    expect(removePageNotes).not.toHaveBeenCalled();
  });

  it('notes in a text field are safe: CMD-X there cuts text', () => {
    const { removePageNotes } = setup([], true, ['n1']);
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    try {
      pressCmdX(textarea);
    } finally {
      textarea.remove();
    }
    expect(removePageNotes).not.toHaveBeenCalled();
  });
});
