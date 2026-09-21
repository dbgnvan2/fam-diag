/**
 * Purpose: recognise the partnership events that merely record a status date
 *          or a status change, so exactly one block shows per marriage,
 *          separation, divorce or widowhood.
 * Spec:    n/a — 2026-09-20, reported as duplicate events on the timeline
 * Tests:   src/frontend/src/utils/partnershipStatusEvents.test.ts
 *
 * Saving a partnership used to APPEND two kinds of event and never update
 * either: one for the status date itself, and one dated TODAY saying the type
 * or status had changed. A marriage entered once, then edited, therefore read
 * as several separate events — on top of the block the synthesizer already
 * renders from the date field. The status date is the record.
 */
import type { EmotionalProcessEvent, Partnership } from '../types';
import { RELATIONSHIP_STATUS_DATE_LABELS } from '../constants/relationshipStatusLabels';

/** Subtypes written by the "type/status changed" record. */
export const STATUS_CHANGE_SUBTYPE_PREFIXES = ['type changed to', 'status changed to'];

/** `Married` / ` married ` / `Married?` all compare equal. */
const normalizeLabel = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z]/g, '');

const eventDate = (event: EmotionalProcessEvent): string =>
  (event.startDate || event.date || '').trim();

/** Every date the partnership records, with the status key that owns it. */
const statusDateEntries = (partnership: Partnership): Array<[string, string]> => {
  const entries: Array<[string, string]> = Object.entries(partnership.statusDates || {});
  const legacy: Array<[string, string | undefined]> = [
    ['started', partnership.relationshipStartDate],
    ['married', partnership.marriedStartDate],
    ['separated', partnership.separationDate],
    ['divorced', partnership.divorceDate],
  ];
  legacy.forEach(([key, value]) => {
    if (value) entries.push([key, value]);
  });
  return entries;
};

/**
 * True when the event exists only to record a status change or a status date
 * the partnership already carries in a field.
 *
 * A user-written relationship event is never matched: it has to both fall on
 * a recorded status date AND name that status in its subtype.
 */
export function isPartnershipStatusRecordEvent(
  event: EmotionalProcessEvent,
  partnership: Partnership
): boolean {
  // These records are always anchored to the relationship.
  if (event.anchorType && event.anchorType !== 'RELATIONSHIP_PRL') return false;
  const subtype = (event.subtype || '').trim().toLowerCase();
  if (STATUS_CHANGE_SUBTYPE_PREFIXES.some((prefix) => subtype.startsWith(prefix))) {
    return true;
  }
  if (!subtype) return false;

  const date = eventDate(event);
  if (!date) return false;
  const normalizedSubtype = normalizeLabel(subtype);

  // The subtype has to be one of the labels the producer actually writes —
  // an exact match, not a stem. A fuzzy match hid the user's own records:
  // "Marriage counselling", "Separation anxiety" and "Started counselling"
  // all share a stem with a status but are nothing to do with one.
  const isKnownLabel =
    RELATIONSHIP_STATUS_DATE_LABELS.has(subtype) ||
    statusDateEntries(partnership).some(
      ([statusKey]) => normalizeLabel(statusKey) === normalizedSubtype
    );
  if (!isKnownLabel) return false;

  // ...and it has to fall on the date that status actually holds.
  return statusDateEntries(partnership).some(
    ([, statusDate]) => statusDate.trim() === date
  );
}

/** Drops those records from a list, leaving user-written events untouched. */
export function withoutPartnershipStatusRecords(
  events: EmotionalProcessEvent[] = [],
  partnership: Partnership
): EmotionalProcessEvent[] {
  return events.filter((event) => !isPartnershipStatusRecordEvent(event, partnership));
}
