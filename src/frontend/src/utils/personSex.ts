import type { Person } from '../types';

/**
 * True when nothing about a person's sex has been recorded: no gender, birth
 * sex, gender identity or symbol (or gender stored as "unknown"). Imports
 * leave all of these unset rather than guessing; such people are drawn as a
 * triangle, the genogram mark for unknown sex.
 */
export const isSexUnknown = (person: Pick<Person, 'gender' | 'birthSex' | 'genderIdentity' | 'genderSymbol'>) =>
  !person.genderSymbol &&
  !person.birthSex &&
  !person.genderIdentity &&
  (!person.gender || person.gender.trim().toLowerCase() === 'unknown');
