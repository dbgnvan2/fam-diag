/**
 * Tests for cvLoader.ts — verify the lazy-load caching contract without
 * actually loading the 9MB OpenCV.js WASM blob.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M0.A.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the heavy module BEFORE importing the loader.
vi.mock('@techstark/opencv-js', () => ({
  default: {
    // Synthetic cv object — has `Mat`, so the loader's "already initialized"
    // branch resolves immediately instead of waiting on onRuntimeInitialized.
    Mat: function Mat() {},
  },
}));

import { loadCv, _resetCvLoaderForTests } from './cvLoader';

describe('cvLoader', () => {
  beforeEach(() => {
    _resetCvLoaderForTests();
  });

  it('test_m0a1_loads_opencv_lazily', async () => {
    const cv = await loadCv();
    expect(cv).toBeDefined();
    // Calling again returns the same cached Promise.
    const cv2 = await loadCv();
    expect(cv2).toBe(cv);
  });
});
