/**
 * Purpose: recognise the "Individual" events that merely record a person's
 *          date field, so they can stop being created and stop being shown.
 * Spec:    n/a — 2026-09-20, reported as duplicate IND events on the timeline
 * Tests:   src/frontend/src/utils/personDateEvents.test.ts
 *
 * Saving a person used to APPEND an event every time a date field changed,
 * never updating the one it wrote last time. Correcting a birth date from
 * 1996 to 2005 therefore left both years on the timeline as separate life
 * events, and the synthesizer added a third block for the live field. The
 * date field is the record; these events are a duplicate of it.
 *
 * Two shapes exist in saved diagrams: older events carry the field name in a
 * legacy `statusLabel`, newer ones in `subtype`.
 */
import type { EmotionalProcessEvent } from '../types';

/** The label written for each person date field. */
export const PERSON_DATE_EVENT_LABELS = {
  birthDate: 'Birth Date',
  deathDate: 'Death Date',
  genderDate: 'Gender Date',
  adoptionDate: 'Adoption Date',
} as const;

/** The category these records were written under. */
export const PERSON_DATE_EVENT_CATEGORY = 'Individual';

const DATE_LABELS = new Set<string>(
  Object.values(PERSON_DATE_EVENT_LABELS).map((label) => label.toLowerCase())
);

/** Older diagrams put the field label in `statusLabel` rather than `subtype`. */
type LegacyLabelled = EmotionalProcessEvent & { statusLabel?: string };

/**
 * True when the event exists only to record a person date field — never for
 * an event the user wrote themselves, which is why the category alone is not
 * enough: "Individual" is also the default category in the Event Creator.
 */
export function isPersonDateRecordEvent(event: EmotionalProcessEvent): boolean {
  if ((event.category || '').trim().toLowerCase() !== PERSON_DATE_EVENT_CATEGORY.toLowerCase()) {
    return false;
  }
  const label = (event.subtype || (event as LegacyLabelled).statusLabel || '').trim();
  return DATE_LABELS.has(label.toLowerCase());
}

/** Drops the date records from a list, leaving everything else untouched. */
export function withoutPersonDateRecords(
  events: EmotionalProcessEvent[] = []
): EmotionalProcessEvent[] {
  return events.filter((event) => !isPersonDateRecordEvent(event));
}
