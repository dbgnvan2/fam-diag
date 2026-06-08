/**
 * Lazy loader for tesseract.js OCR worker.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M0.A.2
 *
 * tesseract.js spins up a worker that owns the WASM + language data.
 * Recognizing a single character is fast once the worker is warm, so we
 * cache one worker for the lifetime of the page.
 */

import type { Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;

export function loadTesseractWorker(): Promise<Worker> {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    const tesseract = await import('tesseract.js');
    const worker = await tesseract.createWorker('eng');
    // Single-character mode: page-segmentation mode 10 — treat the image as a
    // single character. Matches the Tesseract Python --psm 10 flag.
    await worker.setParameters({
      tessedit_pageseg_mode: '10' as unknown as import('tesseract.js').PSM,
    });
    return worker;
  })();
  return workerPromise;
}

/** Test-only reset. */
export function _resetTesseractLoaderForTests(): void {
  workerPromise = null;
}
