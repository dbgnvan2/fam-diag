/**
 * Regression: a PRL appeared on the canvas from the partners' birth instead of
 * from the relationship's own date, whenever the partnership recorded its date
 * as anything other than `relationshipStartDate`.
 *
 * Entering a "Married" date in the Properties panel writes `statusDates.married`
 * plus the legacy `marriedStartDate` — never `relationshipStartDate`. The
 * canvas visibility rule only read `relationshipStartDate`, and the timeline
 * helper treats a missing date as "always visible", so the line was drawn as
 * soon as both partners existed.
 */
import { describe, it, expect } from 'vitest';
import {
  earliestPartnershipDate,
  partnershipDates,
  partnershipSeparationMarks,
} from './partnershipUtils';
import { buildPartnershipVisibility } from './familyScope';
import type { Partnership } from '../types';

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

/** The production rule: no date means "visible at every year". */
const isVisibleAtTimeline = (cutoffYear: number) => (date?: string | null) => {
  if (!date) return true;
  const ts = Date.parse(date);
  if (Number.isNaN(ts)) return true;
  return ts <= Date.UTC(cutoffYear, 11, 31, 23, 59, 59, 999);
};

describe('earliestPartnershipDate', () => {
  it('test_prl_marriage_only_partnership_reports_its_marriage_date', () => {
    // The reported bug: a marriage date is the only date on the record.
    const pr = partnership({ marriedStartDate: '1995-07-07' });
    expect(earliestPartnershipDate(pr)).toBe('1995-07-07');
  });

  it('test_prl_status_dates_are_read_when_no_legacy_field_exists', () => {
    // "Widowed" has no legacy mirror field — it lives only in statusDates.
    const pr = partnership({ statusDates: { widowed: '2012-02-02' } });
    expect(earliestPartnershipDate(pr)).toBe('2012-02-02');
  });

  it('test_prl_earliest_of_several_dates_wins', () => {
    const pr = partnership({
      marriedStartDate: '1995-07-07',
      separationDate: '2008-03-01',
      divorceDate: '2010-06-01',
      statusDates: { married: '1995-07-07', separated: '2008-03-01' },
    });
    expect(earliestPartnershipDate(pr)).toBe('1995-07-07');
  });

  it('test_prl_relationship_start_still_wins_when_it_is_earliest', () => {
    const pr = partnership({
      relationshipStartDate: '1992-01-01',
      marriedStartDate: '1995-07-07',
    });
    expect(earliestPartnershipDate(pr)).toBe('1992-01-01');
  });

  it('test_prl_an_ending_date_alone_is_still_better_than_nothing', () => {
    // Not the relationship's start, but far better than drawing it from birth.
    const pr = partnership({ divorceDate: '2010-06-01' });
    expect(earliestPartnershipDate(pr)).toBe('2010-06-01');
  });

  it('test_prl_undated_partnership_reports_no_date', () => {
    expect(earliestPartnershipDate(partnership())).toBeUndefined();
  });

  it('test_prl_malformed_dates_are_ignored', () => {
    const pr = partnership({ marriedStartDate: 'sometime in the 90s' });
    expect(earliestPartnershipDate(pr)).toBeUndefined();
  });

  it('test_prl_all_dates_are_listed_for_the_timeline_year_bounds', () => {
    const pr = partnership({
      marriedStartDate: '1995-07-07',
      statusDates: { widowed: '2012-02-02' },
    });
    expect(partnershipDates(pr).sort()).toEqual(['1995-07-07', '2012-02-02']);
  });
});

/**
 * These drive buildPartnershipVisibility — the function DiagramEditor's
 * partnershipVisibility memo calls — rather than re-implementing the rule, so
 * the guard cannot pass while the canvas does something else.
 */
