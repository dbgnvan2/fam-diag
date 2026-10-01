/**
 * Purpose: the one implementation of editing, saving and deleting an event,
 *          shared by the Properties panel, the Timeline, the canvas event
 *          dialogs and session notes.
 * Spec:    n/a — REVIEW-unread-areas-2026-09-30.md, systemic pattern S1
 * Tests:   src/frontend/src/utils/eventDraft.test.ts
 *
 * Each surface used to carry its own copy of this logic, and the copies had
 * drifted: only the Properties panel turned the dialog's string values into
 * numbers and kept `date` equal to `startDate`, only the Timeline sent an
 * edit to the entity that owned the event, and neither sent an edit of a date
 * field's event back to the date field.
 *
 * Author decisions (2026-09-30) this module carries out:
 *   - a date field has exactly one event, and editing that event edits the
 *     field (utils/syntheticDateEvents.ts DateSlot);
 *   - a new event starts with no date and no rating — nothing is filled in
 *     that the user did not give.
 */
import type {
  EmotionalLine,
  EmotionalProcessEvent,
  EventAnchorType,
  EventClass,
  EventType,
  FunctionalIndicatorDefinition,
  Partnership,
  Person,
  PersonFunctionalIndicator,
  SymptomGroup,
} from '../types';
import { EVENT_CATEGORIES, EVENT_SUBTYPES } from '../constants/eventConstants';
import {
  emotionalLineDateSlots,
  findDateSlotForEvent,
  isSyntheticEventId,
  partnershipDateSlots,
  personDateSlots,
  type DateSlot,
} from './syntheticDateEvents';
import { legacyFieldForStatus, withPartnershipStatusDate } from './relationshipStatusKeys';

export const createEventId = (): string => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const NUMERIC_FIELDS = new Set<keyof EmotionalProcessEvent>(['intensity', 'howWell', 'frequency', 'impact']);
const SYMPTOM_GROUPS: SymptomGroup[] = ['physical', 'emotional', 'social'];
const SYMPTOM_LABEL_MAX = 30;

const toNumber = (value: unknown): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const capitalise = (value: string): string =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;

/** A date field's event, as opposed to an indicator-backed symptom. */
export const isDateSlotEventId = (id: string): boolean =>
  isSyntheticEventId(id) && !id.startsWith('synth-indicator-');

/**
 * Change an event's category. When the new category has a fixed list of
 * types, a type not in that list is cleared for the user to pick — never
 * replaced with the list's first entry (author decision 2026-09-30). Without
 * a list (a symptom's Physical / Emotional), the typed type is kept.
 */
export const applyEventCategoryChange = (
  draft: EmotionalProcessEvent,
  category: string,
): EmotionalProcessEvent => {
  const listed = EVENT_SUBTYPES[draft.eventType]?.[category];
  const subtype = listed && !listed.includes(draft.subtype || '') ? '' : draft.subtype;
  return { ...draft, category, subtype };
};

/** Whether the event still needs a type chosen from its category's list. */
export const eventNeedsListedSubtype = (draft: EmotionalProcessEvent): boolean =>
  !!EVENT_SUBTYPES[draft.eventType]?.[draft.category] && !(draft.subtype || '').trim();

/**
 * Apply one field change from EventModal. The dialog sends every value as a
 * string; numbers are stored as numbers, and a date change sets `date` and
 * `startDate` together so the two can never disagree (and a cleared start
 * date stays cleared).
 */
export const applyEventDraftFieldChange = (
  draft: EmotionalProcessEvent,
  field: keyof EmotionalProcessEvent,
  value: string,
): EmotionalProcessEvent => {
  if (field === 'eventType') {
    const nextType = value as EventType;
    const options = EVENT_CATEGORIES[nextType] || [];
    const categoryFits =
      options.length === 0 || options.some((option) => option.toLowerCase() === (draft.category || '').toLowerCase());
    // A category that does not belong to the new type is cleared for the
    // user to choose, not replaced with the list's first entry.
    const category = categoryFits ? draft.category : '';
    const subtypeOptions = EVENT_SUBTYPES[nextType]?.[category];
    const subtype =
      subtypeOptions && !subtypeOptions.includes(draft.subtype || '') ? '' : draft.subtype || '';
    return {
      ...draft,
      eventType: nextType,
      category: nextType === 'SYMPTOM' ? capitalise(category) : category,
      subtype,
      symptomType: nextType === 'SYMPTOM' ? subtype.slice(0, SYMPTOM_LABEL_MAX) : undefined,
    };
  }
  if (NUMERIC_FIELDS.has(field)) {
    return { ...draft, [field]: toNumber(value) };
  }
  if (field === 'startDate' || field === 'date') {
    return { ...draft, startDate: value, date: value };
  }
  if (field === 'category' && draft.eventType === 'SYMPTOM') {
    return { ...draft, category: capitalise(value) };
  }
  if ((field === 'subtype' || field === 'symptomType') && draft.eventType === 'SYMPTOM') {
    // The dialog's "Type" field is the symptom's name. It edits `subtype`;
    // `symptomType` is the older copy of the same value and must follow it,
    // or the save links the event to whichever symptom was entered last.
    const label = value.slice(0, SYMPTOM_LABEL_MAX);
    return { ...draft, subtype: label, symptomType: label };
  }
  return { ...draft, [field]: value };
};

