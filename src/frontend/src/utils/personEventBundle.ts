import type { EmotionalProcessEvent, EventAnchorType, EventClass, EventType, Person } from '../types';
import { EVENT_STATUS_OPTIONS, EVENT_TYPE_LABELS, inferEventType } from '../constants/eventConstants';
import { withoutPersonDateRecords } from './personDateEvents';
import { anchorTypeForOwner, createEventId, eventClassForOwner, normalizeEventForSave } from './eventDraft';
import { personDisplayName } from './personNames';

/**
 * A person's name as a matching key (bundle-02). NFKD splits accented
 * letters into letter + mark, the marks are dropped, and every letter or
 * digit in any script is kept, so "José" matches "Jose" and "李明" stays
 * "李明". The old ASCII-only rule turned "李明" into "" and "José" into "jos".
 */
export const normalizePersonNameKey = (value?: string): string =>
  (value || '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// The app's one display-name rule (utils/personNames.ts), so a bundle names
// people as the rest of the app does (gate 2026-10-01 #6).
const displayName = (person: Person): string => personDisplayName(person);

export type PersonEventBundlePerson = {
  personId?: string;
  personName: string;
  baselineEventIds?: string[];
  events: EmotionalProcessEvent[];
};

export type PersonEventBundle = {
  kind: 'fam-diag-person-events';
  version: 1;
  exportedAt: string;
  sourceFileName?: string;
  people: PersonEventBundlePerson[];
};

export type TimelineJson = {
  kind: 'fam-diag-timeline';
  version: 1;
  timelineName: string;
  exportedAt: string;
  sourceFileName?: string;
  people: PersonEventBundlePerson[];
};

const stripFileExtension = (value: string) => value.replace(/\.[^.]+$/, '');

const toTimelineName = (sourceFileName?: string) => {
  const base = stripFileExtension(sourceFileName || 'timeline');
  return `${base} - timeline`;
};

export const buildPersonEventBundle = (people: Person[], sourceFileName?: string): PersonEventBundle => ({
  kind: 'fam-diag-person-events',
  version: 1,
  exportedAt: new Date().toISOString(),
  sourceFileName,
  people: people.map((person) => {
    // The old person-date records are hidden on the Events tab and the
    // Timeline (the date field is the record); the Event Creator lists them
    // no more than those do. They are left out of the baseline too, so
    // merging an edited bundle back keeps them rather than reading them as
    // deleted.
    // Events are exported as stored (bundle-03): the export used to fill a
    // category of "Event" and force eventClass "individual", values the user
    // never gave, which then came back on import.
    const exportedEvents = withoutPersonDateRecords(person.events || []).map((event) => ({ ...event }));
    return {
      personId: person.id,
      personName: displayName(person) || 'Unnamed',
      baselineEventIds: exportedEvents.map((event) => event.id),
      events: exportedEvents,
    };
  }),
});

export const buildTimelineJson = (people: Person[], sourceFileName?: string): TimelineJson => ({
  kind: 'fam-diag-timeline',
  version: 1,
  timelineName: toTimelineName(sourceFileName),
  exportedAt: new Date().toISOString(),
  sourceFileName,
  people: buildPersonEventBundle(people, sourceFileName).people,
});

const isPersonEntry = (item: unknown): boolean =>
  !!item &&
  typeof item === 'object' &&
  typeof (item as PersonEventBundlePerson).personName === 'string' &&
  Array.isArray((item as PersonEventBundlePerson).events);

/**
 * The file's shape only: each person entry has a name and an events array.
 * The events themselves are checked one by one by sanitizeBundlePeople.
 */
export const isPersonEventBundle = (value: unknown): value is PersonEventBundle => {
  if (!value || typeof value !== 'object') return false;
  const raw = value as Partial<PersonEventBundle>;
  if (raw.kind !== 'fam-diag-person-events' || raw.version !== 1 || !Array.isArray(raw.people)) return false;
  return raw.people.every(isPersonEntry);
};

export const isTimelineJson = (value: unknown): value is TimelineJson => {
  if (!value || typeof value !== 'object') return false;
  const raw = value as Partial<TimelineJson>;
  if (raw.kind !== 'fam-diag-timeline' || raw.version !== 1 || !Array.isArray(raw.people)) return false;
  return raw.people.every(isPersonEntry);
};

export const timelineJsonToBundle = (timeline: TimelineJson): PersonEventBundle => ({
  kind: 'fam-diag-person-events',
  version: 1,
  exportedAt: timeline.exportedAt,
  sourceFileName: timeline.sourceFileName || timeline.timelineName,
  people: timeline.people,
});

// ─── Per-event validation (bundle-04) ────────────────────────────────────────

const STRING_FIELDS = [
  'date',
  'startDate',
  'endDate',
  'category',
  'subtype',
  'anchorId',
  'otherPersonName',
  'primaryPersonName',
  'wwwwh',
  'observations',
  'priorEventsNote',
  'reflectionsNote',
  'sourceIndicatorId',
  'symptomType',
] as const;

const RATING_FIELDS = ['intensity', 'howWell', 'frequency', 'impact'] as const;

const EVENT_CLASSES: Record<EventClass, true> = {
  individual: true,
  relationship: true,
  'emotional-pattern': true,
  family: true,
  triangle: true,
};

const ANCHOR_TYPES: Record<EventAnchorType, true> = {
  PERSON: true,
  RELATIONSHIP_PRL: true,
  EMOTIONAL_PROCESS_EP: true,
  FAMILY: true,
  TRIANGLE: true,
};

const STATUSES = new Set<string>(EVENT_STATUS_OPTIONS.map((option) => option.value));

type RatingRead = { value: number; unreadable: boolean };

/**
 * A rating from a file: a number is kept, a numeric string ("4") is read as
 * that number, and anything else is left unset (0) and reported — never
 * silently zeroed (bundle-03).
 */
const readRating = (value: unknown): RatingRead => {
  if (value === undefined || value === null || value === '') return { value: 0, unreadable: false };
  if (typeof value === 'number') return Number.isFinite(value) ? { value, unreadable: false } : { value: 0, unreadable: true };
  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value.trim());
    if (Number.isFinite(numeric)) return { value: numeric, unreadable: false };
  }
  return { value: 0, unreadable: true };
};