describe('PRL visibility across the timeline years', () => {
  // Both partners were born in 1970 and are visible at every year tested.
  const partnersVisible = new Map([
    ['p1', true],
    ['p2', true],
  ]);

  it('test_prl_marriage_only_partnership_is_hidden_before_its_date', () => {
    // The bug as reported: partners born 1970, married 1995. At 1980 the
    // line must not be drawn.
    const pr = partnership({ marriedStartDate: '1995-07-07' });
    const at = (year: number) =>
      buildPartnershipVisibility([pr], partnersVisible, isVisibleAtTimeline(year)).get('pr1');

    expect(at(1980)).toBe(false);
    expect(at(1995)).toBe(true);
    expect(at(2026)).toBe(true);
  });

  it('test_prl_status_dates_only_partnership_is_hidden_before_its_date', () => {
    const pr = partnership({ statusDates: { widowed: '2012-02-02' } });
    const at = (year: number) =>
      buildPartnershipVisibility([pr], partnersVisible, isVisibleAtTimeline(year)).get('pr1');

    expect(at(2000)).toBe(false);
    expect(at(2012)).toBe(true);
  });

  it('test_prl_undated_partnership_stays_visible', () => {
    // Nothing is known, so nothing is inferred — hiding it would drop a
    // relationship from the diagram with no way to get it back.
    const pr = partnership();
    expect(
      buildPartnershipVisibility([pr], partnersVisible, isVisibleAtTimeline(1800)).get('pr1')
    ).toBe(true);
  });

  it('test_prl_hidden_partner_still_hides_the_line', () => {
    // The pre-existing rule is unchanged: a line needs both partners drawn.
    const pr = partnership({ marriedStartDate: '1995-07-07' });
    const partnerHidden = new Map([
      ['p1', true],
      ['p2', false],
    ]);
    expect(
      buildPartnershipVisibility([pr], partnerHidden, isVisibleAtTimeline(2026)).get('pr1')
    ).toBe(false);
  });

  it('test_prl_relationship_start_date_behaviour_is_unchanged', () => {
    // The case that already worked must keep working.
    const pr = partnership({ relationshipStartDate: '2003-05-20' });
    const at = (year: number) =>
      buildPartnershipVisibility([pr], partnersVisible, isVisibleAtTimeline(year)).get('pr1');

    expect(at(2002)).toBe(false);
    expect(at(2005)).toBe(true);
  });
});

/**
 * Reported: Bob Doe and mary Doe were marked married, separated and divorced,
 * and the PRL kept showing an unbroken line. All three dates were recorded —
 * married 1969-03-03, separated 1980-01-01, divorce 1985-01-01 — but
 * relationshipStatus was still "ongoing", and the marks keyed off that alone.
 */
describe('partnershipSeparationMarks', () => {
  it('test_prl_marks_follow_the_recorded_dates_not_the_status_dropdown', () => {
    const bobAndMary = partnership({
      relationshipType: 'married',
      relationshipStatus: 'ongoing',
      marriedStartDate: '1969-03-03',
      separationDate: '1980-01-01',
      divorceDate: '1985-01-01',
      statusDates: { married: '1969-03-03', separated: '1980-01-01', divorce: '1985-01-01' },
    });
    expect(partnershipSeparationMarks(bobAndMary)).toEqual({
      separated: false,
      divorced: true,
    });
  });

  it('test_prl_a_separation_date_alone_gives_one_slash', () => {
    const marks = partnershipSeparationMarks(
      partnership({ relationshipStatus: 'ongoing', separationDate: '1980-01-01' })
    );
    expect(marks).toEqual({ separated: true, divorced: false });
  });

  it('test_prl_divorce_supersedes_separation_rather_than_adding_to_it', () => {
    // Two slashes, not two plus a third.
    const marks = partnershipSeparationMarks(
      partnership({ separationDate: '1980-01-01', divorceDate: '1985-01-01' })
    );
    expect(marks.divorced).toBe(true);
    expect(marks.separated).toBe(false);
  });

  it('test_prl_status_still_works_when_no_date_was_entered', () => {
    expect(partnershipSeparationMarks(partnership({ relationshipStatus: 'separated' }))).toEqual({
      separated: true,
      divorced: false,
    });
    expect(partnershipSeparationMarks(partnership({ relationshipStatus: 'divorced' }))).toEqual({
      separated: false,
      divorced: true,
    });
    // "divorce" and "divorced" are both in use as status values.
    expect(partnershipSeparationMarks(partnership({ relationshipStatus: 'divorce' })).divorced).toBe(
      true
    );
    // A non-married relationship that ended reads as separated.
    expect(partnershipSeparationMarks(partnership({ relationshipStatus: 'ended' }))).toEqual({
      separated: true,
      divorced: false,
    });
  });

  it('test_prl_statusDates_only_partnership_is_marked', () => {
    // "divorce" has a legacy mirror field, but a diagram may carry only the
    // statusDates entry.
    const marks = partnershipSeparationMarks(
      partnership({ relationshipStatus: 'ongoing', statusDates: { divorce: '1985-01-01' } })
    );
    expect(marks.divorced).toBe(true);
  });

  it('test_prl_an_intact_marriage_carries_no_marks', () => {
    const marks = partnershipSeparationMarks(
      partnership({ relationshipStatus: 'married', marriedStartDate: '1969-03-03' })
    );
    expect(marks).toEqual({ separated: false, divorced: false });
  });

  it('test_prl_blank_dates_do_not_count_as_recorded', () => {
    const marks = partnershipSeparationMarks(
      partnership({ relationshipStatus: 'ongoing', statusDates: { separated: '   ' } })
    );
    expect(marks).toEqual({ separated: false, divorced: false });
  });
});
