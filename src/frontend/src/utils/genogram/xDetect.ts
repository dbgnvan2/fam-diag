/**
 * Detect whether a symbol crop has an X drawn through it.
 *
 * Strategy: run a Hough line transform on the cropped binary image, look for
 * two long line segments near +45° and −45° that span at least 60% of the
 * crop's smaller dimension.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M4
 */

import { loadCv } from '../cvLoader';
import type { CvMat } from './preprocess';

export type XDetectionResult = {
  is_dead: boolean;
  /** Angle (radians) of the +45°-ish stroke, if found. */
  angleA?: number;
  /** Angle (radians) of the −45°-ish stroke, if found. */
  angleB?: number;
};

const FORTY_FIVE = Math.PI / 4;
const ANGLE_TOLERANCE = (15 * Math.PI) / 180; // ±15°

export async function detectXThroughSymbol(crop: CvMat): Promise<XDetectionResult> {
  const cv = (await loadCv()) as unknown as XDetectCv;
  const lines = new cv.Mat();

  // Probabilistic Hough — gives line *segments* (with endpoints) which is
  // what we need to check span vs. crop size.
  const minLen = Math.floor(Math.min(crop.rows, crop.cols) * 0.6);
  cv.HoughLinesP(crop, lines, 1, Math.PI / 180, 30, minLen, 8);

  let foundA: number | undefined; //  +45°-ish
  let foundB: number | undefined; //  −45°-ish
  const data32S = lines.data32S as Int32Array | undefined;
  if (data32S) {
    for (let i = 0; i < data32S.length; i += 4) {
      const x1 = data32S[i];
      const y1 = data32S[i + 1];
      const x2 = data32S[i + 2];
      const y2 = data32S[i + 3];
      const angle = Math.atan2(y2 - y1, x2 - x1);
      // Normalize to [-π/2, π/2] — direction-agnostic.
      const a = angle > Math.PI / 2 ? angle - Math.PI : angle < -Math.PI / 2 ? angle + Math.PI : angle;

      if (foundA === undefined && Math.abs(a - FORTY_FIVE) <= ANGLE_TOLERANCE) {
        foundA = a;
      } else if (foundB === undefined && Math.abs(a - -FORTY_FIVE) <= ANGLE_TOLERANCE) {
        foundB = a;
      }
      if (foundA !== undefined && foundB !== undefined) break;
    }
  }
  lines.delete();

  return {
    is_dead: foundA !== undefined && foundB !== undefined,
    angleA: foundA,
    angleB: foundB,
  };
}

interface XDetectCv {
  Mat: { new (): CvMat & { data32S?: Int32Array } };
  HoughLinesP(
    src: CvMat,
    lines: CvMat,
    rho: number,
    theta: number,
    threshold: number,
    minLineLength: number,
    maxLineGap: number
  ): void;
}
