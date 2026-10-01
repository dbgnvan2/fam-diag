import type { Partnership, Person } from '../types';

/**
 * Display names for people and couples (review struct-11). The canvas,
 * Timeline, Properties panel and editor each built these inline with
 * different fallbacks and separators; new code should call these.
 */

/** "First Last" when either is set, else the stored `name`, else `fallback`. */
export const personDisplayName = (
  person: Pick<Person, 'firstName' | 'lastName' | 'name'> | null | undefined,
  fallback = ''
): string => {
  if (!person) return fallback;
  const combined = [person.firstName?.trim(), person.lastName?.trim()].filter(Boolean).join(' ');
  return combined || person.name?.trim() || fallback;
};

/** "Partner A + Partner B"; a missing partner reads "Partner 1" / "Partner 2". */
export const coupleDisplayName = (
  partnership: Pick<Partnership, 'partner1_id' | 'partner2_id'>,
  people: Person[]
): string => {
  const find = (id: string) => people.find((person) => person.id === id);
  const first = personDisplayName(find(partnership.partner1_id), 'Partner 1');
  const second = personDisplayName(find(partnership.partner2_id), 'Partner 2');
  return `${first} + ${second}`;
};

/**
 * Two partners' names as one label, "A + B" — or just the one that is known,
 * or `fallback` when neither is. The one couple format for panel titles,
 * Timeline lanes and relatives' event labels (they used "&", "/" and "+").
 */
export const joinCoupleNames = (name1: string | undefined, name2: string | undefined, fallback = ''): string =>
  [name1?.trim(), name2?.trim()].filter(Boolean).join(' + ') || fallback;
