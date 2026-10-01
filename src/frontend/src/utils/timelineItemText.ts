/**
 * Purpose: what a timeline block says in its box, and what its hover bubble
 *          says.
 * Spec:    n/a — usability fix, 2026-09-19
 * Tests:   src/frontend/src/utils/timelineItemText.test.ts
 *
 * Blocks are laid out by date, so a short event is only a few pixels wide and
 * its label is cut to a character or two. The box therefore carries a
 * three-letter code — Bir, Dea, Mar, Div — and the hover bubble carries the
 * full identification: what happened, to whom, and how they relate to the
 * person whose lane it is.
 */
import type { EmotionalProcessEvent } from '../types';
import { SYNTHETIC_EVENT_NOTE } from './syntheticDateEvents';
import {
  INTENSITY_BORDER,
  INTENSITY_FILL,
  INTENSITY_UNRATED_BORDER,
  INTENSITY_UNRATED_FILL,
  type TimelineBlockShape,
} from '../constants/timelineBlockStyle';
import { resolveBinarySex, type SexFields } from './personSex';

type NameableEvent = Pick<
  EmotionalProcessEvent,
  'category' | 'eventType' | 'symptomType' | 'subtype' | 'sourceIndicatorId'
>;

/**
 * An event that describes a symptom, whatever its eventType says. Real data
 * records these as `FF` as often as `SYMPTOM`, but both carry the
 * `sourceIndicatorId` of the indicator they came from — that, not the type
 * tag, is the reliable marker.
 */
const isSymptomLike = (event: NameableEvent): boolean =>
  event.eventType === 'SYMPTOM' || !!event.sourceIndicatorId;

/**
 * What to call an event on a timeline block. A symptom's `category` is its
 * group ("physical"), which says nothing useful — the symptom itself is on
 * `symptomType` / `subtype`, so "Anxiety" beats "physical".
 */
export function eventDisplayName(event: NameableEvent, fallback = 'Event'): string {
  if (isSymptomLike(event)) {
    const symptom = (event.symptomType || event.subtype || '').trim();
    if (symptom) return symptom;
  }
  return (event.category || '').trim() || fallback;
}

/** "Birth" -> "Bir", "Marriage" -> "Mar", "Relationship Started" -> "Rel". */
export function eventAbbreviation(eventName?: string | null): string {
  const cleaned = (eventName || '').trim();
  if (!cleaned) return '—';
  // Take the first word with letters or digits in it, so "Family: Stress"
  // abbreviates on "Family" rather than on the punctuation.
  const firstWord = cleaned.split(/[\s:·—-]+/).find((part) => /[A-Za-z0-9]/.test(part));
  const source = firstWord || cleaned;
  return source.slice(0, 3);
}

/** Drops the synthesizer's own explanatory text — it is not a user note. */
export function realNote(observations?: string | null): string {
  const value = (observations || '').trim();
  return value === SYNTHETIC_EVENT_NOTE ? '' : value;
}

export type TimelineHoverParts = {
  /** What happened: "Birth", "Marriage", "Relocation". */
  eventName: string;
  /** Who it belongs to: "Jim Doe", "Noah Reed + Emma Carter". */
  ownerName?: string;
  /** How they relate to the lane person: "Grandson", "Father", "Parents". */
  relation?: string;
  /** The user's own note, if there is one. */
  note?: string;
  /** Date range, already formatted. */
  dateRange?: string;
};

/**
 * "Birth — Jim Doe — Grandson", with the date and any real note underneath.
 * Empty parts are dropped rather than rendered as blanks or dashes.
 */
export function buildTimelineHoverText({
  eventName,
  ownerName,
  relation,
  note,
  dateRange,
}: TimelineHoverParts): string {
  const headline = [eventName, ownerName, relation]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(' — ');
  const lines = [headline || 'Event'];
  if (dateRange) lines.push(dateRange);
  const cleanedNote = realNote(note);
  if (cleanedNote) lines.push(cleanedNote);
  return lines.join('\n');
}

/**
 * Purpose: which shape a block takes, from the sex of the person whose event
 *          it is. Events that belong to a couple, a family or a pattern have
 *          no single person, so they stay neutral.
 * Tests:   timelineItemText.test.ts::test_timeline_shape_follows_the_owner_sex
 */
export function blockShapeForPerson(person?: SexFields | null): TimelineBlockShape {
  // The shared sex rule (utils/personSex.ts), not a local copy (gate
  // 2026-10-01 #3).
  const sex = resolveBinarySex(person);
  if (sex === 'male') return 'rect';
  if (sex === 'female') return 'oval';
  return 'neutral';
}

/** Fill and border for an event's intensity (1-5; 0 or unset = unrated). */
export function intensityStyle(intensity?: number | null): {
  fill: string;
  border: string;
} {
  const level = typeof intensity === 'number' ? Math.round(intensity) : 0;
  if (level >= 1 && level <= 5) {
    return { fill: INTENSITY_FILL[level], border: INTENSITY_BORDER[level] };
  }
  return { fill: INTENSITY_UNRATED_FILL, border: INTENSITY_UNRATED_BORDER };
}