export type EventSaveContext = {
  anchorType: EventAnchorType;
  anchorId: string;
  eventClass: EventClass;
  primaryPersonName?: string;
};

/**
 * Every Save creates a complete event (CLAUDE.md "Save = create event"):
 * date AND startDate, anchorType, anchorId, eventClass, createdAt, and the
 * numeric fields as numbers.
 */
export const normalizeEventForSave = (
  draft: EmotionalProcessEvent,
  context: EventSaveContext,
): EmotionalProcessEvent => {
  const eventType = draft.eventType;
  const start = draft.startDate ?? draft.date ?? '';
  const isSymptom = eventType === 'SYMPTOM';
  const symptomLabel = isSymptom
    ? (draft.subtype || draft.symptomType || '').trim().slice(0, SYMPTOM_LABEL_MAX)
    : '';
  return {
    ...draft,
    eventType,
    category: isSymptom ? capitalise(draft.category || '') : draft.category || '',
    subtype: isSymptom ? symptomLabel : draft.subtype || '',
    anchorType: draft.anchorType || context.anchorType,
    anchorId: draft.anchorId || context.anchorId,
    startDate: start,
    date: start,
    otherPersonName: (draft.otherPersonName || '').trim() || 'None',
    primaryPersonName: draft.primaryPersonName || context.primaryPersonName || '',
    intensity: toNumber(draft.intensity),
    frequency: toNumber(draft.frequency),
    impact: toNumber(draft.impact),
    howWell: toNumber(draft.howWell),
    wwwwh: draft.wwwwh || '',
    observations: draft.observations || '',
    priorEventsNote: draft.priorEventsNote || '',
    reflectionsNote: draft.reflectionsNote || '',
    status: draft.status || 'discrete',
    createdAt: draft.createdAt ?? Date.now(),
    // sourceIndicatorId links an event to the functional indicator it
    // describes. SYMPTOM and FF are the carriers (the Symptoms tab saves as
    // FF); any other type drops the link so a retyped event is not still
    // read as a symptom.
    sourceIndicatorId: isSymptom || eventType === 'FF' ? draft.sourceIndicatorId : undefined,
    symptomType: isSymptom ? symptomLabel : undefined,
    eventClass: draft.eventClass || context.eventClass,
  };
};

export type EventOwnerKind = 'person' | 'partnership' | 'emotional';
export type EventOwner = {
  kind: EventOwnerKind;
  id: string;
  /** Partnership only: family-level events live in `familyEvents`. */
  list?: 'events' | 'familyEvents';
};
export type EventOwnerEntity = Person | Partnership | EmotionalLine;
export type EventOwnerUpdates = Partial<Person> | Partial<Partnership> | Partial<EmotionalLine>;

// A partnership owns two lists: its relationship events and its
// family-level events. The anchor and class follow the list, so a family
// event missing its own values is not re-labelled as a relationship event.
export const anchorTypeForOwner = (kind: EventOwnerKind, list?: EventOwner['list']): EventAnchorType =>
  kind === 'person'
    ? 'PERSON'
    : kind === 'partnership'
      ? list === 'familyEvents'
        ? 'FAMILY'
        : 'RELATIONSHIP_PRL'
      : 'EMOTIONAL_PROCESS_EP';

export const eventClassForOwner = (kind: EventOwnerKind, list?: EventOwner['list']): EventClass =>
  kind === 'person'
    ? 'individual'
    : kind === 'partnership'
      ? list === 'familyEvents'
        ? 'family'
        : 'relationship'
      : 'emotional-pattern';

