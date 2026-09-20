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
import { useCallback, useMemo, useState } from 'react';
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

export function useFamilyScope({
  people,
  partnerships,
  allEmotionalLines = [],
  triangles = [],
}: UseFamilyScopeDeps): UseFamilyScopeResult {
  const [focus, setFocus] = useState<FamilyScopeFocus | null>(null);

  const depth = useMemo(() => {
    if (!focus) return { maxUp: 0, maxDown: 0 };
    return computeScopeDepth(people, partnerships, focus.rootId, {
      includeCollaterals: focus.includeCollaterals,
      includePartnerFOO: focus.includePartnerFOO,
    });
  }, [focus, people, partnerships]);

  const scope = useMemo(() => {
    if (!focus) return null;
    return computeFamilyScope(people, partnerships, focus.rootId, {
      up: focus.up,
      down: focus.down,
      includeCollaterals: focus.includeCollaterals,
      includePartnerFOO: focus.includePartnerFOO,
    });
  }, [focus, people, partnerships]);

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
