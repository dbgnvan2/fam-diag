/**
 * Assemble a SymbolRecord from a SymbolCandidate by running the M3→M6
 * subpipelines (shape classify → X detect → X remove → letter OCR).
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M7
 */

import { loadCv } from '../cvLoader';
import { classifyShape, shapeToInferredSex, type Shape, type InferredSex } from './shape';
import { detectXThroughSymbol } from './xDetect';
import { removeXStrokes } from './xRemove';
import { readLetter, type LetterReadResult } from './letterOcr';
import type { SymbolCandidate } from './symbols';
import type { BBox } from './symbols';
import type { CvMat } from './preprocess';

export type SymbolRecord = {
  id: string;
  bbox: BBox;
  shape: Shape;
  inferred_sex: InferredSex;
  is_dead: boolean;
  x_detected: boolean;
  letter: string | null;
  letter_confidence: number;
  letter_source: LetterReadResult['source'];
  overall_confidence: 'high' | 'med' | 'low';
  notes: string[];
};

export type ExtractRecordOptions = {
  /** When provided, used as the VLM fallback for letter OCR. */
  vlm?: { apiKey: string; model: string };
  /** Override the X-mask thickness for the cv.inpaint step. */
  xMaskThickness?: number;
  /** Skip OCR entirely (used by integration tests). */
  skipOcr?: boolean;
};

/**
 * Run the full per-symbol pipeline. The caller passes the full binarised
 * Mat plus the candidate; this function crops, classifies, detects/removes
 * the X, and reads the interior letter.
 *
 * Spec: M7.A.1
 */
export async function extractSymbolRecord(
  candidate: SymbolCandidate,
  fullMat: CvMat,
  opts: ExtractRecordOptions = {}
): Promise<SymbolRecord> {
  const shape = classifyShape(candidate);
  const inferred_sex = shapeToInferredSex(shape);
  const notes: string[] = [];

  // Triangles, plain x and stars don't need the X-through pipeline.
  if (shape === 'triangle' || shape === 'star') {
    return finalize(candidate, shape, inferred_sex, false, false, {
      letter: null, confidence: 0, source: 'none',
    }, notes);
  }

  // For the M7.A.1 happy path we need a crop of the symbol. cv.Mat.roi
  // returns a view into the source. We don't delete it because we may use
  // it for the cleaned-letter OCR.
  const cv = (await loadCv()) as unknown as { Rect: new (x: number, y: number, w: number, h: number) => unknown };
  const rect = new cv.Rect(candidate.bbox.x, candidate.bbox.y, candidate.bbox.w, candidate.bbox.h);
  const crop = ((fullMat as unknown as { roi(r: unknown): CvMat }).roi(rect));

  // M4: X-through detection.
  const xResult = await detectXThroughSymbol(crop);
  const is_dead = xResult.is_dead;

  // M5: X removal (only if we detected an X).
  let cleaned = crop;
  if (is_dead && xResult.angleA !== undefined && xResult.angleB !== undefined) {
    cleaned = await removeXStrokes(crop, { angleA: xResult.angleA, angleB: xResult.angleB }, {
      thickness: opts.xMaskThickness,
    });
    notes.push('deceased (X removed before OCR)');
  }

  // M6: read the interior letter (skipped in integration-test mode).
  const letterResult = opts.skipOcr
    ? { letter: null, confidence: 0, source: 'none' as const }
    : await readLetter(matToDataUrl(cleaned), { vlm: opts.vlm });

  // Free intermediate Mats we own — the roi `crop` is a view into the
  // source; the cleaned Mat is an allocation if removeXStrokes ran.
  if (cleaned !== crop) (cleaned as unknown as { delete?: () => void }).delete?.();
  (crop as unknown as { delete?: () => void }).delete?.();

  return finalize(candidate, shape, inferred_sex, is_dead, true, letterResult, notes);
}

/**
 * Roll the per-stage outputs into a SymbolRecord, computing overall_confidence
 * by the lowest-of-three rule from M7.A.2.
 */
function finalize(
  candidate: SymbolCandidate,
  shape: Shape,
  inferred_sex: InferredSex,
  is_dead: boolean,
  x_detected: boolean,
  letter: LetterReadResult,
  notes: string[]
): SymbolRecord {
  const lowLetter = letter.letter !== null && letter.confidence < 0.6;
  const shapeAmbig = shape === 'x'; // plain X → low confidence in gender
  const overall_confidence: 'high' | 'med' | 'low' = lowLetter || shapeAmbig
    ? 'low'
    : letter.confidence >= 0.85 || letter.letter === null
      ? 'high'
      : 'med';
  if (lowLetter) notes.push(`low-confidence letter (${letter.confidence.toFixed(2)})`);
  if (shapeAmbig) notes.push('plain X — gender unknown');

  return {
    id: candidate.id,
    bbox: candidate.bbox,
    shape,
    inferred_sex,
    is_dead,
    x_detected,
    letter: letter.letter,
    letter_confidence: letter.confidence,
    letter_source: letter.source,
    overall_confidence,
    notes,
  };
}

/**
 * Convert a cv.Mat to a PNG data URL via cv.imshow on an offscreen canvas.
 * Used as the input to the OCR + VLM steps. This function intentionally
 * touches the DOM because both Tesseract.js and the Anthropic API consume
 * image bytes, not raw OpenCV Mats.
 */
function matToDataUrl(mat: CvMat): string {
  // The shared loadCv() promise has already resolved by the time we reach
  // this code path, so we read cv off the global the loader installs.
  const cvAny = (globalThis as unknown as { cv?: { imshow: (canvas: HTMLCanvasElement, mat: CvMat) => void } }).cv;
  if (!cvAny || typeof cvAny.imshow !== 'function') {
    // Test-mode fallback. Real browser pipeline always has cv.imshow.
    return 'data:image/png;base64,';
  }
  const canvas = document.createElement('canvas');
  canvas.width = mat.cols;
  canvas.height = mat.rows;
  cvAny.imshow(canvas, mat);
  return canvas.toDataURL('image/png');
}
