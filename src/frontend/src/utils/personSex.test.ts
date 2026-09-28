import { describe, it, expect } from 'vitest';
import { isSexUnknown } from './personSex';

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
