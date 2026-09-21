/**
 * Reported on "Peter Doe": duplicate Married events. Saving a partnership
 * appended a record for the status date AND a second dated today saying the
 * type had changed, on top of the block synthesized from the date field.
 */
import { describe, it, expect } from 'vitest';
import {
  isPartnershipStatusRecordEvent,
  withoutPartnershipStatusRecords,
} from './partnershipStatusEvents';
import type { EmotionalProcessEvent, Partnership } from '../types';

const partnership = (overrides: Partial<Partnership> = {}): Partnership => ({
  id: 'pr1',
  partner1_id: 'p1',
  partner2_id: 'p2',
  horizontalConnectorY: 0,
  relationshipType: 'married',
  relationshipStatus: 'married',
  children: [],
  ...overrides,
});

const event = (overrides: Partial<EmotionalProcessEvent> = {}): EmotionalProcessEvent => ({
  id: 'e1',
  date: '1990-01-01',
  startDate: '1990-01-01',
  category: 'Married',
  eventType: 'NODAL',
  anchorType: 'RELATIONSHIP_PRL',
  anchorId: 'pr1',
  status: 'discrete',
  intensity: 0,
  howWell: 1,
  otherPersonName: '',
  wwwwh: '',
  observations: '',
  eventClass: 'relationship',
  ...overrides,
});

/** Peter Doe's partnership, exactly as it appears in the saved diagram. */
const peterDoe = partnership({
  marriedStartDate: '1990-01-01',
  statusDates: { married: '1990-01-01' },
});

describe('isPartnershipStatusRecordEvent', () => {
  it('test_prl_status_change_record_is_recognised', () => {
    // Dated today, not the day anything happened.
    const changed = event({ date: '2026-09-19', startDate: '2026-09-19', subtype: 'Type changed to Married' });
    expect(isPartnershipStatusRecordEvent(changed, peterDoe)).toBe(true);
    const statusChanged = event({ subtype: 'Status changed to Separated' });
    expect(isPartnershipStatusRecordEvent(statusChanged, peterDoe)).toBe(true);
  });

  it('test_prl_status_date_record_is_recognised', () => {
    expect(isPartnershipStatusRecordEvent(event({ subtype: 'Married' }), peterDoe)).toBe(true);
  });

  it('test_prl_record_is_matched_through_statusDates_without_a_legacy_field', () => {
    // "Widowed" has no legacy mirror field — it lives only in statusDates.
    const widowed = partnership({ statusDates: { widowed: '2012-02-02' } });
    const record = event({ date: '2012-02-02', startDate: '2012-02-02', subtype: 'Widowed' });
    expect(isPartnershipStatusRecordEvent(record, widowed)).toBe(true);
  });

  it('test_prl_the_separated_label_matches_its_status', () => {
    const separated = partnership({
      separationDate: '2008-03-01',
      statusDates: { separated: '2008-03-01' },
    });
    const record = event({ date: '2008-03-01', startDate: '2008-03-01', subtype: 'Separated' });
    expect(isPartnershipStatusRecordEvent(record, separated)).toBe(true);
  });

  it('test_prl_real_events_sharing_a_word_with_a_status_are_kept', () => {
    // Reproduced by the QA gate against an earlier stem-matching version,
    // which hid every one of these because they start like a status name.
    // They are the user's own clinical records, on the status date.
    const engaged = partnership({
      relationshipType: 'engaged',
      relationshipStartDate: '1990-01-01',
      statusDates: { married: '1990-01-01', separated: '1990-01-01', start: '1990-01-01' },
    });
    [
      'Marriage counselling',
      'Marriage problems',
      'Separation anxiety',
      'Started counselling',
      'Engagement party',
    ].forEach((subtype) => {
      expect(isPartnershipStatusRecordEvent(event({ subtype }), engaged)).toBe(false);
    });
  });

  it('test_prl_every_label_the_producer_writes_is_still_recognised', () => {
    // The other half: an exact label on its own date must still be hidden,
    // or the duplicates come back.
    const all = partnership({
      statusDates: {
        married: '1990-01-01',
        divorce: '1990-01-01',
        separated: '1990-01-01',
        widowed: '1990-01-01',
      },
    });
    ['Married', 'Divorced', 'Separated', 'Widowed'].forEach((subtype) => {
      expect(isPartnershipStatusRecordEvent(event({ subtype }), all)).toBe(true);
    });
  });

  it('test_prl_a_person_anchored_event_is_never_matched', () => {
    const personEvent = event({ subtype: 'Married', anchorType: 'PERSON' });
    expect(isPartnershipStatusRecordEvent(personEvent, peterDoe)).toBe(false);
  });

  it('test_prl_a_user_written_event_on_the_wedding_day_is_kept', () => {
    // Falls on a status date but does not name that status.
    const real = event({ subtype: 'Argument at the reception', category: 'Conflict' });
    expect(isPartnershipStatusRecordEvent(real, peterDoe)).toBe(false);
  });

  it('test_prl_a_status_named_event_on_another_date_is_kept', () => {
    // Names the status but is not the recorded date, so it is the user's own.
    const elsewhere = event({ date: '2001-05-05', startDate: '2001-05-05', subtype: 'Married' });
    expect(isPartnershipStatusRecordEvent(elsewhere, peterDoe)).toBe(false);
  });

  it('test_prl_an_event_with_no_subtype_is_kept', () => {
    expect(isPartnershipStatusRecordEvent(event({ subtype: '' }), peterDoe)).toBe(false);
    expect(isPartnershipStatusRecordEvent(event({ subtype: undefined }), peterDoe)).toBe(false);
  });
});

describe('withoutPartnershipStatusRecords', () => {
  it('test_prl_peter_doe_keeps_no_status_records_and_loses_nothing_else', () => {
    const real = event({ id: 'real', subtype: 'Counselling started', date: '1995-06-06', startDate: '1995-06-06' });
    const kept = withoutPartnershipStatusRecords(
      [
        event({ id: 'changed', date: '2026-09-19', startDate: '2026-09-19', subtype: 'Type changed to Married' }),
        event({ id: 'dated', subtype: 'Married' }),
        real,
      ],
      peterDoe
    );
    expect(kept.map((entry) => entry.id)).toEqual(['real']);
  });
});
