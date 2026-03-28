import { describe, expect, it } from 'vitest';
import { expandPartialDate } from './dateFormatting';

describe('expandPartialDate', () => {
  it('expands a year-only value to the first day of that year', () => {
    expect(expandPartialDate('2000')).toBe('2000-01-01');
  });

  it('expands a year-month value to the first day of that month', () => {
    expect(expandPartialDate('1990-03')).toBe('1990-03-01');
  });

  it('leaves a full date unchanged', () => {
    expect(expandPartialDate('2024-11-05')).toBe('2024-11-05');
  });
});
