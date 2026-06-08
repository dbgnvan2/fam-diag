/**
 * Shape classification — turn a SymbolCandidate's contour geometry into a
 * Shape enum and a gender inference.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M3
 */

import type { SymbolCandidate } from './symbols';

export type Shape = 'square' | 'circle' | 'triangle' | 'x' | 'star';

export type InferredSex = 'male' | 'female' | 'unknown' | 'pregnancy' | 'miscarriage';

/**
 * Classify a shape using `circleFillRatio` (area / area-of-bounding-circle)
 * as the primary signal — it cleanly separates circles (≈ 1.0) from squares
 * (≈ 0.64) and is robust on wobbly hand-drawn contours. Falls back to
 * vertex count + circularity for edge cases.
 *
 * Decision tree:
 *   area==0 OR perimeter==0     → x  (plain X with no enclosed area)
 *   approxVertices == 3          → triangle
 *   circleFillRatio ≥ 0.82       → circle (high confidence)
 *   circleFillRatio ≤ 0.72       → square (high confidence)
 *   borderline: vertex count + circularity decide
 *
 * Star detection is intentionally omitted; the size filter in symbols.ts
 * filters out genuine miscarriage stars long before they reach here.
 *
 * Spec: M3.A.1
 */
export function classifyShape(candidate: SymbolCandidate): Shape {
  const { area, perimeter, approxVertices, circleFillRatio } = candidate;

  if (area === 0 || perimeter === 0) return 'x';
  if (approxVertices === 3) return 'triangle';

  // Primary signal: how full of the bounding circle does the contour
  // actually fill? A perfect square's ratio is 2/π ≈ 0.637, so the circle
  // threshold MUST be above that. Empirical fixture data (see the dump
  // bench): clean circles cluster at 0.65–0.95, hand-drawn squares at
  // 0.20–0.55. Set the boundary above the perfect-square baseline.
  if (circleFillRatio >= 0.68) return 'circle';
  if (circleFillRatio <= 0.60) return 'square';

  // Borderline 0.60–0.68: fall back to circularity + vertex count.
  const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
  if (approxVertices >= 6 && circularity >= 0.78) return 'circle';
  if (circularity >= 0.85) return 'circle';
  return 'square';
}

/**
 * Map a Shape to the kind of "person" (or non-person) it represents.
 *
 * Spec: M3.A.2
 */
export function shapeToInferredSex(shape: Shape): InferredSex {
  switch (shape) {
    case 'square':
      return 'male';
    case 'circle':
      return 'female';
    case 'triangle':
      return 'pregnancy';
    case 'x':
      return 'unknown';
    case 'star':
      return 'miscarriage';
  }
}

