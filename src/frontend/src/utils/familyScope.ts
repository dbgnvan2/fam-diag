/**
 * Family scope — "show me only this person's family, N generations up and
 * N generations down".
 *
 * Purpose: compute the set of people and partnerships that belong to one
 *          person's family within a generation band, so the canvas can hide
 *          everyone else and the Timeline can build its lanes from the same
 *          set.
 * Spec:    docs/implementation_plan_2026-09-19.md#M1
 * Tests:   src/frontend/src/utils/familyScope.test.ts
 *
 * The traversal is a generation-banded BFS, not a lineal walk. Root is
 * generation 0; a person is in scope iff -up <= gen <= +down AND they are
 * reachable by a legal edge path:
 *
 *   - up edge      person -> parentPartnership / birthParentPartnership ->
 *                  both partners, at gen - 1. Legal only from a LINEAL node
 *                  (never from a married-in partner: their family of origin
 *                  is a different family), and only if gen - 1 >= -up.
 *   - down edge    person -> their partnerships -> children, at gen + 1.
 *                  Legal if gen + 1 <= +down.
 *   - partner edge person -> partners, same gen. Always legal; marks the
 *                  partner married-in unless already reached as lineal.
 *
 * Siblings, aunts/uncles and cousins fall out of up-then-down paths and need
 * no special case. Boundary rule R4a: at up = 2 a grandparent's own siblings
 * are NOT included, because reaching them needs a great-grandparent
 * partnership at gen -3, outside the band.
 */
import type { EmotionalLine, Partnership, Person, Triangle } from '../types';
import { earliestPartnershipDate } from './partnershipUtils';

export type FamilyScopeOptions = {
  up: number;
  down: number;
  /** Siblings / aunts / uncles / cousins. Default true. */
  includeCollaterals?: boolean;
  /** Walk up from married-in partners into their family of origin. Default false. */
  includePartnerFOO?: boolean;
};

export type FamilyScope = {
  rootId: string;
  personIds: Set<string>;
  partnershipIds: Set<string>;
  /** Generation offset from the root: negative = ancestors, positive = descendants. */
  generation: Map<string, number>;
  /** People reached only as someone's partner (no blood path from the root). */
  marriedIn: Set<string>;
};

export type FamilyScopeFocus = {
  rootId: string;
  up: number;
  down: number;
  includeCollaterals: boolean;
  includePartnerFOO: boolean;
};

export type FamilyScopeExclusions = {
  visiblePeople: number;
  totalPeople: number;
  hiddenEmotionalLines: number;
  hiddenTriangles: number;
  boundaryEvents: number;
  /** Counterpart names shared by more than one person, so not attributable. */
  unresolvedBoundaryRefs: number;
};

export const DEFAULT_SCOPE_UP = 2;
export const DEFAULT_SCOPE_DOWN = 2;

export const defaultFocusForRoot = (rootId: string): FamilyScopeFocus => ({
  rootId,
  up: DEFAULT_SCOPE_UP,
  down: DEFAULT_SCOPE_DOWN,
  includeCollaterals: true,
  includePartnerFOO: false,
});

/** How a person was reached. Lineal nodes may walk up; married-in nodes may not. */
type Reach = { gen: number; lineal: boolean; fromChildId?: string };

const parentPartnershipIds = (person: Person): string[] => {
  const ids: string[] = [];
  if (person.parentPartnership) ids.push(person.parentPartnership);
  if (person.birthParentPartnership && person.birthParentPartnership !== person.parentPartnership) {
    ids.push(person.birthParentPartnership);
  }
  return ids;
};

/**
 * Purpose: compute the family scope around one root person.
 * Spec:    docs/implementation_plan_2026-09-19.md#M1.A.1
 * Tests:   familyScope.test.ts::test_m1a1_returns_root_only_for_zero_up_zero_down
 */
