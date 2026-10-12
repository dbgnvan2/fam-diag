import { useEffect, useState } from 'react';
import type { Person } from '../types';

type Options = {
  people: Person[];
  /** The existing two-person Add Emotional Pattern dialog. */
  openAddEmotionalPatternModal: (person1Id: string, person2Id: string) => void;
};

/**
 * Purpose: start an Emotional Pattern from one person's right-click menu,
 * then take the second person from the next person click.
 * Tests:   src/frontend/src/hooks/useEmotionalPatternPick.test.ts
 *
 * The second click opens the same dialog as selecting two people and
 * choosing Add Emotional Pattern, so both routes share one save path.
 * Clicking the first person again keeps waiting; Esc or cancelPick ends it.
 */
export function useEmotionalPatternPick({ people, openAddEmotionalPatternModal }: Options) {
  const [firstPersonId, setFirstPersonId] = useState<string | null>(null);
  // The first person can be deleted while the pick is waiting.
  const firstPerson = firstPersonId ? people.find((person) => person.id === firstPersonId) || null : null;
  const pending = firstPerson ? firstPerson.id : null;

  useEffect(() => {
    if (!pending) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFirstPersonId(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [pending]);

  const startPick = (personId: string) => setFirstPersonId(personId);
  const cancelPick = () => setFirstPersonId(null);

  /** Returns true when the click was taken by the pick. */
  const handlePickClick = (personId: string): boolean => {
    if (!pending) return false;
    if (personId === pending) return true;
    setFirstPersonId(null);
    openAddEmotionalPatternModal(pending, personId);
    return true;
  };

  return { patternPickFirstPerson: firstPerson, startPick, cancelPick, handlePickClick };
}
