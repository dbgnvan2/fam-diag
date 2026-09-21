/**
 * Reported: "Individual" events that look like duplicates on the timeline.
 * They were a record written on every date-field change, never updated, so a
 * corrected birth date left the old year behind as a separate life event.
 */
import { describe, it, expect } from 'vitest';
import {
  isPersonDateRecordEvent,
  withoutPersonDateRecords,
} from './personDateEvents';
import type { EmotionalProcessEvent } from '../types';

const event = (overrides: Partial<EmotionalProcessEvent> = {}): EmotionalProcessEvent => ({
  id: 'e1',
  date: '2005-01-05',
  startDate: '2005-01-05',
  category: 'Individual',
  eventType: 'NODAL',
  status: 'discrete',
  intensity: 0,
  howWell: 1,
  otherPersonName: '',
  wwwwh: '',
  observations: '',
  eventClass: 'individual',
  ...overrides,
});

describe('isPersonDateRecordEvent', () => {
  it('test_ind_recognises_the_current_subtype_form', () => {
    expect(isPersonDateRecordEvent(event({ subtype: 'Birth Date' }))).toBe(true);
    expect(isPersonDateRecordEvent(event({ subtype: 'Death Date' }))).toBe(true);
    expect(isPersonDateRecordEvent(event({ subtype: 'Gender Date' }))).toBe(true);
    expect(isPersonDateRecordEvent(event({ subtype: 'Adoption Date' }))).toBe(true);
  });

  it('test_ind_recognises_the_legacy_statusLabel_form', () => {
    // Emma Carter's two events in the shipped demo diagram carry the field
    // name in statusLabel, with no subtype at all.
    const legacy = { ...event(), statusLabel: 'Birth Date' } as EmotionalProcessEvent;
    expect(isPersonDateRecordEvent(legacy)).toBe(true);
  });

  it('test_ind_leaves_a_user_written_individual_event_alone', () => {
    // "Individual" is also the Event Creator's default category, so the
    // category on its own must never be enough to hide an event.
    expect(isPersonDateRecordEvent(event({ subtype: '' }))).toBe(false);
    expect(isPersonDateRecordEvent(event({ subtype: 'Moved house' }))).toBe(false);
    expect(
      isPersonDateRecordEvent(event({ category: 'Individual', subtype: undefined }))
    ).toBe(false);
  });

  it('test_ind_leaves_other_categories_alone', () => {
    expect(isPersonDateRecordEvent(event({ category: 'Birth', subtype: 'Birth Date' }))).toBe(
      false
    );
    expect(isPersonDateRecordEvent(event({ category: 'Nodal', subtype: 'Birth Date' }))).toBe(
      false
    );
  });

  it('test_ind_matching_is_case_and_space_tolerant', () => {
    expect(isPersonDateRecordEvent(event({ category: ' individual ', subtype: ' birth date ' })))
      .toBe(true);
  });
});

describe('withoutPersonDateRecords', () => {
  it('test_ind_drops_the_stale_and_current_records_but_keeps_real_events', () => {
    const stale = event({ id: 'stale', date: '1996-01-05', subtype: 'Birth Date' });
    const current = event({ id: 'current', date: '2005-01-05', subtype: 'Birth Date' });
    const real = event({ id: 'real', category: 'Individual', subtype: 'Left home' });
    const kept = withoutPersonDateRecords([stale, current, real]);
    expect(kept.map((entry) => entry.id)).toEqual(['real']);
  });

  it('test_ind_handles_an_empty_or_missing_list', () => {
    expect(withoutPersonDateRecords([])).toEqual([]);
    expect(withoutPersonDateRecords()).toEqual([]);
  });
});