export const dateSlotsForOwner = (kind: EventOwnerKind, entity: EventOwnerEntity): DateSlot[] =>
  kind === 'person'
    ? personDateSlots(entity as Person)
    : kind === 'partnership'
      ? partnershipDateSlots(entity as Partnership)
      : emotionalLineDateSlots(entity as EmotionalLine);

/** The field writes that record `date` (or clear it, when empty) on a slot. */
const dateFieldUpdates = (
  kind: EventOwnerKind,
  entity: EventOwnerEntity,
  slot: DateSlot,
  date: string,
): EventOwnerUpdates => {
  if (kind !== 'partnership') {
    // Clearing a death that was recorded without a date clears that record too.
    if (kind === 'person' && slot.field === 'deathDate' && !date && slot.recordedUndated) {
      return { deathDate: undefined, deathDateKnown: undefined } as Partial<Person>;
    }
    return { [slot.field]: date || undefined } as EventOwnerUpdates;
  }
  const next = withPartnershipStatusDate(entity as Partnership, slot.statusKey || '', date);
  const legacyField = legacyFieldForStatus(slot.statusKey || '');
  return {
    statusDates: next.statusDates,
    ...(legacyField ? { [legacyField]: next[legacyField] } : {}),
  } as Partial<Partnership>;
};

const ownerList = (owner: EventOwner): 'events' | 'familyEvents' =>
  owner.kind === 'partnership' && owner.list === 'familyEvents' ? 'familyEvents' : 'events';

const listOf = (entity: EventOwnerEntity, list: 'events' | 'familyEvents'): EmotionalProcessEvent[] =>
  list === 'familyEvents' ? (entity as Partnership).familyEvents || [] : entity.events || [];

export const upsertEvent = (
  events: EmotionalProcessEvent[],
  event: EmotionalProcessEvent,
): EmotionalProcessEvent[] =>
  events.some((entry) => entry.id === event.id)
    ? events.map((entry) => (entry.id === event.id ? event : entry))
    : [...events, event];

export type SymptomDefinitionEnsurer = (label: string, group: SymptomGroup) => string | null;

/**
 * Link a SYMPTOM event to the functional indicator it names, and record its
 * ratings on that indicator. The indicator is found by the symptom's own
 * name only; an unknown name creates (or reuses by name) a definition. It
 * never falls back to "the first symptom in the group" — that linked a new
 * Headache to an existing Back pain and overwrote Back pain's scores.
 */
export const syncSymptomIndicator = (
  person: Person,
  event: EmotionalProcessEvent,
  definitions: FunctionalIndicatorDefinition[],
  ensureDefinition?: SymptomDefinitionEnsurer,
): { event: EmotionalProcessEvent; functionalIndicators?: PersonFunctionalIndicator[] } => {
  const label = (event.symptomType || event.subtype || '').trim();
  const group = (event.category || '').toLowerCase() as SymptomGroup;
  if (!label || !SYMPTOM_GROUPS.includes(group)) return { event };
  const byLabel = definitions.find(
    (definition) => definition.label.trim().toLowerCase() === label.toLowerCase(),
  );
  const definitionId = byLabel?.id || ensureDefinition?.(label, group) || null;
  if (!definitionId) return { event };
  const linked = { ...event, sourceIndicatorId: definitionId };
  const entry: PersonFunctionalIndicator = {
    definitionId,
    status: event.status === 'end' ? 'past' : 'current',
    impact: toNumber(event.impact),
    frequency: toNumber(event.frequency),
    intensity: toNumber(event.intensity),
    date: event.startDate || event.date || '',
    lastUpdatedAt: event.createdAt,
  };
  // Renaming a symptom moves it to another definition. The entry it leaves
  // behind goes too, unless another of the person's events still names it —
  // this is how a symptom is reassigned before its old type is removed.
  const previousId = event.sourceIndicatorId;
  const previousStillUsed =
    !!previousId &&
    (person.events || []).some((other) => other.id !== event.id && other.sourceIndicatorId === previousId);
  const dropPrevious = !!previousId && previousId !== definitionId && !previousStillUsed;
  return {
    event: linked,
    functionalIndicators: [
      ...(person.functionalIndicators || []).filter(
        (indicator) =>
          indicator.definitionId !== definitionId && !(dropPrevious && indicator.definitionId === previousId),
      ),
      entry,
    ],
  };
};

export type SaveEventOptions = {
  definitions?: FunctionalIndicatorDefinition[];
  ensureSymptomDefinition?: SymptomDefinitionEnsurer;
};

