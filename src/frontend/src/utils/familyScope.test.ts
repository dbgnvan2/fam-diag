/**
 * Spec: docs/implementation_plan_2026-09-19.md#M1
 *       docs/implementation_plan_2026-09-19.md#M4.A.1
 */
import { describe, it, expect } from 'vitest';
import {
  buildPersonVisibility,
  computeFamilyScope,
  computeScopeDepth,
  computeScopeExclusions,
  deriveTimelineSelection,
  pruneSelectionToScope,
} from './familyScope';
import type { EmotionalLine, EmotionalProcessEvent, Partnership, Person, Triangle } from '../types';

const person = (id: string, overrides: Partial<Person> = {}): Person => ({
  id,
  name: id,
  x: 0,
  y: 0,
  partnerships: [],
  ...overrides,
});

const partnership = (
  id: string,
  partner1_id: string,
  partner2_id: string,
  children: string[] = []
): Partnership => ({
  id,
  partner1_id,
  partner2_id,
  horizontalConnectorY: 0,
  relationshipType: 'married',
  relationshipStatus: 'married',
  children,
});

/**
 * Four-generation family used across the M1 tests.
 *
 *   ggf + ggm            (gen -3, via prGG)
 *        |
 *   gf + gm   +  gfSib   (gen -2, prG; gfSib is gf's sibling)
 *        |
 *   dad + mum  ,  aunt + uncle      (gen -1, prP / prAunt)
 *        |                  |
 *   root + spouse ,  sister      cousin        (gen 0)
 *        |
 *      kid + kidSpouse                          (gen +1)
 *        |
 *    grandkid                                   (gen +2)
 *        |
 *   greatGrandkid                               (gen +3)
 */
const buildFamily = () => {
  const people: Person[] = [
    person('ggf', { partnerships: ['prGG'] }),
    person('ggm', { partnerships: ['prGG'] }),
    person('gf', { partnerships: ['prG'], parentPartnership: 'prGG' }),
    person('gm', { partnerships: ['prG'] }),
    person('gfSib', { parentPartnership: 'prGG' }),
    person('dad', { partnerships: ['prP'], parentPartnership: 'prG' }),
    person('mum', { partnerships: ['prP'] }),
    person('aunt', { partnerships: ['prAunt'], parentPartnership: 'prG' }),
    person('uncle', { partnerships: ['prAunt'] }),
    person('cousin', { parentPartnership: 'prAunt' }),
    person('root', { partnerships: ['prRoot'], parentPartnership: 'prP', birthDate: '1970-01-01' }),
    person('sister', { parentPartnership: 'prP', birthDate: '1972-01-01' }),
    person('spouse', { partnerships: ['prRoot'] }),
    person('kid', { partnerships: ['prKid'], parentPartnership: 'prRoot', birthDate: '1995-01-01' }),
    person('kidSpouse', { partnerships: ['prKid'] }),
    person('grandkid', { partnerships: ['prGrandkid'], parentPartnership: 'prKid' }),
    person('grandkidSpouse', { partnerships: ['prGrandkid'] }),
    person('greatGrandkid', { parentPartnership: 'prGrandkid' }),
  ];
  const partnerships: Partnership[] = [
    partnership('prGG', 'ggf', 'ggm', ['gf', 'gfSib']),
    partnership('prG', 'gf', 'gm', ['dad', 'aunt']),
    partnership('prP', 'dad', 'mum', ['root', 'sister']),
    partnership('prAunt', 'aunt', 'uncle', ['cousin']),
    partnership('prRoot', 'root', 'spouse', ['kid']),
    partnership('prKid', 'kid', 'kidSpouse', ['grandkid']),
    partnership('prGrandkid', 'grandkid', 'grandkidSpouse', ['greatGrandkid']),
  ];
  return { people, partnerships };
};

