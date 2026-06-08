/**
 * Tests for xRemove.ts — verifies line + inpaint call sequence and
 * thickness propagation.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

function MockMat(this: { rows: number; cols: number; delete: () => void; channels: () => number }) {
  this.rows = 60;
  this.cols = 60;
  this.delete = () => {};
  this.channels = () => 1;
}
function MockScalar(this: { v: number[] }, ...vals: number[]) {
  this.v = vals;
}

const cv = {
  Mat: MockMat,
  Scalar: MockScalar,
  line: vi.fn(),
  inpaint: vi.fn(),
  CV_8UC1: 0,
  INPAINT_TELEA: 1,
  LINE_8: 8,
};

vi.mock('@techstark/opencv-js', () => ({ default: cv }));

import { removeXStrokes, DEFAULT_X_MASK_THICKNESS } from './xRemove';
import { _resetCvLoaderForTests } from '../cvLoader';

const fakeCrop = {
  rows: 60,
  cols: 60,
  channels: () => 1,
  delete: () => {},
};

describe('removeXStrokes', () => {
  beforeEach(() => {
    _resetCvLoaderForTests();
    cv.line.mockClear();
    cv.inpaint.mockClear();
  });

  it('test_m5a1_draws_two_diagonal_lines_in_mask_then_inpaints', async () => {
    await removeXStrokes(fakeCrop as never, { angleA: Math.PI / 4, angleB: -Math.PI / 4 });
    expect(cv.line).toHaveBeenCalledTimes(2);
    expect(cv.inpaint).toHaveBeenCalledTimes(1);
    // Inpaint is called with the user-default thickness when no override given.
    expect(cv.inpaint.mock.calls[0][3]).toBe(DEFAULT_X_MASK_THICKNESS);
    expect(cv.inpaint.mock.calls[0][4]).toBe(cv.INPAINT_TELEA);
  });

  it('test_m5a1_thickness_param_tunable', async () => {
    await removeXStrokes(fakeCrop as never, { angleA: Math.PI / 4, angleB: -Math.PI / 4 }, { thickness: 9 });
    expect(cv.line.mock.calls[0][4]).toBe(9);
    expect(cv.line.mock.calls[1][4]).toBe(9);
    expect(cv.inpaint.mock.calls[0][3]).toBe(9);
  });
});
