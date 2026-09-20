/**
 * Purpose: recognise the same underlying event reached by more than one route.
 * Spec:    n/a — regression fix, 2026-09-20
 * Tests:   src/frontend/src/utils/eventDedup.test.ts
 *
 * A partnership event is cloned onto both partners with an id suffix of `-p1`
 * / `-p2` (see the event builders). Anything that gathers a person's events
 * from several sources — their own array plus the partnerships and patterns
 * they belong to — will otherwise list the clone and the original as two
 * separate events.
 */

/** The suffix the clone path appends to a partnership event's id. */
export const CLONE_SUFFIX_PATTERN = /-p[12]$/;

/** `abc-p1` -> `abc`. Ids without a clone suffix are returned unchanged. */
export const baseEventId = (eventId: string): string =>
  eventId.replace(CLONE_SUFFIX_PATTERN, '');

/**
 * True when `ownEventIds` already holds this event — as itself, as one of its
 * `-p1` / `-p2` clones, or as the original a clone was made from.
 */
export const hasSameEvent = (eventId: string, ownEventIds: Set<string>): boolean => {
  if (ownEventIds.has(eventId)) return true;
  const base = baseEventId(eventId);
  return ownEventIds.has(base) || ownEventIds.has(`${base}-p1`) || ownEventIds.has(`${base}-p2`);
};
