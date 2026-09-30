/**
 * Synthesize EmotionalProcessEvent records from date fields on Person /
 * Partnership / EmotionalLine when no matching real event exists in their
 * events[] array.
 *
 * Why: the Timeline Board renders entries for dates like person.birthDate,
 * partnership.marriedStartDate, etc. directly off the field. The Properties
 * panel's Events tab only shows events stored in events[] arrays. That meant
 * the Timeline could show items the Events tab never lists, which is
 * confusing for users.
 *
 * Solution: synthesize the events for those date fields at read time so
 * both views see the same set of items. The field is the record: saving a
 * date writes the field, not an event, and editing the synthesized event
 * edits the field (utils/eventDraft.ts). Each field has exactly one event.
 */
import { RELATIONSHIP_STATUS_INTENSITY } from '../constants/timelineBlockStyle';
import {
  STATUS_KEY_BY_LEGACY_FIELD,
  canonicalRelationshipStatusKey,
  legacyFieldForStatus,
  type PartnershipDateField,
} from './relationshipStatusKeys';
import type {
  EmotionalProcessEvent,
  FunctionalIndicatorDefinition,
  Person,
  Partnership,
  EmotionalLine,
} from '../types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Placeholder text on a synthesized event's observations field. It explains
 * where the event came from; it is not a note the user wrote, so anywhere
 * that shows notes should treat it as "no note" rather than display it.
 */
export const SYNTHETIC_EVENT_NOTE = '(auto-generated from date field)';

const isValidIsoDate = (value?: string | null): value is string =>
  !!value && DATE_PATTERN.test(value);

export const isSyntheticEventId = (id: string): boolean => id.startsWith('synth-');

/**
 * A date field that is shown as an event. Each date field has exactly one
 * event: the field is the record, and editing that event edits the field
 * (utils/eventDraft.ts). Anything else the user writes on it — a note, a
 * rating — is kept on a "companion" event stored under `synthId`; the date
 * shown is always the field's, so the two cannot drift apart.
 */
export type DateSlot = {
  owner: 'person' | 'partnership' | 'emotional';
  /** Field on the owner that holds the date. For a status with no legacy field, 'statusDates'. */
  field: string;
  /** Partnership only: the canonical status key the date belongs to. */
  statusKey?: string;
  category: string;
  synthId: string;
  date?: string;
  /**
   * The fact is recorded but its date is not — a death marked "deceased,
   * date unknown". Its event is listed undated (the Events tab shows "—";
   * the Timeline cannot place it) instead of not at all.
   */
  recordedUndated?: boolean;
};

export const personDateSlots = (person: Person): DateSlot[] => [
  { owner: 'person', field: 'birthDate', category: 'Birth', synthId: `synth-birth-${person.id}`, date: person.birthDate },
  {
    owner: 'person',
    field: 'deathDate',
    category: 'Death',
    synthId: `synth-death-${person.id}`,
    date: person.deathDate,
    recordedUndated: !!person.deathDateKnown,
  },
  { owner: 'person', field: 'adoptionDate', category: 'Adoption', synthId: `synth-adoption-${person.id}`, date: person.adoptionDate },
  // Added when person-date records stopped being written on save: without
  // this the gender date would appear nowhere at all.
  { owner: 'person', field: 'genderDate', category: 'Gender', synthId: `synth-gender-${person.id}`, date: person.genderDate },
];

const PARTNERSHIP_FIELD_SLOTS: Array<{ field: PartnershipDateField; category: string }> = [
  { field: 'relationshipStartDate', category: 'Relationship Started' },
  { field: 'marriedStartDate', category: 'Marriage' },
  { field: 'separationDate', category: 'Separation' },
  { field: 'divorceDate', category: 'Divorce' },
];

