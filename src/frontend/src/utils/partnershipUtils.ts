import type { Partnership, Person } from '../types';

export function computeDefaultFamilyName(partner1: Person, partner2: Person): string {
  const isMale = (p: Person) => p.birthSex === 'male' || p.gender === 'b';
  const male = isMale(partner1) ? partner1 : isMale(partner2) ? partner2 : partner1;
  const female = isMale(partner1) ? partner2 : isMale(partner2) ? partner1 : partner2;

  const lastName = male.lastName || male.name?.trim().split(/\s+/).at(-1) || '';
  const maidenName = female.maidenName || '';

  if (lastName && maidenName) return `${lastName}-${maidenName}`;
  if (lastName) return lastName;
  if (maidenName) return maidenName;
  return '';
}

/**
 * Purpose: every date a partnership records, whichever field it landed in.
 * Spec:    n/a — regression fix, 2026-09-19
 * Tests:   src/frontend/src/utils/partnershipUtils.test.ts
 *
 * A relationship date can live in `relationshipStartDate`, in one of the
 * legacy mirrors (`marriedStartDate` / `separationDate` / `divorceDate`), or
 * only in `statusDates` — "Widowed", for instance, has no mirror field.
 * Anything reasoning about WHEN a relationship existed has to look at all of
 * them, not just `relationshipStartDate`.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function partnershipDates(partnership: Partnership): string[] {
  const candidates = [
    partnership.relationshipStartDate,
    partnership.marriedStartDate,
    partnership.separationDate,
    partnership.divorceDate,
    ...Object.values(partnership.statusDates || {}),
  ];
  const unique = new Set(
    candidates
      .map((value) => (value || '').trim())
      .filter((value) => ISO_DATE.test(value) && !Number.isNaN(Date.parse(value)))
  );
  return [...unique];
}

/**
 * Purpose: the earliest date a partnership is known by, for deciding when its
 *          line may first appear on the canvas.
 * Tests:   partnershipUtils.test.ts::test_prl_marriage_only_partnership_reports_its_marriage_date
 *
 * Any recorded relationship date beats drawing the line from the partners'
 * birth. An ending date on its own (divorce, separation, widowed) is not the
 * relationship's start, but it is still evidence the relationship existed by
 * then — and far better than showing it from birth. Undated partnerships
 * return undefined and stay visible at every year: nothing is known, so
 * nothing is inferred.
 */
export function earliestPartnershipDate(partnership: Partnership): string | undefined {
  const dates = partnershipDates(partnership);
  if (!dates.length) return undefined;
  return dates.reduce((earliest, value) => (value < earliest ? value : earliest));
}

/**
 * Purpose: which separation marks a partnership line carries — one slash for
 *          separated, two for divorced.
 * Spec:    n/a — reported 2026-09-21
 * Tests:   src/frontend/src/utils/partnershipUtils.test.ts
 *
 * The marks used to key off `relationshipStatus` alone, a single current
 * value. A couple with a marriage, a separation AND a divorce date recorded
 * still showed an unbroken line whenever that dropdown had been left on
 * "ongoing" — which is the normal state of affairs, since entering the dates
 * is what the user does. The recorded dates are the evidence; the status is
 * only a fallback for a couple whose status was set without a date.
 *
 * Divorce supersedes separation: a divorced couple is drawn with two slashes,
 * not two slashes and a third.
 */
export type PartnershipSeparationMarks = { separated: boolean; divorced: boolean };

const hasStatusDate = (partnership: Partnership, ...keys: string[]): boolean =>
  keys.some((key) => {
    const value = (partnership.statusDates || {})[key];
    return !!value && value.trim().length > 0;
  });

export function partnershipSeparationMarks(
  partnership: Partnership
): PartnershipSeparationMarks {
  const status = (partnership.relationshipStatus || '').trim().toLowerCase();

  const divorced =
    !!partnership.divorceDate ||
    hasStatusDate(partnership, 'divorce', 'divorced') ||
    status === 'divorce' ||
    status === 'divorced';

  const separated =
    !!partnership.separationDate ||
    hasStatusDate(partnership, 'separated', 'separation') ||
    status === 'separated' ||
    status === 'ended';

  // Two slashes replace the one, rather than joining it.
  return { separated: separated && !divorced, divorced };
}
