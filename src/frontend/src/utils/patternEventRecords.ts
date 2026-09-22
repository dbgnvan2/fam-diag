/**
 * Purpose: recognise the emotional-pattern events that only recorded an EDIT,
 *          so a pattern shows one event for itself plus one each for its
 *          start and end dates.
 * Spec:    n/a — 2026-09-22, the user's model for emotional patterns
 * Tests:   src/frontend/src/utils/patternEventRecords.test.ts
 *
 * The model: creating a pattern is one event; its start date and end date
 * are separate events of that pattern. Measurements of its intensity over
 * time are real data and stay.
 *
 * Saving a pattern used to append two kinds of record on every edit, never
 * replacing the last:
 *
 *   - a DATE record when the start or end date changed, subtype
 *     "Fusion – Ongoing – Pattern Start" — duplicating the Pattern Started /
 *     Pattern Ended that syntheticDateEvents renders from the field;
 *   - a CHANGE record dated today when the type, status or style changed,
 *     subtype "Style: Conflict Solid Wide".
 *
 * Both carry exact, closed-form subtypes, and they are matched exactly. The
 * category alone is useless here — "Emotional Pattern" is also the category
 * of the pattern's own creation event and of every measurement, both of
 * which must survive. An earlier loose matcher on partnership records hid
 * real events such as "Marriage counselling"; this does not repeat that.
 */
import type { EmotionalProcessEvent } from '../types';

/** The category every pattern event is written under. */
export const PATTERN_EVENT_CATEGORY = 'Emotional Pattern';

/**
 * The date record's subtype was always exactly three parts joined by an EN
 * DASH: `${type} – ${status} – ${stage}`, the last being one of these.
 */
export const PATTERN_DATE_RECORD_STAGES = ['Pattern Start', 'Pattern End'];
const EN_DASH_SEPARATOR = ' – ';

/** Each comma-separated segment of a change record starts with one of these. */
export const PATTERN_CHANGE_RECORD_KEYS = ['Type: ', 'Status: ', 'Style: '];

const isPatternCategory = (event: EmotionalProcessEvent): boolean =>
  (event.category || '').trim() === PATTERN_EVENT_CATEGORY;

/** "Fusion – Ongoing – Pattern Start" — exactly that three-part shape. */
export function isPatternDateRecordEvent(event: EmotionalProcessEvent): boolean {
  if (!isPatternCategory(event)) return false;
  const parts = (event.subtype || '').trim().split(EN_DASH_SEPARATOR);
  return (
    parts.length === 3 &&
    parts.every((part) => part.trim().length > 0) &&
    PATTERN_DATE_RECORD_STAGES.includes(parts[2].trim())
  );
}

/** "Type: Conflict, Style: Conflict Solid Wide" */
export function isPatternChangeRecordEvent(event: EmotionalProcessEvent): boolean {
  if (!isPatternCategory(event)) return false;
  const subtype = (event.subtype || '').trim();
  if (!subtype) return false;
  const segments = subtype.split(',').map((segment) => segment.trim());
  // EVERY segment must be a property change; one free-text segment and the
  // event is the user's own.
  return segments.every((segment) =>
    PATTERN_CHANGE_RECORD_KEYS.some((key) => segment.startsWith(key) && segment.length > key.length)
  );
}

/** True when the event only recorded an edit to the pattern. */
export function isPatternEditRecordEvent(event: EmotionalProcessEvent): boolean {
  return isPatternDateRecordEvent(event) || isPatternChangeRecordEvent(event);
}

/** Drops the edit records, leaving creation, measurements and user events. */
export function withoutPatternEditRecords(
  events: EmotionalProcessEvent[] = []
): EmotionalProcessEvent[] {
  return events.filter((event) => !isPatternEditRecordEvent(event));
}
