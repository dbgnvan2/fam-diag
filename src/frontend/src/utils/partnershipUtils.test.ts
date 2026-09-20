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
import { earliestPartnershipDate, partnershipDates } from './partnershipUtils';
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
