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
  Person,
  Partnership,
  EmotionalLine,
} from '../types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
  observations: '(auto-generated from date field)',
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
