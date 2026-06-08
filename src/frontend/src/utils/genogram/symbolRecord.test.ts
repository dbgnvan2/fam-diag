/**
 * Tests for symbolRecord.ts — verify the per-symbol pipeline assembly.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { classifyShapeMock, detectXMock, removeXMock, readLetterMock } = vi.hoisted(() => ({
  classifyShapeMock: vi.fn(),
  detectXMock: vi.fn(),
  removeXMock: vi.fn(),
  readLetterMock: vi.fn(),
}));

vi.mock('./shape', async () => {
  const actual = await vi.importActual<typeof import('./shape')>('./shape');
  return {
    ...actual,
    classifyShape: classifyShapeMock,
  };
});
vi.mock('./xDetect', () => ({ detectXThroughSymbol: detectXMock }));
vi.mock('./xRemove', () => ({ removeXStrokes: removeXMock }));
vi.mock('./letterOcr', () => ({ readLetter: readLetterMock }));

function MockRect(this: { x: number; y: number; w: number; h: number }, x: number, y: number, w: number, h: number) {
  this.x = x; this.y = y; this.w = w; this.h = h;
}
function MockMat(this: { rows: number; cols: number; delete: () => void; channels: () => number }) {
  this.rows = 0; this.cols = 0; this.delete = () => {}; this.channels = () => 1;
}
// cvLoader probes `cv.Mat` to detect that OpenCV is initialized — we must
// supply it (or the loader hangs waiting for onRuntimeInitialized).
const cv = { Rect: MockRect, Mat: MockMat };
vi.mock('@techstark/opencv-js', () => ({ default: cv }));

import { extractSymbolRecord } from './symbolRecord';
import { _resetCvLoaderForTests } from '../cvLoader';
import type { SymbolCandidate } from './symbols';

const fakeCandidate: SymbolCandidate = {
  id: 'sym-0',
  bbox: { x: 0, y: 0, w: 40, h: 40 },
  area: 1600,
  perimeter: 160,
  contourPoints: [],
};
const fakeMat = {
  rows: 100, cols: 100, channels: () => 1, delete: () => {},
  roi: () => ({ rows: 40, cols: 40, channels: () => 1, delete: () => {} }),
} as unknown as Parameters<typeof extractSymbolRecord>[1];

describe('extractSymbolRecord', () => {
  beforeEach(() => {
    _resetCvLoaderForTests();
    classifyShapeMock.mockReset();
    detectXMock.mockReset();
    removeXMock.mockReset();
    readLetterMock.mockReset();
  });

  it('test_m7a1_record_shape_complete', async () => {
    classifyShapeMock.mockReturnValue('square');
    detectXMock.mockResolvedValue({ is_dead: false });
    readLetterMock.mockResolvedValue({ letter: 'M', confidence: 0.95, source: 'tesseract' });

    const record = await extractSymbolRecord(fakeCandidate, fakeMat);
    expect(record).toMatchObject({
      id: 'sym-0',
      shape: 'square',
      inferred_sex: 'male',
      is_dead: false,
      x_detected: true,
      letter: 'M',
      letter_source: 'tesseract',
    });
    expect(['high', 'med', 'low']).toContain(record.overall_confidence);
  });

  it('test_m7a2_low_confidence_propagates_when_letter_below_threshold', async () => {
    classifyShapeMock.mockReturnValue('circle');
    detectXMock.mockResolvedValue({ is_dead: false });
    readLetterMock.mockResolvedValue({ letter: 'D', confidence: 0.35, source: 'tesseract' });

    const record = await extractSymbolRecord(fakeCandidate, fakeMat);
    expect(record.overall_confidence).toBe('low');
    expect(record.notes.join(' ')).toMatch(/low-confidence letter/);
  });

  it('runs X removal only when the symbol is detected as dead', async () => {
    classifyShapeMock.mockReturnValue('square');
    detectXMock.mockResolvedValue({ is_dead: true, angleA: Math.PI / 4, angleB: -Math.PI / 4 });
    removeXMock.mockResolvedValue({ rows: 40, cols: 40, channels: () => 1, delete: () => {} });
    readLetterMock.mockResolvedValue({ letter: 'D', confidence: 0.9, source: 'tesseract' });

    const record = await extractSymbolRecord(fakeCandidate, fakeMat);
    expect(removeXMock).toHaveBeenCalledTimes(1);
    expect(record.is_dead).toBe(true);
    expect(record.notes.join(' ')).toMatch(/deceased/);
  });

  it('short-circuits non-person shapes (triangle, star) without running X-detect', async () => {
    classifyShapeMock.mockReturnValue('star');

    const record = await extractSymbolRecord(fakeCandidate, fakeMat);
    expect(record.shape).toBe('star');
    expect(record.inferred_sex).toBe('miscarriage');
    expect(detectXMock).not.toHaveBeenCalled();
    expect(readLetterMock).not.toHaveBeenCalled();
  });
});
