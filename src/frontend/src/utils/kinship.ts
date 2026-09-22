/**
 * Purpose: name how each person in a family scope is related to the person
 *          whose lane is being built — by birth, as a relative's spouse, or as
 *          a spouse's relative.
 * Spec:    n/a — follow-up to gate pass 13, 2026-09-22
 * Tests:   src/frontend/src/utils/kinship.test.ts
 *
 * "Married in" is not one relationship, it is several, and the kinship term
 * depends on WHERE on the path the marriage is crossed:
 *
 *   - a RELATIVE'S SPOUSE — reach a blood relative, then cross a marriage:
 *     a son's wife is a daughter-in-law, a sibling's husband a brother-in-law,
 *     a parent's other partner a step-parent;
 *   - a SPOUSE'S RELATIVE — cross the lane person's own marriage first, then
 *     move: up to a father-in-law, down to a step-son, up-and-down to a
 *     sister-in-law.
 *
 * An earlier version collapsed both into a single married-in flag, so a
 * father-in-law read "Step-father" and a step-son read "Son-in-law".
 *
 * Blood is decided by the family-scope traversal (up, then down, never up
 * again) and always wins. For everyone else this does a hop-ordered search
 * from the lane person, so each person takes the CLOSEST route to them.
 */
import type { Partnership, Person } from '../types';

export type KinRoute =
  | 'blood'
  /** The lane person's own partner. */
  | 'ownSpouse'
  /** The own partner's ancestors: parents-in-law, grandparents-in-law. */
  | 'ownSpouseUp'
  /** The own partner's children by someone else: step-children. */
  | 'ownSpouseDown'
  /** The own partner's siblings: brothers- and sisters-in-law. */
  | 'ownSpouseSide'
  /** Any other blood relative's partner: in-law or step, by generation. */
  | 'relativeSpouse'
  /** Anything further — related by marriage, no everyday term. */
  | 'distant';

type Edge = 'up' | 'down' | 'partner';

/** Where a route goes next, given the edge it takes. */
const next = (route: KinRoute, edge: Edge): KinRoute => {
  switch (route) {
    case 'ownSpouse':
      return edge === 'up' ? 'ownSpouseUp' : edge === 'down' ? 'ownSpouseDown' : 'distant';
    case 'ownSpouseUp':
      // Further up stays in the in-law line; down from a parent-in-law
      // reaches the partner's siblings.
      return edge === 'up' ? 'ownSpouseUp' : edge === 'down' ? 'ownSpouseSide' : 'distant';
    case 'ownSpouseDown':
      return edge === 'down' ? 'ownSpouseDown' : 'distant';
    default:
      return 'distant';
  }
};

/**
 * Purpose: the kin route to every person reachable from the lane person.
 * Tests:   kinship.test.ts::test_kin_father_in_law_is_not_a_step_father
 *
 * @param bloodIds the people the scope traversal found to be related by birth.
 */
export function computeKinRoutes(
  people: Person[],
  partnerships: Partnership[],
  laneId: string,
  bloodIds: Set<string>
): Map<string, KinRoute> {
  const personById = new Map(people.map((person) => [person.id, person]));
  const partnershipById = new Map(partnerships.map((entry) => [entry.id, entry]));
  const routes = new Map<string, KinRoute>();
  if (!personById.has(laneId)) return routes;

  // Blood always wins, whatever order the search would reach it in.
  bloodIds.forEach((id) => routes.set(id, 'blood'));
  routes.set(laneId, 'blood');

  const neighbours = (id: string): Array<{ id: string; edge: Edge }> => {
    const person = personById.get(id);
    if (!person) return [];
    const out: Array<{ id: string; edge: Edge }> = [];
    [person.parentPartnership, person.birthParentPartnership]
      .filter((pid): pid is string => !!pid)
      .forEach((pid) => {
        const parents = partnershipById.get(pid);
        if (!parents) return;
        [parents.partner1_id, parents.partner2_id].forEach((parentId) => {
          if (parentId) out.push({ id: parentId, edge: 'up' });
        });
      });
    (person.partnerships || []).forEach((pid) => {
      const union = partnershipById.get(pid);
      if (!union) return;
      const partnerId = union.partner1_id === id ? union.partner2_id : union.partner1_id;
      if (partnerId && partnerId !== id) out.push({ id: partnerId, edge: 'partner' });
      (union.children || []).forEach((childId) => out.push({ id: childId, edge: 'down' }));
    });
    return out;
  };

  // Hop-ordered: the first route to reach someone is the closest one.
  const queue: Array<{ id: string; route: KinRoute }> = [];
  const enqueueFrom = (id: string, route: KinRoute) => queue.push({ id, route });
  enqueueFrom(laneId, 'blood');
  bloodIds.forEach((id) => {
    if (id !== laneId) enqueueFrom(id, 'blood');
  });

  const expanded = new Set<string>();
  while (queue.length) {
    const { id, route } = queue.shift()!;
    const key = `${id}:${route}`;
    if (expanded.has(key)) continue;
    expanded.add(key);

    neighbours(id).forEach(({ id: target, edge }) => {
      if (routes.has(target)) return; // already has a closer (or blood) route
      let targetRoute: KinRoute;
      if (route === 'blood') {
        if (edge !== 'partner') return; // blood-to-blood moves are the scope's job
        // Crossing a marriage from a blood relative: from the lane person it is
        // their own partner, from anyone else it is that relative's spouse.
        targetRoute = id === laneId ? 'ownSpouse' : 'relativeSpouse';
      } else {
        targetRoute = next(route, edge);
      }
      routes.set(target, targetRoute);
      enqueueFrom(target, targetRoute);
    });
  }

  return routes;
}

