import { describe, expect, it } from 'vitest';
import type { Partnership, Person } from '../types';
import {
  deriveSiblingPositionResult,
  effectiveSiblingPositions,
  getSiblingPositionLabel,
  getSiblingPositionOptions,
  parentMatchForRole,
  siblingConflictInputKey,
  siblingPositionInputKey,
  siblingPositionResults,
} from './siblingPosition';

const makePerson = (overrides: Partial<Person>): Person => ({
  id: overrides.id || 'p',
  x: 0,
  y: 0,
  name: overrides.name || 'Person',
  partnerships: overrides.partnerships || [],
  ...overrides,
});

const makePartnership = (overrides: Partial<Partnership>): Partnership => ({
  id: overrides.id || 'rel',
  partner1_id: overrides.partner1_id || 'p1',
  partner2_id: overrides.partner2_id || 'p2',
  horizontalConnectorY: 0,
  relationshipType: 'married',
  relationshipStatus: 'married',
  children: overrides.children || [],
  ...overrides,
});

describe('siblingPosition', () => {
  it('derives a confirmed oldest brother of sisters position', () => {
    const people = [
      makePerson({ id: 'dad', name: 'Dad', birthSex: 'male' }),
      makePerson({ id: 'mom', name: 'Mom', birthSex: 'female' }),
      makePerson({
        id: 'harry',
        name: 'Harry',
        birthSex: 'male',
        birthDate: '1980-01-01',
        parentPartnership: 'parents',
        siblingsComplete: true,
      }),
      makePerson({
        id: 'jane',
        name: 'Jane',
        birthSex: 'female',
        birthDate: '1982-01-01',
        parentPartnership: 'parents',
        siblingsComplete: true,
      }),
      makePerson({
        id: 'beth',
        name: 'Beth',
        birthSex: 'female',
        birthDate: '1984-01-01',
        parentPartnership: 'parents',
        siblingsComplete: true,
      }),
    ];
    const partnerships = [
      makePartnership({
        id: 'parents',
        partner1_id: 'dad',
        partner2_id: 'mom',
        children: ['harry', 'jane', 'beth'],
      }),
    ];

    const result = deriveSiblingPositionResult({
      person: people[2],
      people,
      partnerships,
    });

    expect(result.derived_position).toBe('ob/s');
    expect(getSiblingPositionLabel(result.derived_position)).toBe('Oldest brother of sisters');
    expect(result.effective_position).toBe('ob/s');
    expect(result.confidence).toBe('CONFIRMED');
    expect(result.rank).toBe('oldest');
    expect(result.composition).toBe('s');
  });

  it('uses a manual override when one is set', () => {
    const people = [
      makePerson({ id: 'dad', name: 'Dad', birthSex: 'male' }),
      makePerson({ id: 'mom', name: 'Mom', birthSex: 'female' }),
      makePerson({
        id: 'alex',
        name: 'Alex',
        birthSex: 'female',
        parentPartnership: 'parents',
        siblingPositionOverride: 'ys/b',
      }),
    ];
    const partnerships = [
      makePartnership({
        id: 'parents',
        partner1_id: 'dad',
        partner2_id: 'mom',
        children: ['alex'],
      }),
    ];

    const result = deriveSiblingPositionResult({
      person: people[2],
      people,
      partnerships,
    });

    expect(result.manual_position).toBe('ys/b');
    expect(result.effective_position).toBe('ys/b');
    expect(result.confidence).toBe('MANUAL');
  });

  it('computes rank and sex conflict with a partner', () => {
    const people = [
      makePerson({ id: 'mDad', name: 'MDad', birthSex: 'male' }),
      makePerson({ id: 'mMom', name: 'MMom', birthSex: 'female' }),
      makePerson({ id: 'fDad', name: 'FDad', birthSex: 'male' }),
      makePerson({ id: 'fMom', name: 'FMom', birthSex: 'female' }),
      makePerson({
        id: 'mark',
        name: 'Mark',
        birthSex: 'male',
        birthDate: '1980-01-01',
        parentPartnership: 'mParents',
        siblingsComplete: true,
        partnerships: ['couple'],
      }),
      makePerson({
        id: 'mBrother',
        name: 'Mike',
        birthSex: 'male',
        birthDate: '1982-01-01',
        parentPartnership: 'mParents',
        siblingsComplete: true,
      }),
      makePerson({
        id: 'sue',
        name: 'Sue',
        birthSex: 'female',
        birthDate: '1981-01-01',
        parentPartnership: 'fParents',
        siblingsComplete: true,
        partnerships: ['couple'],
      }),
      makePerson({
        id: 'fSister',
        name: 'Sara',
        birthSex: 'female',
        birthDate: '1983-01-01',
        parentPartnership: 'fParents',
        siblingsComplete: true,
      }),
    ];
    const partnerships = [
      makePartnership({
        id: 'mParents',
        partner1_id: 'mDad',
        partner2_id: 'mMom',
        children: ['mark', 'mBrother'],
      }),
      makePartnership({
        id: 'fParents',
        partner1_id: 'fDad',
        partner2_id: 'fMom',
        children: ['sue', 'fSister'],
      }),
      makePartnership({
        id: 'couple',
        partner1_id: 'mark',
        partner2_id: 'sue',
        relationshipStatus: 'married',
        children: [],
      }),
    ];

    const result = deriveSiblingPositionResult({
      person: people[4],
      people,
      partnerships,
    });

    expect(result.effective_position).toBe('ob/b');
    expect(result.conflict_with_partner?.other_effective_position).toBe('os/s');
    expect(result.conflict_with_partner?.rank_conflict).toBe(true);
    expect(result.conflict_with_partner?.sex_conflict).toBe(true);
    expect(result.conflict_with_partner?.category).toBe('Rank and Sex Conflict');
  });

  it('filters override options to positions consistent with known sibling sexes', () => {
    const people = [
      makePerson({ id: 'dad', name: 'Dad', birthSex: 'male' }),
      makePerson({ id: 'mom', name: 'Mom', birthSex: 'female' }),
      makePerson({
        id: 'pat',
        name: 'Pat',
        birthSex: 'male',
        parentPartnership: 'parents',
      }),
      makePerson({
        id: 'sis',
        name: 'Sis',
        birthSex: 'female',
        parentPartnership: 'parents',
      }),
    ];
    const partnerships = [
      makePartnership({
        id: 'parents',
        partner1_id: 'dad',
        partner2_id: 'mom',
        children: ['pat', 'sis'],
      }),
    ];

    const options = getSiblingPositionOptions({ person: people[2], people, partnerships });

    expect(options.some((option) => option.value === 'ob/s')).toBe(true);
    expect(options.some((option) => option.value === 'ob/b')).toBe(false);
  });
});

