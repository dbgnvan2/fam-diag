/**
 * Purpose: the one rule for which events an owner lists — its stored events
 *          minus the records that are shown another way, plus the events
 *          synthesized from its date fields.
 * Spec:    n/a — review 2026-09-30 struct-06
 * Tests:   src/frontend/src/utils/listedEvents.test.ts
 *
 * The Properties panel, the Timeline lanes, the relatives' system events and
 * the timeline year range each wrote this out, and the copies drifted: the
 * panel's partnership tab listed "Status changed to …" records the Timeline
 * hid, and system events kept the date-field companion records every other
 * view hides. Hidden, in every view:
 *   - date-field companions (they hold notes for a synthesized date event);
 *   - a person's legacy date records (utils/personDateEvents.ts);
 *   - a partnership's status-change records (utils/partnershipStatusEvents.ts);
 *   - a pattern's per-edit records (utils/patternEventRecords.ts).
 */
import type { EmotionalLine, EmotionalProcessEvent, FunctionalIndicatorDefinition, Partnership, Person } from '../types';
import {
  synthesizeEmotionalLineDateEvents,
  synthesizePartnershipDateEvents,
  synthesizePersonDateEvents,
  synthesizePersonIndicatorEvents,
  withoutDateSlotCompanions,
} from './syntheticDateEvents';
import { withoutPersonDateRecords } from './personDateEvents';
import { withoutPartnershipStatusRecords } from './partnershipStatusEvents';
import { withoutPatternEditRecords } from './patternEventRecords';

/** A person's stored events as listed (no synthesized ones). */
export const storedPersonEvents = (person: Person): EmotionalProcessEvent[] =>
  withoutPersonDateRecords(withoutDateSlotCompanions(person.events));

export const listedPersonEvents = (
  person: Person,
  definitions: FunctionalIndicatorDefinition[]
): EmotionalProcessEvent[] => [
  ...storedPersonEvents(person),
  ...synthesizePersonDateEvents(person),
  ...synthesizePersonIndicatorEvents(person, definitions),
];

/** A partnership's stored relationship events as listed (no synthesized ones). */
export const storedPartnershipEvents = (partnership: Partnership): EmotionalProcessEvent[] =>
  withoutPartnershipStatusRecords(withoutDateSlotCompanions(partnership.events), partnership);

export const listedPartnershipEvents = (
  partnership: Partnership,
  partner1Name?: string,
  partner2Name?: string
): EmotionalProcessEvent[] => [
  ...storedPartnershipEvents(partnership),
  ...synthesizePartnershipDateEvents(partnership, partner1Name, partner2Name),
];

/** A pattern's stored events as listed (no synthesized ones). */
export const storedEmotionalLineEvents = (line: EmotionalLine): EmotionalProcessEvent[] =>
  withoutPatternEditRecords(withoutDateSlotCompanions(line.events));

export const listedEmotionalLineEvents = (
  line: EmotionalLine,
  person1Name?: string,
  person2Name?: string
): EmotionalProcessEvent[] => [
  ...storedEmotionalLineEvents(line),
  ...synthesizeEmotionalLineDateEvents(line, person1Name, person2Name),
];