export function computeFamilyScope(
  people: Person[],
  partnerships: Partnership[],
  rootId: string,
  options: FamilyScopeOptions
): FamilyScope {
  const { up, down } = options;
  const includeCollaterals = options.includeCollaterals ?? true;
  const includePartnerFOO = options.includePartnerFOO ?? false;

  const personById = new Map(people.map((person) => [person.id, person]));
  const partnershipById = new Map(partnerships.map((partnership) => [partnership.id, partnership]));

  const empty: FamilyScope = {
    rootId,
    personIds: new Set<string>(),
    partnershipIds: new Set<string>(),
    generation: new Map<string, number>(),
    marriedIn: new Set<string>(),
  };
  if (!personById.has(rootId)) return empty;

  // Visited state keyed by person id, kept at the least-restrictive reach:
  // a lineal reach beats a married-in reach, and a reach closer to the root
  // generation leaves more budget in both directions.
  const reached = new Map<string, Reach>();
  const queue: Array<{ id: string; reach: Reach }> = [];

  const isBetter = (next: Reach, prev: Reach | undefined): boolean => {
    if (!prev) return true;
    if (next.lineal && !prev.lineal) return true;
    if (!next.lineal && prev.lineal) return false;
    return Math.abs(next.gen) < Math.abs(prev.gen);
  };

  const visit = (id: string, reach: Reach) => {
    if (!personById.has(id)) return;
    if (reach.gen < -up || reach.gen > down) return;
    if (!isBetter(reach, reached.get(id))) return;
    reached.set(id, reach);
    queue.push({ id, reach });
  };

  visit(rootId, { gen: 0, lineal: true });

  while (queue.length) {
    const { id, reach } = queue.shift()!;
    // Guard against a stale queue entry that a better reach has superseded.
    if (reached.get(id) !== reach) continue;
    const person = personById.get(id);
    if (!person) continue;

    // Partner edge — same generation, never lineal on its own.
    (person.partnerships || []).forEach((partnershipId) => {
      const partnership = partnershipById.get(partnershipId);
      if (!partnership) return;
      const partnerId =
        partnership.partner1_id === id ? partnership.partner2_id : partnership.partner1_id;
      if (!partnerId || partnerId === id) return;
      visit(partnerId, { gen: reach.gen, lineal: false });
    });

    // Up edge — only from a lineal node, unless the partner-FOO toggle is on.
    if (reach.lineal || includePartnerFOO) {
      parentPartnershipIds(person).forEach((partnershipId) => {
        const partnership = partnershipById.get(partnershipId);
        if (!partnership) return;
        [partnership.partner1_id, partnership.partner2_id].forEach((parentId) => {
          if (!parentId) return;
          visit(parentId, { gen: reach.gen - 1, lineal: true, fromChildId: id });
        });
      });
    }

    // Down edge — children of every partnership this person belongs to.
    // With collaterals off, a node reached by walking up may only descend
    // back to the child it came from.
    (person.partnerships || []).forEach((partnershipId) => {
      const partnership = partnershipById.get(partnershipId);
      if (!partnership) return;
      (partnership.children || []).forEach((childId) => {
        if (!childId) return;
        if (!includeCollaterals && reach.fromChildId && childId !== reach.fromChildId) return;
        visit(childId, { gen: reach.gen + 1, lineal: true });
      });
    });
  }

  const personIds = new Set(reached.keys());
  const generation = new Map<string, number>();
  const marriedIn = new Set<string>();
  reached.forEach((reach, id) => {
    generation.set(id, reach.gen);
    if (!reach.lineal) marriedIn.add(id);
  });

  // A partnership is in scope iff both partners are — the rule
  // partnershipVisibility already applies on the canvas.
  const partnershipIds = new Set<string>();
  partnerships.forEach((partnership) => {
    if (personIds.has(partnership.partner1_id) && personIds.has(partnership.partner2_id)) {
      partnershipIds.add(partnership.id);
    }
  });

  return { rootId, personIds, partnershipIds, generation, marriedIn };
}

/**
 * Purpose: count what a scope hides, so the UI can say so instead of silently
 *          dropping it.
 * Spec:    docs/implementation_plan_2026-09-19.md#M1.A.12
 * Tests:   familyScope.test.ts::test_m1a12_counts_hidden_lines_triangles_and_boundary_events
 */
