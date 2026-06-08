/**
 * Core image processing operations: color conversion, thresholding, etc.
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md (Phase 1)
 */

import {
  Mat,
  CV_8U,
  CV_8UC4,
  CV_32F,
  COLOR_RGBA2GRAY,
  THRESH_BINARY_INV,
  THRESH_OTSU,
} from './types';

/**
 * Convert browser ImageData to Mat.
 *
 * Input: ImageData from canvas.getImageData() — 4-channel RGBA, Uint8ClampedArray
 * Output: CV_8UC4 Mat with same dimensions
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md#A.2
 * Test: preprocess.test.ts — matFromImageData output shape
 */
export function matFromImageData(imageData: ImageData): Mat {
  const { width, height, data } = imageData;
  const mat = new Mat(height, width, CV_8UC4);

  // Copy RGBA data as-is
  mat.data.set(data);

  return mat;
}

/**
 * Convert color space.
 *
 * Currently supports: COLOR_RGBA2GRAY
 *
 * For grayscale: weighted average per ITU-R BT.601
 *   Y = 0.299·R + 0.587·G + 0.114·B
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md#B.1
 * Test: preprocess.test.ts::test_m1a1_grayscale_binary_output
 */
export function cvtColor(src: Mat, dst: Mat, code: number): void {
  if (code === COLOR_RGBA2GRAY) {
    if (src.channels() !== 4) {
      throw new Error(`cvtColor COLOR_RGBA2GRAY expects 4-channel input, got ${src.channels()}`);
    }

    // If dst is empty (created with no args), allocate it now
    if (dst.rows === 0) {
      dst.rows = src.rows;
      dst.cols = src.cols;
      dst.type = CV_8U;
      dst.channels_ = 1;
      (dst as any).elemSize_ = 1;
      dst.data = new Uint8ClampedArray(src.rows * src.cols);
    }

    // Ensure dst is single-channel and correct size
    if (dst.channels() !== 1 || dst.rows !== src.rows || dst.cols !== src.cols) {
      throw new Error('cvtColor: dst must be single-channel Mat of same size as src');
    }

    const srcData = src.data as Uint8ClampedArray;
    const dstData = dst.data as Uint8ClampedArray;

    for (let i = 0; i < srcData.length; i += 4) {
      const r = srcData[i];
      const g = srcData[i + 1];
      const b = srcData[i + 2];
      // Y = 0.299·R + 0.587·G + 0.114·B
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      dstData[i >> 2] = gray; // Store in dst at [i/4]
    }
  } else {
    throw new Error(`cvtColor: unsupported color code ${code}`);
  }
}

/**
 * Compute Otsu's threshold (automatic threshold selection).
 *
 * Algorithm: histogram-based method that minimizes within-class variance
 * Returns the threshold value that best separates background/foreground.
 *
 * Reference: Otsu, N. (1979). "A threshold selection method from gray-level histograms"
 */
function computeOtsuThreshold(data: Uint8ClampedArray): number {
  // Build histogram
  const hist = new Float32Array(256);
  for (let i = 0; i < data.length; i++) {
    hist[data[i]]++;
  }

  const total = data.length;
  let sum = 0;
  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;

    const wF = total - wB;
    if (wF === 0) break;

    sum += t * hist[t];
    const sumF = sum - sumB;
    const muB = sumB / wB;
    const muF = sumF / wF;
    const variance = wB * wF * Math.pow(muB - muF, 2);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  return threshold;
}

/**
 * Apply threshold to convert grayscale image to binary.
 *
 * Supports:
 *   THRESH_BINARY_INV | THRESH_OTSU — automatically compute threshold, then invert (0→255, 255→0)
 *
 * Output: binary image with only 0 and 255 values
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md#C.1
 * Test: preprocess.test.ts::test_m1a1_grayscale_binary_output
 */
export function threshold(
  src: Mat,
  dst: Mat,
  threshValue: number,
  maxVal: number,
  type: number
): number {
  if (src.channels() !== 1) {
    throw new Error(`threshold expects single-channel input, got ${src.channels()}`);
  }

  // If dst is empty (created with no args), allocate it now
  if (dst.rows === 0) {
    dst.rows = src.rows;
    dst.cols = src.cols;
    dst.type = CV_8U;
    dst.channels_ = 1;
    (dst as any).elemSize_ = 1;
    dst.data = new Uint8ClampedArray(src.rows * src.cols);
  }

  if (dst.rows !== src.rows || dst.cols !== src.cols) {
    throw new Error('threshold: dst must be Mat of same size as src');
  }

  const srcData = src.data as Uint8ClampedArray;
  const dstData = dst.data as Uint8ClampedArray;

  let computedThreshold = threshValue;

  // If OTSU flag set, compute automatic threshold
  if (type & THRESH_OTSU) {
    computedThreshold = computeOtsuThreshold(srcData);
  }

  // Apply threshold with optional inversion
  const invert = (type & THRESH_BINARY_INV) !== 0;

  for (let i = 0; i < srcData.length; i++) {
    const val = srcData[i] > computedThreshold ? maxVal : 0;
    dstData[i] = invert ? maxVal - val : val;
  }

  return computedThreshold;
}

/**
 * Subtract two images element-wise: dst = src1 - src2 (clamped to 0).
 *
 * Used in preprocessing to remove connector lines from symbol detection.
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md#H.2
 */
export function subtract(src1: Mat, src2: Mat, dst: Mat): void {
  if (src1.rows !== src2.rows || src1.cols !== src2.cols) {
    throw new Error('subtract: src1 and src2 must have same dimensions');
  }

  if (dst.rows !== src1.rows || dst.cols !== src1.cols) {
    throw new Error('subtract: dst must be pre-allocated Mat of same size');
  }

  const data1 = src1.data as Uint8ClampedArray;
  const data2 = src2.data as Uint8ClampedArray;
  const dstData = dst.data as Uint8ClampedArray;

  for (let i = 0; i < data1.length; i++) {
    dstData[i] = Math.max(0, data1[i] - data2[i]);
  }
}
