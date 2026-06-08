/**
 * Symbol detection — find each enclosed contour in the preprocessed binary
 * after erasing the thin straight connector lines.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M2
 */

import { loadCv } from '../cvLoader';
import type { CvMat } from './preprocess';

export type BBox = { x: number; y: number; w: number; h: number };

export type SymbolCandidate = {
  id: string;
  bbox: BBox;
  area: number;
  perimeter: number;
  /** Pixel-level approximation of the contour outline. Indexes into the original Mat. */
  contourPoints: Array<{ x: number; y: number }>;
  /**
   * Polygon vertex count via cv.approxPolyDP — far more reliable than
   * counting angle changes ourselves on wobbly hand-drawn input. 3 ≈
   * triangle, 4–5 ≈ square, 8+ ≈ circle.
   */
  approxVertices: number;
  /**
   * Ratio of the contour area to the area of its minimum enclosing circle.
   * A perfect circle is 1.0; a square (inscribed in its bounding circle)
   * is ≈ 0.637. The cleanest signal for circle-vs-square discrimination on
   * hand-drawn input — better than circularity, which is noisy on a wobbly
   * perimeter.
   */
  circleFillRatio: number;
};

/**
 * Erase thin horizontal and vertical connector lines from a binary image,
 * leaving the enclosed shapes intact. Uses morphological opening with a
 * long thin structuring element to "find" the lines, then subtracts them.
 *
 * Spec: M2.A.1
 */
export async function eraseConnectorLines(binary: CvMat): Promise<CvMat> {
  const cv = (await loadCv()) as unknown as SymbolsCv;

  const eraseLineByOrientation = (width: number, height: number) => {
    // cv.getStructuringElement expects a cv.Size, not a plain {w,h} object —
    // the Emscripten binding throws "Missing field" otherwise.
    const sz = new cv.Size(width, height);
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, sz);
    const linesMat = new cv.Mat();
    cv.morphologyEx(binary, linesMat, cv.MORPH_OPEN, kernel);
    cv.subtract(binary, linesMat, binary);
    linesMat.delete();
    kernel.delete();
  };

  // Horizontal lines (couple lines, child-row connector): wide-and-short kernel.
  eraseLineByOrientation(40, 1);
  // Vertical lines (parent → child drops): short-and-tall kernel.
  eraseLineByOrientation(1, 40);

  return binary;
}

/**
 * Detect all enclosed contours and return their bounding boxes + outline
 * geometry.
 *
 * Spec: M2.A.2
 */
