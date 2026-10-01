import { describe, it, expect } from 'vitest';
import { deriveBirthSex, deriveGenderIdentity, isSexUnknown, normalizeGender, resolveBinarySex, toggledBinarySex } from './personSex';

describe('isSexUnknown', () => {
  it('is true when nothing is recorded, or gender is "unknown"', () => {
    expect(isSexUnknown({})).toBe(true);
    expect(isSexUnknown({ gender: '' })).toBe(true);
    expect(isSexUnknown({ gender: 'Unknown' })).toBe(true);
  });

  it('is false when any sex or gender field is set', () => {
    expect(isSexUnknown({ gender: 'female' })).toBe(false);
    expect(isSexUnknown({ birthSex: 'intersex' })).toBe(false);
    expect(isSexUnknown({ genderIdentity: 'nonbinary' })).toBe(false);
    expect(isSexUnknown({ genderSymbol: 'ai_agent' })).toBe(false);
  });
});

// Review nodes-10 / struct-07: one resolver, case-insensitive, with the
// 'b' / 's' sibling codes, and unknown for anything it does not recognise.

describe('normalizeGender (nodes-10)', () => {
  it('maps male / m / b and female / f / s in any case', () => {
    ['male', 'Male', 'MALE', 'm', 'M', 'b', 'B', ' male '].forEach((g) => expect(normalizeGender(g)).toBe('male'));
    ['female', 'Female', 'f', 'F', 's', 'S'].forEach((g) => expect(normalizeGender(g)).toBe('female'));
    expect(normalizeGender('Intersex')).toBe('intersex');
    expect(normalizeGender('ai-agent')).toBe('ai-agent');
  });

  it('returns null, not female, for anything else', () => {
    ['', 'unknown', 'x', 'other', undefined, null].forEach((g) => expect(normalizeGender(g)).toBeNull());
  });
});

describe('isSexUnknown (nodes-10)', () => {
  it('treats an unrecognised gender as unknown', () => {
    expect(isSexUnknown({ gender: 'x' })).toBe(true);
    expect(isSexUnknown({ gender: 'B' })).toBe(false);
  });
});

describe('deriveBirthSex / deriveGenderIdentity (nodes-10)', () => {
  it('keeps the existing answers for valid values', () => {
    expect(deriveBirthSex({ gender: 'male' })).toBe('male');
    expect(deriveBirthSex({ gender: 'female' })).toBe('female');
    expect(deriveBirthSex({ birthSex: 'intersex', gender: 'male' })).toBe('intersex');
    expect(deriveBirthSex({ genderSymbol: 'ai_agent' })).toBe('ai-agent');
    expect(deriveGenderIdentity({ gender: 'male' })).toBe('masculine');
    expect(deriveGenderIdentity({ gender: 'female' })).toBe('feminine');
    expect(deriveGenderIdentity({ birthSex: 'male', genderIdentity: 'feminine' })).toBe('feminine');
  });

  it('reads the sibling codes and capitalised values', () => {
    expect(deriveBirthSex({ gender: 'b' })).toBe('male');
    expect(deriveBirthSex({ gender: 'Male' })).toBe('male');
    expect(deriveBirthSex({ gender: 's' })).toBe('female');
    expect(deriveGenderIdentity({ gender: 'B' })).toBe('masculine');
  });

  it('is null when nothing says', () => {
    expect(deriveBirthSex({})).toBeNull();
    expect(deriveBirthSex({ gender: 'x' })).toBeNull();
    expect(deriveGenderIdentity({})).toBeNull();
  });
});

describe('resolveBinarySex (nodes-10)', () => {
  it('agrees with the canvas on male / female', () => {
    expect(resolveBinarySex({ gender: 'Male' })).toBe('male');
    expect(resolveBinarySex({ gender: 'b' })).toBe('male');
    expect(resolveBinarySex({ gender: 'F' })).toBe('female');
    expect(resolveBinarySex({ birthSex: 'female' })).toBe('female');
    expect(resolveBinarySex({ genderIdentity: 'masculine' })).toBe('male');
    expect(resolveBinarySex({ genderSymbol: 'female_cis' })).toBe('female');
  });

  it('is null for unknown or non-binary', () => {
    expect(resolveBinarySex(null)).toBeNull();
    expect(resolveBinarySex({ gender: 'x' })).toBeNull();
    expect(resolveBinarySex({ birthSex: 'intersex' })).toBeNull();
  });
});

describe('toggledBinarySex (review 2026-09-30 struct-07)', () => {
  it('reads every sex field, not gender alone', () => {
    expect(toggledBinarySex({ birthSex: 'male' })).toBe('female');
    expect(toggledBinarySex({ gender: 'female' })).toBe('male');
    expect(toggledBinarySex({ genderIdentity: 'masculine' })).toBe('female');
    expect(toggledBinarySex({})).toBe('male');
  });
});
