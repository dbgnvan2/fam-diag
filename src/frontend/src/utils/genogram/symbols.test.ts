/**
 * Tests for symbols.ts — verifies the cv call sequence and the candidate
 * shape, plus the pure-function manual-bbox path.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock contour data — three shapes laid out roughly L → R.
const mockContours = [
  { rect: { x: 10, y: 100, width: 40, height: 40 }, area: 1600, perim: 160 },
  { rect: { x: 80, y: 100, width: 40, height: 40 }, area: 1600, perim: 160 },
  { rect: { x: 150, y: 100, width: 40, height: 40 }, area: 1600, perim: 160 },
];

function makeMat() {
  return { delete: vi.fn(), rows: 1, cols: 1, channels: () => 1 };
}

// `new cv.Mat()` and `new cv.MatVector()` must work, so use function declarations
// (not arrow functions) which JS treats as constructors.
function MockMat(this: ReturnType<typeof makeMat>) {
  Object.assign(this, makeMat());
}
function MockMatVector(this: {
  size(): number;
  get(i: number): { data32S: Int32Array; delete: () => void };
  delete(): void;
}) {
  this.size = () => mockContours.length;
  this.get = (i: number) => ({
    data32S: new Int32Array([
      mockContours[i].rect.x,
      mockContours[i].rect.y,
      mockContours[i].rect.x + mockContours[i].rect.width,
      mockContours[i].rect.y,
      mockContours[i].rect.x + mockContours[i].rect.width,
      mockContours[i].rect.y + mockContours[i].rect.height,
      mockContours[i].rect.x,
      mockContours[i].rect.y + mockContours[i].rect.height,
    ]),
    delete: () => {},
  });
  this.delete = () => {};
}

function MockSize(this: { width: number; height: number }, w: number, h: number) {
  this.width = w; this.height = h;
}

const cv = {
  Mat: MockMat,
  MatVector: MockMatVector,
  Size: MockSize,
  getStructuringElement: vi.fn(makeMat),
  morphologyEx: vi.fn(),
  subtract: vi.fn(),
  findContours: vi.fn(),
  boundingRect: vi.fn((c: { data32S: Int32Array }) => {
    const idx = mockContours.findIndex((m) => m.rect.x === c.data32S[0]);
    return mockContours[idx].rect;
  }),
  contourArea: vi.fn((c: { data32S: Int32Array }) => {
    const idx = mockContours.findIndex((m) => m.rect.x === c.data32S[0]);
    return mockContours[idx].area;
  }),
  arcLength: vi.fn((c: { data32S: Int32Array }) => {
    const idx = mockContours.findIndex((m) => m.rect.x === c.data32S[0]);
    return mockContours[idx].perim;
  }),
  // approxPolyDP writes its result into the destination mat. We don't care
  // about the actual approximation here — just give it a fake 4-vertex
  // square (rows=4) so the caller's approxVertices is non-zero.
  approxPolyDP: vi.fn((_c: unknown, dst: { rows?: number; cols?: number }) => {
    dst.rows = 4;
    dst.cols = 1;
  }),
  // Fake enclosing circle whose area is 2× the contour area → ratio 0.5
  // (between square and circle thresholds, exercises the fallback path).
  minEnclosingCircle: vi.fn(() => ({ center: { x: 0, y: 0 }, radius: 25 })),
  MORPH_RECT: 0,
  MORPH_OPEN: 2,
  RETR_EXTERNAL: 0,
  CHAIN_APPROX_SIMPLE: 2,
};

vi.mock('@techstark/opencv-js', () => ({ default: cv }));

import {
  eraseConnectorLines,
  detectSymbolContours,
  candidatesFromManualBBoxes,
} from './symbols';
import { _resetCvLoaderForTests } from '../cvLoader';

describe('eraseConnectorLines', () => {
  beforeEach(() => {
    _resetCvLoaderForTests();
    cv.morphologyEx.mockClear();
    cv.subtract.mockClear();
    cv.getStructuringElement.mockClear();
  });

  it('test_m2a1_runs_morphology_for_both_orientations', async () => {
    const binary = makeMat() as unknown as Parameters<typeof eraseConnectorLines>[0];
    await eraseConnectorLines(binary);
    // Two orientations: horizontal kernel (40×1) and vertical (1×40).
    expect(cv.getStructuringElement).toHaveBeenCalledTimes(2);
    const sizes = cv.getStructuringElement.mock.calls.map((call) => call[1]);
    expect(sizes).toContainEqual(expect.objectContaining({ width: 40, height: 1 }));
    expect(sizes).toContainEqual(expect.objectContaining({ width: 1, height: 40 }));
    expect(cv.morphologyEx).toHaveBeenCalledTimes(2);
    expect(cv.subtract).toHaveBeenCalledTimes(2);
  });
});

describe('detectSymbolContours', () => {
  beforeEach(() => {
    _resetCvLoaderForTests();
  });

  it('test_m2a2_detects_three_separate_shapes', async () => {
    const binary = makeMat() as unknown as Parameters<typeof detectSymbolContours>[0];
    const candidates = await detectSymbolContours(binary);
    expect(candidates).toHaveLength(3);
    candidates.forEach((c) => {
      expect(c.bbox.w).toBeGreaterThanOrEqual(20);
      expect(c.bbox.h).toBeGreaterThanOrEqual(20);
      expect(c.area).toBeGreaterThan(0);
      expect(c.perimeter).toBeGreaterThan(0);
      expect(c.contourPoints.length).toBeGreaterThanOrEqual(4);
      expect(c.approxVertices).toBeGreaterThan(0);
    });
  });

  it('orders candidates by reading order (top→bottom, left→right)', async () => {
    const binary = makeMat() as unknown as Parameters<typeof detectSymbolContours>[0];
    const candidates = await detectSymbolContours(binary);
    expect(candidates[0].bbox.x).toBeLessThan(candidates[1].bbox.x);
    expect(candidates[1].bbox.x).toBeLessThan(candidates[2].bbox.x);
  });
});

describe('candidatesFromManualBBoxes', () => {
  it('test_m2a3_manual_bboxes_override_auto_detection', () => {
    const candidates = candidatesFromManualBBoxes([
      { x: 10, y: 10, w: 50, h: 50 },
      { x: 100, y: 100, w: 30, h: 30 },
    ]);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].bbox.w).toBe(50);
    expect(candidates[0].area).toBe(2500);
    expect(candidates[0].perimeter).toBe(200);
    expect(candidates[0].contourPoints).toHaveLength(4);
    expect(candidates[0].id).toBe('manual-0');
  });
});