export function computeScopeExclusions(
  scope: FamilyScope | null,
  people: Person[],
  partnerships: Partnership[],
  allEmotionalLines: EmotionalLine[],
  triangles: Triangle[]
): FamilyScopeExclusions {
  if (!scope) {
    return {
      visiblePeople: people.length,
      totalPeople: people.length,
      hiddenEmotionalLines: 0,
      hiddenTriangles: 0,
      boundaryEvents: 0,
      unresolvedBoundaryRefs: 0,
    };
  }
  const inScope = (id?: string) => !!id && scope.personIds.has(id);

  const hiddenEmotionalLines = allEmotionalLines.filter(
    (line) => !inScope(line.person1_id) || !inScope(line.person2_id)
  ).length;

  const hiddenTriangles = triangles.filter(
    (triangle) =>
      !inScope(triangle.person1_id) ||
      !inScope(triangle.person2_id) ||
      !inScope(triangle.person3_id)
  ).length;

  // Events kept on screen whose counterpart sits outside the scope.
  // Events carry a counterpart's display NAME, not an id. Repeated names
  // across generations are normal in a genogram, so a name shared by two
  // people cannot be resolved and must not be guessed — it is counted as
  // unresolved and reported separately rather than attributed to whichever
  // person happened to be last in the list.
  const idsByName = new Map<string, string[]>();
  people.forEach((person) => {
    const key = (person.name || '').trim().toLowerCase();
    if (!key) return;
    idsByName.set(key, [...(idsByName.get(key) || []), person.id]);
  });
  let unresolvedBoundaryRefs = 0;
  const referencesOutOfScope = (otherPersonName?: string): boolean => {
    const key = (otherPersonName || '').trim().toLowerCase();
    if (!key || key === 'none') return false;
    const matches = idsByName.get(key);
    if (!matches || matches.length === 0) return false;
    if (matches.length > 1) {
      unresolvedBoundaryRefs += 1;
      return false;
    }
    return !inScope(matches[0]);
  };

  let boundaryEvents = 0;
  people.forEach((person) => {
    if (!inScope(person.id)) return;
    (person.events || []).forEach((event) => {
      if (referencesOutOfScope(event.otherPersonName)) boundaryEvents += 1;
    });
  });
  partnerships.forEach((partnership) => {
    if (!scope.partnershipIds.has(partnership.id)) return;
    [...(partnership.events || []), ...(partnership.familyEvents || [])].forEach((event) => {
      if (referencesOutOfScope(event.otherPersonName)) boundaryEvents += 1;
    });
  });

  return {
    visiblePeople: scope.personIds.size,
    totalPeople: people.length,
    hiddenEmotionalLines,
    hiddenTriangles,
    boundaryEvents,
    unresolvedBoundaryRefs,
  };
}

/**
 * Purpose: compose the two independent canvas filters — the family scope and
 *          the timeline-year slider — into one person-visibility map. They
 *          AND together: a person must pass both to be drawn (D9).
 * Spec:    docs/implementation_plan_2026-09-19.md#M2.A.4
 * Tests:   familyScope.test.ts::test_m2a4_scope_and_year_slider_and_together
 */
export function buildPersonVisibility(
  people: Person[],
  scope: FamilyScope | null,
  isVisibleAtTimeline: (date?: string | null) => boolean
): Map<string, boolean> {
  const map = new Map<string, boolean>();
  people.forEach((person) => {
    const inScope = scope ? scope.personIds.has(person.id) : true;
    map.set(person.id, inScope && isVisibleAtTimeline(person.birthDate));
  });
  return map;
}

/**
 * Purpose: decide which partnership lines may be drawn at the current
 *          timeline year, given which people are visible.
 * Spec:    n/a — regression fix, 2026-09-19
 * Tests:   partnershipUtils.test.ts::test_prl_marriage_only_partnership_is_hidden_before_its_date
 *
 * The date tested is the EARLIEST the partnership records, not
 * `relationshipStartDate` alone: a marriage date entered in the Properties
 * panel lands in `statusDates` / `marriedStartDate`, and reading only
 * `relationshipStartDate` left nothing to test — so the line was drawn from
 * the partners' birth.
 */
export function buildPartnershipVisibility(
  partnerships: Partnership[],
  personVisibility: Map<string, boolean>,
  isVisibleAtTimeline: (date?: string | null) => boolean
): Map<string, boolean> {
  const map = new Map<string, boolean>();
  partnerships.forEach((partnership) => {
    const visible =
      isVisibleAtTimeline(earliestPartnershipDate(partnership)) &&
      (personVisibility.get(partnership.partner1_id) ?? true) &&
      (personVisibility.get(partnership.partner2_id) ?? true);
    map.set(partnership.id, visible);
  });
  return map;
}

export type ScopedSelection = {
  personIds: string[];
  partnershipId: string | null;
  familyIds: string[];
  childId: string | null;
  emotionalLineId: string | null;
};

