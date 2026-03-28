import { describe, it, expect } from 'vitest';
import { expandPartialDate } from '../utils/dateFormatting';

describe('expandPartialDate', () => {
  it('expands year-only to Jan 1', () => {
    expect(expandPartialDate('2000')).toBe('2000-01-01');
    expect(expandPartialDate('1985')).toBe('1985-01-01');
  });

  it('expands year-month to the 1st of that month', () => {
    expect(expandPartialDate('1990-03')).toBe('1990-03-01');
    expect(expandPartialDate('2024-12')).toBe('2024-12-01');
  });

  it('passes full dates through unchanged', () => {
    expect(expandPartialDate('2000-06-15')).toBe('2000-06-15');
    expect(expandPartialDate('1990-03-01')).toBe('1990-03-01');
  });

  it('passes empty string through unchanged', () => {
    expect(expandPartialDate('')).toBe('');
  });

  it('passes invalid strings through unchanged', () => {
    expect(expandPartialDate('foo')).toBe('foo');
    expect(expandPartialDate('20')).toBe('20');
    expect(expandPartialDate('2000-1')).toBe('2000-1');
  });
});
