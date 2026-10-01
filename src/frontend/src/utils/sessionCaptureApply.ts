/**
 * Purpose: apply the session-capture operations the user ticked, and say
 *          exactly what was and was not applied.
 * Spec:    n/a — review 2026-09-30 (DE2-01, DE2-02, DE2-07, capture-03,
 *          capture-04)
 * Tests:   src/frontend/src/utils/sessionCaptureApply.test.ts
 *
 * This logic lived inside DiagramEditor, where it:
 *   - reported an `upsert_partnership` as applied but never created the
 *     partnership;
 *   - built events by hand (no anchor, no subtype, an invented "Session
 *     Event" category, any eventType string from the file);
 *   - attached an operation to the first person whose name started with the
 *     hint, so "John" landed on whichever John came first;
 *   - copied payload values onto people without checking their type.
 */
import { nanoid } from 'nanoid';
import type { EmotionalProcessEvent, EventType, Partnership, Person } from '../types';
import type { SessionCaptureImportData, SessionCaptureOperation } from '../types/diagramEditor';
import { EVENT_TYPE_LABELS } from '../constants/eventConstants';
import { buildNewEventDraft, normalizeEventForSave } from './eventDraft';
import { resolveImportedGender } from './dataNormalization';
import { personDisplayName } from './personNames';

type Payload = Record<string, unknown>;

const asText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
/** A date the file gives as text, kept as written; anything else is dropped. */
const asDateText = (value: unknown): string | undefined => {
  const text = asText(value);
  return text && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(text) ? text : undefined;
};

