/**
 * Contour detection and analysis operations.
 *
 * Core algorithm: 8-connectivity contour tracing via flood-fill.
 * Analyzes contours via geometry (perimeter, area, circularity, corners).
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md (Phase 3)
 */

import { Mat, MatVector, CV_8U, Point, Circle } from './types';

/**
 * Find contours in a binary image.
 *
 * Algorithm: 8-connectivity contour tracing.
 * For each white (255) pixel not yet visited, start a new contour by
 * tracing the boundary using 8-connected neighbors.
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md#E.1
 * Test: symbols.test.ts::test_m2a2_detects_three_separate_shapes
 */
export function findContours(
  image: Mat,
  contours: MatVector,
  hierarchy: Mat,
  mode: number, // RETR_EXTERNAL
  method: number // CHAIN_APPROX_SIMPLE
): void {
  if (image.channels() !== 1) {
    throw new Error('findContours expects single-channel binary image');
  }

  const data = image.data as Uint8ClampedArray;
  const visited = new Set<number>();
  const { rows, cols } = image;

  // Find all contours by scanning top-to-bottom, left-to-right
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x;
      if (data[idx] !== 0 && !visited.has(idx)) {
        // Start a new contour from this white pixel
        const contour = traceContour(image, x, y, visited);
        if (contour.length > 0) {
          // Store contour as a Mat (Nx1, 2 channels per point: x,y)
          const contourMat = new Mat(contour.length, 1, CV_8U);
          // Store as interleaved x,y values in the data
          for (let i = 0; i < contour.length; i++) {
            contourMat.data[i * 2] = contour[i].x;
            contourMat.data[i * 2 + 1] = contour[i].y;
          }
          (contourMat as any).contourPoints = contour; // Store original points
          contours.push_back(contourMat);
        }
      }
    }
  }
}

/**
 * Trace a contour starting from (x, y) using 8-connected neighbors.
 * Uses Moore-neighbor contour tracing algorithm.
 */
function traceContour(image: Mat, startX: number, startY: number, visited: Set<number>): Point[] {
  const { rows, cols } = image;
  const data = image.data as Uint8ClampedArray;
  const contour: Point[] = [];

  // 8-connected neighbors in order (start from right, go clockwise)
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  let x = startX;
  let y = startY;
  let direction = 0; // Start searching to the right

  const firstIdx = y * cols + x;
  visited.add(firstIdx);
  contour.push({ x, y });

  // Trace the boundary
  let steps = 0;
  const maxSteps = rows * cols * 10; // Safety limit

  while (steps < maxSteps) {
    steps++;
    let found = false;

    // Search for next contour point in 8-connected neighbors
    for (let i = 0; i < 8; i++) {
      const dir = (direction + i) % 8;
      const nx = x + dx[dir];
      const ny = y + dy[dir];

      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        const nidx = ny * cols + nx;
        if (data[nidx] !== 0 && !visited.has(nidx)) {
          visited.add(nidx);
          contour.push({ x: nx, y: ny });
          x = nx;
          y = ny;
          direction = dir;
          found = true;
          break;
        }
      }
    }

    if (!found) break;
    if (x === startX && y === startY && contour.length > 2) break;
  }

  return contour;
}

/**
 * Get the bounding rectangle of a contour.
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md#E.3
 */
