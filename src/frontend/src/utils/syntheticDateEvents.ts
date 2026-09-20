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
 * Solution: synthesize phantom events for those date fields at read time so
 * both views see the same set of items. New date edits done through the
 * Properties panel still create real events via the existing build*Event
 * helpers — synthesis only fills gaps in older data.
 */
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

const hasEventForSlot = (
  events: EmotionalProcessEvent[] | undefined,
  category: string,
  synthId: string,
): boolean => {
  if (!events) return false;
  const lower = category.toLowerCase();
  return events.some(
    (e) =>
      e.id === synthId ||
      (e.category || '').trim().toLowerCase() === lower,
  );
};

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

export const synthesizePersonDateEvents = (person: Person): EmotionalProcessEvent[] => {
  const out: EmotionalProcessEvent[] = [];
  const slots: Array<{ field: 'birthDate' | 'deathDate' | 'adoptionDate'; category: string; synthId: string }> = [
    { field: 'birthDate', category: 'Birth', synthId: `synth-birth-${person.id}` },
    { field: 'deathDate', category: 'Death', synthId: `synth-death-${person.id}` },
    { field: 'adoptionDate', category: 'Adoption', synthId: `synth-adoption-${person.id}` },
  ];
  slots.forEach(({ field, category, synthId }) => {
    const date = person[field] as string | undefined;
    if (!isValidIsoDate(date)) return;
    if (hasEventForSlot(person.events, category, synthId)) return;
    out.push({
      ...baseSynthEvent(synthId, date, category),
      anchorType: 'PERSON',
      anchorId: person.id,
      eventClass: 'individual',
      primaryPersonName: person.name || '',
    });
  });
  return out;
};

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
    if (hasEventForSlot(person.events, label, synthId)) return [];
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
  const out: EmotionalProcessEvent[] = [];
  const primaryName = partner1Name || '';
  const otherName = partner2Name || 'None';
  const dateMap: Array<{ field: keyof Partnership; category: string }> = [
    { field: 'relationshipStartDate', category: 'Relationship Started' },
    { field: 'marriedStartDate', category: 'Marriage' },
    { field: 'separationDate', category: 'Separation' },
    { field: 'divorceDate', category: 'Divorce' },
  ];
  dateMap.forEach(({ field, category }) => {
    const date = partnership[field] as string | undefined;
    if (!isValidIsoDate(date)) return;
    const synthId = `synth-${field}-${partnership.id}`;
    if (hasEventForSlot(partnership.events, category, synthId)) return;
    out.push({
      ...baseSynthEvent(synthId, date, category),
      anchorType: 'RELATIONSHIP_PRL',
      anchorId: partnership.id,
      eventClass: 'relationship',
      primaryPersonName: primaryName,
      otherPersonName: otherName,
    });
  });
  return out;
};

export const synthesizeEmotionalLineDateEvents = (
  line: EmotionalLine,
  person1Name?: string,
  person2Name?: string,
): EmotionalProcessEvent[] => {
  const out: EmotionalProcessEvent[] = [];
  const primary = person1Name || '';
  const other = person2Name || 'None';
  const startId = `synth-epl-start-${line.id}`;
  const endId = `synth-epl-end-${line.id}`;
  if (isValidIsoDate(line.startDate) && !hasEventForSlot(line.events, 'Pattern Started', startId)) {
    out.push({
      ...baseSynthEvent(startId, line.startDate!, 'Pattern Started'),
      anchorType: 'EMOTIONAL_PROCESS_EP',
      anchorId: line.id,
      eventClass: 'emotional-pattern',
      primaryPersonName: primary,
      otherPersonName: other,
      eventType: 'EPE',
    });
  }
  if (isValidIsoDate(line.endDate) && !hasEventForSlot(line.events, 'Pattern Ended', endId)) {
    out.push({
      ...baseSynthEvent(endId, line.endDate!, 'Pattern Ended'),
      anchorType: 'EMOTIONAL_PROCESS_EP',
      anchorId: line.id,
      eventClass: 'emotional-pattern',
      primaryPersonName: primary,
      otherPersonName: other,
      eventType: 'EPE',
    });
  }
  return out;
};

export const isSyntheticEventId = (id: string): boolean => id.startsWith('synth-');
