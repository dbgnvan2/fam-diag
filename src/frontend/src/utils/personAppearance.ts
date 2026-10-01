import type { Person } from '../types';

export const DEFAULT_PERSON_BORDER_COLOR = '#000000';

/**
 * Whether a person's custom border colour is in use. A colour stored without
 * the flag (older files) counts as enabled.
 */
export const isPersonBorderEnabled = (person: Pick<Person, 'borderEnabled' | 'borderColor'>) =>
  person.borderEnabled ?? !!person.borderColor;

/**
 * The border colour the canvas actually draws: the stored colour only when
 * the custom border is enabled, the default otherwise. The multi-select
 * panel compares people by this, not by the raw `borderColor` (review
 * nodes-05).
 */
export const effectivePersonBorderColor = (person: Pick<Person, 'borderEnabled' | 'borderColor'>) =>
  isPersonBorderEnabled(person)
    ? person.borderColor ?? DEFAULT_PERSON_BORDER_COLOR
    : DEFAULT_PERSON_BORDER_COLOR;