export type SanitizedEvent = { event: EmotionalProcessEvent; unreadableRatings: number };

/**
 * One event read from a bundle or timeline file, or null when it cannot be
 * shown or saved: not an object, an id that is not a string, a text field
 * that is not text (an object-valued `observations` crashed the Event
 * Creator), or an unknown type, status, class or anchor. A missing type is
 * inferred the way the app reads every legacy event (inferEventType); a
 * missing class is the person owner's.
 */
export const sanitizeBundleEvent = (raw: unknown): SanitizedEvent | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  if (source.id !== undefined && source.id !== null && typeof source.id !== 'string') return null;
  for (const field of STRING_FIELDS) {
    const value = source[field];
    if (value !== undefined && value !== null && typeof value !== 'string') return null;
  }
  if (source.eventType !== undefined && source.eventType !== null) {
    if (typeof source.eventType !== 'string' || !(source.eventType in EVENT_TYPE_LABELS)) return null;
  }
  if (source.status !== undefined && source.status !== null) {
    if (typeof source.status !== 'string' || !STATUSES.has(source.status)) return null;
  }
  if (source.eventClass !== undefined && source.eventClass !== null) {
    if (typeof source.eventClass !== 'string' || !(source.eventClass in EVENT_CLASSES)) return null;
  }
  if (source.anchorType !== undefined && source.anchorType !== null) {
    if (typeof source.anchorType !== 'string' || !(source.anchorType in ANCHOR_TYPES)) return null;
  }

  const text: Partial<Record<(typeof STRING_FIELDS)[number], string>> = {};
  for (const field of STRING_FIELDS) {
    const value = source[field];
    if (typeof value === 'string') text[field] = value;
  }
  let unreadableRatings = 0;
  const ratings = {} as Record<(typeof RATING_FIELDS)[number], number>;
  for (const field of RATING_FIELDS) {
    const read = readRating(source[field]);
    if (read.unreadable) unreadableRatings += 1;
    ratings[field] = read.value;
  }

  const storedType = source.eventType as EventType | undefined;
  const base: Omit<EmotionalProcessEvent, 'eventType'> = {
    ...(source as Partial<EmotionalProcessEvent>),
    ...text,
    ...ratings,
    id: typeof source.id === 'string' && source.id ? source.id : createEventId(),
    date: text.date ?? '',
    category: text.category ?? '',
    otherPersonName: text.otherPersonName ?? '',
    wwwwh: text.wwwwh ?? '',
    observations: text.observations ?? '',
    status: (source.status as EmotionalProcessEvent['status'] | undefined) || 'discrete',
    eventClass: (source.eventClass as EventClass | undefined) || eventClassForOwner('person'),
    anchorType: (source.anchorType as EventAnchorType | undefined) || undefined,
    createdAt: typeof source.createdAt === 'number' ? source.createdAt : undefined,
  };
  // inferEventType is written for stored legacy events, which can lack a type.
  const eventType = storedType || inferEventType({ ...base } as unknown as EmotionalProcessEvent);
  return { event: { ...base, eventType }, unreadableRatings };
};

