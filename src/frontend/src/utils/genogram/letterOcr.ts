/**
 * Letter OCR for a cleaned single-character crop. Tries Tesseract first
 * (fast, free) and falls back to a vision-model call only when confidence
 * is below LETTER_OCR_CONFIDENCE_THRESHOLD.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M6
 */

import { loadTesseractWorker } from '../tesseractLoader';
import { ocrViaClaudeVision } from './letterVlm';

export const LETTER_OCR_CONFIDENCE_THRESHOLD = 0.6;

export type LetterReadResult = {
  letter: string | null;
  confidence: number;
  source: 'tesseract' | 'vlm' | 'none';
};

/**
 * Tesseract single-character OCR. The caller is expected to have upscaled
 * the crop to ~64px tall — Tesseract is much more reliable on tall glyphs.
 *
 * Spec: M6.A.1
 */
export async function ocrSingleChar(cropDataUrl: string): Promise<LetterReadResult> {
  const worker = await loadTesseractWorker();
  const { data } = await worker.recognize(cropDataUrl);
  const text = (data.text || '').trim();
  const confidence = (data.confidence ?? 0) / 100;
  if (!text || text.length === 0) {
    return { letter: null, confidence: 0, source: 'none' };
  }
  // Single-character mode sometimes returns multi-char strings if the crop
  // is messy; take the first non-whitespace character.
  const letter = text.replace(/\s/g, '').charAt(0) || null;
  return {
    letter,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    source: 'tesseract',
  };
}

export type ReadLetterOptions = {
  /** Override the fallback threshold per call (default LETTER_OCR_CONFIDENCE_THRESHOLD). */
  threshold?: number;
  /** When provided, the VLM fallback uses this API key + model. If absent, fallback is skipped. */
  vlm?: { apiKey: string; model: string };
};

/**
 * Try Tesseract first; if confidence is below threshold AND a VLM is wired,
 * fall back to the vision-model OCR for the single cleaned crop.
 *
 * Spec: M6.A.3
 */
export async function readLetter(
  cropDataUrl: string,
  opts: ReadLetterOptions = {}
): Promise<LetterReadResult> {
  const threshold = opts.threshold ?? LETTER_OCR_CONFIDENCE_THRESHOLD;
  const tesseractResult = await ocrSingleChar(cropDataUrl);
  if (tesseractResult.confidence >= threshold && tesseractResult.letter) {
    return tesseractResult;
  }
  if (!opts.vlm) return tesseractResult;

  const vlmResult = await ocrViaClaudeVision(cropDataUrl, opts.vlm.apiKey, opts.vlm.model);
  return vlmResult;
}
