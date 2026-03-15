import { describe, expect, it } from 'vitest';
import type { Partnership, Person } from '../types';
import {
  deriveSiblingPositionResult,
  getSiblingPositionLabel,
  getSiblingPositionOptions,
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
