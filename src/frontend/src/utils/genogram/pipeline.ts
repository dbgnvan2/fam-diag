/**
 * Top-level genogram extraction pipeline. Wires the M1-M9 steps together
 * and produces a DiagramImportData object the existing File → Open flow
 * accepts.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M11
 */

import type { DiagramImportData } from '../../types/diagramEditor';
import { ImportLog } from '../importLog';
import { preprocessImage, deskewIfAngled, type PreprocessedImage } from './preprocess';
import {
  detectSymbolContours,
  eraseConnectorLines,
  candidatesFromManualBBoxes,
  type SymbolCandidate,
  type BBox,
} from './symbols';
import { extractSymbolRecord, type SymbolRecord } from './symbolRecord';
import { detectConnectors, inferPartnerships } from './connectors';
import { assembleDiagramImport } from './assemble';

export type PipelineProgress = {
  stage: 'preprocess' | 'symbols' | 'classify' | 'connectors' | 'assemble' | 'done';
  message: string;
  current?: number;
  total?: number;
};

export type GenogramPipelineOptions = {
  /** Optional manual override — skip auto contour detection. */
  manualBBoxes?: BBox[];
  /** VLM credentials for the per-symbol letter-OCR fallback. */
  vlm?: { apiKey: string; model: string };
  /** Override the X mask thickness used during the inpaint step. */
  xMaskThickness?: number;
  /** Optional log destination. A fresh ImportLog is used if omitted. */
  log?: ImportLog;
  /** Live progress callback — fired on every stage transition. */
  onProgress?: (p: PipelineProgress) => void;
  /**
   * Skip the letter-OCR step entirely. Useful for integration tests where we
   * want to verify the CV side without paying the cost of loading tesseract
   * or making 20+ Anthropic VLM calls. Symbols still get a shape + sex; the
   * letter field is null.
   */
  skipOcr?: boolean;
  /**
   * Optional user hints from the upload dialog. The pipeline uses these
   * advisorily — e.g. `generationCount` constrains the topology layout's
   * row count; `expectedPersonCount` could later inform filter tightness.
   */
  hints?: {
    generationCount?: number;
    expectedPersonCount?: number;
    handDrawn?: boolean;
    hasNotes?: boolean;
  };
};

export type GenogramPipelineResult = {
  data: DiagramImportData;
  symbols: SymbolRecord[];
  log: ImportLog;
};

/**
 * Yield to the event loop. setTimeout(0) reliably releases the main thread
 * so React can flush its state updates and paint the next progress message
 * before the next synchronous cv operation starts.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Run the full pipeline against an image Blob and return the final
 * DiagramImportData. Caller decides what to do with it (set state, save to
 * file, hand to the existing import flow).
 */
export async function runGenogramPipeline(
  blob: Blob,
  opts: GenogramPipelineOptions = {}
): Promise<GenogramPipelineResult> {
  const log = opts.log ?? new ImportLog();
  const onProgress = opts.onProgress ?? (() => {});
  log.info(`Genogram pipeline started at ${new Date().toISOString()}`);
  log.info(`Image blob: type=${blob.type || '(none)'} size=${blob.size} bytes`);

  onProgress({
    stage: 'preprocess',
    message: 'Loading vision libraries (~10MB, one-time download — may take 20s)…',
  });
  await yieldToEventLoop(); // let the message paint before WASM init blocks the thread
  let pre: PreprocessedImage;
  try {
    pre = await preprocessImage(blob, (step) => {
      // Surface each preprocess sub-step (cv load, decode, downscale,
      // threshold) so the UI doesn't appear stuck on a single message.
      onProgress({ stage: 'preprocess', message: step });
    });
    log.info(`Preprocessed: ${pre.width}x${pre.height} binarised`);
    onProgress({ stage: 'preprocess', message: `Preprocessed ${pre.width}×${pre.height} image` });
    await yieldToEventLoop();
  } catch (err) {
    log.error(`preprocessImage failed: ${(err as Error).message}`);
    throw err;
  }

  const deskewed = deskewIfAngled(pre.binary);
  if (deskewed.angleCorrected !== 0) {
    log.info(`Deskew applied: ${deskewed.angleCorrected.toFixed(2)}°`);
  }

  // Symbol detection — auto or manual.
  onProgress({ stage: 'symbols', message: 'Erasing connector lines…' });
  await yieldToEventLoop();
  let candidates: SymbolCandidate[];
  if (opts.manualBBoxes && opts.manualBBoxes.length > 0) {
    candidates = candidatesFromManualBBoxes(opts.manualBBoxes);
    log.info(`Manual mode: ${candidates.length} bounding boxes supplied`);
  } else {
    const eraseTarget = pre.binary;
    await eraseConnectorLines(eraseTarget);
    onProgress({ stage: 'symbols', message: 'Finding symbol contours…' });
    await yieldToEventLoop();
    candidates = await detectSymbolContours(eraseTarget);
    log.info(`Auto-detected ${candidates.length} symbol candidates`);
    if (candidates.length === 0) {
      log.error('No symbols detected — check image contrast / lighting.');
    }
  }
  onProgress({
    stage: 'symbols',
    message: `Found ${candidates.length} symbol candidates`,
    current: candidates.length,
    total: candidates.length,
  });
  await yieldToEventLoop();

  // Per-symbol extraction — this is the long-tail bit, so emit progress
  // every iteration. The VLM fallback (when configured) makes each step
  // potentially network-bound, which is why a counter matters here.
  const records: SymbolRecord[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    onProgress({
      stage: 'classify',
      message: `Reading symbol ${i + 1} of ${candidates.length}…`,
      current: i + 1,
      total: candidates.length,
    });
    try {
      const rec = await extractSymbolRecord(c, pre.binary, {
        vlm: opts.vlm,
        xMaskThickness: opts.xMaskThickness,
        skipOcr: opts.skipOcr,
      });
      records.push(rec);
    } catch (err) {
      log.warn(`Symbol ${c.id} extraction failed: ${(err as Error).message}`);
    }
  }
  log.info(`Extracted ${records.length} symbol records`);
  records.forEach((r) => {
    log.info(
      `  ${r.id}: shape=${r.shape} sex=${r.inferred_sex} dead=${r.is_dead} letter=${r.letter ?? '∅'} conf=${r.letter_confidence.toFixed(2)} (${r.overall_confidence})`
    );
  });

  // Connector + partnership inference.
  onProgress({ stage: 'connectors', message: 'Detecting connector lines…' });
  await yieldToEventLoop();
  const connectors = await detectConnectors(pre.binary);
  log.info(`Detected ${connectors.length} connector segments`);
  const inferred = inferPartnerships(records, connectors);
  log.info(`Inferred ${inferred.length} partnerships`);

  // Final DiagramImportData.
  onProgress({ stage: 'assemble', message: 'Assembling diagram…' });
  const data = assembleDiagramImport(records, inferred, opts.hints);
  log.info(
    `Assembled: people=${data.people?.length ?? 0} partnerships=${data.partnerships?.length ?? 0}`
  );

  // Free the binary now that we're done with it.
  (pre.binary as unknown as { delete?: () => void }).delete?.();

  onProgress({
    stage: 'done',
    message: `Done — ${data.people?.length ?? 0} people, ${data.partnerships?.length ?? 0} partnerships`,
  });

  return { data, symbols: records, log };
}
