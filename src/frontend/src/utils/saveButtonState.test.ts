import { describe, expect, it } from 'vitest';
import { getSaveButtonState, TEN_MINUTES_MS } from './saveButtonState';

describe('getSaveButtonState', () => {
  it('returns clean when diagram is not dirty', () => {
    expect(getSaveButtonState(false, null, Date.now())).toBe('clean');
  });

  it('returns dirty when diagram has unsaved changes but no timestamp', () => {
    expect(getSaveButtonState(true, null, Date.now())).toBe('dirty');
  });

  it('returns dirty when elapsed time is under ten minutes', () => {
    const now = Date.now();
    expect(getSaveButtonState(true, now - TEN_MINUTES_MS + 1, now)).toBe('dirty');
  });

  it('returns critical when elapsed time exceeds ten minutes', () => {
    const now = Date.now();
    expect(getSaveButtonState(true, now - TEN_MINUTES_MS - 1000, now)).toBe('critical');
  });
});
