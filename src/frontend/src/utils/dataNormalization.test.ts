import { describe, it, expect } from 'vitest';
import { resolveImportedGender, inferGenderFromName } from './dataNormalization';

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