export const partnershipDateSlots = (partnership: Partnership): DateSlot[] => {
  const slots: DateSlot[] = PARTNERSHIP_FIELD_SLOTS.map(({ field, category }) => ({
    owner: 'partnership',
    field,
    statusKey: STATUS_KEY_BY_LEGACY_FIELD[field],
    category,
    synthId: `synth-${field}-${partnership.id}`,
    date: partnership[field],
  }));
  // A status whose date is mirrored into a legacy field ('start', 'ongoing',
  // 'divorce', ...) is the slot above. Only statuses with no field of their
  // own — "widowed" is the common one — get a slot here, or the panel's
  // canonical keys would list the same date twice.
  const seen = new Set<string>();
  Object.entries(partnership.statusDates || {}).forEach(([rawKey, date]) => {
    const statusKey = canonicalRelationshipStatusKey(rawKey);
    if (legacyFieldForStatus(statusKey) || seen.has(statusKey)) return;
    seen.add(statusKey);
    slots.push({
      owner: 'partnership',
      field: 'statusDates',
      statusKey,
      category: statusKey.charAt(0).toUpperCase() + statusKey.slice(1),
      synthId: `synth-status-${statusKey}-${partnership.id}`,
      date,
    });
  });
  return slots;
};

export const emotionalLineDateSlots = (line: EmotionalLine): DateSlot[] => [
  { owner: 'emotional', field: 'startDate', category: 'Pattern Started', synthId: `synth-epl-start-${line.id}`, date: line.startDate },
  { owner: 'emotional', field: 'endDate', category: 'Pattern Ended', synthId: `synth-epl-end-${line.id}`, date: line.endDate },
];

/**
 * The slot an event belongs to: its id is the slot's synthetic id, or it is
 * an older stored event whose category names the slot (a "Death" event on a
 * person's own record is that person's death).
 */
export const findDateSlotForEvent = (
  slots: DateSlot[],
  event: Pick<EmotionalProcessEvent, 'id' | 'category'>,
): DateSlot | undefined => {
  const byId = slots.find((slot) => slot.synthId === event.id);
  if (byId) return byId;
  const category = (event.category || '').trim().toLowerCase();
  if (!category) return undefined;
  return slots.find((slot) => slot.category.toLowerCase() === category);
};

/**
 * Stored events minus the date-slot companions. A companion is rendered by
 * the synthesizer with the field's date, so listing it directly as well
 * would show the date field twice — and with a stale date once the field is
 * edited elsewhere.
 */
export const withoutDateSlotCompanions = (
  events: EmotionalProcessEvent[] = [],
): EmotionalProcessEvent[] => events.filter((event) => !isSyntheticEventId(event.id));

const baseSynthEvent = (
  syntheticId: string,
  date: string,
  category: string,
): Omit<EmotionalProcessEvent, 'anchorType' | 'anchorId' | 'eventClass' | 'primaryPersonName'> => ({
  id: syntheticId,
  eventType: 'NODAL',
  category,
  subtype: '',
  status: 'discrete',
  intensity: 0,
  frequency: 0,
  impact: 0,
  howWell: 0,
  date,
  startDate: date,
  wwwwh: '',
  observations: SYNTHETIC_EVENT_NOTE,
  otherPersonName: 'None',
});

/**
 * The one event for a slot, or null when there is none to show:
 *   - no valid date on the field → nothing (a companion without a date is
 *     not shown), unless the slot is recorded undated — then it is listed
 *     with no date;
 *   - a companion stored under the synthetic id → it, dated from the field;
 *   - an older stored event with the slot's category → nothing here, that
 *     event is listed as it is;
 *   - otherwise a synthesized event.
 */
const eventForSlot = (
  slot: DateSlot,
  events: EmotionalProcessEvent[] | undefined,
  base: Pick<EmotionalProcessEvent, 'anchorType' | 'anchorId' | 'eventClass' | 'primaryPersonName'> &
    Partial<EmotionalProcessEvent>,
): EmotionalProcessEvent | null => {
  const date = isValidIsoDate(slot.date) ? slot.date : slot.recordedUndated ? '' : null;
  if (date === null) return null;
  const companion = events?.find((event) => event.id === slot.synthId);
  const synth: EmotionalProcessEvent = { ...baseSynthEvent(slot.synthId, date, slot.category), ...base };
  if (companion) {
    return {
      ...synth,
      ...companion,
      id: slot.synthId,
      category: slot.category,
      eventType: synth.eventType,
      anchorType: synth.anchorType,
      anchorId: synth.anchorId,
      date,
      startDate: date,
    };
  }
  const lower = slot.category.toLowerCase();
  if (events?.some((event) => (event.category || '').trim().toLowerCase() === lower)) return null;
  return synth;
};

