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
import { getStructuringElement, morphologyEx } from './morphology';
import { findContours, boundingRect, arcLength, contourArea, approxPolyDP, minEnclosingCircle } from './contours';
import { HoughLinesP } from './hough';
import { inpaint } from './inpaint';

// Phase 1 exports
export * from './types';
export { matFromImageData, cvtColor, threshold, subtract } from './matCore';

// Phase 2 exports
export { getStructuringElement, morphologyEx } from './morphology';

// Phase 3 exports
export { findContours, boundingRect, arcLength, contourArea, approxPolyDP, minEnclosingCircle } from './contours';

// Phase 4 exports
export { HoughLinesP } from './hough';

// Phase 5 exports
export { inpaint } from './inpaint';

/**
 * Create a namespace that mimics opencv.js for compatibility.
 * This is what gets returned from the loader.
 */
export const cv = {
  // Constants
  CV_8U: 0,
  CV_8UC1: 0,  // Single-channel 8-bit
  CV_8UC4: 24, // 4-channel 8-bit
  CV_32F: 5,   // 32-bit float
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

  // Classes and constructors
  Mat,
  MatVector,
  Size: function(width: any, height: any) { return { width, height }; },
  Rect: function(x: any, y: any, width: any, height: any) { return { x, y, width, height }; },
  Scalar: function(val: any) { return { val: [val, val, val, val] }; },

  // Phase 1: Core ops
  matFromImageData,
  cvtColor,
  threshold,
  subtract,

  // Phase 2: Morphology
  getStructuringElement,
  morphologyEx,

  // Phase 3: Contours
  findContours,
  boundingRect,
  arcLength,
  contourArea,
  approxPolyDP,
  minEnclosingCircle,

  // Phase 4: Line detection
  HoughLinesP,

  // Phase 5: Inpaint
  inpaint,
};

export default cv;
