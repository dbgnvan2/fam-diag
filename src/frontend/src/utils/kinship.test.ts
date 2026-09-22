/**
 * Gate pass 13 found that a single married-in flag cannot name kinship: the
 * term depends on where on the path the marriage is crossed. A father-in-law
 * read "Step-father" and a step-son read "Son-in-law".
 */
import { describe, it, expect } from 'vitest';
import { collectSystemEvents } from './systemEvents';
import { computeFamilyScope, defaultFocusForRoot } from './familyScope';
import { computeKinRoutes } from './kinship';
import type { Partnership, Person } from '../types';

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
 * Peter is the lane person throughout.
 *
 *   grandpaB+grandmaB ─┐                         carol  (Bob's second wife)
 *                      │                           │
 *               bob + mary ─────────── bob ────────┘
 *                  │
 *   ┌──────────────┼──────────┐
 *  sue + sueHusband  peter + betty           betty's parents: bettyDad+bettyMum
 *                       │     │                         │
 *                      jim  tom (betty's son,        bettySis
 *                            by an earlier marriage)
 */
const buildFamily = () => {
  const born = (year: number) => ({ birthDate: `${year}-01-01` });
  const people: Person[] = [
    person('bob', { birthSex: 'male', partnerships: ['prBob', 'prBobCarol'], ...born(1940) }),
    person('mary', { birthSex: 'female', partnerships: ['prBob'], ...born(1942) }),
    person('carol', { birthSex: 'female', partnerships: ['prBobCarol'], ...born(1950) }),
    person('peter', {
      birthSex: 'male',
      parentPartnership: 'prBob',
      partnerships: ['prPeter'],
      ...born(1965),
    }),
    person('sue', {
      birthSex: 'female',
      parentPartnership: 'prBob',
      partnerships: ['prSue'],
      ...born(1967),
    }),
    person('sueHusband', { birthSex: 'male', partnerships: ['prSue'], ...born(1966) }),
    person('betty', {
      birthSex: 'female',
      parentPartnership: 'prBettyParents',
      partnerships: ['prPeter', 'prBettyFirst'],
      ...born(1966),
    }),
    person('bettyDad', { birthSex: 'male', partnerships: ['prBettyParents'], ...born(1938) }),
    person('bettyMum', { birthSex: 'female', partnerships: ['prBettyParents'], ...born(1940) }),
    person('bettySis', { birthSex: 'female', parentPartnership: 'prBettyParents', ...born(1968) }),
    person('bettyFirst', { birthSex: 'male', partnerships: ['prBettyFirst'], ...born(1960) }),
    person('tom', { birthSex: 'male', parentPartnership: 'prBettyFirst', ...born(1988) }),
    person('jim', { birthSex: 'male', parentPartnership: 'prPeter', ...born(1992) }),
  ];
  const partnerships: Partnership[] = [
    partnership('prBob', 'bob', 'mary', ['peter', 'sue']),
    partnership('prBobCarol', 'bob', 'carol', []),
    partnership('prSue', 'sue', 'sueHusband', []),
    partnership('prPeter', 'peter', 'betty', ['jim']),
    partnership('prBettyParents', 'bettyDad', 'bettyMum', ['betty', 'bettySis']),
    partnership('prBettyFirst', 'bettyFirst', 'betty', ['tom']),
  ];
  return { people, partnerships };
};

/** The noun the lane `laneId` gives `ownerId`, via the production collector. */
const nounFor = (laneId: string, ownerId: string): string | undefined => {
  const { people, partnerships } = buildFamily();
  // Give the owner an event late enough to fall inside any lane's lifetime.
  const withEvent = people.map((entry) =>
    entry.id === ownerId
      ? {
          ...entry,
          events: [
            {
              id: `${ownerId}-late`,
              date: '2020-01-01',
              startDate: '2020-01-01',
              category: 'Checkup',
              eventType: 'NODAL' as const,
              status: 'discrete' as const,
              intensity: 0,
              howWell: 0,
              otherPersonName: '',
              wwwwh: '',
              observations: '',
              eventClass: 'individual' as const,
            },
          ],
        }
      : entry
  );
  const scope = computeFamilyScope(withEvent, partnerships, laneId, {
    ...defaultFocusForRoot(laneId),
    includePartnerFOO: true,
  });
  const result = collectSystemEvents({
    personId: laneId,
    scope,
    people: withEvent,
    partnerships,
    now: new Date('2026-09-22T00:00:00Z'),
  });
  return result.events.find((entry) => entry.ownerEntityId === ownerId)?.relationNoun;
};

describe('kinship — a spouse\'s relatives', () => {
  it('test_kin_father_in_law_is_not_a_step_father', () => {
    // Reached by crossing Peter's own marriage and going UP.
    expect(nounFor('peter', 'bettyDad')).toBe('Father-in-law');
    expect(nounFor('peter', 'bettyMum')).toBe('Mother-in-law');
  });

  it('test_kin_step_son_is_not_a_son_in_law', () => {
    // Betty's son by an earlier marriage: crossed Peter's marriage, then DOWN.
    expect(nounFor('peter', 'tom')).toBe('Step-son');
  });

  it('test_kin_a_spouses_sibling_is_a_sister_in_law', () => {
    // Crossed the marriage, up to Betty's parents, down to her sister.
    expect(nounFor('peter', 'bettySis')).toBe('Sister-in-law');
  });
});

describe('kinship — a relative\'s spouse', () => {
  it('test_kin_a_sons_wife_is_a_daughter_in_law', () => {
    // The reported case: reach a blood son, then cross his marriage.
    expect(nounFor('bob', 'betty')).toBe('Daughter-in-law');
  });

  it('test_kin_a_siblings_husband_is_a_brother_in_law', () => {
    expect(nounFor('peter', 'sueHusband')).toBe('Brother-in-law');
  });

  it('test_kin_a_parents_other_partner_is_a_step_mother', () => {
    // Carol is Bob's second wife, not Peter's mother. Her event is dated
    // inside Peter's lifetime, so this assertion always runs.
    expect(nounFor('peter', 'carol')).toBe('Step-mother');
  });
});

describe('kinship — blood always wins', () => {
  it('test_kin_blood_relatives_keep_their_own_nouns', () => {
    expect(nounFor('peter', 'bob')).toBe('Father');
    expect(nounFor('peter', 'sue')).toBe('Sister');
    expect(nounFor('peter', 'jim')).toBe('Son');
    // Betty is Jim's mother by birth, whatever she is to Bob.
    expect(nounFor('jim', 'betty')).toBe('Mother');
  });

  it('test_kin_a_spouse_who_is_also_a_blood_relative_is_named_by_blood', () => {
    // Cousins who marry: the route through the marriage is shorter in hops
    // than the blood route, but blood must still win.
    const people: Person[] = [
      person('gp', { partnerships: ['prGp'] }),
      person('gm', { partnerships: ['prGp'] }),
      person('uncleA', { parentPartnership: 'prGp', partnerships: ['prA'] }),
      person('auntA', { partnerships: ['prA'] }),
      person('uncleB', { parentPartnership: 'prGp', partnerships: ['prB'] }),
      person('auntB', { partnerships: ['prB'] }),
      person('cousinX', { birthSex: 'male', parentPartnership: 'prA', partnerships: ['prXY'] }),
      person('cousinY', { birthSex: 'female', parentPartnership: 'prB', partnerships: ['prXY'] }),
    ];
    const partnerships: Partnership[] = [
      partnership('prGp', 'gp', 'gm', ['uncleA', 'uncleB']),
      partnership('prA', 'uncleA', 'auntA', ['cousinX']),
      partnership('prB', 'uncleB', 'auntB', ['cousinY']),
      partnership('prXY', 'cousinX', 'cousinY', []),
    ];
    const scope = computeFamilyScope(people, partnerships, 'cousinX', {
      ...defaultFocusForRoot('cousinX'),
    });
    const blood = new Set([...scope.personIds].filter((id) => !scope.marriedIn.has(id)));
    const routes = computeKinRoutes(people, partnerships, 'cousinX', blood);
    expect(routes.get('cousinY')).toBe('blood');
  });
});

describe('kinship — collateral blood relatives', () => {
  /**
   * Found while verifying the in-law fix against the reported diagram: Jim's
   * uncle Paul read "Father" and his aunt Mary "Mother". Blood nouns were keyed
   * on generation alone, and an uncle is one generation up just like a father.
   * The path shape separates them — up to the shared ancestor, then down.
   */
  it('test_kin_an_uncle_is_not_a_father', () => {
    // Jim → up to Peter → up to Bob → down to Sue: two up, one down.
    expect(nounFor('jim', 'sue')).toBe('Aunt');
    expect(nounFor('jim', 'peter')).toBe('Father');
  });

  it('test_kin_a_nephew_is_not_a_son', () => {
    // Sue → up to Bob → down to Peter → down to Jim: one up, two down.
    expect(nounFor('sue', 'jim')).toBe('Nephew');
  });

  it('test_kin_a_cousin_is_not_a_sibling', () => {
    const people: Person[] = [
      person('gp', { partnerships: ['prGp'], birthDate: '1920-01-01' }),
      person('gm', { partnerships: ['prGp'], birthDate: '1922-01-01' }),
      person('dadA', { parentPartnership: 'prGp', partnerships: ['prA'], birthDate: '1950-01-01' }),
      person('momA', { partnerships: ['prA'], birthDate: '1951-01-01' }),
      person('dadB', { parentPartnership: 'prGp', partnerships: ['prB'], birthDate: '1952-01-01' }),
      person('momB', { partnerships: ['prB'], birthDate: '1953-01-01' }),
      person('me', { birthSex: 'male', parentPartnership: 'prA', birthDate: '1980-01-01' }),
      person('cousin', {
        birthSex: 'female',
        parentPartnership: 'prB',
        birthDate: '1982-01-01',
        events: [
          {
            id: 'cousin-late',
            date: '2020-01-01',
            startDate: '2020-01-01',
            category: 'Checkup',
            eventType: 'NODAL',
            status: 'discrete',
            intensity: 0,
            howWell: 0,
            otherPersonName: '',
            wwwwh: '',
            observations: '',
            eventClass: 'individual',
          },
        ],
      }),
    ];
    const partnerships: Partnership[] = [
      partnership('prGp', 'gp', 'gm', ['dadA', 'dadB']),
      partnership('prA', 'dadA', 'momA', ['me']),
      partnership('prB', 'dadB', 'momB', ['cousin']),
    ];
    const result = collectSystemEvents({
      personId: 'me',
      scope: computeFamilyScope(people, partnerships, 'me', defaultFocusForRoot('me')),
      people,
      partnerships,
      now: new Date('2026-09-22T00:00:00Z'),
    });
    // Both level with "me" — but two up and two down is a cousin, not a sister.
    expect(result.events.find((entry) => entry.ownerEntityId === 'cousin')?.relationNoun).toBe(
      'Cousin'
    );
  });
});
