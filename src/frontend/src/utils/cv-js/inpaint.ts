/**
 * Image inpainting (hole filling) via diffusion.
 *
 * Reconstructs pixels in masked regions using surrounding context.
 * Used to remove deceased X marks before letter OCR.
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md (Phase 5)
 */

import { Mat } from './types';

/**
 * Inpaint (fill) masked regions using diffusion.
 *
 * Parameters:
 *   image: input image (must be pre-copied to output)
 *   mask: mask where 255 = pixels to inpaint, 0 = keep as-is
 *   dst: output image
 *   radius: ignored (for API compatibility)
 *   flags: inpaint method (ignored, always uses simple diffusion)
 *
 * Algorithm: Simple iterative diffusion (Laplacian smoothing).
 * For each masked pixel, average its non-masked neighbors.
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md#H.1
 * Test: xRemove.test.ts::test_m5a1_removes_synthetic_x_keeps_letter
 */
export function inpaint(
  image: Mat,
  mask: Mat,
  dst: Mat,
  _radius: number,
  _flags: number
): void {
  if (image.channels() !== 1 || mask.channels() !== 1 || dst.channels() !== 1) {
    throw new Error('inpaint expects single-channel inputs');
  }

  if (image.rows !== mask.rows || image.cols !== mask.cols) {
    throw new Error('inpaint: image and mask must have same dimensions');
  }

  if (dst.rows !== image.rows || dst.cols !== image.cols) {
    throw new Error('inpaint: dst must be same size as image');
  }

  const { rows, cols } = image;
  const imageData = image.data as Uint8ClampedArray;
  const maskData = mask.data as Uint8ClampedArray;
  const dstData = dst.data as Uint8ClampedArray;

  // Copy image to dst
  dstData.set(imageData);

  // Iterative diffusion: smooth masked regions
  const iterations = 10;

  for (let iter = 0; iter < iterations; iter++) {
    const temp = new Uint8ClampedArray(dstData);

    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const idx = y * cols + x;

        // Only process masked pixels (255 = inpaint, 0 = keep)
        if (maskData[idx] === 255) {
          // Average 4-connected neighbors that are not masked
          let sum = 0;
          let count = 0;

          for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const ny = y + dy;
            const nx = x + dx;
            const nidx = ny * cols + nx;

            // Prefer non-masked neighbors; fall back to any neighbor
            if (maskData[nidx] === 0) {
              sum += temp[nidx];
              count++;
            }
          }

          // If no non-masked neighbors, use any neighbor
          if (count === 0) {
            for (const [dy, dx] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
              const ny = y + dy;
              const nx = x + dx;
              const nidx = ny * cols + nx;
              sum += temp[nidx];
              count++;
            }
          }

          dstData[idx] = Math.round(sum / count);
        }
      }
    }
  }
}