describe('computeFamilyScope', () => {
  it('test_m1a1_returns_root_only_for_zero_up_zero_down', () => {
    const { people, partnerships } = buildFamily();
    const scope = computeFamilyScope(people, partnerships, 'root', {
      up: 0,
      down: 0,
      includeCollaterals: true,
    });
    // The spouse comes in on the partner edge (same generation) — a couple
    // cannot be drawn half-present — but nobody above or below does.
    expect([...scope.personIds].sort()).toEqual(['root', 'spouse']);
    expect(scope.generation.get('root')).toBe(0);
    expect(scope.marriedIn.has('spouse')).toBe(true);
    expect(scope.marriedIn.has('root')).toBe(false);
  });

  it('test_m1a2_two_up_includes_grandparents_excludes_great_grandparents', () => {
    const { people, partnerships } = buildFamily();
    const scope = computeFamilyScope(people, partnerships, 'root', { up: 2, down: 0 });
    expect(scope.personIds.has('dad')).toBe(true);
    expect(scope.personIds.has('mum')).toBe(true);
    expect(scope.personIds.has('gf')).toBe(true);
    expect(scope.personIds.has('gm')).toBe(true);
    expect(scope.generation.get('gf')).toBe(-2);
    expect(scope.personIds.has('ggf')).toBe(false);
    expect(scope.personIds.has('ggm')).toBe(false);
  });

  it('test_m1a3_two_down_includes_grandchildren_excludes_great_grandchildren', () => {
    const { people, partnerships } = buildFamily();
    const scope = computeFamilyScope(people, partnerships, 'root', { up: 0, down: 2 });
    expect(scope.personIds.has('kid')).toBe(true);
    expect(scope.personIds.has('grandkid')).toBe(true);
    expect(scope.generation.get('grandkid')).toBe(2);
    expect(scope.personIds.has('greatGrandkid')).toBe(false);
  });

  it('test_m1a4_includes_child_spouse_but_not_spouse_parents', () => {
    const people: Person[] = [
      person('root', { partnerships: ['prRoot'] }),
      person('rootSpouse', { partnerships: ['prRoot'] }),
      person('kid', { partnerships: ['prKid'], parentPartnership: 'prRoot' }),
      person('kidSpouse', { partnerships: ['prKid'], parentPartnership: 'prInLaw' }),
      person('inLawDad', { partnerships: ['prInLaw'] }),
      person('inLawMum', { partnerships: ['prInLaw'] }),
    ];
    const partnerships: Partnership[] = [
      partnership('prRoot', 'root', 'rootSpouse', ['kid']),
      partnership('prKid', 'kid', 'kidSpouse', []),
      partnership('prInLaw', 'inLawDad', 'inLawMum', ['kidSpouse']),
    ];
    const scope = computeFamilyScope(people, partnerships, 'root', { up: 2, down: 2 });
    expect(scope.personIds.has('kidSpouse')).toBe(true);
    expect(scope.marriedIn.has('kidSpouse')).toBe(true);
    // D1: we never walk up from a married-in partner.
    expect(scope.personIds.has('inLawDad')).toBe(false);
    expect(scope.personIds.has('inLawMum')).toBe(false);
  });

  it('test_m1a5_partner_foo_toggle_includes_partner_parents', () => {
    const people: Person[] = [
      person('root', { partnerships: ['prRoot'] }),
      person('rootSpouse', { partnerships: ['prRoot'], parentPartnership: 'prInLaw' }),
      person('inLawDad', { partnerships: ['prInLaw'] }),
      person('inLawMum', { partnerships: ['prInLaw'] }),
    ];
    const partnerships: Partnership[] = [
      partnership('prRoot', 'root', 'rootSpouse', []),
      partnership('prInLaw', 'inLawDad', 'inLawMum', ['rootSpouse']),
    ];
    const off = computeFamilyScope(people, partnerships, 'root', { up: 2, down: 2 });
    expect(off.personIds.has('inLawDad')).toBe(false);

    const on = computeFamilyScope(people, partnerships, 'root', {
      up: 2,
      down: 2,
      includePartnerFOO: true,
    });
    expect(on.personIds.has('inLawDad')).toBe(true);
    expect(on.personIds.has('inLawMum')).toBe(true);
    expect(on.generation.get('inLawDad')).toBe(-1);
  });

  it('test_m1a6_collaterals_on_includes_siblings_aunts_cousins', () => {
    const { people, partnerships } = buildFamily();
    const scope = computeFamilyScope(people, partnerships, 'root', {
      up: 2,
      down: 2,
      includeCollaterals: true,
    });
    expect(scope.personIds.has('sister')).toBe(true);
    expect(scope.personIds.has('aunt')).toBe(true);
    expect(scope.personIds.has('uncle')).toBe(true);
    expect(scope.personIds.has('cousin')).toBe(true);
    expect(scope.generation.get('cousin')).toBe(0);
  });

  it('test_m1a6_collaterals_off_excludes_siblings_aunts_cousins', () => {
    const { people, partnerships } = buildFamily();
    const scope = computeFamilyScope(people, partnerships, 'root', {
      up: 2,
      down: 2,
      includeCollaterals: false,
    });
    expect(scope.personIds.has('sister')).toBe(false);
    expect(scope.personIds.has('aunt')).toBe(false);
    expect(scope.personIds.has('uncle')).toBe(false);
    expect(scope.personIds.has('cousin')).toBe(false);
    // The lineal spine and the partners on it survive.
    expect(scope.personIds.has('dad')).toBe(true);
    expect(scope.personIds.has('gf')).toBe(true);
    expect(scope.personIds.has('kid')).toBe(true);
  });

  it('test_m1a7_grandparent_sibling_excluded_at_two_up', () => {
    const { people, partnerships } = buildFamily();
    const scope = computeFamilyScope(people, partnerships, 'root', { up: 2, down: 2 });
    // R4a: gfSib needs the great-grandparent partnership at gen -3.
    expect(scope.personIds.has('gfSib')).toBe(false);
    const deeper = computeFamilyScope(people, partnerships, 'root', { up: 3, down: 0 });
    expect(deeper.personIds.has('gfSib')).toBe(true);
  });

  it('test_m1a8_adopted_person_traverses_both_parent_partnerships', () => {
    const people: Person[] = [
      person('child', {
        parentPartnership: 'prAdoptive',
        birthParentPartnership: 'prBirth',
      }),
      person('adoptiveDad', { partnerships: ['prAdoptive'] }),
      person('adoptiveMum', { partnerships: ['prAdoptive'] }),
      person('birthDad', { partnerships: ['prBirth'] }),
      person('birthMum', { partnerships: ['prBirth'] }),
    ];
    const partnerships: Partnership[] = [
      partnership('prAdoptive', 'adoptiveDad', 'adoptiveMum', ['child']),
      partnership('prBirth', 'birthDad', 'birthMum', ['child']),
    ];
    const scope = computeFamilyScope(people, partnerships, 'child', { up: 1, down: 0 });
    expect(scope.personIds.has('adoptiveDad')).toBe(true);
    expect(scope.personIds.has('adoptiveMum')).toBe(true);
    expect(scope.personIds.has('birthDad')).toBe(true);
    expect(scope.personIds.has('birthMum')).toBe(true);
  });

  it('test_m1a9_cyclic_parent_chain_terminates', () => {
    // Bad import: a is its own grandparent.
    const people: Person[] = [
      person('a', { partnerships: ['pr1'], parentPartnership: 'pr2' }),
      person('b', { partnerships: ['pr1'] }),
      person('c', { partnerships: ['pr2'], parentPartnership: 'pr1' }),
      person('d', { partnerships: ['pr2'] }),
    ];
    const partnerships: Partnership[] = [
      partnership('pr1', 'a', 'b', ['c']),
      partnership('pr2', 'c', 'd', ['a']),
    ];
    const scope = computeFamilyScope(people, partnerships, 'a', { up: 5, down: 5 });
    expect(scope.personIds.size).toBeLessThanOrEqual(people.length);
    expect(scope.personIds.has('a')).toBe(true);
  });

  it('test_m1a10_partnership_requires_both_partners_in_scope', () => {
    const { people, partnerships } = buildFamily();
    const scope = computeFamilyScope(people, partnerships, 'root', { up: 1, down: 1 });
    expect(scope.partnershipIds.has('prRoot')).toBe(true);
    expect(scope.partnershipIds.has('prP')).toBe(true);
    // prG has gf/gm at gen -2, outside a 1-up scope.
    expect(scope.partnershipIds.has('prG')).toBe(false);
    scope.partnershipIds.forEach((id) => {
      const pr = partnerships.find((entry) => entry.id === id)!;
      expect(scope.personIds.has(pr.partner1_id)).toBe(true);
      expect(scope.personIds.has(pr.partner2_id)).toBe(true);
    });
  });

  it('test_m1a11_isolated_root_returns_single_person', () => {
    const people = [person('lonely')];
    const scope = computeFamilyScope(people, [], 'lonely', { up: 3, down: 3 });
    expect([...scope.personIds]).toEqual(['lonely']);
    expect(scope.partnershipIds.size).toBe(0);
  });

  it('test_m1a11_unknown_root_returns_empty_scope', () => {
    const { people, partnerships } = buildFamily();
    const scope = computeFamilyScope(people, partnerships, 'not-a-person', { up: 2, down: 2 });
    expect(scope.personIds.size).toBe(0);
  });
});

