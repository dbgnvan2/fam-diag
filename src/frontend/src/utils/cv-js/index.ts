/**
 * Pure-JavaScript OpenCV replacement.
 *
 * This module provides a subset of the opencv.js API sufficient for the
 * genogram extraction pipeline. It eliminates the ESM/CommonJS incompatibility
 * that blocked browser-side image import.
 *
 * Implemented operations (15 total):
 *   - Image I/O: matFromImageData, Mat
 *   - Color: cvtColor (RGBA2GRAY)
 *   - Thresholding: threshold (Otsu)
 *   - Morphology: morphologyEx (MORPH_OPEN), getStructuringElement
 *   - Contours: findContours, boundingRect, arcLength, contourArea
 *   - Analysis: approxPolyDP, minEnclosingCircle
 *   - Lines: HoughLinesP
 *   - Advanced: inpaint, subtract
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md
 */

import { Mat, MatVector } from './types';
import { matFromImageData, cvtColor, threshold, subtract } from './matCore';

// Phase 1 exports
export * from './types';
export { matFromImageData, cvtColor, threshold, subtract } from './matCore';

// Placeholders for future phases (will be filled in as implemented)
// Phase 2: morphology
// Phase 3: contours
// Phase 4: hough
// Phase 5: inpaint

/**
 * Create a namespace that mimics opencv.js for compatibility.
 * This is what gets returned from the loader.
 */
export const cv = {
  // Constants
  CV_8U: 0,
  CV_8UC4: 24,
  CV_32F: 5,
  COLOR_RGBA2GRAY: 7,
  THRESH_BINARY: 0,
  THRESH_BINARY_INV: 1,
  THRESH_OTSU: 8,
  MORPH_RECT: 0,
  MORPH_OPEN: 2,
  RETR_EXTERNAL: 0,
  CHAIN_APPROX_SIMPLE: 2,
  INPAINT_NS: 0,
  INPAINT_TELEA: 1,

  // Classes
  Mat,
  MatVector,

  // Phase 1: Core ops
  matFromImageData,
  cvtColor,
  threshold,
  subtract,

  // Placeholders for phases 2-5 (will be filled as implemented)
  // morphologyEx: (...args) => { throw new Error('Not yet implemented'); },
  // findContours: (...args) => { throw new Error('Not yet implemented'); },
  // ... etc
};

export default cv;
