/**
 * Purpose: build the event a session note's "Make Event" opens, and decide
 *          whether the note in progress has unsaved changes.
 * Spec:    n/a — REVIEW-unread-areas-2026-09-30.md M16 / M17
 * Tests:   src/frontend/src/utils/sessionNoteEvents.test.ts
 *
 * The draft used to fill in values the user never gave: intensity 5 and
 * how-well 5 (0 is "unset"), a 1 January date built from any four-digit
 * number in the text, and an "other person" found by plain substring, so
 * "Al" matched "also". It also never set startDate, anchorType, anchorId or
 * subtype. Now it holds only the note's own text and the target it belongs
 * to; saving goes through utils/eventDraft like every other event.
 */
import type { EmotionalLine, EmotionalProcessEvent, Partnership, Person } from '../types';
import type { SessionNoteFileRecord } from '../types/diagramEditor';
import { anchorTypeForOwner, buildNewEventDraft, eventClassForOwner, type EventOwnerKind } from './eventDraft';

export type SessionEventTarget = { type: EventOwnerKind; id: string };

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The first person named in `text` as a whole word (case-insensitive),
 * trying longer names first so "Ann Lee" wins over "Ann". Undefined when no
 * name appears.
 */
export const findMentionedPerson = (
  text: string,
  people: Person[],
  excludeId?: string,
): Person | undefined =>
  [...people]
    .filter((person) => person.id !== excludeId && (person.name || '').trim())
    .sort((a, b) => b.name.trim().length - a.name.trim().length)
    .find((person) =>
      new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(person.name.trim())}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text),
    );

/** The name the target's events are recorded under. */
const primaryNameFor = (
  target: SessionEventTarget,
  people: Person[],
  partnerships: Partnership[],
  emotionalLines: EmotionalLine[],
): string => {
  const nameOf = (id?: string) => people.find((p) => p.id === id)?.name || '';
  if (target.type === 'person') return nameOf(target.id);
  if (target.type === 'partnership') {
    return nameOf(partnerships.find((p) => p.id === target.id)?.partner1_id);
  }
  return nameOf(emotionalLines.find((line) => line.id === target.id)?.person1_id);
};

export const buildSessionEventDraft = ({
  snippet,
  target,
  people,
  partnerships,
  emotionalLines,
}: {
  snippet: string;
  target: SessionEventTarget;
  people: Person[];
  partnerships: Partnership[];
  emotionalLines: EmotionalLine[];
}): EmotionalProcessEvent => {
  const text = snippet.trim();
  const mentioned = findMentionedPerson(text, people, target.type === 'person' ? target.id : undefined);
  return buildNewEventDraft({
    eventType: target.type === 'emotional' ? 'EPE' : 'NODAL',
    anchorType: anchorTypeForOwner(target.type),
    anchorId: target.id,
    eventClass: eventClassForOwner(target.type),
    primaryPersonName: primaryNameFor(target, people, partnerships, emotionalLines),
    seed: {
      wwwwh: text,
      observations: text,
      otherPersonName: mentioned?.name || 'None',
    },
  });
};

type SessionNoteContent = Pick<SessionNoteFileRecord, 'coachName' | 'clientName' | 'presentingIssue' | 'noteContent'>;

/**
 * True when the note in progress differs from its saved record — or, for a
 * note never saved, when it has any content at all.
 */
export const isSessionNoteDirty = (current: SessionNoteContent, saved: SessionNoteContent | null | undefined): boolean => {
  const fields: Array<keyof SessionNoteContent> = ['coachName', 'clientName', 'presentingIssue', 'noteContent'];
  if (!saved) return fields.some((field) => (current[field] || '').trim() !== '');
  return fields.some((field) => (current[field] || '') !== (saved[field] || ''));
};
