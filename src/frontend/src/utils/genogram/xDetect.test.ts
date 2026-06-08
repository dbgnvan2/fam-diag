/**
 * Tests for xDetect.ts — verifies the Hough-line interpretation logic.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// `houghOutput` is mutated per-test to inject different line geometries.
let houghOutput = new Int32Array(0);

function MockMat(this: { rows: number; cols: number; channels: () => number; delete: () => void; data32S: Int32Array }) {
  this.rows = 100;
  this.cols = 100;
  this.channels = () => 1;
  this.delete = () => {};
  Object.defineProperty(this, 'data32S', {
    get: () => houghOutput,
  });
}

const cv = {
  Mat: MockMat,
  HoughLinesP: vi.fn(),
};

vi.mock('@techstark/opencv-js', () => ({ default: cv }));

import { detectXThroughSymbol } from './xDetect';
import { _resetCvLoaderForTests } from '../cvLoader';

const fakeCrop = { rows: 100, cols: 100, channels: () => 1, delete: () => {} };

describe('detectXThroughSymbol', () => {
  beforeEach(() => {
    _resetCvLoaderForTests();
    cv.HoughLinesP.mockClear();
  });

  it('test_m4a1_detects_full_x_through_square', async () => {
    // Two diagonals corner-to-corner: (0,0)→(100,100) is +45°,
    // (0,100)→(100,0) is -45°.
    houghOutput = new Int32Array([0, 0, 100, 100, 0, 100, 100, 0]);
    const result = await detectXThroughSymbol(fakeCrop as never);
    expect(result.is_dead).toBe(true);
    expect(result.angleA).toBeCloseTo(Math.PI / 4, 1);
    expect(result.angleB).toBeCloseTo(-Math.PI / 4, 1);
  });

  it('test_m4a1_does_not_detect_x_on_clean_square', async () => {
    // Only horizontal/vertical lines — no diagonals.
    houghOutput = new Int32Array([0, 0, 100, 0, 0, 0, 0, 100]);
    const result = await detectXThroughSymbol(fakeCrop as never);
    expect(result.is_dead).toBe(false);
  });

  it('test_m4a1_does_not_false_positive_on_diagonal_letter_z', async () => {
    // A "Z" shape: top horizontal, one diagonal, bottom horizontal.
    // Diagonal at +45° present, but no matching -45°.
    houghOutput = new Int32Array([0, 0, 100, 0, 0, 0, 100, 100, 0, 100, 100, 100]);
    const result = await detectXThroughSymbol(fakeCrop as never);
    expect(result.is_dead).toBe(false);
    expect(result.angleA).toBeCloseTo(Math.PI / 4, 1);
    expect(result.angleB).toBeUndefined();
  });
});
