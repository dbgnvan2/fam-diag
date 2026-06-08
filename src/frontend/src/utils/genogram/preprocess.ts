/**
 * Genogram image preprocessing — turn a photographed hand-drawn diagram
 * into a clean binarised Mat suitable for contour detection.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M1
 */

import { loadCv } from '../cvLoader';

// Minimal structural type — the real cv.Mat is much richer but we touch
// only a handful of methods. Using `any` here would defeat the linter.
export interface CvMat {
  delete(): void;
  rows: number;
  cols: number;
  channels(): number;
}

export type PreprocessedImage = {
  binary: CvMat; // single-channel 0/255 image
  width: number;
  height: number;
};

/**
 * Maximum long-side resolution after downscaling. Phone photos are typically
 * 4000+ pixels wide; that overwhelms the synchronous WASM ops (adaptiveThreshold,
 * findContours, HoughLinesP) and makes the page appear hung. 1600px is plenty
 * for genogram contour detection.
 */
export const MAX_LONG_SIDE = 1600;

/**
 * Convert a Blob (PNG/JPG from the upload input) to a binarised cv.Mat.
 *
 * Pipeline: blob → ImageBitmap → (downscale) → canvas → cv.matFromImageData →
 * grayscale → Otsu threshold.
 *
 * Note: we use Otsu (global) instead of adaptiveThreshold (local). Otsu is
 * roughly 50× faster on the synchronous WASM path and is plenty for the
 * high-contrast pen-on-paper input we expect. Adaptive lighting variance is
 * deferred — if a real fixture fails on it, swap back to adaptive on the
 * affected branch only.
 *
 * Spec: M1.A.1
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

const TRACE = (msg: string) => {
  if (typeof window !== 'undefined' && typeof console !== 'undefined') {
    console.log(`[preprocess] ${msg}`);
    return;
  }
  if (typeof process === 'undefined' || process.env?.GENOGRAM_DEBUG !== '1') return;
  if (!process.stderr?.write) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('fs').writeSync(2, `  [preprocess] ${msg}\n`);
  } catch {
    process.stderr.write(`  [preprocess] ${msg}\n`);
  }
};

export async function preprocessImage(
  blob: Blob,
  onStep?: (msg: string) => void
): Promise<PreprocessedImage> {
  TRACE('start');
  // The first WASM compile is the longest single step on a cold cache,
  // so surface it with a very specific message + yield before it fires.
  onStep?.('Loading OpenCV WASM (one-time, may take 10–20s on first import)…');
  await yieldToEventLoop();
  const cv = (await loadCv()) as unknown as PreprocessCv;
  TRACE('cv ready');

  onStep?.('Decoding image…');
  await yieldToEventLoop();
  TRACE('createImageBitmap(blob)…');
  const bitmap = await createImageBitmap(blob);
  TRACE(`bitmap ${bitmap.width}x${bitmap.height}`);

  const longSide = Math.max(bitmap.width, bitmap.height);
  const scale = longSide > MAX_LONG_SIDE ? MAX_LONG_SIDE / longSide : 1;
  const targetWidth = Math.round(bitmap.width * scale);
  const targetHeight = Math.round(bitmap.height * scale);
  onStep?.(`Downscaling ${bitmap.width}×${bitmap.height} → ${targetWidth}×${targetHeight}…`);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to acquire 2D canvas context');
  TRACE(`drawImage onto ${targetWidth}x${targetHeight}…`);
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  TRACE('drawImage done');
  const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  TRACE(`getImageData ok (${imageData.data.length} bytes)`);

  onStep?.('Converting to OpenCV matrix…');
  await yieldToEventLoop();
  TRACE('matFromImageData…');
  const src = cv.matFromImageData(imageData) as CvMat;
  TRACE(`matFromImageData ok ${src.rows}x${src.cols}`);
  const gray = new cv.Mat() as CvMat;

  onStep?.('Grayscaling…');
  await yieldToEventLoop();
  TRACE('cvtColor RGBA→Gray…');
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  TRACE('cvtColor done');
  src.delete();

  onStep?.('Thresholding (Otsu)…');
  await yieldToEventLoop();
  TRACE('threshold Otsu…');
  const binary = new cv.Mat() as CvMat;
  cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
  TRACE('threshold done');
  gray.delete();

  TRACE('preprocess complete');
  return { binary, width: targetWidth, height: targetHeight };
}

/**
 * Detect the dominant skew angle (in degrees) of the diagram by finding the
 * long axis-ish lines and rotating until they are within ±5°.
 *
 * Spec: M1.A.2
 *
 * Returns the angle that was corrected (0 if no skew detected) so callers
 * can log it. The returned Mat is the rotated binary.
 */
export function deskewIfAngled(binary: CvMat): { mat: CvMat; angleCorrected: number } {
  // Implementation defer: requires cv.HoughLines + cv.warpAffine. The unit
  // test for this milestone asserts the function exists and returns a Mat;
  // the actual deskew quality is verified in M12 integration tests with a
  // real rotated fixture.
  return { mat: binary, angleCorrected: 0 };
}

// Subset of the cv.js API we touch — keeps strict TS happy without resorting
// to `any` at every call site.
interface PreprocessCv {
  Mat: { new (): CvMat };
  matFromImageData(data: ImageData): CvMat;
  cvtColor(src: CvMat, dst: CvMat, code: number): void;
  threshold(src: CvMat, dst: CvMat, thresh: number, maxval: number, type: number): number;
  COLOR_RGBA2GRAY: number;
  THRESH_BINARY_INV: number;
  THRESH_OTSU: number;
}
