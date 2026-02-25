import type { EmotionalProcessEvent, Person } from '../types';

const normalizeName = (value?: string) =>
  (value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const makeEventId = () => `evt-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

const normalizeEvent = (event: EmotionalProcessEvent): EmotionalProcessEvent => ({
  ...event,
  id: event.id || makeEventId(),
  date: event.date || new Date().toISOString().slice(0, 10),
  category: event.category || 'Event',
  intensity: typeof event.intensity === 'number' ? event.intensity : 0,
  frequency: typeof event.frequency === 'number' ? event.frequency : 0,
  impact: typeof event.impact === 'number' ? event.impact : 0,
  howWell: typeof event.howWell === 'number' ? event.howWell : 5,
  otherPersonName: event.otherPersonName || '',
  primaryPersonName: event.primaryPersonName || '',
  wwwwh: event.wwwwh || '',
  observations: event.observations || '',
  priorEventsNote: event.priorEventsNote || '',
  reflectionsNote: event.reflectionsNote || '',
  eventClass: 'individual',
});

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
    const normalizedEvents = (person.events || []).map((event) => normalizeEvent(event));
    return {
      personId: person.id,
      personName: person.name || [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || 'Unnamed',
      baselineEventIds: normalizedEvents.map((event) => event.id),
      events: normalizedEvents,
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

export const isPersonEventBundle = (value: unknown): value is PersonEventBundle => {
  if (!value || typeof value !== 'object') return false;
  const raw = value as Partial<PersonEventBundle>;
  if (raw.kind !== 'fam-diag-person-events' || raw.version !== 1 || !Array.isArray(raw.people)) return false;
  return raw.people.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as PersonEventBundlePerson).personName === 'string' &&
      Array.isArray((item as PersonEventBundlePerson).events)
  );
};

export const isTimelineJson = (value: unknown): value is TimelineJson => {
  if (!value || typeof value !== 'object') return false;
  const raw = value as Partial<TimelineJson>;
  if (raw.kind !== 'fam-diag-timeline' || raw.version !== 1 || !Array.isArray(raw.people)) return false;
  return raw.people.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as PersonEventBundlePerson).personName === 'string' &&
      Array.isArray((item as PersonEventBundlePerson).events)
  );
};

export const timelineJsonToBundle = (timeline: TimelineJson): PersonEventBundle => ({
  kind: 'fam-diag-person-events',
  version: 1,
  exportedAt: timeline.exportedAt,
  sourceFileName: timeline.sourceFileName || timeline.timelineName,
  people: timeline.people,
});

export type PersonEventMergeSummary = {
  matchedPeople: number;
  unmatchedPeople: string[];
  addedEvents: number;
  updatedEvents: number;
  removedEvents: number;
};

export const mergePersonEventsFromBundle = (
  currentPeople: Person[],
  bundle: PersonEventBundle
): { people: Person[]; summary: PersonEventMergeSummary } => {
  const personById = new Map(currentPeople.map((person) => [person.id, person]));
  const personByName = new Map(
    currentPeople.map((person) => [
      normalizeName(person.name || [person.firstName, person.lastName].filter(Boolean).join(' ')),
      person,
    ])
  );
  const updatedById = new Map<string, Person>();

  let matchedPeople = 0;
  let addedEvents = 0;
  let updatedEvents = 0;
  let removedEvents = 0;
  const unmatchedPeople: string[] = [];

  bundle.people.forEach((incomingPerson) => {
    const byId = incomingPerson.personId ? personById.get(incomingPerson.personId) : undefined;
    const byName = personByName.get(normalizeName(incomingPerson.personName));
    const matched = byId || byName;
    if (!matched) {
      unmatchedPeople.push(incomingPerson.personName || 'Unnamed');
      return;
    }
    matchedPeople += 1;

    const existing = updatedById.get(matched.id) || matched;
    const currentEvents = [...(existing.events || [])];
    const normalizedIncoming = (incomingPerson.events || []).map((event) => normalizeEvent(event));

    const baselineIds = new Set(incomingPerson.baselineEventIds || []);
    const incomingIds = new Set(normalizedIncoming.map((event) => event.id));

    const keptEvents =
      baselineIds.size > 0
        ? currentEvents.filter((event) => !(baselineIds.has(event.id) && !incomingIds.has(event.id)))
        : currentEvents;
    if (baselineIds.size > 0) {
      removedEvents += Math.max(0, currentEvents.length - keptEvents.length);
    }

    const byEventId = new Map(keptEvents.map((event) => [event.id, event]));
    normalizedIncoming.forEach((event) => {
      if (byEventId.has(event.id)) {
        updatedEvents += 1;
      } else {
        addedEvents += 1;
      }
      byEventId.set(event.id, event);
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
      addedEvents,
      updatedEvents,
      removedEvents,
    },
  };
};
