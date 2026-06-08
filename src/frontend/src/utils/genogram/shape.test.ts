/**
 * Tests for shape.ts — pure functions, no cv dependency.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M3
 */

import { describe, it, expect } from 'vitest';
import { classifyShape, shapeToInferredSex } from './shape';
import type { SymbolCandidate } from './symbols';

function candidate(opts: {
  area: number;
  perimeter: number;
  approxVertices: number;
  circleFillRatio?: number;
}): SymbolCandidate {
  return {
    id: 'test',
    bbox: { x: 0, y: 0, w: 40, h: 40 },
    area: opts.area,
    perimeter: opts.perimeter,
    contourPoints: [],
    approxVertices: opts.approxVertices,
    // Default to a square's ratio — tests opt into circle ratios when needed.
    circleFillRatio: opts.circleFillRatio ?? 0.637,
  };
}

describe('classifyShape', () => {
  it('test_m3a1_classifies_circle_high_circularity', () => {
    // Perfect circle: r=20, area=π·400, perimeter=2π·20 → circularity=1.0.
    // circleFillRatio = π·400 / (π·400) = 1.0.
    const c = candidate({
      area: Math.PI * 400,
      perimeter: 2 * Math.PI * 20,
      approxVertices: 8,
      circleFillRatio: 1.0,
    });
    expect(classifyShape(c)).toBe('circle');
  });

  it('test_m3a1_classifies_square_around_0_785', () => {
    // Square 40x40: area=1600, perimeter=160 → circularity ≈ 0.785
    const s = candidate({ area: 1600, perimeter: 160, approxVertices: 4 });
    expect(classifyShape(s)).toBe('square');
  });

  it('test_m3a1_classifies_triangle_by_vertex_count', () => {
    // approxVertices === 3 → triangle regardless of circularity
    const t = candidate({ area: 692, perimeter: 120, approxVertices: 3 });
    expect(classifyShape(t)).toBe('triangle');
  });

  it('test_m3a1_classifies_plain_x_when_no_enclosed_area', () => {
    const x = candidate({ area: 0, perimeter: 80, approxVertices: 8 });
    expect(classifyShape(x)).toBe('x');
  });

  it('biases toward square when ambiguous (low circularity + 4-5 vertices)', () => {
    // Hand-drawn square with wobbly contour: vertices=5, circularity=0.65
    const s = candidate({ area: 1300, perimeter: 160, approxVertices: 5 });
    expect(classifyShape(s)).toBe('square');
  });

  it('classifies many-sided wobbly shapes with high circle-fill-ratio as circle', () => {
    // Hand-drawn circle: many vertices and the circle fills its bounding circle.
    const c = candidate({ area: 1660, perimeter: 158, approxVertices: 10, circleFillRatio: 0.9 });
    expect(classifyShape(c)).toBe('circle');
  });
});

describe('shapeToInferredSex', () => {
  it('test_m3a2_gender_mapping', () => {
    expect(shapeToInferredSex('square')).toBe('male');
    expect(shapeToInferredSex('circle')).toBe('female');
    expect(shapeToInferredSex('triangle')).toBe('pregnancy');
    expect(shapeToInferredSex('x')).toBe('unknown');
    expect(shapeToInferredSex('star')).toBe('miscarriage');
  });
});
