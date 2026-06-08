/**
 * Tests for preprocess.ts — verifies the OpenCV call sequence without
 * loading real WASM.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Build a mock cv namespace shared by both the loader and the test.
const mockMatInstances: Array<{ rows: number; cols: number; channels(): number; delete: ReturnType<typeof vi.fn> }> = [];

function makeMat() {
  const m = {
    rows: 10,
    cols: 10,
    channels: () => 1,
    delete: vi.fn(),
  };
  mockMatInstances.push(m);
  return m;
}

const cv = {
  Mat: vi.fn(makeMat),
  matFromImageData: vi.fn(makeMat),
  cvtColor: vi.fn(),
  threshold: vi.fn(),
  COLOR_RGBA2GRAY: 11,
  THRESH_BINARY_INV: 1,
  THRESH_OTSU: 8,
};

// Mock the new pure-JS cv-js module (not the old @techstark/opencv-js)
vi.mock('../cv-js', () => ({
  default: cv,
  ...cv,
}));

import { preprocessImage, deskewIfAngled } from './preprocess';
import { _resetCvLoaderForTests } from '../cvLoader';

describe('preprocessImage', () => {
  beforeEach(() => {
    _resetCvLoaderForTests();
    mockMatInstances.length = 0;
    cv.matFromImageData.mockClear();
    cv.cvtColor.mockClear();
    cv.threshold.mockClear();

    // jsdom doesn't ship createImageBitmap; stub it.
    (globalThis as unknown as { createImageBitmap: typeof createImageBitmap }).createImageBitmap = vi.fn(
      async () => ({ width: 40, height: 30 }) as unknown as ImageBitmap
    );

    // Stub canvas.getContext to return a fake 2D context.
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () =>
        ({
          drawImage: vi.fn(),
          getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray(40 * 30 * 4),
            width: 40,
            height: 30,
            colorSpace: 'srgb',
          })),
        }) as unknown as CanvasRenderingContext2D
    ) as typeof HTMLCanvasElement.prototype.getContext;
  });

  it('test_m1a1_grayscale_binary_output', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const result = await preprocessImage(blob);

    expect(cv.cvtColor).toHaveBeenCalledTimes(1);
    expect(cv.cvtColor.mock.calls[0][2]).toBe(cv.COLOR_RGBA2GRAY);

    expect(cv.threshold).toHaveBeenCalledTimes(1);
    const thresholdCall = cv.threshold.mock.calls[0];
    expect(thresholdCall[3]).toBe(255); // maxval
    expect(thresholdCall[4]).toBe(cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

    expect(result.width).toBe(40);
    expect(result.height).toBe(30);
    expect(result.binary).toBeDefined();
  });

  it('frees intermediate Mats so we do not leak WASM heap', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' });
    await preprocessImage(blob);
    // src and gray Mats are deleted; binary is returned (caller's job to delete).
    const deletedCount = mockMatInstances.filter((m) => m.delete.mock.calls.length > 0).length;
    expect(deletedCount).toBeGreaterThanOrEqual(2);
  });
});

describe('deskewIfAngled', () => {
  it('test_m1a2_returns_a_mat_and_angle', () => {
    const fakeMat = { rows: 1, cols: 1, channels: () => 1, delete: vi.fn() };
    const { mat, angleCorrected } = deskewIfAngled(fakeMat);
    expect(mat).toBe(fakeMat);
    expect(typeof angleCorrected).toBe('number');
  });
});
