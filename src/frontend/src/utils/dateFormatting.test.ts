import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ageInYears, expandPartialDate, parseCalendarDate, timelineYearBounds } from './dateFormatting';

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


// These bugs only show west of UTC, so run the checks in Vancouver time.
describe('calendar-date helpers west of UTC', () => {
  let savedTz: string | undefined;
  beforeEach(() => {
    savedTz = process.env.TZ;
    process.env.TZ = 'America/Vancouver';
  });
  afterEach(() => {
    if (savedTz === undefined) delete process.env.TZ;
    else process.env.TZ = savedTz;
  });

  it('test environment really is west of UTC', () => {
    expect(new Date(Date.parse('1950-01-01')).getFullYear()).toBe(1949);
  });

  it('timelineYearBounds reads 1950-01-01 as 1950 (regression: was 1949)', () => {
    const ts = [Date.parse('1950-01-01'), Date.parse('1990-01-01')];
    expect(timelineYearBounds(ts, 2026)).toEqual({ min: 1950, max: 2026 });
  });

  it('timelineYearBounds keeps a future last year and handles no entries', () => {
    expect(timelineYearBounds([Date.parse('2030-01-01')], 2026)).toEqual({ min: 2030, max: 2030 });
    expect(timelineYearBounds([], 2026)).toEqual({ min: 2026, max: 2026 });
  });

  it('ageInYears does not add the year a day early (regression)', () => {
    // Local 2026-06-14 is the day before the 50th birthday.
    expect(ageInYears('1976-06-15', undefined, new Date(2026, 5, 14))).toBe(49);
    expect(ageInYears('1976-06-15', undefined, new Date(2026, 5, 15))).toBe(50);
  });

  it('ageInYears uses the death date when present', () => {
    expect(ageInYears('1900-03-10', '1980-03-09', new Date(2026, 0, 1))).toBe(79);
    expect(ageInYears('1900-03-10', '1980-03-10', new Date(2026, 0, 1))).toBe(80);
  });

  it('ageInYears returns null for missing, malformed or negative ages', () => {
    const today = new Date(2026, 0, 1);
    expect(ageInYears(undefined, undefined, today)).toBeNull();
    expect(ageInYears('1976', undefined, today)).toBeNull();
    expect(ageInYears('1980-01-01', '1970-01-01', today)).toBeNull();
  });

  it('parseCalendarDate rejects out-of-range parts', () => {
    expect(parseCalendarDate('2020-13-01')).toBeNull();
    expect(parseCalendarDate('2020-02-10')).toEqual({ year: 2020, month: 2, day: 10 });
  });
});