export const synthesizePersonDateEvents = (person: Person): EmotionalProcessEvent[] =>
  personDateSlots(person).flatMap((slot) => {
    const event = eventForSlot(slot, person.events, {
      anchorType: 'PERSON',
      anchorId: person.id,
      eventClass: 'individual',
      primaryPersonName: person.name || '',
    });
    return event ? [event] : [];
  });

/**
 * Purpose: surface a functional indicator that carries a date but has no
 *          backing SYMPTOM event, so imported symptoms are not invisible on
 *          every timeline.
 * Spec:    docs/implementation_plan_2026-09-19.md#M7.B.1
 * Tests:   syntheticDateEvents.test.ts::test_m7b1_indicator_without_event_becomes_symptom_event
 *
 * Saving a symptom through the Properties panel writes both an event and an
 * indicator entry. Indicators arriving through transcript / voice import
 * (DiagramEditor mergeIndicators) only write the indicator, so those need
 * synthesizing at read time.
 */
export const synthesizePersonIndicatorEvents = (
  person: Person,
  definitions: FunctionalIndicatorDefinition[] = [],
): EmotionalProcessEvent[] => {
  const labelById = new Map(definitions.map((definition) => [definition.id, definition]));
  const backedDefinitionIds = new Set(
    (person.events || [])
      .map((event) => event.sourceIndicatorId)
      .filter((id): id is string => !!id),
  );

  return (person.functionalIndicators || []).flatMap((indicator) => {
    if (!isValidIsoDate(indicator.date)) return [];
    if (backedDefinitionIds.has(indicator.definitionId)) return [];
    const definition = labelById.get(indicator.definitionId);
    const label = definition?.label || 'Symptom';
    const synthId = `synth-indicator-${person.id}-${indicator.definitionId}`;
    const lowerLabel = label.toLowerCase();
    if (
      (person.events || []).some(
        (event) => event.id === synthId || (event.category || '').trim().toLowerCase() === lowerLabel,
      )
    ) {
      return [];
    }
    return [
      {
        ...baseSynthEvent(synthId, indicator.date!, label),
        eventType: 'SYMPTOM' as const,
        anchorType: 'PERSON' as const,
        anchorId: person.id,
        eventClass: 'individual' as const,
        primaryPersonName: person.name || '',
        status: indicator.status === 'past' ? ('end' as const) : ('ongoing' as const),
        intensity: indicator.intensity ?? 0,
        frequency: indicator.frequency ?? 0,
        impact: indicator.impact ?? 0,
        sourceIndicatorId: indicator.definitionId,
        symptomType: label,
        category: definition?.group || label,
        subtype: label,
      },
    ];
  });
};

export const synthesizePartnershipDateEvents = (
  partnership: Partnership,
  partner1Name?: string,
  partner2Name?: string,
): EmotionalProcessEvent[] => {
  const emitted = new Set<string>();
  return partnershipDateSlots(partnership).flatMap((slot) => {
    const event = eventForSlot(slot, partnership.events, {
      anchorType: 'RELATIONSHIP_PRL',
      anchorId: partnership.id,
      eventClass: 'relationship',
      primaryPersonName: partner1Name || '',
      otherPersonName: partner2Name || 'None',
      intensity: RELATIONSHIP_STATUS_INTENSITY[slot.statusKey === 'divorce' ? 'divorced' : slot.statusKey === 'start' ? 'started' : slot.statusKey || ''] ?? 0,
    });
    if (!event) return [];
    // The same date and category from two sources is one event.
    const key = `${event.startDate}|${event.category}`;
    if (emitted.has(key)) return [];
    emitted.add(key);
    return [event];
  });
};

export const synthesizeEmotionalLineDateEvents = (
  line: EmotionalLine,
  person1Name?: string,
  person2Name?: string,
): EmotionalProcessEvent[] =>
  emotionalLineDateSlots(line).flatMap((slot) => {
    const event = eventForSlot(slot, line.events, {
      anchorType: 'EMOTIONAL_PROCESS_EP',
      anchorId: line.id,
      eventClass: 'emotional-pattern',
      primaryPersonName: person1Name || '',
      otherPersonName: person2Name || 'None',
      eventType: 'EPE',
    });
    return event ? [event] : [];
  });