describe('computeScopeExclusions', () => {
  const event = (id: string, otherPersonName: string): EmotionalProcessEvent => ({
    id,
    date: '2000-01-01',
    startDate: '2000-01-01',
    category: 'Conflict',
    eventType: 'NODAL',
    status: 'discrete',
    intensity: 2,
    howWell: 0,
    otherPersonName,
    wwwwh: '',
    observations: '',
    eventClass: 'individual',
  });

  it('test_m1a12_counts_hidden_lines_triangles_and_boundary_events', () => {
    const { people, partnerships } = buildFamily();
    const withEvents = people.map((entry) =>
      entry.id === 'root'
        ? { ...entry, events: [event('e1', 'greatGrandkid'), event('e2', 'sister')] }
        : entry
    );
    const lines: EmotionalLine[] = [
      {
        id: 'l1',
        person1_id: 'root',
        person2_id: 'sister',
        relationshipType: 'conflict',
        lineStyle: 'conflict-double',
        lineEnding: 'none',
      },
      {
        id: 'l2',
        person1_id: 'root',
        person2_id: 'greatGrandkid',
        relationshipType: 'distance',
        lineStyle: 'dotted',
        lineEnding: 'none',
      },
    ];
    const triangles: Triangle[] = [
      { id: 't1', person1_id: 'root', person2_id: 'sister', person3_id: 'greatGrandkid' },
    ];
    const scope = computeFamilyScope(withEvents, partnerships, 'root', { up: 2, down: 2 });
    const exclusions = computeScopeExclusions(scope, withEvents, partnerships, lines, triangles);

    expect(exclusions.totalPeople).toBe(people.length);
    expect(exclusions.visiblePeople).toBe(scope.personIds.size);
    expect(exclusions.hiddenEmotionalLines).toBe(1);
    expect(exclusions.hiddenTriangles).toBe(1);
    // e1 points at greatGrandkid (out of scope); e2 points at sister (in scope).
    expect(exclusions.boundaryEvents).toBe(1);
  });

  it('test_m1a12_ambiguous_counterpart_names_are_reported_not_guessed', () => {
    // Two people share a display name — normal across generations in a
    // genogram. A last-wins name lookup would attribute the event to whichever
    // happened to be later in the array.
    const { people, partnerships } = buildFamily();
    const renamed = people.map((entry) =>
      entry.id === 'sister' || entry.id === 'greatGrandkid'
        ? { ...entry, name: 'Mary' }
        : entry
    );
    const withEvent = renamed.map((entry) =>
      entry.id === 'root' ? { ...entry, events: [event('e1', 'Mary')] } : entry
    );
    const scope = computeFamilyScope(withEvent, partnerships, 'root', { up: 2, down: 2 });
    const exclusions = computeScopeExclusions(scope, withEvent, partnerships, [], []);

    expect(exclusions.unresolvedBoundaryRefs).toBe(1);
    expect(exclusions.boundaryEvents).toBe(0);
  });

  it('test_m1a12_null_scope_reports_everything_visible', () => {
    const { people, partnerships } = buildFamily();
    const exclusions = computeScopeExclusions(null, people, partnerships, [], []);
    expect(exclusions.visiblePeople).toBe(people.length);
    expect(exclusions.hiddenEmotionalLines).toBe(0);
    expect(exclusions.boundaryEvents).toBe(0);
  });
});