export type SanitizedBundlePeople = {
  people: PersonEventBundlePerson[];
  /** Events that were dropped because they could not be read. */
  droppedEvents: number;
  /** Rating values that were not numbers, left unset (0). */
  unreadableRatings: number;
};

/**
 * Check every event in a bundle's people (bundle-04). Invalid entries are
 * dropped and counted. A dropped event's id is also taken out of the
 * baseline, so the merge keeps the diagram's copy instead of reading the
 * unreadable entry as a deletion.
 */
export const sanitizeBundlePeople = (people: PersonEventBundlePerson[]): SanitizedBundlePeople => {
  let droppedEvents = 0;
  let unreadableRatings = 0;
  const cleaned = people.map((person) => {
    const droppedIds = new Set<string>();
    const events: EmotionalProcessEvent[] = [];
    (person.events || []).forEach((raw: unknown) => {
      const sanitized = sanitizeBundleEvent(raw);
      if (!sanitized) {
        droppedEvents += 1;
        const rawId = raw && typeof raw === 'object' ? (raw as { id?: unknown }).id : undefined;
        if (typeof rawId === 'string') droppedIds.add(rawId);
        return;
      }
      unreadableRatings += sanitized.unreadableRatings;
      events.push(sanitized.event);
    });
    const baselineEventIds = Array.isArray(person.baselineEventIds)
      ? person.baselineEventIds.filter((id): id is string => typeof id === 'string' && !droppedIds.has(id))
      : undefined;
    return {
      ...person,
      personId: typeof person.personId === 'string' ? person.personId : undefined,
      ...(baselineEventIds ? { baselineEventIds } : {}),
      events,
    };
  });
  return { people: cleaned, droppedEvents, unreadableRatings };
};

// ─── Merge (bundle-01..03) ───────────────────────────────────────────────────

export type PersonEventMergeSummary = {
  matchedPeople: number;
  /** People in the file that match nobody in the diagram. */
  unmatchedPeople: string[];
  /** People whose name matches more than one person; left unmatched. */
  ambiguousPeople: string[];
  addedEvents: number;
  updatedEvents: number;
  /** Events in the file identical to the diagram's copy; left as they are. */
  unchangedEvents: number;
  removedEvents: number;
  droppedEvents: number;
  unreadableRatings: number;
};

const PERSON_ANCHOR = anchorTypeForOwner('person');

