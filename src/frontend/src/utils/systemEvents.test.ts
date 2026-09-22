/**
 * Spec: docs/implementation_plan_2026-09-19.md#M7.C
 *       docs/implementation_plan_2026-09-19.md#M7.D
 */
import { describe, it, expect } from 'vitest';
import { collectSystemEvents } from './systemEvents';
import { computeFamilyScope, defaultFocusForRoot } from './familyScope';
import type {
  EmotionalLine,
  EmotionalProcessEvent,
  FunctionalIndicatorDefinition,
  Partnership,
  Person,
} from '../types';

const event = (
  id: string,
  category: string,
  date: string,
  overrides: Partial<EmotionalProcessEvent> = {}
): EmotionalProcessEvent => ({
  id,
  date,
  startDate: date,
  category,
  eventType: 'NODAL',
  status: 'discrete',
  intensity: 0,
  howWell: 0,
  otherPersonName: 'None',
  wwwwh: '',
  observations: '',
  eventClass: 'individual',
  ...overrides,
});

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
  children: string[] = [],
  overrides: Partial<Partnership> = {}
): Partnership => ({
  id,
  partner1_id,
  partner2_id,
  horizontalConnectorY: 0,
  relationshipType: 'married',
  relationshipStatus: 'married',
  children,
  ...overrides,
});

/**
 *  dad(m, d.1998) + mum(f)          married 1962, divorced 1985
 *        |
 *  root(m, b.1970) + wife(f)        married 1995
 *        |                    sister(f, b.1972, symptom 1990)
 *      son(m, b.2000)
 *
 *  gf(m, d.1965) + gm(f)            root's grandparents
 */
const buildSystem = () => {
  const people: Person[] = [
    person('gf', {
      partnerships: ['prG'],
      birthSex: 'male',
      deathDate: '1965-03-01',
      name: 'Grandfather',
    }),
    person('gm', { partnerships: ['prG'], birthSex: 'female', name: 'Grandmother' }),
    person('dad', {
      partnerships: ['prP'],
      parentPartnership: 'prG',
      birthSex: 'male',
      deathDate: '1998-04-01',
      name: 'Dad',
    }),
    person('mum', { partnerships: ['prP'], birthSex: 'female', name: 'Mum' }),
    person('root', {
      partnerships: ['prRoot'],
      parentPartnership: 'prP',
      birthSex: 'male',
      birthDate: '1970-01-01',
      name: 'Root',
    }),
    person('wife', { partnerships: ['prRoot'], birthSex: 'female', name: 'Wife' }),
    person('sister', {
      parentPartnership: 'prP',
      birthSex: 'female',
      birthDate: '1972-05-05',
      name: 'Sister',
      events: [
        event('sis-symptom', 'emotional', '1990-02-02', {
          eventType: 'SYMPTOM',
          symptomType: 'Depression',
          intensity: 3,
        }),
      ],
    }),
    person('son', {
      parentPartnership: 'prRoot',
      birthSex: 'male',
      birthDate: '2000-08-08',
      name: 'Son',
    }),
  ];
  const partnerships: Partnership[] = [
    partnership('prG', 'gf', 'gm', ['dad']),
    partnership('prP', 'dad', 'mum', ['root', 'sister'], {
      marriedStartDate: '1962-06-01',
      divorceDate: '1985-09-09',
      familyEvents: [
        event('fam-move', 'Relocation', '1980-01-01', {
          eventType: 'FAMILY',
          eventClass: 'family',
        }),
        event('tri-1', 'Triangle', '1983-01-01', {
          eventType: 'TRIANGLE',
          eventClass: 'triangle',
        }),
      ],
    }),
    partnership('prRoot', 'root', 'wife', ['son'], { marriedStartDate: '1995-07-07' }),
  ];
  return { people, partnerships };
};

const scopeFor = (people: Person[], partnerships: Partnership[], rootId = 'root') => {
  const focus = defaultFocusForRoot(rootId);
  return computeFamilyScope(people, partnerships, rootId, focus);
};

const collect = (
  overrides: Partial<Parameters<typeof collectSystemEvents>[0]> = {},
  rootId = 'root'
) => {
  const { people, partnerships } = buildSystem();
  return collectSystemEvents({
    personId: rootId,
    scope: scopeFor(people, partnerships, rootId),
    people,
    partnerships,
    now: new Date('2026-09-19T00:00:00Z'),
    ...overrides,
  });
};