describe('deriveTimelineSelection', () => {
  it('test_m4a1_explicit_person_selection_wins_over_scope', () => {
    const { people, partnerships } = buildFamily();
    const scope = computeFamilyScope(people, partnerships, 'root', { up: 2, down: 2 });
    const derived = deriveTimelineSelection(scope, ['sister'], people, partnerships, ['prP']);
    expect(derived.personIds).toEqual(['sister']);
    expect(derived.familyIds).toEqual(['prP']);
  });

  it('test_m4a1_scope_drives_lanes_when_no_person_selected', () => {
    const { people, partnerships } = buildFamily();
    const scope = computeFamilyScope(people, partnerships, 'root', { up: 1, down: 1 });
    const derived = deriveTimelineSelection(scope, [], people, partnerships);
    expect(derived.personIds).toHaveLength(scope.personIds.size);
    expect(new Set(derived.personIds)).toEqual(scope.personIds);
    expect(new Set(derived.familyIds)).toEqual(scope.partnershipIds);
  });

  it('test_m4a1_lanes_sorted_by_generation_then_birthdate', () => {
    const { people, partnerships } = buildFamily();
    const scope = computeFamilyScope(people, partnerships, 'root', { up: 1, down: 1 });
    const derived = deriveTimelineSelection(scope, [], people, partnerships);
    const generations = derived.personIds.map((id) => scope.generation.get(id) ?? 0);
    expect([...generations]).toEqual([...generations].sort((a, b) => a - b));
    // Within generation 0, root (1970) sorts before sister (1972).
    expect(derived.personIds.indexOf('root')).toBeLessThan(derived.personIds.indexOf('sister'));
  });

  it('test_m4a1_no_scope_and_no_selection_yields_no_person_lanes', () => {
    const { people, partnerships } = buildFamily();
    const derived = deriveTimelineSelection(null, [], people, partnerships, ['prP']);
    expect(derived.personIds).toEqual([]);
    expect(derived.familyIds).toEqual(['prP']);
  });
});

