/**
 * Morphological image operations: erosion, dilation, opening, closing.
 *
 * Used to remove thin lines (connectors) before contour detection.
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md (Phase 2)
 */

import type { Size } from './types';
import { Mat, MORPH_RECT, CV_8U } from './types';

/**
 * Create a structuring element (kernel).
 *
 * Currently supports: MORPH_RECT (rectangular kernel, all 1s)
 *
 * Output: kernel Mat with 1s for included pixels, 0s for excluded.
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md#D.1
 */
export function getStructuringElement(shape: number, size: Size): Mat {
  if (shape !== MORPH_RECT) {
    throw new Error(`getStructuringElement: unsupported shape ${shape}`);
  }

  const kernel = new Mat(size.height, size.width, CV_8U);
  kernel.data.fill(1);
  return kernel;
}

/**
 * Erode a binary image: for each pixel, set to minimum of neighborhood.
 *
 * This shrinks white (255) regions and removes thin structures.
 *
 * Algorithm:
 *   For each pixel p in src where kernel has 1:
 *     dst[p] = min(src[q] for all q covered by kernel centered at p)
 */
function erode(src: Mat, dst: Mat, kernel: Mat): void {
  if (src.channels() !== 1 || dst.channels() !== 1) {
    throw new Error('erode expects single-channel input/output');
  }

  const srcData = src.data as Uint8ClampedArray;
  const dstData = dst.data as Uint8ClampedArray;

  const kh = kernel.rows;
  const kw = kernel.cols;
  const kdata = kernel.data as Uint8ClampedArray;
  const khy = Math.floor(kh / 2);
  const khx = Math.floor(kw / 2);

  for (let y = 0; y < src.rows; y++) {
    for (let x = 0; x < src.cols; x++) {
      let minVal = 255;

      for (let ky = 0; ky < kh; ky++) {
        for (let kx = 0; kx < kw; kx++) {
          // Skip if kernel element is 0
          if (kdata[ky * kw + kx] === 0) continue;

          const sy = y + ky - khy;
          const sx = x + kx - khx;

          // Boundary handling: treat out-of-bounds as 0 (black)
          if (sy < 0 || sy >= src.rows || sx < 0 || sx >= src.cols) {
            minVal = 0;
          } else {
            const val = srcData[sy * src.cols + sx];
            minVal = Math.min(minVal, val);
          }
        }
      }

      dstData[y * src.cols + x] = minVal;
    }
  }
}

/**
 * Dilate a binary image: for each pixel, set to maximum of neighborhood.
 *
 * This expands white (255) regions and fills small holes.
 *
 * Algorithm:
 *   For each pixel p in src where kernel has 1:
 *     dst[p] = max(src[q] for all q covered by kernel centered at p)
 */
function dilate(src: Mat, dst: Mat, kernel: Mat): void {
  if (src.channels() !== 1 || dst.channels() !== 1) {
    throw new Error('dilate expects single-channel input/output');
  }

  const srcData = src.data as Uint8ClampedArray;
  const dstData = dst.data as Uint8ClampedArray;

  const kh = kernel.rows;
  const kw = kernel.cols;
  const kdata = kernel.data as Uint8ClampedArray;
  const khy = Math.floor(kh / 2);
  const khx = Math.floor(kw / 2);

  for (let y = 0; y < src.rows; y++) {
    for (let x = 0; x < src.cols; x++) {
      let maxVal = 0;

      for (let ky = 0; ky < kh; ky++) {
        for (let kx = 0; kx < kw; kx++) {
          // Skip if kernel element is 0
          if (kdata[ky * kw + kx] === 0) continue;

          const sy = y + ky - khy;
          const sx = x + kx - khx;

          // Boundary handling: treat out-of-bounds as 0 (black)
          if (sy >= 0 && sy < src.rows && sx >= 0 && sx < src.cols) {
            const val = srcData[sy * src.cols + sx];
            maxVal = Math.max(maxVal, val);
          }
        }
      }

      dstData[y * src.cols + x] = maxVal;
    }
  }
}

/**
 * Morphological operation: OPEN = erode then dilate.
 *
 * Removes small white noise and thin structures while preserving larger objects.
 *
 * Used in preprocessing to erase connector lines before contour detection.
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md#D.2
 * Test: symbols.test.ts::test_m2a1_horizontal_line_erased
 */
export function morphologyEx(src: Mat, dst: Mat, op: number, kernel: Mat): void {
  if (op !== 2) {
    // op === 2 is MORPH_OPEN
    throw new Error(`morphologyEx: unsupported operation ${op}`);
  }

  if (src.channels() !== 1 || dst.channels() !== 1) {
    throw new Error('morphologyEx expects single-channel input/output');
  }

  // MORPH_OPEN = erode + dilate
  // Use temporary Mat for intermediate result
  const temp = new Mat(src.rows, src.cols, src.type);

  // Erode: src → temp
  erode(src, temp, kernel);

  // Dilate: temp → dst
  dilate(temp, dst, kernel);

  temp.delete();
}