const labels = (result: ReturnType<typeof collectSystemEvents>) =>
  result.events.map((entry) => entry.relationLabel);

describe('collectSystemEvents', () => {
  it('test_m7c1_returns_relation_class_and_label_per_event', () => {
    const result = collect();
    result.events.forEach((entry) => {
      expect(entry.relationLabel.length).toBeGreaterThan(0);
      expect(entry.ownerEntityId).toBeTruthy();
      expect(['person', 'partnership', 'emotional']).toContain(entry.ownerEntityType);
    });
    // The lane person's own events are not "system" events.
    expect(result.events.some((entry) => entry.relationClass === 'self')).toBe(false);
  });

  it('test_m7c2_ring_follows_active_canvas_scope', () => {
    const { people, partnerships } = buildSystem();
    const narrow = collectSystemEvents({
      personId: 'root',
      scope: computeFamilyScope(people, partnerships, 'root', { up: 0, down: 1 }),
      people,
      partnerships,
      now: new Date('2026-09-19T00:00:00Z'),
    });
    // No ancestors in a 0-up ring, so the father's death is not collected.
    expect(labels(narrow).some((label) => /Father died/.test(label))).toBe(false);
    expect(labels(narrow).some((label) => /Son born/.test(label))).toBe(true);

    const wide = collect();
    expect(labels(wide).some((label) => /Father died/.test(label))).toBe(true);
  });

  it('test_m7c2_ring_uses_defaults_when_no_focus_active', () => {
    // D10: with no canvas focus the ring falls back to the same defaults
    // (2 up / 2 down, collaterals on). Production callers pass null until the
    // user sets a focus, so if this path returned nothing the whole feature
    // would be inert and would report "0 system events" as though the family
    // had none.
    const { people, partnerships } = buildSystem();
    const explicit = collectSystemEvents({
      personId: 'root',
      scope: scopeFor(people, partnerships),
      people,
      partnerships,
      now: new Date('2026-09-19T00:00:00Z'),
    });
    const implicit = collectSystemEvents({
      personId: 'root',
      scope: null,
      people,
      partnerships,
      now: new Date('2026-09-19T00:00:00Z'),
    });

    expect(implicit.events.length).toBeGreaterThan(0);
    expect(labels(implicit)).toContain('Father died');
    expect(implicit.relativeCount).toBeGreaterThan(0);
    // The implicit default must match an explicitly-built default scope.
    expect(labels(implicit).sort()).toEqual(labels(explicit).sort());
  });

  it('test_m7c2_null_scope_still_respects_the_generation_band', () => {
    // The fallback is the DEFAULT scope, not "everyone".
    const { people, partnerships } = buildSystem();
    const outsider: Person = person('stranger', {
      name: 'Stranger',
      events: [event('stranger-evt', 'Death', '1990-01-01')],
    });
    const result = collectSystemEvents({
      personId: 'root',
      scope: null,
      people: [...people, outsider],
      partnerships,
      now: new Date('2026-09-19T00:00:00Z'),
    });
    expect(result.relativeIds).not.toContain('stranger');
  });

  it('test_m7c3_labels_father_death_and_parents_divorce', () => {
    const all = labels(collect());
    expect(all).toContain('Father died');
    expect(all).toContain('Parents divorced');
    expect(all).toContain('Son born');
    expect(all).toContain('Sister born');
  });

  it('test_m7c3_unknown_sex_falls_back_to_neutral_label', () => {
    const { people, partnerships } = buildSystem();
    const genderless = people.map((entry) =>
      entry.id === 'dad' ? { ...entry, birthSex: undefined, gender: undefined } : entry
    );
    const result = collectSystemEvents({
      personId: 'root',
      scope: scopeFor(genderless, partnerships),
      people: genderless,
      partnerships,
      now: new Date('2026-09-19T00:00:00Z'),
    });
    expect(labels(result)).toContain('Parent died');
  });

  it('test_m7c4_relative_symptom_event_reaches_lane', () => {
    const result = collect();
    const symptom = result.events.find((entry) => entry.event.id === 'sis-symptom');
    expect(symptom).toBeDefined();
    expect(symptom?.event.eventType).toBe('SYMPTOM');
    expect(symptom?.relationLabel).toContain('Sister');
  });

  it('test_m7c4_indicator_without_backing_event_reaches_lane', () => {
    const { people, partnerships } = buildSystem();
    const definitions: FunctionalIndicatorDefinition[] = [
      { id: 'fi-anx', label: 'Anxiety', group: 'emotional' },
    ];
    const withIndicator = people.map((entry) =>
      entry.id === 'mum'
        ? {
            ...entry,
            functionalIndicators: [
              { definitionId: 'fi-anx', status: 'current' as const, impact: 3, date: '1988-01-01' },
            ],
          }
        : entry
    );
    const result = collectSystemEvents({
      personId: 'root',
      scope: scopeFor(withIndicator, partnerships),
      people: withIndicator,
      partnerships,
      functionalIndicatorDefinitions: definitions,
      now: new Date('2026-09-19T00:00:00Z'),
    });
    expect(labels(result).some((label) => /Mother Anxiety/.test(label))).toBe(true);
  });

  it('test_m7c5_parental_family_events_collected', () => {
    const all = labels(collect());
    expect(all.some((label) => /Family: Relocation/.test(label))).toBe(true);
    expect(all.some((label) => /Triangle: Triangle/.test(label))).toBe(true);
  });

  it('test_m7c5_own_partnership_marriage_is_left_to_the_lane_itself', () => {
    // The lane person's own marriage is their own event, not a system event:
    // the Timeline lane and the Events tab both list it directly, so emitting
    // it here rendered it twice.
    const all = labels(collect());
    expect(all.some((label) => /Own family/.test(label))).toBe(false);
    // The parents' marriage, by contrast, IS a system event.
    expect(all).toContain('Parents married');
  });

  it('test_m7c6_partnership_clone_p1_p2_not_duplicated', () => {
    const { people, partnerships } = buildSystem();
    const shared = event('shared-evt', 'Conflict', '1996-01-01');
    const withClones = people.map((entry) => {
      if (entry.id === 'root') return { ...entry, events: [{ ...shared, id: 'shared-evt-p1' }] };
      if (entry.id === 'wife') return { ...entry, events: [{ ...shared, id: 'shared-evt-p2' }] };
      return entry;
    });
    const result = collectSystemEvents({
      personId: 'root',
      scope: scopeFor(withClones, partnerships),
      people: withClones,
      partnerships,
      now: new Date('2026-09-19T00:00:00Z'),
    });
    const conflicts = result.events.filter((entry) => entry.event.id.startsWith('shared-evt'));
    // Neither copy is a system event. A partnership event is cloned onto both
    // partners, so the wife's `-p2` copy is the SAME marriage the lane person
    // already holds as `-p1` — surfacing it here listed it twice, which is
    // what was reported on the timeline.
    expect(conflicts).toHaveLength(0);
  });

  it('test_m7c6_a_relatives_own_event_is_still_collected', () => {
    // The suppression above must not swallow events the lane person does not
    // hold a copy of.
    const { people, partnerships } = buildSystem();
    const withWifeEvent = people.map((entry) =>
      entry.id === 'wife'
        ? { ...entry, events: [event('wife-only', 'Illness', '1996-01-01')] }
        : entry
    );
    const result = collectSystemEvents({
      personId: 'root',
      scope: scopeFor(withWifeEvent, partnerships),
      people: withWifeEvent,
      partnerships,
      now: new Date('2026-09-19T00:00:00Z'),
    });
    expect(result.events.some((entry) => entry.event.id === 'wife-only')).toBe(true);
  });

  it('test_m7c6_same_event_from_two_relations_appears_once', () => {
    const result = collect();
    const keys = result.events.map(
      (entry) => `${entry.ownerEntityType}:${entry.ownerEntityId}:${entry.event.id}`
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('test_m7c4_emotional_pattern_between_relatives_is_collected', () => {
    const { people, partnerships } = buildSystem();
    const lines: EmotionalLine[] = [
      {
        id: 'epl-1',
        person1_id: 'dad',
        person2_id: 'sister',
        relationshipType: 'conflict',
        lineStyle: 'conflict-double',
        lineEnding: 'none',
        startDate: '1986-01-01',
        events: [event('epl-evt', 'Escalation', '1987-01-01', { eventType: 'EPE' })],
      },
    ];
    const result = collectSystemEvents({
      personId: 'root',
      scope: scopeFor(people, partnerships),
      people,
      partnerships,
      allEmotionalLines: lines,
      now: new Date('2026-09-19T00:00:00Z'),
    });
    expect(labels(result).some((label) => /Escalation/.test(label))).toBe(true);
  });

  it('test_m7c1_reports_how_many_relatives_contributed', () => {
    const result = collect();
    expect(result.relativeCount).toBeGreaterThan(0);
    expect(result.lifetimeFilterApplied).toBe(true);
  });
});

describe('lifetime clipping', () => {
  it('test_m7d1_grandparent_death_before_birth_excluded', () => {
    const all = labels(collect());
    // gf died in 1965, root was born in 1970.
    expect(all.some((label) => /Grandfather died/.test(label))).toBe(false);
  });

  it('test_m7d1_span_starting_before_birth_ending_after_is_kept', () => {
    const { people, partnerships } = buildSystem();
    const withSpan = people.map((entry) =>
      entry.id === 'mum'
        ? {
            ...entry,
            events: [
              event('mum-span', 'Illness', '1968-01-01', { endDate: '1975-01-01', status: 'end' }),
            ],
          }
        : entry
    );
    const result = collectSystemEvents({
      personId: 'root',
      scope: scopeFor(withSpan, partnerships),
      people: withSpan,
      partnerships,
      now: new Date('2026-09-19T00:00:00Z'),
    });
    expect(result.events.some((entry) => entry.event.id === 'mum-span')).toBe(true);
  });

  it('test_m7d1_event_after_death_excluded', () => {
    const { people, partnerships } = buildSystem();
    const deadRoot = people.map((entry) =>
      entry.id === 'root' ? { ...entry, deathDate: '1996-01-01' } : entry
    );
    const result = collectSystemEvents({
      personId: 'root',
      scope: scopeFor(deadRoot, partnerships),
      people: deadRoot,
      partnerships,
      now: new Date('2026-09-19T00:00:00Z'),
    });
    // The son was born in 2000, after this root died in 1996.
    expect(labels(result).some((label) => /Son born/.test(label))).toBe(false);
    // The father died in 1998, also after.
    expect(labels(result).some((label) => /Father died/.test(label))).toBe(false);
  });

  it('test_m7d2_parents_marriage_kept_although_before_birth', () => {
    // Parents married in 1962; root was born in 1970.
    const all = labels(collect());
    expect(all).toContain('Parents married');
  });

  it('test_m7d2_grandparents_marriage_is_not_exempt', () => {
    const { people, partnerships } = buildSystem();
    const withGrandMarriage = partnerships.map((entry) =>
      entry.id === 'prG' ? { ...entry, marriedStartDate: '1930-01-01' } : entry
    );
    const result = collectSystemEvents({
      personId: 'root',
      scope: scopeFor(people, withGrandMarriage),
      people,
      partnerships: withGrandMarriage,
      now: new Date('2026-09-19T00:00:00Z'),
    });
    // Only the PARENTAL union formation is exempt from the lifetime clip.
    expect(
      result.events.some((entry) => entry.event.id === 'synth-marriedStartDate-prG')
    ).toBe(false);
  });

  it('test_m7d3_no_birthdate_disables_lower_bound_and_flags_it', () => {
    const { people, partnerships } = buildSystem();
    const undated = people.map((entry) =>
      entry.id === 'root' ? { ...entry, birthDate: undefined } : entry
    );
    const result = collectSystemEvents({
      personId: 'root',
      scope: scopeFor(undated, partnerships),
      people: undated,
      partnerships,
      now: new Date('2026-09-19T00:00:00Z'),
    });
    expect(result.lifetimeFilterApplied).toBe(false);
    // With no lower bound the grandfather's 1965 death is back.
    expect(labels(result).some((label) => /Grandfather died/.test(label))).toBe(true);
  });

  it('test_m7g1_system_events_are_read_only_projection', () => {
    const { people, partnerships } = buildSystem();
    const peopleBefore = structuredClone(people);
    const partnershipsBefore = structuredClone(partnerships);
    collectSystemEvents({
      personId: 'root',
      scope: scopeFor(people, partnerships),
      people,
      partnerships,
      now: new Date('2026-09-19T00:00:00Z'),
    });
    expect(people).toEqual(peopleBefore);
    expect(partnerships).toEqual(partnershipsBefore);
  });
});


/**
 * Spec: docs/implementation_plan_2026-09-19.md#M7.C.6 (gate fixes)
 */
describe('collectSystemEvents — own partnerships and undated events', () => {
  it('test_m7c6_own_partnership_events_are_not_emitted_as_system_events', () => {
    // The lane person's own marriage is their own event. Both consumers list
    // it directly, so emitting it here rendered every marriage twice.
    const result = collect();
    const ownPartnershipItems = result.events.filter(
      (entry) => entry.ownerEntityType === 'partnership' && entry.ownerEntityId === 'prRoot'
    );
    expect(ownPartnershipItems).toHaveLength(0);
    // The PARENTS' partnership is still collected.
    expect(
      result.events.some(
        (entry) => entry.ownerEntityType === 'partnership' && entry.ownerEntityId === 'prP'
      )
    ).toBe(true);
  });

  it('test_m7c6_undated_events_are_counted_not_silently_dropped', () => {
    const { people, partnerships } = buildSystem();
    const withUndated = people.map((entry) =>
      entry.id === 'mum'
        ? {
            ...entry,
            events: [
              { ...event('mum-undated', 'Illness', ''), date: '', startDate: undefined },
            ],
          }
        : entry
    );
    const result = collectSystemEvents({
      personId: 'root',
      scope: scopeFor(withUndated, partnerships),
      people: withUndated,
      partnerships,
      now: new Date('2026-09-19T00:00:00Z'),
    });
    expect(result.undatedDropped).toBeGreaterThan(0);
    expect(result.events.some((entry) => entry.event.id === 'mum-undated')).toBe(false);
  });

  it('test_m7c6_an_undated_clone_twin_does_not_lock_out_its_dated_twin', () => {
    // The real hazard is a -p1/-p2 clone PAIR on the SAME owner: both collapse
    // to the same altKey, so an undated twin reserving the key first would
    // skip the dated one. Different owners never collide, so a cross-owner
    // fixture cannot fail on the pre-fix ordering and proves nothing.
    // The undated twin is listed FIRST so it is pushed first.
    const { people, partnerships } = buildSystem();
    const withTwins = people.map((entry) =>
      entry.id === 'mum'
        ? {
            ...entry,
            events: [
              { ...event('twin-p1', 'Conflict', ''), date: '', startDate: undefined },
              event('twin-p2', 'Conflict', '1990-01-01'),
            ],
          }
        : entry
    );
    const result = collectSystemEvents({
      personId: 'root',
      scope: scopeFor(withTwins, partnerships),
      people: withTwins,
      partnerships,
      now: new Date('2026-09-19T00:00:00Z'),
    });

    expect(result.events.some((entry) => entry.event.id === 'twin-p2')).toBe(true);
    expect(result.events.some((entry) => entry.event.id === 'twin-p1')).toBe(false);
    expect(result.undatedDropped).toBeGreaterThan(0);
  });

  it('test_m7c6_a_dated_event_on_another_owner_is_unaffected_by_an_undated_namesake', () => {
    // Different owners have distinct dedup keys — kept as its own case so the
    // twin test above stays the one that guards the ordering.
    const { people, partnerships } = buildSystem();
    const shared = event('shared', 'Conflict', '1990-01-01');
    const withBoth = people.map((entry) =>
      entry.id === 'mum'
        ? { ...entry, events: [{ ...shared }] }
        : entry.id === 'sister'
        ? { ...entry, events: [...(entry.events || []), { ...shared, date: '', startDate: undefined }] }
        : entry
    );
    const result = collectSystemEvents({
      personId: 'root',
      scope: scopeFor(withBoth, partnerships),
      people: withBoth,
      partnerships,
      now: new Date('2026-09-19T00:00:00Z'),
    });
    expect(result.events.some((entry) => entry.event.id === 'shared')).toBe(true);
  });
});

/**
 * Reported: Betty Baker was labelled "Daughter" on her father-in-law's lane.
 * She has no parentPartnership — she married into the family — but her son's
 * up-edge marked both his parents as lineal, which cleared her married-in
 * flag. Blood kinship needs the genealogical rule: from the root you may go
 * up and then down, but never up again.
 */
describe('in-law and step relations', () => {
  const inLawFamily = () => {
    // Everyone carries a birth date so every person owns at least one event
    // and therefore appears with a relation label.
    const people: Person[] = [
      // Bob dies inside Jim's lifetime, so Jim's lane has an event of his to
      // label — a birth in 1940 would be clipped out of a life begun in 1990.
      person('bob', {
        name: 'Bob',
        birthSex: 'male',
        partnerships: ['prBob'],
        birthDate: '1940-01-01',
        deathDate: '2010-05-05',
      }),
      person('mary', {
        name: 'Mary',
        birthSex: 'female',
        partnerships: ['prBob'],
        birthDate: '1942-01-01',
      }),
      person('peter', {
        name: 'Peter',
        birthSex: 'male',
        parentPartnership: 'prBob',
        partnerships: ['prPeter'],
        birthDate: '1965-01-01',
        events: [event('peter-evt', 'Job change', '2000-01-01')],
      }),
      person('sue', {
        name: 'Sue',
        birthSex: 'female',
        parentPartnership: 'prBob',
        birthDate: '1967-01-01',
      }),
      // Married in: no parentPartnership of her own.
      person('betty', {
        name: 'Betty',
        birthSex: 'female',
        partnerships: ['prPeter'],
        birthDate: '1966-01-01',
        events: [event('betty-evt', 'Illness', '1995-01-01')],
      }),
      person('jim', {
        name: 'Jim',
        birthSex: 'male',
        parentPartnership: 'prPeter',
        birthDate: '1990-01-01',
      }),
    ];
    const partnerships: Partnership[] = [
      partnership('prBob', 'bob', 'mary', ['peter', 'sue']),
      partnership('prPeter', 'peter', 'betty', ['jim']),
    ];
    return { people, partnerships };
  };

  const nounFor = (rootId: string, ownerId: string): string | undefined => {
    const { people, partnerships } = inLawFamily();
    const result = collectSystemEvents({
      personId: rootId,
      scope: computeFamilyScope(people, partnerships, rootId, defaultFocusForRoot(rootId)),
      people,
      partnerships,
      now: new Date('2026-09-21T00:00:00Z'),
    });
    return result.events.find((entry) => entry.ownerEntityId === ownerId)?.relationNoun;
  };

  it('test_inlaw_a_sons_wife_is_a_daughter_in_law_not_a_daughter', () => {
    expect(nounFor('bob', 'betty')).toBe('Daughter-in-law');
    // The blood daughter is still a daughter.
    expect(nounFor('bob', 'sue')).toBe('Daughter');
  });

  it('test_inlaw_she_is_still_a_mother_to_her_own_child', () => {
    // The same person, a different lane: Jim's mother by birth.
    expect(nounFor('jim', 'betty')).toBe('Mother');
  });

  it('test_inlaw_she_is_a_sister_in_law_to_her_husbands_siblings', () => {
    expect(nounFor('betty', 'sue')).toBe('Sister-in-law');
    expect(nounFor('betty', 'peter')).toBe('Husband');
  });

  it('test_inlaw_blood_relatives_keep_their_own_nouns', () => {
    expect(nounFor('bob', 'peter')).toBe('Son');
    expect(nounFor('bob', 'jim')).toBe('Grandson');
    expect(nounFor('jim', 'bob')).toBe('Grandfather');
  });

  it('test_inlaw_a_step_parent_is_not_a_parent_in_law', () => {
    // A parent's other partner is a step-parent. This used to guard its real
    // assertion behind `if (carol)`, and Carol's only event (her 1945 birth)
    // was clipped out of Peter's lifetime — so the assertion never ran and
    // only a trivially-true `not.toBe('Mother')` did. She now carries an
    // event inside his lifetime and the assertion is unconditional.
    const { people, partnerships } = inLawFamily();
    const withStep: Person[] = [
      ...people.map((entry) =>
        entry.id === 'bob' ? { ...entry, partnerships: ['prBob', 'prStep'] } : entry
      ),
      person('carol', {
        name: 'Carol',
        birthSex: 'female',
        partnerships: ['prStep'],
        birthDate: '1945-01-01',
        events: [event('carol-late', 'Illness', '2005-01-01')],
      }),
    ];
    const withStepPartnerships = [...partnerships, partnership('prStep', 'bob', 'carol', [])];
    const result = collectSystemEvents({
      personId: 'peter',
      scope: computeFamilyScope(withStep, withStepPartnerships, 'peter', defaultFocusForRoot('peter')),
      people: withStep,
      partnerships: withStepPartnerships,
      now: new Date('2026-09-21T00:00:00Z'),
    });
    const carol = result.events.find((entry) => entry.ownerEntityId === 'carol');
    expect(carol).toBeDefined();
    expect(carol!.relationNoun).toBe('Step-mother');
  });
});