/**
 * An incoming event as it will be saved on `person`, through the one save
 * path (utils/eventDraft.ts). It keeps its own class and anchor when it has
 * them; a PERSON anchor is pointed at the matched person, since the file may
 * come from another copy of the diagram.
 */
const prepareForPerson = (
  event: EmotionalProcessEvent,
  person: Person,
  prior: EmotionalProcessEvent | undefined,
): EmotionalProcessEvent => {
  let draft = event;
  // A file written before Event Creator kept the two dates together can
  // carry an edited `date` beside the old `startDate`. The one that differs
  // from the diagram's copy is the edit.
  if (prior && draft.startDate !== undefined && draft.date !== draft.startDate) {
    const priorDate = prior.startDate || prior.date || '';
    if (draft.startDate === priorDate) draft = { ...draft, startDate: draft.date };
  }
  const saved = normalizeEventForSave(
    { ...draft, createdAt: draft.createdAt ?? prior?.createdAt },
    {
      anchorType: PERSON_ANCHOR,
      anchorId: person.id,
      eventClass: eventClassForOwner('person'),
      primaryPersonName: displayName(person),
    },
  );
  return saved.anchorType === PERSON_ANCHOR && saved.anchorId !== person.id
    ? { ...saved, anchorId: person.id }
    : saved;
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
};

/** Same content, ignoring key order, undefined fields and `createdAt`. */
const sameEventContent = (a: EmotionalProcessEvent, b: EmotionalProcessEvent): boolean =>
  JSON.stringify(stableValue({ ...a, createdAt: undefined })) ===
  JSON.stringify(stableValue({ ...b, createdAt: undefined }));

export const mergePersonEventsFromBundle = (
  currentPeople: Person[],
  bundle: PersonEventBundle
): { people: Person[]; summary: PersonEventMergeSummary } => {
  const sanitized = sanitizeBundlePeople(bundle.people);
  const personById = new Map(currentPeople.map((person) => [person.id, person]));
  // bundle-02: a name key can belong to several people. An empty key never
  // matches, and a key held by more than one person matches nobody.
  const peopleByName = new Map<string, Person[]>();
  // Each person is found by their display name and by their stored `name`,
  // so a bundle written before the display-name rule changed still matches.
  currentPeople.forEach((person) => {
    const keys = new Set([normalizePersonNameKey(displayName(person)), normalizePersonNameKey(person.name)]);
    keys.forEach((key) => {
      if (!key) return;
      peopleByName.set(key, [...(peopleByName.get(key) || []), person]);
    });
  });
  const updatedById = new Map<string, Person>();

  let matchedPeople = 0;
  let addedEvents = 0;
  let updatedEvents = 0;
  let unchangedEvents = 0;
  let removedEvents = 0;
  const unmatchedPeople: string[] = [];
  const ambiguousPeople: string[] = [];

  sanitized.people.forEach((incomingPerson) => {
    const label = incomingPerson.personName || 'Unnamed';
    const byId = incomingPerson.personId ? personById.get(incomingPerson.personId) : undefined;
    let matched = byId;
    if (!matched) {
      const key = normalizePersonNameKey(incomingPerson.personName);
      const candidates = key ? peopleByName.get(key) || [] : [];
      if (candidates.length > 1) {
        ambiguousPeople.push(label);
        return;
      }
      matched = candidates[0];
    }
    if (!matched) {
      unmatchedPeople.push(label);
      return;
    }
    matchedPeople += 1;

    const existing = updatedById.get(matched.id) || matched;
    const currentEvents = existing.events || [];
    const baselineIds = new Set(incomingPerson.baselineEventIds || []);
    const incomingIds = new Set(incomingPerson.events.map((event) => event.id));

    const keptEvents =
      baselineIds.size > 0
        ? currentEvents.filter((event) => !(baselineIds.has(event.id) && !incomingIds.has(event.id)))
        : currentEvents;
    removedEvents += currentEvents.length - keptEvents.length;

    const byEventId = new Map(keptEvents.map((event) => [event.id, event]));
    incomingPerson.events.forEach((event) => {
      const prior = byEventId.get(event.id);
      const prepared = prepareForPerson(event, existing, prior);
      if (prior) {
        const priorRead = sanitizeBundleEvent(prior);
        const priorPrepared = priorRead ? prepareForPerson(priorRead.event, existing, prior) : null;
        if (priorPrepared && sameEventContent(priorPrepared, prepared)) {
          // bundle-01: an unchanged event is left as stored, not counted.
          unchangedEvents += 1;
          return;
        }
        updatedEvents += 1;
      } else {
        addedEvents += 1;
      }
      byEventId.set(event.id, prepared);
    });

    updatedById.set(matched.id, {
      ...existing,
      events: [...byEventId.values()],
    });
  });

  const people = currentPeople.map((person) => updatedById.get(person.id) || person);
  return {
    people,
    summary: {
      matchedPeople,
      unmatchedPeople,
      ambiguousPeople,
      addedEvents,
      updatedEvents,
      unchangedEvents,
      removedEvents,
      droppedEvents: sanitized.droppedEvents,
      unreadableRatings: sanitized.unreadableRatings,
    },
  };
};