describe('computeScopeDepth', () => {
  it('test_m2a2_reports_real_ancestor_and_descendant_depth', () => {
    const { people, partnerships } = buildFamily();
    const depth = computeScopeDepth(people, partnerships, 'root');
    expect(depth.maxUp).toBe(3);
    expect(depth.maxDown).toBe(3);
  });

  it('test_m2a2_depth_honours_the_focus_traversal_options', () => {
    // The steppers clamp against this number, so it has to be measured with
    // the same traversal the focus uses — not a hardcoded one.
    const people: Person[] = [
      person('root', { partnerships: ['prRoot'] }),
      person('spouse', { partnerships: ['prRoot'], parentPartnership: 'prInLaw' }),
      person('inLawDad', { partnerships: ['prInLaw'] }),
      person('inLawMum', { partnerships: ['prInLaw'] }),
    ];
    const partnerships: Partnership[] = [
      partnership('prRoot', 'root', 'spouse', []),
      partnership('prInLaw', 'inLawDad', 'inLawMum', ['spouse']),
    ];
    expect(computeScopeDepth(people, partnerships, 'root').maxUp).toBe(0);
    expect(
      computeScopeDepth(people, partnerships, 'root', { includePartnerFOO: true }).maxUp
    ).toBe(1);
  });
});