/**
 * Purpose: drop anything a focus has just hidden from the current selection,
 *          the same way the timeline-year slider already prunes it.
 * Spec:    docs/implementation_plan_2026-09-19.md#M2.A.5
 * Tests:   familyScope.test.ts::test_m2a5_focus_prunes_hidden_selection
 */
export function pruneSelectionToScope(
  scope: FamilyScope | null,
  selection: ScopedSelection,
  allEmotionalLines: EmotionalLine[] = []
): ScopedSelection {
  if (!scope) return selection;
  const inScope = (id?: string | null): boolean => !!id && scope.personIds.has(id);
  const line = selection.emotionalLineId
    ? allEmotionalLines.find((entry) => entry.id === selection.emotionalLineId)
    : undefined;
  return {
    personIds: selection.personIds.filter((id) => inScope(id)),
    partnershipId:
      selection.partnershipId && scope.partnershipIds.has(selection.partnershipId)
        ? selection.partnershipId
        : null,
    familyIds: selection.familyIds.filter((id) => scope.partnershipIds.has(id)),
    childId: inScope(selection.childId) ? selection.childId : null,
    // A line we cannot resolve is left alone: absence from the list means the
    // caller has not supplied it, not that it is out of scope.
    emotionalLineId: !selection.emotionalLineId
      ? null
      : !line
      ? selection.emotionalLineId
      : inScope(line.person1_id) && inScope(line.person2_id)
      ? selection.emotionalLineId
      : null,
  };
}

const birthKey = (person?: Person): string => person?.birthDate || '9999-99-99';

/**
 * Purpose: decide which Timeline lanes to open — an explicit person selection
 *          always wins over the active scope.
 * Spec:    docs/implementation_plan_2026-09-19.md#M4.A.1
 * Tests:   familyScope.test.ts::test_m4a1_explicit_person_selection_wins_over_scope
 */
export function deriveTimelineSelection(
  scope: FamilyScope | null,
  selectedPeopleIds: string[],
  people: Person[],
  partnerships: Partnership[],
  selectedFamilyIds: string[] = []
): { personIds: string[]; familyIds: string[] } {
  if (selectedPeopleIds.length > 0) {
    return { personIds: [...selectedPeopleIds], familyIds: [...selectedFamilyIds] };
  }
  if (!scope) return { personIds: [], familyIds: [...selectedFamilyIds] };

  const personById = new Map(people.map((person) => [person.id, person]));
  const personIds = [...scope.personIds].sort((a, b) => {
    const genA = scope.generation.get(a) ?? 0;
    const genB = scope.generation.get(b) ?? 0;
    if (genA !== genB) return genA - genB;
    const birthA = birthKey(personById.get(a));
    const birthB = birthKey(personById.get(b));
    if (birthA !== birthB) return birthA < birthB ? -1 : 1;
    const nameA = personById.get(a)?.name || '';
    const nameB = personById.get(b)?.name || '';
    return nameA.localeCompare(nameB);
  });

  const familyIds = partnerships
    .filter((partnership) => scope.partnershipIds.has(partnership.id))
    .map((partnership) => partnership.id);

  return { personIds, familyIds };
}

/**
 * Purpose: the deepest ancestor / descendant distance actually present around
 *          a root, so the +/- steppers can clamp at the real depth.
 * Spec:    docs/implementation_plan_2026-09-19.md#M2.A.2
 * Tests:   useFamilyScope.test.ts::test_m2a2_steppers_clamp_at_zero_and_max_depth
 */
export function computeScopeDepth(
  people: Person[],
  partnerships: Partnership[],
  rootId: string,
  options: Pick<FamilyScopeOptions, 'includeCollaterals' | 'includePartnerFOO'> = {}
): { maxUp: number; maxDown: number } {
  // The depth must be measured with the SAME traversal the focus uses —
  // otherwise the +/- steppers clamp against a family the focus cannot reach
  // (or stop short of one it can).
  const wide = computeFamilyScope(people, partnerships, rootId, {
    up: people.length,
    down: people.length,
    includeCollaterals: options.includeCollaterals ?? true,
    includePartnerFOO: options.includePartnerFOO ?? false,
  });
  let maxUp = 0;
  let maxDown = 0;
  wide.generation.forEach((gen) => {
    if (gen < 0) maxUp = Math.max(maxUp, -gen);
    if (gen > 0) maxDown = Math.max(maxDown, gen);
  });
  return { maxUp, maxDown };
}
