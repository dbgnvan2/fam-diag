/**
 * Line detection via Hough transform (probabilistic variant).
 *
 * Detects straight lines in binary images by voting in Hough space.
 * Used to find connector lines (marriages, parent-child) and deceased X marks.
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md (Phase 4)
 */

import { Mat, LineSegment } from './types';

/**
 * Probabilistic Hough Line Transform.
 *
 * Parameters:
 *   image: single-channel binary image
 *   lines: output Mat (Nx4, x1,y1,x2,y2 per line)
 *   rho: distance resolution (pixels)
 *   theta: angle resolution (radians)
 *   threshold: votes required to detect a line
 *   minLineLength: minimum line length (pixels)
 *   maxLineGap: maximum gap between segments (pixels)
 *
 * Spec: docs/implementation_plan_2026-06-08-opencv-js.md#G.1
 * Test: connectors.test.ts::test_m8a1_detects_horizontal_couple_and_vertical_child
 */
export function HoughLinesP(
  image: Mat,
  lines: Mat,
  rho: number,
  theta: number,
  threshold: number,
  minLineLength: number,
  maxLineGap: number
): void {
  if (image.channels() !== 1) {
    throw new Error('HoughLinesP expects single-channel binary image');
  }

  const { rows: height, cols: width } = image;
  const data = image.data as Uint8ClampedArray;

  // Hough space dimensions
  const maxRho = Math.sqrt(height * height + width * width);
  const rhoCount = Math.ceil(maxRho / rho);
  const thetaCount = Math.ceil(Math.PI / theta);

  // Accumulator: vote array
  const accumulator = new Uint32Array(rhoCount * thetaCount);

  // Gather edge points and vote
  const edgePoints: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] !== 0) {
        edgePoints.push({ x, y });

        // Vote for all possible (rho, theta) pairs
        for (let t = 0; t < thetaCount; t++) {
          const thetaVal = t * theta;
          const cos_t = Math.cos(thetaVal);
          const sin_t = Math.sin(thetaVal);

          const rhoVal = x * cos_t + y * sin_t;
          const rhoIdx = Math.round((rhoVal + maxRho / 2) / rho);

          if (rhoIdx >= 0 && rhoIdx < rhoCount) {
            accumulator[rhoIdx * thetaCount + t]++;
          }
        }
      }
    }
  }

  // Extract lines from peaks in accumulator
  const detectedLines: LineSegment[] = [];

  for (let rhoIdx = 0; rhoIdx < rhoCount; rhoIdx++) {
    for (let thetaIdx = 0; thetaIdx < thetaCount; thetaIdx++) {
      const votes = accumulator[rhoIdx * thetaCount + thetaIdx];

      if (votes >= threshold) {
        const rhoVal = (rhoIdx - maxRho / 2 / rho) * rho;
        const thetaVal = thetaIdx * theta;

        // Group collinear edge points and form line segments
        const segments = groupCollinearPoints(
          edgePoints,
          rhoVal,
          thetaVal,
          maxLineLength,
          maxLineGap
        );

        for (const seg of segments) {
          if (euclideanDistance(seg.x1, seg.y1, seg.x2, seg.y2) >= minLineLength) {
            detectedLines.push(seg);
          }
        }
      }
    }
  }

  // Store lines in output Mat (Nx4, x1,y1,x2,y2)
  lines.rows = detectedLines.length;
  lines.cols = 4;
  lines.type = 5; // CV_32F
  lines.data = new Float32Array(detectedLines.length * 4);

  const outData = lines.data as Float32Array;
  for (let i = 0; i < detectedLines.length; i++) {
    const line = detectedLines[i];
    outData[i * 4 + 0] = line.x1;
    outData[i * 4 + 1] = line.y1;
    outData[i * 4 + 2] = line.x2;
    outData[i * 4 + 3] = line.y2;
  }
}

const maxLineLength = 1000; // Safety constant

/**
 * Group collinear edge points into line segments.
 *
 * Groups consecutive points that lie near the detected line,
 * then forms maximal line segments respecting minLineLength.
 */
function groupCollinearPoints(
  edgePoints: Array<{ x: number; y: number }>,
  rho: number,
  theta: number,
  maxGap: number,
  gap: number
): LineSegment[] {
  const cos_t = Math.cos(theta);
  const sin_t = Math.sin(theta);

  // Filter points near this line (distance to line < ~1 pixel)
  const onLine = edgePoints.filter((p) => {
    const dist = Math.abs(p.x * cos_t + p.y * sin_t - rho);
    return dist < 1.5;
  });

  if (onLine.length < 2) return [];

  // Sort by position along the line
  onLine.sort((a, b) => {
    return a.x * cos_t + a.y * sin_t - (b.x * cos_t + b.y * sin_t);
  });

  // Group into segments respecting maxGap
  const segments: LineSegment[] = [];
  let start = 0;

  for (let i = 1; i < onLine.length; i++) {
    const dist = euclideanDistance(onLine[i].x, onLine[i].y, onLine[i - 1].x, onLine[i - 1].y);

    if (dist > gap) {
      // Gap found, finalize previous segment
      if (i - start >= 2) {
        segments.push({
          x1: onLine[start].x,
          y1: onLine[start].y,
          x2: onLine[i - 1].x,
          y2: onLine[i - 1].y,
        });
      }
      start = i;
    }
  }

  // Final segment
  if (onLine.length - start >= 2) {
    segments.push({
      x1: onLine[start].x,
      y1: onLine[start].y,
      x2: onLine[onLine.length - 1].x,
      y2: onLine[onLine.length - 1].y,
    });
  }

  return segments;
}

/**
 * Euclidean distance between two points.
 */
function euclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}
