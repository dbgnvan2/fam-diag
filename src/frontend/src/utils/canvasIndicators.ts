/**
 * Purpose: what the canvas shows as a person's age and as the "current"
 *          rating of an indicator (Emotional Autonomy square, family
 *          Triangle / Stress marks). Domain rules, kept out of the node
 *          components.
 * Spec:    n/a — review 2026-09-30 (nodes-01, nodes-02, nodes-03)
 * Tests:   src/frontend/src/utils/canvasIndicators.test.ts
 */
import type { EmotionalProcessEvent, Person } from '../types';
import { ageInYears, parseCalendarDate } from './dateFormatting';

const eventDate = (event: EmotionalProcessEvent) => (event.startDate || event.date || '').trim();

/**
 * The event with the latest date. Undated events count as older than any
 * dated one; among equals the one recorded last wins. (Array order is the
 * order events were created, so the last one was not necessarily the latest
 * — a backfilled 2010 event used to replace a 2022 one.)
 */
export const latestEventByDate = (events: EmotionalProcessEvent[]): EmotionalProcessEvent | undefined =>
  events.reduce<EmotionalProcessEvent | undefined>((best, event) => {
    if (!best) return event;
    const a = eventDate(best);
    const b = eventDate(event);
    if (!b) return a ? best : event;
    if (!a) return event;
    return b >= a ? event : best;
  }, undefined);

/** A 1-5 rating, or '' when it was never given (0 means unset). */
export const ratingLabel = (intensity: number | undefined): string =>
  typeof intensity === 'number' && intensity > 0 ? String(intensity) : '';

/**
 * The latest Emotional Autonomy rating the user actually gave. An unrated EA
 * event (intensity 0) neither shows "0" nor hides an older real rating.
 */
export const latestEmotionalAutonomyLevel = (events: EmotionalProcessEvent[] | undefined): number | null => {
  const rated = (events || []).filter(
    (event) => event.eventType === 'EA' && typeof event.intensity === 'number' && event.intensity > 0
  );
  const latest = latestEventByDate(rated);
  return latest ? latest.intensity : null;
};

/**
 * "Age N", or null when no true age can be given: no birth date; deceased
 * with the death date unknown; a miscarriage or stillbirth. (These used to
 * be aged to today — "Age 126" for someone born in 1900.)
 */
export const personAgeLabel = (person: Person, today: Date): string | null => {
  if (person.lifeStatus && person.lifeStatus !== 'alive') return null;
  if (person.deathDateKnown && !parseCalendarDate(person.deathDate)) return null;
  const age = ageInYears(person.birthDate, person.deathDate, today);
  return age === null ? null : `Age ${age}`;
};
