/**
 * Purpose: how a timeline block is drawn — its shape (by the sex of the person
 *          the event belongs to) and its fill (by the event's intensity).
 * Spec:    n/a — 2026-09-20, at the user's request
 * Tests:   src/frontend/src/utils/timelineItemText.test.ts
 *
 * Editorial content — the colour ramp and the shape vocabulary — lives here
 * rather than inside the rendering code.
 */

/** A rectangle for males, a wide oval for females, a soft box for anyone else. */
export type TimelineBlockShape = 'rect' | 'oval' | 'neutral';

export const BLOCK_BORDER_RADIUS: Record<TimelineBlockShape, string> = {
  rect: '2px',
  // A pill: at the block's fixed height this reads as a wide oval.
  oval: '999px',
  neutral: '6px',
};

/**
 * Event intensity is 1-5 with 0 meaning "not rated" (never conflate it with
 * the graphic intensityLevel on emotional lines). The ramp runs blue → green
 * → amber → orange → red; an unrated event is neutral grey so it cannot be
 * mistaken for a rating.
 */
export const INTENSITY_FILL: Record<number, string> = {
  1: '#cfe3ff', // blue
  2: '#cdf0d5', // green
  3: '#fdf0c2', // amber
  4: '#ffdcc0', // orange
  5: '#ffcccc', // red
};

export const INTENSITY_UNRATED_FILL = '#eceff4';

export const INTENSITY_BORDER: Record<number, string> = {
  1: '#6c9bd8',
  2: '#6fbf8a',
  3: '#d9b93c',
  4: '#e0924a',
  5: '#d96a6a',
};

export const INTENSITY_UNRATED_BORDER = '#c2cad6';

/**
 * How intense each relationship status reads on the 1-5 scale. Carried onto
 * the synthesized status events so a divorce still shows warmer than a
 * marriage now that the appended status records are gone.
 */
export const RELATIONSHIP_STATUS_INTENSITY: Record<string, number> = {
  married: 3,
  separated: 4,
  divorced: 5,
  widowed: 5,
  started: 2,
  ended: 4,
  ongoing: 3,
};
