import { useEffect, useRef } from 'react';
import type { PageNote, Person } from '../types';
import { isDialogOpen } from './useDialogFocus';
import { deleteSelectionConfirmMessage, isDeleteSelectionShortcut } from '../utils/deleteSelectionShortcut';
import { personDisplayName } from '../utils/personNames';

type Options = {
  people: Person[];
  selectedPeopleIds: string[];
  removePeople: (personIds: string[]) => void;
  pageNotes: PageNote[];
  /** See allSelectedPageNoteIds: the open note plus an active marquee's notes. */
  selectedPageNoteIds: string[];
  removePageNotes: (noteIds: string[]) => void;
  /** Injected for tests; window.confirm in the app. */
  confirmFn?: (message: string) => boolean;
};

/**
 * Purpose: CMD-X / Ctrl-X deletes the selected people and page notes after
 * one confirm.
 * Tests:   src/frontend/src/hooks/useDeleteSelectionShortcut.test.ts
 *
 * Does nothing in a text field (CMD-X cuts text there), while any dialog is
 * open, or with nothing selected. The listener is added once and reads the
 * latest props through a ref.
 */
export function useDeleteSelectionShortcut({
  people,
  selectedPeopleIds,
  removePeople,
  pageNotes,
  selectedPageNoteIds,
  removePageNotes,
  confirmFn = (message) => window.confirm(message),
}: Options) {
  const latest = useRef({ people, selectedPeopleIds, removePeople, pageNotes, selectedPageNoteIds, removePageNotes, confirmFn });
  latest.current = { people, selectedPeopleIds, removePeople, pageNotes, selectedPageNoteIds, removePageNotes, confirmFn };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isDeleteSelectionShortcut(event) || isDialogOpen()) return;
      const current = latest.current;
      // Only ids that still exist: a selection can outlive what it names.
      const selectedPeople = current.selectedPeopleIds
        .map((id) => current.people.find((person) => person.id === id))
        .filter((person): person is Person => Boolean(person));
      const selectedNotes = current.selectedPageNoteIds
        .map((id) => current.pageNotes.find((note) => note.id === id))
        .filter((note): note is PageNote => Boolean(note));
      if (selectedPeople.length === 0 && selectedNotes.length === 0) return;
      event.preventDefault();
      const message = deleteSelectionConfirmMessage(
        selectedPeople.map((person) => personDisplayName(person)),
        selectedNotes.map((note) => note.title)
      );
      if (!current.confirmFn(message)) return;
      if (selectedPeople.length) current.removePeople(selectedPeople.map((person) => person.id));
      if (selectedNotes.length) current.removePageNotes(selectedNotes.map((note) => note.id));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