// ─── Import flow shared by both import menus (bundle-01) ─────────────────────

const describeMerge = (summary: PersonEventMergeSummary): string => {
  const lines = [
    `Matched people: ${summary.matchedPeople}`,
    `Add: ${summary.addedEvents}`,
    `Update: ${summary.updatedEvents}`,
    `Remove: ${summary.removedEvents}`,
    `Unchanged: ${summary.unchangedEvents}`,
  ];
  if (summary.unmatchedPeople.length > 0) {
    lines.push(`Not matched (their events are not imported): ${summary.unmatchedPeople.join(', ')}`);
  }
  if (summary.ambiguousPeople.length > 0) {
    lines.push(
      `Name matches more than one person (their events are not imported): ${summary.ambiguousPeople.join(', ')}`,
    );
  }
  if (summary.droppedEvents > 0) {
    lines.push(`Unreadable events skipped: ${summary.droppedEvents}`);
  }
  if (summary.unreadableRatings > 0) {
    lines.push(`Ratings that were not numbers, left unset: ${summary.unreadableRatings}`);
  }
  return lines.join('\n');
};

export type PersonEventImportOutcome =
  | { status: 'invalid' }
  | { status: 'no-changes'; summary: PersonEventMergeSummary; message: string }
  | { status: 'cancelled'; summary: PersonEventMergeSummary }
  | { status: 'applied'; people: Person[]; summary: PersonEventMergeSummary; message: string };

/**
 * Purpose: the one import of a timeline / person-events file, used by both
 *          the File › Import menu (useFileOperations) and the timeline
 *          import (DiagramEditor), so the two cannot drift (bundle-01).
 * Tests:   src/frontend/src/utils/personEventBundle.test.ts
 *
 * The merge adds, updates and removes events, so the counts are shown and
 * the user is asked before anything changes. The caller applies `people`
 * only when the outcome is "applied".
 */
export const importPersonEventFile = (
  parsed: unknown,
  currentPeople: Person[],
  confirm: (message: string) => boolean,
): PersonEventImportOutcome => {
  const bundle = isTimelineJson(parsed)
    ? timelineJsonToBundle(parsed)
    : isPersonEventBundle(parsed)
      ? parsed
      : null;
  if (!bundle) return { status: 'invalid' };
  const result = mergePersonEventsFromBundle(currentPeople, bundle);
  const { summary } = result;
  const details = describeMerge(summary);
  if (summary.addedEvents + summary.updatedEvents + summary.removedEvents === 0) {
    return { status: 'no-changes', summary, message: `No event changes to import.\n${details}` };
  }
  if (!confirm(`Import events from this file?\n${details}`)) return { status: 'cancelled', summary };
  return { status: 'applied', people: result.people, summary, message: `Imported person events.\n${details}` };
};