export function boundingRect(contour: Mat): { x: number; y: number; width: number; height: number } {
  const points = (contour as any).contourPoints as Point[] || parseContourPoints(contour);

  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Calculate the perimeter of a contour (sum of edge lengths).
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md#F.1
 */
export function arcLength(curve: Mat, closed: boolean): number {
  const points = (curve as any).contourPoints as Point[] || parseContourPoints(curve);

  if (points.length < 2) return 0;

  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }

  if (closed && points.length > 1) {
    const dx = points[0].x - points[points.length - 1].x;
    const dy = points[0].y - points[points.length - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }

  return length;
}

/**
 * Calculate the area enclosed by a contour (shoelace formula).
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md#F.2
 */
export function contourArea(contour: Mat): number {
  const points = (contour as any).contourPoints as Point[] || parseContourPoints(contour);

  if (points.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area) / 2;
}

/**
 * Simplify a polygon using Ramer-Douglas-Peucker algorithm.
 *
 * Reduces the number of points while staying within epsilon distance of the original contour.
 * Used to count corners (3 → triangle, 4 → square, etc).
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md#F.4
 */
export function approxPolyDP(
  curve: Mat,
  approxCurve: Mat,
  epsilon: number,
  closed: boolean
): void {
  const points = (curve as any).contourPoints as Point[] || parseContourPoints(curve);

  if (points.length < 2) {
    approxCurve.rows = 0;
    return;
  }

  const simplified = rdpSimplify(points, epsilon, closed);

  // Store simplified points in approxCurve
  approxCurve.rows = simplified.length;
  approxCurve.cols = 1;
  (approxCurve as any).contourPoints = simplified;
}

/**
 * Ramer-Douglas-Peucker polygon simplification.
 */
function rdpSimplify(points: Point[], epsilon: number, closed: boolean): Point[] {
  if (points.length <= 2) return points;

  const start = 0;
  const end = closed ? points.length : points.length - 1;

  return rdpSimplifyRecursive(points, start, end, epsilon);
}

function rdpSimplifyRecursive(points: Point[], start: number, end: number, epsilon: number): Point[] {
  let maxDist = 0;
  let maxIdx = 0;

  const p1 = points[start];
  const p2 = points[end % points.length];

  for (let i = start + 1; i < end; i++) {
    const dist = pointToLineDistance(points[i], p1, p2);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplifyRecursive(points, start, maxIdx, epsilon);
    const right = rdpSimplifyRecursive(points, maxIdx, end, epsilon);
    return left.slice(0, -1).concat(right);
  } else {
    return [p1, p2];
  }
}

/**
 * Distance from point to line segment.
 */
function pointToLineDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));

  const cx = a.x + t * dx;
  const cy = a.y + t * dy;

  const pdx = p.x - cx;
  const pdy = p.y - cy;

  return Math.sqrt(pdx * pdx + pdy * pdy);
}

/**
 * Find the smallest circle enclosing a set of points (Welzl's algorithm).
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md#F.3
 */
export function minEnclosingCircle(contour: Mat): Circle {
  const points = (contour as any).contourPoints as Point[] || parseContourPoints(contour);

  if (points.length === 0) {
    return { center: { x: 0, y: 0 }, radius: 0 };
  }

  // Welzl's algorithm - randomized O(n) expected time
  const shuffled = [...points].sort(() => Math.random() - 0.5);
  let circle = welzlCircle(shuffled, [], 0);

  return circle;
}

/**
 * Welzl's smallest enclosing circle algorithm.
 */
function welzlCircle(points: Point[], boundary: Point[], idx: number): Circle {
  // Base case: 0 or 3 boundary points
  if (idx === points.length || boundary.length === 3) {
    if (boundary.length === 0) {
      return { center: { x: 0, y: 0 }, radius: 0 };
    } else if (boundary.length === 1) {
      return { center: boundary[0], radius: 0 };
    } else if (boundary.length === 2) {
      return circleFrom2Points(boundary[0], boundary[1]);
    } else {
      return circleFrom3Points(boundary[0], boundary[1], boundary[2]);
    }
  }

  const p = points[idx];
  const circle = welzlCircle(points, boundary, idx + 1);

  // Check if p is inside circle
  const dx = p.x - circle.center.x;
  const dy = p.y - circle.center.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > circle.radius + 1e-10) {
    // p is outside, need to recompute
    return welzlCircle(points, [...boundary, p], idx + 1);
  }

  return circle;
}

/**
 * Smallest circle through two points (diameter).
 */
function circleFrom2Points(p1: Point, p2: Point): Circle {
  const cx = (p1.x + p2.x) / 2;
  const cy = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const radius = Math.sqrt(dx * dx + dy * dy) / 2;

  return { center: { x: cx, y: cy }, radius };
}

/**
 * Smallest circle through three points (circumcircle if acute, else diameter).
 */
function circleFrom3Points(p1: Point, p2: Point, p3: Point): Circle {
  // Circumcircle of triangle
  const ax = p1.x;
  const ay = p1.y;
  const bx = p2.x;
  const by = p2.y;
  const cx = p3.x;
  const cy = p3.y;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));

  if (Math.abs(d) < 1e-10) {
    // Degenerate (collinear), use 2-point circle
    return circleFrom2Points(p1, p2);
  }

  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

  const radius = Math.sqrt((ax - ux) * (ax - ux) + (ay - uy) * (ay - uy));

  return { center: { x: ux, y: uy }, radius };
}

/**
 * Helper: parse contour points from Mat storage.
 */
function parseContourPoints(mat: Mat): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < mat.rows; i++) {
    points.push({
      x: mat.data[i * 2],
      y: mat.data[i * 2 + 1],
    });
  }
  return points;
}
