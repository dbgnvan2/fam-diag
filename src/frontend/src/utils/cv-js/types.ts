/**
 * Type definitions for pure-JS OpenCV replacement.
 * Mirrors opencv.js API surface.
 */

/** Mat type constants */
export const CV_8U = 0;   // 8-bit unsigned single channel
export const CV_8UC4 = 24; // 8-bit unsigned 4-channel (RGBA)
export const CV_32F = 5;   // 32-bit float single channel

/** Color conversion constants */
export const COLOR_RGBA2GRAY = 7;

/** Threshold flags */
export const THRESH_BINARY = 0;
export const THRESH_BINARY_INV = 1;
export const THRESH_OTSU = 8;

/** Morphology constants */
export const MORPH_RECT = 0;
export const MORPH_OPEN = 2;

/** Contour retrieval modes */
export const RETR_EXTERNAL = 0;

/** Contour approximation methods */
export const CHAIN_APPROX_SIMPLE = 2;

/** Hough line detection constants */
export const LINE_4 = 4;
export const LINE_8 = 8;
export const LINE_AA = 16;

/** Inpaint methods */
export const INPAINT_NS = 0;
export const INPAINT_TELEA = 1;

/**
 * Size object { width: number, height: number }
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * Rect object { x, y, width, height }
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Point { x, y }
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Scalar value [v0, v1, v2, v3]
 */
export interface Scalar {
  val: [number, number, number, number];
}

/**
 * Circle { center: Point, radius: number }
 */
export interface Circle {
  center: Point;
  radius: number;
}

/**
 * Line segment { x1, y1, x2, y2 }
 */
export interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Mat — n-dimensional matrix
 */
export class Mat {
  rows: number;
  cols: number;
  type: number;
  channels_: number;
  data: Uint8ClampedArray | Float32Array;
  private elemSize_: number;

  constructor(rows?: number, cols?: number, type?: number, data?: Uint8ClampedArray | Float32Array | any) {
    // Support no-arg constructor (opencv.js compatibility)
    if (rows === undefined) {
      this.rows = 0;
      this.cols = 0;
      this.type = CV_8U;
      this.channels_ = 1;
      this.elemSize_ = 1;
      this.data = new Uint8ClampedArray(0);
      return;
    }

    if (cols === undefined || type === undefined) {
      throw new Error('Mat constructor requires rows, cols, and type arguments (or no arguments)');
    }

    // Support Scalar as 4th argument (opencv.js compatibility) - just ignore it
    // If data looks like a Scalar object (has 'val' property), treat as no data
    if (data && typeof data === 'object' && 'val' in data) {
      data = undefined;
    }

    this.rows = rows;
    this.cols = cols;
    this.type = type;

    // Determine channel count and element size from type
    if (type === CV_8UC4) {
      this.channels_ = 4;
      this.elemSize_ = 4;
    } else if (type === CV_32F || type === CV_8U) {
      this.channels_ = 1;
      this.elemSize_ = type === CV_32F ? 4 : 1;
    } else {
      throw new Error(`Unsupported Mat type: ${type}`);
    }

    const totalSize = rows * cols * this.elemSize_;

    if (data) {
      this.data = data;
    } else if (type === CV_32F) {
      this.data = new Float32Array(totalSize);
    } else {
      this.data = new Uint8ClampedArray(totalSize);
    }
  }

  channels(): number {
    return this.channels_;
  }

  elemSize(): number {
    return this.elemSize_;
  }

  /**
   * Get pixel value at (row, col).
   * For single-channel: returns [value]
   * For 4-channel: returns [r, g, b, a]
   */
  at(row: number, col: number): number[] {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      throw new Error(`Index out of bounds: (${row}, ${col}) in ${this.rows}×${this.cols}`);
    }

    const offset = (row * this.cols + col) * this.elemSize_;

    if (this.channels_ === 1) {
      return [this.data[offset]];
    } else if (this.channels_ === 4) {
      return [
        this.data[offset],
        this.data[offset + 1],
        this.data[offset + 2],
        this.data[offset + 3],
      ];
    }

    return [];
  }

  /**
   * Set pixel value at (row, col).
   */
  set(row: number, col: number, ...values: number[]): void {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      throw new Error(`Index out of bounds: (${row}, ${col}) in ${this.rows}×${this.cols}`);
    }

    const offset = (row * this.cols + col) * this.elemSize_;

    for (let i = 0; i < Math.min(values.length, this.elemSize_); i++) {
      this.data[offset + i] = values[i];
    }
  }

  /**
   * Clone this Mat
   */
  clone(): Mat {
    const newData = new (this.data.constructor as any)(this.data) as Uint8ClampedArray | Float32Array;
    return new Mat(this.rows, this.cols, this.type, newData);
  }

  /**
   * Extract a region of interest (rectangular submatrix).
   *
   * Returns a new Mat containing pixels from [y, y+h) × [x, x+w).
   * In OpenCV, this is implemented as a view, but we copy for simplicity.
   */
  roi(rect: { x: number; y: number; width: number; height: number }): Mat {
    const { x, y, width: w, height: h } = rect;

    if (x < 0 || y < 0 || x + w > this.cols || y + h > this.rows) {
      throw new Error(`ROI out of bounds: x=${x} y=${y} w=${w} h=${h} in ${this.rows}×${this.cols}`);
    }

    // Create new Mat for the region
    const roiMat = new Mat(h, w, this.type);

    // Copy pixel data from source to ROI
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const srcIdx = (y + row) * this.cols + (x + col);
        const dstIdx = row * w + col;

        for (let c = 0; c < this.channels_; c++) {
          roiMat.data[dstIdx * this.channels_ + c] = this.data[srcIdx * this.channels_ + c];
        }
      }
    }

    return roiMat;
  }

  /**
   * Delete this Mat (free memory). No-op in JS but needed for API compatibility.
   */
  delete(): void {
    // No-op in pure JS
  }
}

/**
 * MatVector — container for multiple Mats (contours)
 */
export class MatVector {
  mats: Mat[] = [];

  push_back(mat: Mat): void {
    this.mats.push(mat);
  }

  size(): number {
    return this.mats.length;
  }

  get(index: number): Mat {
    return this.mats[index];
  }

  delete(): void {
    // No-op in pure JS
  }
}

/**
 * Utility: create a Mat filled with zeros
 */
export function matZeros(rows: number, cols: number, type: number): Mat {
  const mat = new Mat(rows, cols, type);
  mat.data.fill(0);
  return mat;
}

/**
 * Utility: create a Mat filled with a constant value
 */
export function matFilled(rows: number, cols: number, type: number, value: number): Mat {
  const mat = new Mat(rows, cols, type);
  mat.data.fill(value);
  return mat;
}
