/**
 * Mask out the detected X strokes and inpaint the holes so the interior
 * letter is left intact for OCR.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M5
 *
 * Tunable parameter X_MASK_THICKNESS controls how wide a band along each
 * detected diagonal we erase. Thicker = more reliable X removal but more
 * letter-stroke collateral damage. Default 5 was set per the user's spec.
 */

import { loadCv } from '../cvLoader';
import type { CvMat } from './preprocess';

export const DEFAULT_X_MASK_THICKNESS = 5;

export type RemoveXOptions = {
  thickness?: number;
};

export async function removeXStrokes(
  crop: CvMat,
  angles: { angleA: number; angleB: number },
  opts: RemoveXOptions = {}
): Promise<CvMat> {
  const cv = (await loadCv()) as unknown as XRemoveCv;
  const thickness = opts.thickness ?? DEFAULT_X_MASK_THICKNESS;
  const w = crop.cols;
  const h = crop.rows;

  // Build a single-channel mask the same size as the crop, with the two
  // diagonal stripes drawn in white. cv.inpaint will fill those pixels
  // using the surrounding context (cv.INPAINT_TELEA).
  const mask = new cv.Mat(h, w, cv.CV_8UC1, new cv.Scalar(0));
  drawLineByAngle(cv, mask, angles.angleA, w, h, thickness);
  drawLineByAngle(cv, mask, angles.angleB, w, h, thickness);

  const cleaned = new cv.Mat();
  cv.inpaint(crop, mask, cleaned, thickness, cv.INPAINT_TELEA);
  mask.delete();
  return cleaned;
}

function drawLineByAngle(
  cv: XRemoveCv,
  mask: CvMat,
  angle: number,
  w: number,
  h: number,
  thickness: number
): void {
  // Draw a line through the center of the crop at the given angle, spanning
  // the longer dimension. Endpoints are clamped to the bounding box.
  const cx = w / 2;
  const cy = h / 2;
  const len = Math.max(w, h);
  const dx = Math.cos(angle) * len;
  const dy = Math.sin(angle) * len;
  const p1 = { x: Math.round(cx - dx), y: Math.round(cy - dy) };
  const p2 = { x: Math.round(cx + dx), y: Math.round(cy + dy) };
  cv.line(mask, p1, p2, new cv.Scalar(255, 255, 255, 255), thickness, cv.LINE_8, 0);
}

interface XRemoveCv {
  Mat: { new (rows?: number, cols?: number, type?: number, scalar?: object): CvMat };
  Scalar: { new (...vals: number[]): object };
  line(
    img: CvMat,
    pt1: { x: number; y: number },
    pt2: { x: number; y: number },
    color: object,
    thickness: number,
    lineType: number,
    shift: number
  ): void;
  inpaint(src: CvMat, mask: CvMat, dst: CvMat, radius: number, flags: number): void;
  CV_8UC1: number;
  INPAINT_TELEA: number;
  LINE_8: number;
}