describe('buildPersonVisibility', () => {
  const visibilityPeople: Person[] = [
    person('root', { partnerships: ['prRoot'], birthDate: '1970-01-01' }),
    person('kid', { parentPartnership: 'prRoot', birthDate: '2015-01-01' }),
    person('spouse', { partnerships: ['prRoot'], birthDate: '1971-01-01' }),
    person('stranger', { birthDate: '1960-01-01' }),
  ];
  const visibilityPartnerships: Partnership[] = [
    partnership('prRoot', 'root', 'spouse', ['kid']),
  ];
  const bornBy = (year: number) => (date?: string | null) =>
    !date || Number(date.slice(0, 4)) <= year;

  it('test_m2a4_scope_and_year_slider_and_together', () => {
    const scope = computeFamilyScope(visibilityPeople, visibilityPartnerships, 'root', {
      up: 2,
      down: 2,
    });
    const map = buildPersonVisibility(visibilityPeople, scope, bornBy(2000));

    // In scope but born after the slider year → still hidden.
    expect(map.get('kid')).toBe(false);
    // Born before the slider year but out of scope → still hidden.
    expect(map.get('stranger')).toBe(false);
    // Passes both filters.
    expect(map.get('root')).toBe(true);
    expect(map.get('spouse')).toBe(true);
  });

  it('test_m2a4_no_scope_leaves_the_year_slider_in_sole_charge', () => {
    const map = buildPersonVisibility(visibilityPeople, null, bornBy(2000));
    expect(map.get('stranger')).toBe(true);
    expect(map.get('kid')).toBe(false);
  });

  it('test_m2a4_no_year_cutoff_leaves_the_scope_in_sole_charge', () => {
    const scope = computeFamilyScope(visibilityPeople, visibilityPartnerships, 'root', {
      up: 2,
      down: 2,
    });
    const map = buildPersonVisibility(visibilityPeople, scope, () => true);
    expect(map.get('kid')).toBe(true);
    expect(map.get('stranger')).toBe(false);
  });

  it('test_m2a6_focus_cycle_leaves_data_unmutated', () => {
    const before = structuredClone(visibilityPeople);
    const scope = computeFamilyScope(visibilityPeople, visibilityPartnerships, 'root', {
      up: 2,
      down: 2,
    });
    buildPersonVisibility(visibilityPeople, scope, bornBy(2020));
    const other = computeFamilyScope(visibilityPeople, visibilityPartnerships, 'kid', {
      up: 1,
      down: 0,
    });
    buildPersonVisibility(visibilityPeople, other, bornBy(2020));
    const cleared = buildPersonVisibility(visibilityPeople, null, bornBy(2020));

    expect(visibilityPeople).toEqual(before);
    // Clearing the focus restores everyone the year filter allows.
    visibilityPeople.forEach((entry) => expect(cleared.get(entry.id)).toBe(true));
  });
});

describe('pruneSelectionToScope', () => {
  it('test_m2a5_focus_prunes_hidden_selection', () => {
    const { people, partnerships } = buildFamily();
    const scope = computeFamilyScope(people, partnerships, 'root', { up: 1, down: 1 });
    const lines: EmotionalLine[] = [
      {
        id: 'in',
        person1_id: 'root',
        person2_id: 'sister',
        relationshipType: 'conflict',
        lineStyle: 'conflict-double',
        lineEnding: 'none',
      },
      {
        id: 'out',
        person1_id: 'root',
        person2_id: 'gf',
        relationshipType: 'distance',
        lineStyle: 'dotted',
        lineEnding: 'none',
      },
    ];

    const pruned = pruneSelectionToScope(
      scope,
      {
        personIds: ['root', 'gf', 'sister'],
        partnershipId: 'prG',
        familyIds: ['prP', 'prG'],
        childId: 'gf',
        emotionalLineId: 'out',
      },
      lines
    );

    // gf sits at gen -2, outside a 1-up scope.
    expect(pruned.personIds).toEqual(['root', 'sister']);
    expect(pruned.partnershipId).toBeNull();
    expect(pruned.familyIds).toEqual(['prP']);
    expect(pruned.childId).toBeNull();
    expect(pruned.emotionalLineId).toBeNull();
  });

  it('test_m2a5_keeps_a_selection_that_is_entirely_in_scope', () => {
    const { people, partnerships } = buildFamily();
    const scope = computeFamilyScope(people, partnerships, 'root', { up: 2, down: 2 });
    const lines: EmotionalLine[] = [
      {
        id: 'in',
        person1_id: 'root',
        person2_id: 'sister',
        relationshipType: 'conflict',
        lineStyle: 'conflict-double',
        lineEnding: 'none',
      },
    ];
    const selection = {
      personIds: ['root', 'sister'],
      partnershipId: 'prP',
      familyIds: ['prP'],
      childId: 'root',
      emotionalLineId: 'in',
    };
    expect(pruneSelectionToScope(scope, selection, lines)).toEqual(selection);
  });

  it('test_m2a5_no_scope_leaves_the_selection_untouched', () => {
    const selection = {
      personIds: ['anything'],
      partnershipId: 'pr',
      familyIds: ['pr'],
      childId: 'anything',
      emotionalLineId: 'line',
    };
    expect(pruneSelectionToScope(null, selection, [])).toBe(selection);
  });
});