/**
 * The updates that store `event` on its owner.
 *
 *   - A date field's event (its synthetic id, or a stored event whose
 *     category names the field) writes its date to the field, and anything
 *     else on it to one companion event — never a second event.
 *   - An indicator-backed symptom row becomes a real SYMPTOM event.
 *   - A SYMPTOM on a person also updates the indicator it names.
 */
export const saveEventOnOwner = (
  owner: EventOwner,
  entity: EventOwnerEntity,
  draft: EmotionalProcessEvent,
  options: SaveEventOptions = {},
): EventOwnerUpdates => {
  const list = ownerList(owner);
  const events = listOf(entity, list);
  let event = draft;
  if (owner.kind === 'person' && event.id.startsWith('synth-indicator-')) {
    event = { ...event, id: createEventId() };
  }

  if (list === 'events') {
    const slot = findDateSlotForEvent(dateSlotsForOwner(owner.kind, entity), event);
    const date = event.startDate || event.date || '';
    // An undated event that only shares the field's category (a death noted
    // with no date) has no date to record, so it is stored as it is.
    if (slot && (date || event.id === slot.synthId)) {
      const isStoredOlderEvent = event.id !== slot.synthId && events.some((entry) => entry.id === event.id);
      let nextEvents: EmotionalProcessEvent[];
      if (isStoredOlderEvent) {
        nextEvents = events.map((entry) => (entry.id === event.id ? { ...event, date, startDate: date } : entry));
      } else {
        const rest = events.filter((entry) => entry.id !== slot.synthId && entry.id !== event.id);
        // An undated edit of a death recorded without a date keeps its
        // notes: the record stands, only its date is unknown.
        const keepsUndated = !date && slot.recordedUndated;
        nextEvents =
          date || keepsUndated
            ? [...rest, { ...event, id: slot.synthId, category: slot.category, date, startDate: date }]
            : rest;
        if (keepsUndated) return { events: nextEvents } as EventOwnerUpdates;
      }
      return { ...dateFieldUpdates(owner.kind, entity, slot, date), events: nextEvents } as EventOwnerUpdates;
    }
  }

  if (owner.kind === 'person' && event.eventType === 'SYMPTOM') {
    const synced = syncSymptomIndicator(
      entity as Person,
      event,
      options.definitions || [],
      options.ensureSymptomDefinition,
    );
    const updates: Partial<Person> = { events: upsertEvent(events, synced.event) };
    if (synced.functionalIndicators) updates.functionalIndicators = synced.functionalIndicators;
    return updates;
  }
  return { [list]: upsertEvent(events, event) } as EventOwnerUpdates;
};

/**
 * The updates that delete one event from its owner. Deleting a date field's
 * event clears the date; deleting a symptom also removes the indicator it
 * recorded, or the Timeline would bring it straight back.
 */
export const deleteEventFromOwner = (
  owner: EventOwner,
  entity: EventOwnerEntity,
  eventId: string,
): EventOwnerUpdates => {
  const list = ownerList(owner);
  const events = listOf(entity, list);

  if (owner.kind === 'person') {
    const person = entity as Person;
    const indicatorPrefix = `synth-indicator-${person.id}-`;
    if (eventId.startsWith(indicatorPrefix)) {
      const definitionId = eventId.slice(indicatorPrefix.length);
      return {
        functionalIndicators: (person.functionalIndicators || []).filter(
          (indicator) => indicator.definitionId !== definitionId,
        ),
      };
    }
  }

  if (list === 'events') {
    const slots = dateSlotsForOwner(owner.kind, entity);
    const stored = events.find((entry) => entry.id === eventId);
    const slot = stored ? findDateSlotForEvent(slots, stored) : slots.find((entry) => entry.synthId === eventId);
    if (slot) {
      const storedDate = stored ? stored.startDate || stored.date || '' : '';
      const clearsField = !stored || stored.id === slot.synthId || storedDate === (slot.date || '');
      const nextEvents = events.filter((entry) => entry.id !== eventId);
      // Deleting the death event removes the death, dated or not.
      const fieldUpdates = clearsField
        ? dateFieldUpdates(owner.kind, entity, { ...slot, recordedUndated: slot.recordedUndated || slot.field === 'deathDate' }, '')
        : {};
      return { ...fieldUpdates, events: nextEvents } as EventOwnerUpdates;
    }
  }

  const nextEvents = events.filter((entry) => entry.id !== eventId);
  const removed = events.find((entry) => entry.id === eventId);
  if (owner.kind === 'person' && removed?.sourceIndicatorId && removed.eventType === 'SYMPTOM') {
    const person = entity as Person;
    const stillReferenced = nextEvents.some((entry) => entry.sourceIndicatorId === removed.sourceIndicatorId);
    return {
      events: nextEvents,
      ...(stillReferenced
        ? {}
        : {
            functionalIndicators: (person.functionalIndicators || []).filter(
              (indicator) => indicator.definitionId !== removed.sourceIndicatorId,
            ),
          }),
    };
  }
  return { [list]: nextEvents } as EventOwnerUpdates;
};

