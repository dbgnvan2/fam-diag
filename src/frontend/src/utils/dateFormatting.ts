const YEAR_ONLY = /^\d{4}$/;
const YEAR_MONTH = /^\d{4}-\d{2}$/;

export const expandPartialDate = (text: string): string => {
  if (YEAR_ONLY.test(text)) return `${text}-01-01`;
  if (YEAR_MONTH.test(text)) return `${text}-01`;
  return text;
};

// Diagram dates are calendar dates stored as 'YYYY-MM-DD'. Date.parse reads
// that form as UTC midnight, so reading it back with local getters
// (getFullYear, getMonth, getDate) gives the previous day — and on Jan 1 the
// previous year — anywhere west of UTC. The helpers below work on the calendar
// values directly or with UTC getters.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Calendar parts of a 'YYYY-MM-DD' string, or null if it is not one. */
export const parseCalendarDate = (iso?: string | null) => {
  const match = iso ? ISO_DATE.exec(iso) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
};

/**
 * Timeline slider range from event timestamps (Date.parse of 'YYYY-MM-DD',
 * i.e. UTC midnight), extended to include the current year.
 */
export const timelineYearBounds = (sortedTimestamps: number[], currentYear: number) => {
  if (!sortedTimestamps.length) return { min: currentYear, max: currentYear };
  const min = new Date(sortedTimestamps[0]).getUTCFullYear();
  const last = new Date(sortedTimestamps[sortedTimestamps.length - 1]).getUTCFullYear();
  return { min, max: Math.max(last, currentYear) };
};

/**
 * Whole years between a birth date and a death date (or today, a local
 * calendar date). Null when the birth date is missing or invalid, or the
 * result would be negative.
 */
export const ageInYears = (birthIso: string | undefined, deathIso: string | undefined, today: Date) => {
  const birth = parseCalendarDate(birthIso);
  if (!birth) return null;
  const end = parseCalendarDate(deathIso) ?? {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
  let age = end.year - birth.year;
  if (end.month < birth.month || (end.month === birth.month && end.day < birth.day)) {
    age -= 1;
  }
  return age < 0 ? null : age;
};

/**
 * Today as a LOCAL calendar date, 'YYYY-MM-DD'. For records of when
 * something was done in the app (a prediction created or resolved) — never
 * as a default for when an event happened, which is the user's to give.
 * `toISOString().slice(0, 10)` gave the UTC date, which is tomorrow west of
 * UTC in the evening.
 */
export const localDateString = (now: Date = new Date()): string => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** End of a timeline year, the canvas cutoff for that year. */
export const timelineCutoffForYear = (year: number | null): number | null =>
  year == null ? null : Date.UTC(year, 11, 31, 23, 59, 59, 999);

/**
 * The canvas timeline rule: a date at or before the cutoff is visible, and
 * anything with no usable date is visible at every year.
 */
export const isVisibleAtCutoff = (cutoffTimestamp: number | null) => (date?: string | null): boolean => {
  if (cutoffTimestamp == null) return true;
  if (!date) return true;
  const ts = Date.parse(date);
  if (Number.isNaN(ts)) return true;
  return ts <= cutoffTimestamp;
};

/**
 * Keep the timeline slider year inside the diagram's year range. A year past
 * the end goes to the newest year, not the oldest — jumping to the oldest hid
 * almost the whole diagram (review 2026-09-30 DE1-09). No year yet (a newly
 * opened diagram) is the newest year, so everything is shown, including
 * future-dated entries (DE1-08).
 */
export const clampTimelineYear = (
  year: number | null,
  bounds: { min: number; max: number }
): number => {
  if (year == null) return bounds.max;
  if (year > bounds.max) return bounds.max;
  if (year < bounds.min) return bounds.min;
  return year;
};
