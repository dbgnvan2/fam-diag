import { describe, it, expect } from 'vitest';
import { coupleDisplayName, joinCoupleNames, personDisplayName } from './personNames';
import type { Person } from '../types';

// Review struct-11: one rule for a person's and a couple's display name.
describe('personDisplayName (struct-11)', () => {
  it('prefers first + last, then name, then the fallback', () => {
    expect(personDisplayName({ name: 'Old', firstName: ' Ann ', lastName: 'Lee' })).toBe('Ann Lee');
    expect(personDisplayName({ name: 'Old', firstName: '', lastName: '' })).toBe('Old');
    expect(personDisplayName({ name: '  ' }, 'Unnamed')).toBe('Unnamed');
    expect(personDisplayName(undefined, 'Partner 1')).toBe('Partner 1');
  });
});

describe('coupleDisplayName (struct-11)', () => {
  const people: Person[] = [
    { id: 'a', name: 'A', firstName: 'Ann', lastName: 'Lee', x: 0, y: 0, partnerships: [] },
    { id: 'b', name: 'Bob', x: 0, y: 0, partnerships: [] },
  ];
  it('joins the two names with " + "', () => {
    expect(coupleDisplayName({ partner1_id: 'a', partner2_id: 'b' }, people)).toBe('Ann Lee + Bob');
  });
  it('names a missing partner by position', () => {
    expect(coupleDisplayName({ partner1_id: 'a', partner2_id: 'zz' }, people)).toBe('Ann Lee + Partner 2');
  });
});

describe('joinCoupleNames (review 2026-09-30 struct-11)', () => {
  it('one format everywhere: "A + B", one name alone, or the fallback', () => {
    expect(joinCoupleNames('Ann', 'Bob')).toBe('Ann + Bob');
    expect(joinCoupleNames('Ann', undefined)).toBe('Ann');
    expect(joinCoupleNames(' ', '', 'Family')).toBe('Family');
  });
});
