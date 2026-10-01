/**
 * Purpose: hold the active family-scope focus (root person + N generations up
 *          / down) and derive the scope, its depth limits and its exclusion
 *          counts from it.
 * Spec:    docs/implementation_plan_2026-09-19.md#M2
 * Tests:   src/frontend/src/hooks/useFamilyScope.test.ts
 *
 * The focus is view state only — it is never written to the diagram, never
 * autosaved, and never moves a person (D7/D8).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EmotionalLine, Partnership, Person, Triangle } from '../types';
import {
  computeFamilyScope,
  computeScopeDepth,
  computeScopeExclusions,
  defaultFocusForRoot,
  type FamilyScope,
  type FamilyScopeExclusions,
  type FamilyScopeFocus,
} from '../utils/familyScope';

interface UseFamilyScopeDeps {
  people: Person[];
  partnerships: Partnership[];
  allEmotionalLines?: EmotionalLine[];
  triangles?: Triangle[];
}

export interface UseFamilyScopeResult {
  focus: FamilyScopeFocus | null;
  scope: FamilyScope | null;
  exclusions: FamilyScopeExclusions;
  depth: { maxUp: number; maxDown: number };
  rootPerson: Person | null;
  setFocus: (focus: FamilyScopeFocus | null) => void;
  focusOnPerson: (rootId: string, overrides?: Partial<Omit<FamilyScopeFocus, 'rootId'>>) => void;
  clearFocus: () => void;
  adjustUp: (delta: number) => void;
  adjustDown: (delta: number) => void;
  isInScope: (personId: string) => boolean;
}

/**
 * Everything the family scope reads about structure — ids, parent families,
 * partnerships and children — and nothing about position or other fields.
 */
export const familyTopologyKey = (people: Person[], partnerships: Partnership[]): string =>
  JSON.stringify([
    people.map((person) => [person.id, person.parentPartnership, person.birthParentPartnership, person.partnerships]),
    partnerships.map((partnership) => [partnership.id, partnership.partner1_id, partnership.partner2_id, partnership.children]),
  ]);

export function useFamilyScope({
  people,
  partnerships,
  allEmotionalLines = [],
  triangles = [],
}: UseFamilyScopeDeps): UseFamilyScopeResult {
  const [storedFocus, setFocus] = useState<FamilyScopeFocus | null>(null);
  // A focus whose root person is gone (deleted, or a different diagram
  // opened / File > New) is no focus: it gave an empty scope that hid
  // everyone, including people added afterwards (review 2026-09-30 DE1-06).
  const rootExists = !!storedFocus && people.some((person) => person.id === storedFocus.rootId);
  const focus = rootExists ? storedFocus : null;
  useEffect(() => {
    if (storedFocus && !rootExists) setFocus(null);
  }, [storedFocus, rootExists]);

  // The scope depends only on who is related to whom, never on where people
  // stand. Keyed on that, a drag no longer recomputes it (and every effect
  // keyed on the scope) on every frame (review 2026-09-30 struct-03).
  const topologyKey = useMemo(() => familyTopologyKey(people, partnerships), [people, partnerships]);
  const latest = useRef({ people, partnerships });
  latest.current = { people, partnerships };

  const depth = useMemo(() => {
    if (!focus) return { maxUp: 0, maxDown: 0 };
    return computeScopeDepth(latest.current.people, latest.current.partnerships, focus.rootId, {
      includeCollaterals: focus.includeCollaterals,
      includePartnerFOO: focus.includePartnerFOO,
    });
    // topologyKey is the cache key (people / partnerships are read through
    // a ref so a move does not recompute) — review struct-03.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, topologyKey]);

  const scope = useMemo(() => {
    if (!focus) return null;
    return computeFamilyScope(latest.current.people, latest.current.partnerships, focus.rootId, {
      up: focus.up,
      down: focus.down,
      includeCollaterals: focus.includeCollaterals,
      includePartnerFOO: focus.includePartnerFOO,
    });
    // topologyKey is the cache key (people / partnerships are read through
    // a ref so a move does not recompute) — review struct-03.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, topologyKey]);

  const exclusions = useMemo(
    () => computeScopeExclusions(scope, people, partnerships, allEmotionalLines, triangles),
    [scope, people, partnerships, allEmotionalLines, triangles]
  );

  const rootPerson = useMemo(
    () => (focus ? people.find((person) => person.id === focus.rootId) ?? null : null),
    [focus, people]
  );

  const focusOnPerson = useCallback(
    (rootId: string, overrides: Partial<Omit<FamilyScopeFocus, 'rootId'>> = {}) => {
      setFocus({ ...defaultFocusForRoot(rootId), ...overrides });
    },
    []
  );

  const clearFocus = useCallback(() => setFocus(null), []);

  const adjustUp = useCallback(
    (delta: number) => {
      setFocus((prev) => {
        if (!prev) return prev;
        const { maxUp } = computeScopeDepth(people, partnerships, prev.rootId, {
          includeCollaterals: prev.includeCollaterals,
          includePartnerFOO: prev.includePartnerFOO,
        });
        const next = Math.min(Math.max(prev.up + delta, 0), maxUp);
        return next === prev.up ? prev : { ...prev, up: next };
      });
    },
    [people, partnerships]
  );

  const adjustDown = useCallback(
    (delta: number) => {
      setFocus((prev) => {
        if (!prev) return prev;
        const { maxDown } = computeScopeDepth(people, partnerships, prev.rootId, {
          includeCollaterals: prev.includeCollaterals,
          includePartnerFOO: prev.includePartnerFOO,
        });
        const next = Math.min(Math.max(prev.down + delta, 0), maxDown);
        return next === prev.down ? prev : { ...prev, down: next };
      });
    },
    [people, partnerships]
  );

  const isInScope = useCallback(
    (personId: string) => (scope ? scope.personIds.has(personId) : true),
    [scope]
  );

  return {
    focus,
    scope,
    exclusions,
    depth,
    rootPerson,
    setFocus,
    focusOnPerson,
    clearFocus,
    adjustUp,
    adjustDown,
    isInScope,
  };
}
