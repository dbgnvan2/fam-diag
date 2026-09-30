/**
 * Spec: docs/implementation_plan_2026-09-19.md#M1.A.13
 *
 * Runs the scope computation against a real saved diagram rather than a
 * hand-built graph, so the traversal is exercised on the id shapes and
 * optional-field patterns that actually occur in user files.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { computeFamilyScope, computeScopeDepth } from './familyScope';
import type { Partnership, Person } from '../types';

const loadDiagram = (): { people: Person[]; partnerships: Partnership[] } => {
  const raw = JSON.parse(
    readFileSync(join(__dirname, '../../../../dixie 3 generations.json'), 'utf8')
  ) as { people: Person[]; partnerships: Partnership[] };
  return { people: raw.people, partnerships: raw.partnerships };
};

describe('familyScope on the dixie 3 generations fixture', () => {
  it('test_m1a13_dixie_three_generations_scope_is_subset', () => {
    const { people, partnerships } = loadDiagram();
    expect(people.length).toBeGreaterThan(0);

    // "M (b.1968)" sits in the middle generation of this file.
    const root = people.find((person) => person.name?.startsWith('M (b.1968)'));
    expect(root).toBeDefined();

    const scope = computeFamilyScope(people, partnerships, root!.id, { up: 0, down: 2 });
    // Exact membership, measured on the file: M, her partner D, and their
    // descendants. A bound ("fewer than everyone") could not catch a leak.
    const names = [...scope.personIds].map((id) => people.find((person) => person.id === id)?.name).sort();
    expect(names).toEqual(['D (b.1971)', 'E (b.2014)', 'E (child, b.2010-twin)', 'K (b.2010)', 'M (b.1968)']);
  });

  it('test_m1a13_dixie_two_up_reaches_grandparents', () => {
    const { people, partnerships } = loadDiagram();
    const root = people.find((person) => person.name?.startsWith('K (b.2010)'));
    expect(root).toBeDefined();

    const scope = computeFamilyScope(people, partnerships, root!.id, { up: 2, down: 0 });
    const generations = [...scope.generation.values()];
    expect(Math.min(...generations)).toBe(-2);
    expect(Math.max(...generations)).toBe(0);
  });

  it('test_m1a13_dixie_depth_is_finite', () => {
    const { people, partnerships } = loadDiagram();
    const root = people.find((person) => person.name?.startsWith('K (b.2010)'));
    const depth = computeScopeDepth(people, partnerships, root!.id);
    // K is the youngest generation of a three-generation file.
    expect(depth).toEqual({ maxUp: 2, maxDown: 0 });
  });
});
