import type { Partnership, Person } from '../types';

export function computeDefaultFamilyName(partner1: Person, partner2: Person): string {
  // Same test as siblingPosition: either spelling of the stored gender.
  const isMale = (p: Person) => p.birthSex === 'male' || p.gender === 'b' || p.gender === 'male';
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

  // A whitespace-only date is not a recorded date (same rule as statusDates).
  const divorced =
    !!partnership.divorceDate?.trim() ||
    hasStatusDate(partnership, 'divorce', 'divorced') ||
    status === 'divorce' ||
    status === 'divorced';

  const separated =
    !!partnership.separationDate?.trim() ||
    hasStatusDate(partnership, 'separated', 'separation') ||
    status === 'separated' ||
    status === 'ended';

  // Two slashes replace the one, rather than joining it.
  return { separated: separated && !divorced, divorced };
}

/**
 * True when `ancestorId` is a parent, grandparent, ... of `personId`, through
 * either the raising family or the birth family. Stops on a cycle already
 * present in the data.
 */
export function isAncestorOf(
  ancestorId: string,
  personId: string,
  people: Person[],
  partnerships: Partnership[]
): boolean {
  const personById = new Map(people.map((entry) => [entry.id, entry]));
  const partnershipById = new Map(partnerships.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  const queue = [personId];
  while (queue.length) {
    const current = personById.get(queue.shift()!);
    if (!current) continue;
    [current.parentPartnership, current.birthParentPartnership].forEach((id) => {
      const parents = id ? partnershipById.get(id) : undefined;
      if (!parents) return;
      [parents.partner1_id, parents.partner2_id].forEach((parentId) => {
        if (!parentId || seen.has(parentId)) return;
        seen.add(parentId);
        queue.push(parentId);
      });
    });
  }
  return seen.has(ancestorId);
}

export type AddChildCheck =
  | { kind: 'ok' }
  | { kind: 'already-child' }
  | { kind: 'refuse'; message: string }
  | { kind: 'confirm'; message: string };

/**
 * Whether a person may be made a child of a partnership. Refuses a partner
 * and anyone who is already an ancestor of either partner (which would make
 * the family its own ancestor); asks before moving someone who already has
 * parents, since the move takes them away from those parents.
 */
export function checkAddChildToPartnership(
  childId: string,
  partnership: Partnership,
  people: Person[],
  partnerships: Partnership[]
): AddChildCheck {
  if (partnership.partner1_id === childId || partnership.partner2_id === childId) {
    return { kind: 'refuse', message: 'A PRL partner cannot also be added as that PRL child.' };
  }
  if (partnership.children.includes(childId)) return { kind: 'already-child' };
  const nameOf = (id: string) => people.find((entry) => entry.id === id)?.name || 'this person';
  if (
    isAncestorOf(childId, partnership.partner1_id, people, partnerships) ||
    isAncestorOf(childId, partnership.partner2_id, people, partnerships)
  ) {
    return {
      kind: 'refuse',
      message: `${nameOf(childId)} is an ancestor of this couple and cannot also be their child.`,
    };
  }
  const child = people.find((entry) => entry.id === childId);
  const currentParents = child?.parentPartnership
    ? partnerships.find((entry) => entry.id === child.parentPartnership)
    : undefined;
  if (currentParents && currentParents.id !== partnership.id) {
    return {
      kind: 'confirm',
      message: `${nameOf(childId)} is already the child of ${nameOf(currentParents.partner1_id)} and ${nameOf(
        currentParents.partner2_id
      )}. Move them to this couple instead?`,
    };
  }
  return { kind: 'ok' };
}