export type NewEventDraftInput = {
  eventType: EventType;
  anchorType: EventAnchorType;
  anchorId: string;
  eventClass: EventClass;
  primaryPersonName?: string;
  defaultCategory?: string;
  seed?: Partial<EmotionalProcessEvent> | null;
};

/**
 * A new event: only what the seed gives, plus the owner it belongs to. No
 * date (a date is a fact the user supplies), no rating (0 is "unset"), and
 * nothing copied from the previous event.
 */
export const buildNewEventDraft = ({
  eventType,
  anchorType,
  anchorId,
  eventClass,
  primaryPersonName,
  defaultCategory,
  seed,
}: NewEventDraftInput): EmotionalProcessEvent => {
  const date = seed?.startDate || seed?.date || '';
  // No category is chosen for the user: the first NODAL category is
  // "Birth", and a Birth event writes the person's birth date.
  const rawCategory = seed?.category || defaultCategory || '';
  const category = eventType === 'SYMPTOM' ? capitalise(rawCategory) : rawCategory;
  const subtype = seed?.subtype || (eventType === 'SYMPTOM' ? seed?.symptomType || '' : '');
  return {
    ...seed,
    id: createEventId(),
    date,
    startDate: date,
    endDate: seed?.endDate || '',
    category,
    eventType,
    subtype,
    anchorType,
    anchorId,
    status: seed?.status || 'discrete',
    intensity: toNumber(seed?.intensity ?? 0),
    frequency: toNumber(seed?.frequency ?? 0),
    impact: toNumber(seed?.impact ?? 0),
    howWell: toNumber(seed?.howWell ?? 0),
    otherPersonName: seed?.otherPersonName || 'None',
    primaryPersonName: seed?.primaryPersonName || primaryPersonName || '',
    wwwwh: seed?.wwwwh || '',
    observations: seed?.observations || '',
    priorEventsNote: seed?.priorEventsNote || '',
    reflectionsNote: seed?.reflectionsNote || '',
    createdAt: Date.now(),
    symptomType: eventType === 'SYMPTOM' ? subtype.slice(0, SYMPTOM_LABEL_MAX) : undefined,
    eventClass: seed?.eventClass || eventClass,
  };
};

/** The EPE category that names a pattern's own type. */
export const EPE_CATEGORY_BY_PATTERN_TYPE: Record<EmotionalLine['relationshipType'], string> = {
  fusion: '+/- Adequate',
  distance: 'Distance',
  conflict: 'Conflict',
  projection: 'Projection',
  cutoff: 'Cutoff',
  'open-connection': 'Emotional Pattern',
};

/**
 * Keep each date field's companion event (utils/syntheticDateEvents.ts
 * DateSlot) dated from its field, and drop it when the field is cleared.
 * The views always show the field's date, but readers of the stored events
 * (EventCreator, personEventBundle, PredictionsPanel) saw the companion's
 * own date, which went stale when the field was edited elsewhere. Applied on
 * every entity update, so no writer of a date field can leave one behind.
 * Returns the same object when nothing changed.
 */
export const withSyncedDateSlotCompanions = <T extends EventOwnerEntity>(kind: EventOwnerKind, entity: T): T => {
  const events = entity.events;
  if (!events?.some((event) => isSyntheticEventId(event.id))) return entity;
  const slotById = new Map(dateSlotsForOwner(kind, entity).map((slot) => [slot.synthId, slot]));
  let changed = false;
  const next = events.flatMap((event) => {
    const slot = slotById.get(event.id);
    if (!slot) return [event];
    const date = slot.date || '';
    if (!date && !slot.recordedUndated) {
      changed = true;
      return [];
    }
    if (event.date === date && event.startDate === date) return [event];
    changed = true;
    return [{ ...event, date, startDate: date }];
  });
  return changed ? { ...entity, events: next } : entity;
};
