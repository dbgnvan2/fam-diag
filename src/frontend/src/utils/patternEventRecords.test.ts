/**
 * The user's model: creating a pattern is one event; its start date and end
 * date are separate events. Saving a pattern used to append a record on every
 * edit, so a single fusion line in the shipped demo carried eight events.
 */
import { describe, it, expect } from 'vitest';
import {
  isPatternChangeRecordEvent,
  isPatternDateRecordEvent,
  withoutPatternEditRecords,
} from './patternEventRecords';
import type { EmotionalProcessEvent } from '../types';

const event = (overrides: Partial<EmotionalProcessEvent> = {}): EmotionalProcessEvent => ({
  id: 'e',
  date: '2020-01-01',
  startDate: '2020-01-01',
  category: 'Emotional Pattern',
  eventType: 'EPE',
  anchorType: 'EMOTIONAL_PROCESS_EP',
  status: 'discrete',
  intensity: 0,
  howWell: 0,
  otherPersonName: '',
  wwwwh: '',
  observations: '',
  eventClass: 'emotional-pattern',
  ...overrides,
});

describe('pattern date records', () => {
  it('test_epl_recognises_the_date_record_the_producer_wrote', () => {
    expect(isPatternDateRecordEvent(event({ subtype: 'Fusion – Ongoing – Pattern Start' }))).toBe(true);
    expect(isPatternDateRecordEvent(event({ subtype: 'Conflict – Ended – Pattern End' }))).toBe(true);
  });

  it('test_epl_a_measurement_is_not_a_date_record', () => {
    // Real intensity data over time — must survive.
    expect(isPatternDateRecordEvent(event({ subtype: 'Fusion – Measurement', intensity: 3 }))).toBe(false);
  });

  it('test_epl_a_user_note_mentioning_the_start_is_not_a_date_record', () => {
    expect(isPatternDateRecordEvent(event({ subtype: 'Argued about when it started' }))).toBe(false);
    expect(isPatternDateRecordEvent(event({ subtype: 'Pattern Start' }))).toBe(false);
    expect(isPatternDateRecordEvent(event({ subtype: 'Before – Pattern Start' }))).toBe(false);
  });

  it('test_epl_another_category_is_never_a_date_record', () => {
    expect(
      isPatternDateRecordEvent(event({ category: 'Conflict', subtype: 'Fusion – Ongoing – Pattern Start' }))
    ).toBe(false);
  });
});

describe('pattern change records', () => {
  it('test_epl_recognises_the_change_record_the_producer_wrote', () => {
    expect(isPatternChangeRecordEvent(event({ subtype: 'Style: Conflict Solid Wide' }))).toBe(true);
    expect(isPatternChangeRecordEvent(event({ subtype: 'Type: Conflict, Status: Ended' }))).toBe(true);
  });

  it('test_epl_a_user_note_with_a_colon_is_not_a_change_record', () => {
    // Every segment has to be a property change — one free-text segment and
    // the event is the user's own.
    expect(isPatternChangeRecordEvent(event({ subtype: 'Style: tense, then shouting' }))).toBe(false);
    expect(isPatternChangeRecordEvent(event({ subtype: 'Note: saw them fight' }))).toBe(false);
    expect(isPatternChangeRecordEvent(event({ subtype: 'Type:' }))).toBe(false);
  });
});

describe('withoutPatternEditRecords', () => {
  it('test_epl_keeps_the_creation_event_measurements_and_user_events', () => {
    const creation = event({ id: 'creation', subtype: undefined, intensity: 2 });
    const measurement = event({ id: 'measure', subtype: 'Fusion – Measurement', intensity: 3 });
    const userEvent = event({ id: 'user', category: 'Emotional Pattern', subtype: 'Blew up at dinner' });
    const dateRecord = event({ id: 'date', subtype: 'Fusion – Ongoing – Pattern Start' });
    const changeRecord = event({ id: 'change', subtype: 'Style: Fusion Solid Wide' });

    const kept = withoutPatternEditRecords([creation, measurement, userEvent, dateRecord, changeRecord]);
    expect(kept.map((entry) => entry.id)).toEqual(['creation', 'measure', 'user']);
  });
});
