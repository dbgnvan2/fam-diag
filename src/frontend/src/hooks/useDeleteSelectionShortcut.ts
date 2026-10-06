import { useEffect, useRef } from 'react';
import type { Person } from '../types';
import { isDialogOpen } from './useDialogFocus';
import { deletePeopleConfirmMessage, isDeleteSelectionShortcut } from '../utils/deleteSelectionShortcut';
import { personDisplayName } from '../utils/personNames';

type Options = {
  people: Person[];
  selectedPeopleIds: string[];
  removePeople: (personIds: string[]) => void;
  /** Injected for tests; window.confirm in the app. */
  confirmFn?: (message: string) => boolean;
};

/**
 * Purpose: CMD-X / Ctrl-X deletes the selected people after a confirm.
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
  confirmFn = (message) => window.confirm(message),
}: Options) {
  const latest = useRef({ people, selectedPeopleIds, removePeople, confirmFn });
  latest.current = { people, selectedPeopleIds, removePeople, confirmFn };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isDeleteSelectionShortcut(event) || isDialogOpen()) return;
      const { people: list, selectedPeopleIds: ids, removePeople: remove, confirmFn: confirm } = latest.current;
      const selected = ids
        .map((id) => list.find((person) => person.id === id))
        .filter((person): person is Person => Boolean(person));
      if (selected.length === 0) return;
      event.preventDefault();
      if (!confirm(deletePeopleConfirmMessage(selected.map((person) => personDisplayName(person))))) return;
      remove(selected.map((person) => person.id));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