/**
 * The shape of the closest blood path to a relative: how many generations up
 * to the shared ancestor, then how many down.
 *
 * Generation alone cannot name a blood relative. An uncle and a father are
 * both one generation up; a cousin and a brother are both level. Keyed on
 * generation, Jim's uncle Paul came out as his "Father". The path shape
 * separates them: a father is one up and none down, an uncle two up and one
 * down.
 */
export type BloodPath = { ups: number; downs: number };

/**
 * Purpose: the (ups, downs) shape of the shortest blood path to each blood
 *          relative, following the genealogical rule — up, then down, never
 *          up again.
 * Tests:   kinship.test.ts::test_kin_an_uncle_is_not_a_father
 */
export function computeBloodPaths(
  people: Person[],
  partnerships: Partnership[],
  laneId: string,
  bloodIds: Set<string>
): Map<string, BloodPath> {
  const personById = new Map(people.map((person) => [person.id, person]));
  const partnershipById = new Map(partnerships.map((entry) => [entry.id, entry]));
  const paths = new Map<string, BloodPath>();
  if (!personById.has(laneId)) return paths;

  // Phase 1: ancestors only — up edges, recording the height of each.
  // Phase 2: from every ancestor (and the lane person), down edges.
  // Keeping the phases separate is what enforces "never up again".
  const height = new Map<string, number>([[laneId, 0]]);
  const upQueue = [laneId];
  while (upQueue.length) {
    const id = upQueue.shift()!;
    const person = personById.get(id);
    if (!person) continue;
    [person.parentPartnership, person.birthParentPartnership]
      .filter((pid): pid is string => !!pid)
      .forEach((pid) => {
        const parents = partnershipById.get(pid);
        if (!parents) return;
        [parents.partner1_id, parents.partner2_id].forEach((parentId) => {
          if (!parentId || height.has(parentId) || !bloodIds.has(parentId)) return;
          height.set(parentId, (height.get(id) ?? 0) + 1);
          upQueue.push(parentId);
        });
      });
  }

  // Seed the down search from the nearest ancestors first, so a relative
  // reachable through several ancestors takes the closest shared one.
  const seeds = [...height.entries()].sort((a, b) => a[1] - b[1]);
  seeds.forEach(([id, ups]) => {
    if (!paths.has(id)) paths.set(id, { ups, downs: 0 });
  });
  const downQueue: Array<{ id: string; ups: number; downs: number }> = seeds.map(
    ([id, ups]) => ({ id, ups, downs: 0 })
  );
  while (downQueue.length) {
    const { id, ups, downs } = downQueue.shift()!;
    const person = personById.get(id);
    if (!person) continue;
    (person.partnerships || []).forEach((pid) => {
      const union = partnershipById.get(pid);
      if (!union) return;
      (union.children || []).forEach((childId) => {
        if (!childId || paths.has(childId) || !bloodIds.has(childId)) return;
        const path = { ups, downs: downs + 1 };
        paths.set(childId, path);
        downQueue.push({ id: childId, ...path });
      });
    });
  }
  return paths;
}
