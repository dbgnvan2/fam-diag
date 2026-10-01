import { describe, it, expect } from 'vitest';
import type { Partnership, Person } from '../types';
import {
  resolveImportedGender,
  inferGenderFromName,
  normalizeImportedChildLayout,
} from './dataNormalization';

describe('resolveImportedGender', () => {
  it('uses the explicit value from the import source', () => {
    expect(resolveImportedGender('male', 'Quinlan')).toBe('male');
    // Explicit value wins over name evidence.
    expect(resolveImportedGender('female', 'Don')).toBe('female');
  });

  it('falls back to name-override evidence', () => {
    expect(resolveImportedGender(undefined, 'Don Ray')).toBe('male');
    expect(resolveImportedGender(undefined, 'Mary')).toBe('female');
  });

  it('returns undefined when there is no evidence (regression: used to default to female)', () => {
    // Session-capture, transcript and facts imports all used `|| 'female'`.
    expect(resolveImportedGender(undefined, 'Quinlan')).toBeUndefined();
    expect(resolveImportedGender('', 'Quinlan')).toBeUndefined();
    expect(resolveImportedGender(undefined, '')).toBeUndefined();
  });

  it('agrees with inferGenderFromName when nothing explicit is given', () => {
    for (const name of ['John', 'Margaret', 'Tavi', 'donald smith']) {
      expect(resolveImportedGender(undefined, name)).toBe(inferGenderFromName(name));
    }
  });
});

describe('normalizeImportedChildLayout', () => {
  const deepFreeze = <T,>(value: T): T => {
    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  };

  // A child-bearing couple whose child has a spouse (so connector Y is
  // rewritten twice) and a partnership note with no position (so one is placed).
  const fixture = () => {
    const people: Person[] = [
      { id: 'gp1', name: 'GP One', x: 100, y: 100, gender: 'male', partnerships: ['top'] },
      { id: 'gp2', name: 'GP Two', x: 300, y: 120, gender: 'female', partnerships: ['top'] },
      { id: 'kid', name: 'Kid', x: 200, y: 300, gender: 'male', partnerships: ['low'], parentPartnership: 'top' },
      { id: 'sp', name: 'Spouse', x: 500, y: 320, gender: 'female', partnerships: ['low'] },
      { id: 'gk', name: 'Grandkid', x: 300, y: 500, gender: 'female', partnerships: [], parentPartnership: 'low' },
    ];
    const partnerships: Partnership[] = [
      { id: 'top', partner1_id: 'gp1', partner2_id: 'gp2', horizontalConnectorY: 150, relationshipType: 'married', relationshipStatus: 'married', children: ['kid'], notes: 'note' },
      { id: 'low', partner1_id: 'kid', partner2_id: 'sp', horizontalConnectorY: 350, relationshipType: 'married', relationshipStatus: 'married', children: ['gk'] },
    ];
    return { people, partnerships };
  };

  it('does not modify its inputs (regression: wrote into the caller\'s partnerships)', () => {
    const { people, partnerships } = fixture();
    deepFreeze(people);
    deepFreeze(partnerships);
    expect(() =>
      normalizeImportedChildLayout(people, partnerships, { expandParentSpan: true, autoResizeDenseFamilies: true })
    ).not.toThrow();
  });

  it('returns the partnership changes it used to write in place', () => {
    const { people, partnerships } = fixture();
    const result = normalizeImportedChildLayout(people, partnerships, {
      expandParentSpan: true,
      autoResizeDenseFamilies: true,
    });
    const top = result.partnerships.find((p) => p.id === 'top')!;
    const low = result.partnerships.find((p) => p.id === 'low')!;
    // Note placed for the partnership that had notes and no position.
    expect(top.notesPosition).toBeDefined();
    // The married child's couple connector follows the aligned partners.
    const kid = result.people.find((p) => p.id === 'kid')!;
    const sp = result.people.find((p) => p.id === 'sp')!;
    expect(low.horizontalConnectorY).toBe(Math.max(kid.y, sp.y) + 60);
    // Inputs untouched.
    expect(partnerships.find((p) => p.id === 'top')!.notesPosition).toBeUndefined();
  });

  it('returns the same arrays when there is nothing to lay out', () => {
    const people: Person[] = [{ id: 'a', name: 'A', x: 0, y: 0, partnerships: [] }];
    const result = normalizeImportedChildLayout(people, []);
    expect(result.people).toBe(people);
    expect(result.partnerships).toEqual([]);
  });
});

describe('resolveImportedGender — explicit unknown', () => {
  it('treats an explicit "unknown" as unknown, not as a stored gender or a name guess', () => {
    expect(resolveImportedGender('unknown', 'Mary')).toBeUndefined();
    expect(resolveImportedGender('Unknown', 'Quinlan')).toBeUndefined();
  });
});

describe('normalizeImportedChildLayout — reads every sex field (review 2026-09-30 struct-07)', () => {
  it('a couple whose sex is only in birthSex still gets male left, female right', () => {
    const people = [
      { id: 'w', name: 'W', x: 0, y: 0, partnerships: ['pr'], birthSex: 'female' as const },
      { id: 'h', name: 'H', x: 200, y: 0, partnerships: ['pr'], birthSex: 'male' as const },
    ];
    const partnerships = [
      { id: 'pr', partner1_id: 'w', partner2_id: 'h', horizontalConnectorY: 60, relationshipType: 'married', relationshipStatus: 'married', children: [] },
    ];
    const result = normalizeImportedChildLayout(people, partnerships);
    const x = (id: string) => result.people.find((p) => p.id === id)!.x;
    expect(x('h')).toBeLessThan(x('w'));
  });
});

describe('GENDER_SYMBOL_OPTIONS agree with the shared sex rule (gate 2026-10-01 #2)', () => {
  it('every option\'s birth sex and identity give back its own symbol', async () => {
    const { GENDER_SYMBOL_OPTIONS } = await import('./dataNormalization');
    const { deriveGenderSymbol } = await import('./personSex');
    for (const option of GENDER_SYMBOL_OPTIONS) {
      expect({ label: option.label, symbol: deriveGenderSymbol({ birthSex: option.birthSex, genderIdentity: option.genderIdentity }) })
        .toEqual({ label: option.label, symbol: option.symbol });
    }
  });
});