describe('siblingPosition — review fixes 2026-09-30', () => {
  const mk = (id: string, overrides: Partial<Person> = {}): Person =>
    ({ id, name: id, x: 0, y: 0, partnerships: [], ...overrides }) as Person;
  const pr = (id: string, a: string, b: string, children: string[]): Partnership =>
    ({ id, partner1_id: a, partner2_id: b, horizontalConnectorY: 0, relationshipType: 'married', relationshipStatus: 'married', children }) as Partnership;

  it('uses the adoptive family when a person has both (author decision 6)', () => {
    const people = [
      mk('kid', { birthSex: 'male', birthDate: '2000-01-01', parentPartnership: 'adopt', birthParentPartnership: 'birth' }),
      mk('adoptSis', { birthSex: 'female', birthDate: '1998-01-01', parentPartnership: 'adopt' }),
      mk('birthBro', { birthSex: 'male', birthDate: '1995-01-01', parentPartnership: 'birth' }),
      mk('aD', { birthSex: 'male', partnerships: ['adopt'] }),
      mk('aM', { birthSex: 'female', partnerships: ['adopt'] }),
      mk('bD', { birthSex: 'male', partnerships: ['birth'] }),
      mk('bM', { birthSex: 'female', partnerships: ['birth'] }),
    ];
    const partnerships = [pr('adopt', 'aD', 'aM', ['kid', 'adoptSis']), pr('birth', 'bD', 'bM', ['kid', 'birthBro'])];
    const result = deriveSiblingPositionResult({ person: people[0], people, partnerships });
    expect(result.effective_position).toBe('yb/s');
  });

  it('never names a male parent "Mother" or one parent as both (regression: position fallback)', () => {
    const people = [
      mk('kid', { birthSex: 'male', parentPartnership: 'pr' }),
      mk('dad', { birthSex: 'male', x: 200, partnerships: ['pr'] }),
      mk('other', { x: 100, partnerships: ['pr'] }),
    ];
    const partnerships = [pr('pr', 'dad', 'other', ['kid'])];
    expect(parentMatchForRole(people[0], people, partnerships, 'father')?.id).toBe('dad');
    expect(parentMatchForRole(people[0], people, partnerships, 'mother')?.id).toBe('other');
    const twoFathers = [people[0], people[1], mk('dad2', { birthSex: 'male', partnerships: ['pr'] })];
    const prs = [pr('pr', 'dad', 'dad2', ['kid'])];
    expect(parentMatchForRole(twoFathers[0], twoFathers, prs, 'mother')).toBeNull();
  });

  it('still falls back to position when neither parent has a known sex', () => {
    const people = [
      mk('kid', { birthSex: 'male', parentPartnership: 'pr' }),
      mk('left', { x: -100, partnerships: ['pr'] }),
      mk('right', { x: 100, partnerships: ['pr'] }),
    ];
    const partnerships = [pr('pr', 'right', 'left', ['kid'])];
    expect(parentMatchForRole(people[0], people, partnerships, 'father')?.id).toBe('left');
    expect(parentMatchForRole(people[0], people, partnerships, 'mother')?.id).toBe('right');
  });

  it('a partner entered by override takes the sex its code gives (regression: always male)', () => {
    const people = [
      mk('me', { birthSex: 'male', siblingPositionOverride: 'ob/b', partnerPositionOverride: 'os/b' }),
    ];
    const result = deriveSiblingPositionResult({ person: people[0], people, partnerships: [] });
    expect(result.conflict_with_partner?.category).not.toContain('same-sex');
  });

  it('twins born the same day are indeterminate, not ranked by array order', () => {
    const people = [
      mk('a', { birthSex: 'male', birthDate: '2000-01-01', parentPartnership: 'pr' }),
      mk('b', { birthSex: 'male', birthDate: '2000-01-01', parentPartnership: 'pr' }),
      mk('d', { birthSex: 'male', partnerships: ['pr'] }),
      mk('m', { birthSex: 'female', partnerships: ['pr'] }),
    ];
    const partnerships = [pr('pr', 'd', 'm', ['a', 'b'])];
    expect(deriveSiblingPositionResult({ person: people[0], people, partnerships }).confidence).toBe('INDETERMINATE');
  });

  it('a birth-order override takes its slot; dated siblings fill the rest in date order', () => {
    const people = [
      mk('first', { birthSex: 'female', birthOrderOverride: 1, parentPartnership: 'pr' }),
      mk('older', { birthSex: 'male', birthDate: '1990-01-01', parentPartnership: 'pr' }),
      mk('younger', { birthSex: 'male', birthDate: '1995-01-01', parentPartnership: 'pr' }),
      mk('d', { birthSex: 'male', partnerships: ['pr'] }),
      mk('m', { birthSex: 'female', partnerships: ['pr'] }),
    ];
    const partnerships = [pr('pr', 'd', 'm', ['first', 'older', 'younger'])];
    const at = (id: string) =>
      deriveSiblingPositionResult({ person: people.find((p) => p.id === id)!, people, partnerships }).rank;
    expect(at('first')).toBe('oldest');
    expect(at('older')).toBe('middle');
    expect(at('younger')).toBe('youngest');
  });

  it('effectiveSiblingPositions matches the full derivation, and its input key ignores coordinates', () => {
    const people = [
      mk('a', { birthSex: 'male', birthDate: '1990-01-01', parentPartnership: 'pr' }),
      mk('b', { birthSex: 'female', birthDate: '1992-01-01', parentPartnership: 'pr' }),
      mk('d', { birthSex: 'male', partnerships: ['pr'] }),
      mk('m', { birthSex: 'female', partnerships: ['pr'] }),
    ];
    const partnerships = [pr('pr', 'd', 'm', ['a', 'b'])];
    const map = effectiveSiblingPositions(people, partnerships);
    expect(map.get('a')).toBe(deriveSiblingPositionResult({ person: people[0], people, partnerships }).effective_position);
    const moved = people.map((p) => ({ ...p, x: p.x + 50 }));
    expect(siblingPositionInputKey(moved, partnerships)).toBe(siblingPositionInputKey(people, partnerships));
    const redated = people.map((p) => (p.id === 'a' ? { ...p, birthDate: '1999-01-01' } : p));
    expect(siblingPositionInputKey(redated, partnerships)).not.toBe(siblingPositionInputKey(people, partnerships));
  });
});

describe('siblingConflictInputKey', () => {
  const mk = (id: string, overrides: Partial<Person> = {}): Person =>
    ({ id, name: id, x: 0, y: 0, partnerships: [], ...overrides }) as Person;

  it('changes when a parent of unknown sex moves (the position fallback reads it), not when anyone else does', () => {
    const people = [mk('known', { birthSex: 'male', x: 0 }), mk('unknown', { x: 0 })];
    const base = siblingConflictInputKey(people, []);
    expect(siblingConflictInputKey([{ ...people[0], x: 99 }, people[1]], [])).toBe(base);
    expect(siblingConflictInputKey([people[0], { ...people[1], x: 99 }], [])).not.toBe(base);
  });

  it('siblingPositionResults gives the same result as deriving each person', () => {
    const people = [mk('a', { birthSex: 'male' })];
    expect(siblingPositionResults(people, []).get('a')).toEqual(
      deriveSiblingPositionResult({ person: people[0], people, partnerships: [] })
    );
  });
});
