/**
 * Tests for letterOcr.ts (Tesseract + VLM fallback orchestrator).
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted to the top of the file — its factory cannot close over
// regular top-level constants. Use vi.hoisted() to declare the spies
// alongside the mocks so they're available at hoist time.
const { workerRecognize, createWorkerMock, vlmMock } = vi.hoisted(() => ({
  workerRecognize: vi.fn(),
  createWorkerMock: vi.fn(),
  vlmMock: vi.fn(),
}));

vi.mock('tesseract.js', () => ({
  createWorker: createWorkerMock,
}));

vi.mock('./letterVlm', () => ({
  ocrViaClaudeVision: vlmMock,
}));

import { ocrSingleChar, readLetter } from './letterOcr';
import { _resetTesseractLoaderForTests } from '../tesseractLoader';

describe('ocrSingleChar', () => {
  beforeEach(() => {
    _resetTesseractLoaderForTests();
    workerRecognize.mockReset();
    createWorkerMock.mockReset();
    createWorkerMock.mockResolvedValue({
      setParameters: vi.fn().mockResolvedValue(undefined),
      recognize: workerRecognize,
      terminate: vi.fn(),
    } as unknown as import('tesseract.js').Worker);
  });

  it('test_m6a1_reads_clean_letter_M', async () => {
    workerRecognize.mockResolvedValue({ data: { text: 'M', confidence: 92 } });
    const result = await ocrSingleChar('data:image/png;base64,FAKE');
    expect(result.letter).toBe('M');
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.source).toBe('tesseract');
  });

  it('test_m6a1_returns_null_when_crop_is_blank', async () => {
    workerRecognize.mockResolvedValue({ data: { text: '', confidence: 0 } });
    const result = await ocrSingleChar('data:image/png;base64,FAKE');
    expect(result.letter).toBeNull();
    expect(result.source).toBe('none');
  });

  it('strips multi-character noise to a single character', async () => {
    workerRecognize.mockResolvedValue({ data: { text: 'Mx', confidence: 85 } });
    const result = await ocrSingleChar('data:image/png;base64,FAKE');
    expect(result.letter).toBe('M');
  });
});

describe('readLetter', () => {
  beforeEach(() => {
    _resetTesseractLoaderForTests();
    workerRecognize.mockReset();
    vlmMock.mockReset();
    createWorkerMock.mockReset();
    createWorkerMock.mockResolvedValue({
      setParameters: vi.fn().mockResolvedValue(undefined),
      recognize: workerRecognize,
      terminate: vi.fn(),
    } as unknown as import('tesseract.js').Worker);
  });

  it('test_m6a3_falls_back_to_vlm_below_threshold', async () => {
    workerRecognize.mockResolvedValue({ data: { text: 'M', confidence: 40 } });
    vlmMock.mockResolvedValue({ letter: 'M', confidence: 0.9, source: 'vlm' });
    const result = await readLetter('data:image/png;base64,FAKE', {
      vlm: { apiKey: 'sk-x', model: 'claude-sonnet-4-6' },
    });
    expect(result.source).toBe('vlm');
    expect(vlmMock).toHaveBeenCalledTimes(1);
  });

  it('skips VLM when Tesseract confidence is high enough', async () => {
    workerRecognize.mockResolvedValue({ data: { text: 'A', confidence: 95 } });
    const result = await readLetter('data:image/png;base64,FAKE', {
      vlm: { apiKey: 'sk-x', model: 'claude-sonnet-4-6' },
    });
    expect(result.source).toBe('tesseract');
    expect(vlmMock).not.toHaveBeenCalled();
  });

  it('returns the Tesseract result when no VLM is wired', async () => {
    workerRecognize.mockResolvedValue({ data: { text: 'X', confidence: 30 } });
    const result = await readLetter('data:image/png;base64,FAKE'); // no opts.vlm
    expect(result.source).toBe('tesseract');
    expect(vlmMock).not.toHaveBeenCalled();
  });
});