/** Lower-case, accents removed, letters and digits of any script kept. */
export const normalizeCaptureName = (value: string | undefined): string =>
  (value || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// The name a capture is matched against: the stored name first (what the
// capture's author saw on the diagram), then first + last.
const captureName = (person: Person) => person.name || personDisplayName(person);

export type CapturePersonMatch =
  | { kind: 'found'; index: number }
  | { kind: 'none' }
  | { kind: 'ambiguous'; names: string[] };

/**
 * Which person an operation is about. An id wins. Otherwise an exact name
 * match, then a first-name match — each used only when exactly one person
 * matches; two or more is reported as ambiguous instead of picking one.
 */
export const matchCapturePerson = (
  people: Person[],
  hints: { personId?: string; names: Array<string | undefined> }
): CapturePersonMatch => {
  if (hints.personId) {
    const byId = people.findIndex((person) => person.id === hints.personId);
    if (byId >= 0) return { kind: 'found', index: byId };
  }
  const targets = hints.names.map(normalizeCaptureName).filter(Boolean);
  if (!targets.length) return { kind: 'none' };
  const normalized = people.map((person) => normalizeCaptureName(captureName(person)));
  const pick = (test: (name: string) => boolean): CapturePersonMatch | null => {
    const hits = normalized.flatMap((name, index) => (name && test(name) ? [index] : []));
    if (hits.length === 1) return { kind: 'found', index: hits[0] };
    if (hits.length > 1) return { kind: 'ambiguous', names: hits.map((index) => captureName(people[index])) };
    return null;
  };
  return (
    pick((name) => targets.includes(name)) ??
    pick((name) => targets.some((target) => name.startsWith(`${target} `))) ?? { kind: 'none' }
  );
};

const hintsFor = (operation: SessionCaptureOperation, payload: Payload) => ({
  personId: operation.matchHints?.personId,
  names: [
    operation.matchHints?.personName,
    ...(operation.matchHints?.aliases || []),
    asText(payload.personName),
    asText(payload.name),
  ],
});

/**
 * Capture files are written by a model and can repeat an operation id. The
 * dialog keys its checkboxes by id, so two operations with one id shared a
 * checkbox and an unticked one could be applied. Repeats get a unique id.
 */
export const withUniqueOperationIds = (data: SessionCaptureImportData): SessionCaptureImportData => {
  const seen = new Set<string>();
  return {
    ...data,
    operations: data.operations.map((operation, index) => {
      let id = operation.id;
      if (seen.has(id)) id = `${operation.id}#${index}`;
      seen.add(id);
      return id === operation.id ? operation : { ...operation, id };
    }),
  };
};

export type SessionCaptureResult = {
  people: Person[];
  partnerships: Partnership[];
  applied: number;
  /** Operations that changed nothing, with the reason shown to the user. */
  skipped: Array<{ id: string; reason: string }>;
  undatedEventCount: number;
};

const placeFor = (count: number) => ({ x: 120 + (count % 10) * 90, y: 140 + Math.floor(count / 10) * 90 });

const EVENT_TYPES = new Set(Object.keys(EVENT_TYPE_LABELS));

export function applySessionCaptureOperations(
  people: Person[],
  partnerships: Partnership[],
  operations: SessionCaptureOperation[],
  makeId: () => string = nanoid
): SessionCaptureResult {
  const nextPeople = [...people];
  let nextPartnerships = [...partnerships];
  const skipped: SessionCaptureResult['skipped'] = [];
  let applied = 0;
  let undatedEventCount = 0;

  const fingerprint = (personId: string, event: EmotionalProcessEvent) =>
    `${personId}|${event.date || ''}|${(event.category || '').trim().toLowerCase()}|${(event.observations || '').trim().toLowerCase()}`;
  const fingerprints = new Set<string>();
  nextPeople.forEach((person) => (person.events || []).forEach((event) => fingerprints.add(fingerprint(person.id, event))));

  const addPerson = (name: string, payload: Payload, id?: string): number => {
    nextPeople.push({
      id: id || makeId(),
      name,
      firstName: asText(payload.firstName),
      lastName: asText(payload.lastName),
      birthDate: asDateText(payload.birthDate),
      deathDate: asDateText(payload.deathDate),
      gender: resolveImportedGender(asText(payload.gender), name),
      notes: asText(payload.notes),
      ...placeFor(nextPeople.length),
      partnerships: [],
      events: [],
    });
    return nextPeople.length - 1;
  };

  /** The person for an operation: matched, created, or a reason it is skipped. */
  const resolvePerson = (
    operation: SessionCaptureOperation,
    payload: Payload,
    createWith: string | undefined
  ): number | string => {
    const match = matchCapturePerson(nextPeople, hintsFor(operation, payload));
    if (match.kind === 'found') return match.index;
    if (match.kind === 'ambiguous') return `"${createWith || '?'}" matches ${match.names.join(', ')}`;
    if (!createWith) return 'no person name';
    return addPerson(createWith, payload, operation.matchHints?.personId);
  };

  operations.forEach((operation) => {
    const payload: Payload = operation.payload || {};

    if (operation.type === 'upsert_person') {
      const name = asText(payload.name) || asText(payload.personName) || asText(operation.matchHints?.personName);
      const before = nextPeople.length;
      const target = resolvePerson(operation, payload, name);
      if (typeof target === 'string') return void skipped.push({ id: operation.id, reason: target });
      if (nextPeople.length === before) {
        // Fill only what is missing; never overwrite what the user recorded.
        const existing = nextPeople[target];
        const incomingNotes = asText(payload.notes) || '';
        nextPeople[target] = {
          ...existing,
          firstName: existing.firstName || asText(payload.firstName),
          lastName: existing.lastName || asText(payload.lastName),
          birthDate: existing.birthDate || asDateText(payload.birthDate),
          deathDate: existing.deathDate || asDateText(payload.deathDate),
          gender: existing.gender || resolveImportedGender(asText(payload.gender), captureName(existing)),
          notes:
            incomingNotes && existing.notes && !existing.notes.includes(incomingNotes)
              ? `${existing.notes}\n${incomingNotes}`
              : existing.notes || incomingNotes || undefined,
        };
      }
      applied += 1;
      return;
    }

    if (operation.type === 'add_person_event') {
      const name = asText(operation.matchHints?.personName) || asText(payload.personName) || asText(payload.name);
      const target = resolvePerson(operation, payload, name);
      if (typeof target === 'string') return void skipped.push({ id: operation.id, reason: target });
      const requestedType = asText(payload.eventType);
      if (requestedType && !EVENT_TYPES.has(requestedType)) {
        return void skipped.push({ id: operation.id, reason: `unknown event type "${requestedType}"` });
      }
      const person = nextPeople[target];
      const seed: Partial<EmotionalProcessEvent> = {
        // No date in the capture: left blank, never today.
        date: asDateText(payload.date) || asDateText(payload.startDate) || '',
        startDate: asDateText(payload.startDate) || asDateText(payload.date) || '',
        category: asText(payload.category) || '',
        subtype: asText(payload.subtype) || '',
        intensity: asNumber(payload.intensity) ?? 0,
        frequency: asNumber(payload.frequency) ?? 0,
        impact: asNumber(payload.impact) ?? 0,
        howWell: asNumber(payload.howWell) ?? 0,
        otherPersonName: asText(payload.otherPersonName),
        wwwwh: asText(payload.wwwwh) || '',
        observations: asText(payload.observations) || asText(payload.notes) || '',
        priorEventsNote: asText(payload.priorEventsNote) || '',
        reflectionsNote: asText(payload.reflectionsNote) || '',
      };
      const context = {
        anchorType: 'PERSON' as const,
        anchorId: person.id,
        eventClass: 'individual' as const,
        primaryPersonName: person.name,
      };
      const event = normalizeEventForSave(
        buildNewEventDraft({ ...context, eventType: (requestedType as EventType) || 'NODAL', seed }),
        context
      );
      const key = fingerprint(person.id, event);
      if (fingerprints.has(key)) return void skipped.push({ id: operation.id, reason: 'already in the diagram' });
      fingerprints.add(key);
      if (!event.startDate) undatedEventCount += 1;
      nextPeople[target] = { ...person, events: [...(person.events || []), event] };
      applied += 1;
      return;
    }

    if (operation.type === 'upsert_partnership') {
      const name1 = asText(payload.partner1Name) || asText(payload.partner1);
      const name2 = asText(payload.partner2Name) || asText(payload.partner2);
      if (!name1 || !name2) return void skipped.push({ id: operation.id, reason: 'needs both partners' });
      const asPersonOp = (name: string): SessionCaptureOperation => ({ ...operation, matchHints: { personName: name } });
      const first = resolvePerson(asPersonOp(name1), { personName: name1 }, name1);
      if (typeof first === 'string') return void skipped.push({ id: operation.id, reason: first });
      const second = resolvePerson(asPersonOp(name2), { personName: name2 }, name2);
      if (typeof second === 'string') return void skipped.push({ id: operation.id, reason: second });
      const a = nextPeople[first];
      const b = nextPeople[second];
      if (a.id === b.id) return void skipped.push({ id: operation.id, reason: 'both partners are the same person' });
      const type = asText(payload.relationshipType);
      const status = asText(payload.relationshipStatus);
      const existing = nextPartnerships.find(
        (entry) =>
          (entry.partner1_id === a.id && entry.partner2_id === b.id) ||
          (entry.partner1_id === b.id && entry.partner2_id === a.id)
      );
      if (existing) {
        nextPartnerships = nextPartnerships.map((entry) =>
          entry.id === existing.id
            ? {
                ...entry,
                relationshipType: type || entry.relationshipType,
                relationshipStatus: status || entry.relationshipStatus,
              }
            : entry
        );
      } else {
        const id = makeId();
        nextPartnerships = [
          ...nextPartnerships,
          {
            id,
            partner1_id: a.id,
            partner2_id: b.id,
            horizontalConnectorY: Math.max(a.y, b.y) + 100,
            // The same defaults as Add Partner when the capture names none.
            relationshipType: type || 'dating',
            relationshipStatus: status || 'ongoing',
            children: [],
            events: [],
          },
        ];
        nextPeople[first] = { ...a, partnerships: [...(a.partnerships || []), id] };
        nextPeople[second] = { ...b, partnerships: [...(b.partnerships || []), id] };
      }
      applied += 1;
    }
  });

  return { people: nextPeople, partnerships: nextPartnerships, applied, skipped, undatedEventCount };
}

/** The message shown after applying: what was applied, and what was not, and why. */
export const sessionCaptureSummary = (result: SessionCaptureResult): string => {
  const lines = [`Applied ${result.applied} reviewed session operation${result.applied === 1 ? '' : 's'}.`];
  if (result.skipped.length) {
    lines.push(`${result.skipped.length} not applied:`);
    result.skipped.forEach((entry) => lines.push(`- ${entry.id}: ${entry.reason}`));
  }
  if (result.undatedEventCount) {
    const n = result.undatedEventCount;
    lines.push(`${n} event${n === 1 ? '' : 's'} had no date and ${n === 1 ? 'was' : 'were'} added without one.`);
  }
  return lines.join('\n');
};
