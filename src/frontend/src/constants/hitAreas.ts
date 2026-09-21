/**
 * Purpose: how wide a line's clickable region is, independent of how thick it
 *          is drawn.
 * Spec:    n/a — 2026-09-21, at the user's request
 * Tests:   PartnershipNode.test.tsx, ChildConnection.test.tsx,
 *          EmotionalLineNode.test.tsx
 *
 * A partner relationship line is drawn 2px wide and a child connection 1px.
 * Hitting either with a mouse means landing inside a couple of pixels, which
 * is far harder than it sounds once the canvas is zoomed out — and the lines
 * are the way into the Properties panel for a relationship.
 *
 * Konva separates the drawn stroke from the hit region: `hitStrokeWidth`
 * widens what responds to a click without changing what is rendered. The
 * three line kinds used different widths (20 / 10 / 24), so they now share
 * one.
 *
 * 28 is a deliberate compromise. Sibling drop-lines sit roughly 40px apart at
 * 100% zoom, so a wider region would leave neighbouring lines almost no gap;
 * where regions do overlap, the topmost shape in draw order wins.
 */
export const LINE_HIT_STROKE_WIDTH = 28;