export async function detectSymbolContours(binary: CvMat): Promise<SymbolCandidate[]> {
  const cv = (await loadCv()) as unknown as SymbolsCv;

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  const out: SymbolCandidate[] = [];
  const total = contours.size();
  for (let i = 0; i < total; i++) {
    const contour = contours.get(i);
    const rect = cv.boundingRect(contour);
    const area = cv.contourArea(contour);
    const perimeter = cv.arcLength(contour, true);

    // Filter: empirically tuned on the Jennies Boy fixture to produce 21–24
    // candidates from a 545-contour input (target: 24 reference persons).
    // Tested in genogram-filter.mjs.
    //
    //  - min 20×20: rejects pen-dot noise and stray letter fragments
    //  - fillRatio ≥ 0.3: rejects thin line segments where the contour's
    //    enclosed area is tiny compared to its bounding box
    //  - aspect ≤ 2.5: rejects long thin shapes (residual connector
    //    fragments after morphological erasure)
    const bboxArea = rect.width * rect.height;
    const fillRatio = bboxArea > 0 ? area / bboxArea : 0;
    const aspect =
      Math.max(rect.width, rect.height) /
      Math.max(1, Math.min(rect.width, rect.height));
    const passesFilter =
      rect.width >= 20 &&
      rect.height >= 20 &&
      rect.width <= 300 &&
      rect.height <= 300 &&
      fillRatio >= 0.3 &&
      aspect <= 2.5;
    if (!passesFilter) {
      contour.delete?.();
      continue;
    }

    const points: Array<{ x: number; y: number }> = [];
    const data32S = contour.data32S as Int32Array | undefined;
    if (data32S) {
      for (let p = 0; p < data32S.length; p += 2) {
        points.push({ x: data32S[p], y: data32S[p + 1] });
      }
    }

    // Polygon approximation: epsilon = 1.5% of perimeter. The OpenCV docs
    // suggest 1-5%; the lower end keeps enough detail to distinguish a
    // hand-drawn circle (8+ vertices) from a square (4-5).
    const approx = new cv.Mat();
    cv.approxPolyDP(contour, approx, 0.015 * perimeter, true);
    const approxVertices = (approx.rows ?? approx.cols ?? 0) || ((approx.data32S as Int32Array | undefined)?.length ?? 0) / 2;
    approx.delete();

    // minEnclosingCircle → area / πr². Perfect circle = 1.0, square ≈ 0.64.
    let circleFillRatio = 0;
    try {
      const enclosing = cv.minEnclosingCircle(contour);
      const r = enclosing.radius;
      if (r > 0) {
        circleFillRatio = area / (Math.PI * r * r);
      }
    } catch {
      // Some builds throw on degenerate contours — leave at 0.
    }

    out.push({
      id: `sym-${i}`,
      bbox: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      area,
      perimeter,
      contourPoints: points,
      approxVertices,
      circleFillRatio,
    });
    contour.delete?.();
  }
  contours.delete();
  hierarchy.delete();

  // Order top-to-bottom, then left-to-right — needed by the auto-naming pass
  // ("Male 1", "Male 2", …) downstream so numbering matches the user's
  // reading order on the page.
  out.sort((a, b) => {
    const yDiff = a.bbox.y - b.bbox.y;
    if (Math.abs(yDiff) > 20) return yDiff;
    return a.bbox.x - b.bbox.x;
  });
  out.forEach((c, i) => {
    c.id = `sym-${i}`;
  });
  return out;
}

/**
 * Manual override: take user-supplied bounding boxes and produce candidates
 * with synthetic geometry (rectangle assumed). Skips the contour-finding step
 * entirely.
 *
 * Spec: M2.A.3
 */
export function candidatesFromManualBBoxes(bboxes: BBox[]): SymbolCandidate[] {
  return bboxes.map((bbox, i) => ({
    id: `manual-${i}`,
    bbox,
    area: bbox.w * bbox.h,
    perimeter: 2 * (bbox.w + bbox.h),
    contourPoints: [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.w, y: bbox.y },
      { x: bbox.x + bbox.w, y: bbox.y + bbox.h },
      { x: bbox.x, y: bbox.y + bbox.h },
    ],
    approxVertices: 4, // manual bboxes are assumed to be rectangles
    // For a square inscribed in its bounding circle: area / (π·r²) ≈ 0.637.
    circleFillRatio: 0.637,
  }));
}

interface CvMatVector {
  get(i: number): CvContour;
  size(): number;
  delete(): void;
}

interface SymbolsCv {
  Mat: { new (): CvMat & { rows?: number; cols?: number; data32S?: Int32Array } };
  MatVector: { new (): CvMatVector };
  Size: { new (width: number, height: number): { width: number; height: number } };
  getStructuringElement(shape: number, size: { width: number; height: number }): CvMat;
  morphologyEx(src: CvMat, dst: CvMat, op: number, kernel: CvMat): void;
  subtract(src1: CvMat, src2: CvMat, dst: CvMat): void;
  findContours(
    src: CvMat,
    contours: CvMatVector,
    hierarchy: CvMat,
    mode: number,
    method: number
  ): void;
  boundingRect(contour: CvContour): { x: number; y: number; width: number; height: number };
  contourArea(contour: CvContour): number;
  arcLength(contour: CvContour, closed: boolean): number;
  approxPolyDP(contour: CvContour, dst: CvMat, epsilon: number, closed: boolean): void;
  minEnclosingCircle(contour: CvContour): { center: { x: number; y: number }; radius: number };
  MORPH_RECT: number;
  MORPH_OPEN: number;
  RETR_EXTERNAL: number;
  CHAIN_APPROX_SIMPLE: number;
}

interface CvContour {
  data32S?: Int32Array;
  delete?: () => void;
}
