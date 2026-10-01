import { describe, it, expect } from 'vitest';
import { DEFAULT_DEMO_FILE_NAME, isDemoDiagramFileName } from './demoTour';

describe('isDemoDiagramFileName (review 2026-09-30 G-TEST-13)', () => {
  it('recognises the demo file name in any case (regression: the mixed-case name never matched)', () => {
    expect(isDemoDiagramFileName(DEFAULT_DEMO_FILE_NAME)).toBe(true);
    expect(isDemoDiagramFileName('product_default.diagram.json')).toBe(true);
    expect(isDemoDiagramFileName('Demo Family Diagram.json')).toBe(true);
  });

  it('does not match a client file', () => {
    expect(isDemoDiagramFileName('smith-family.json')).toBe(false);
    expect(isDemoDiagramFileName(null)).toBe(false);
  });
});
