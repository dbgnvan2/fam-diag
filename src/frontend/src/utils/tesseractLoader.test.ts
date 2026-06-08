/**
 * Tests for tesseractLoader.ts — caching contract, mocked WASM.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M0.A.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const createWorkerMock = vi.fn();

vi.mock('tesseract.js', () => ({
  createWorker: createWorkerMock,
}));

import { loadTesseractWorker, _resetTesseractLoaderForTests } from './tesseractLoader';

describe('tesseractLoader', () => {
  beforeEach(() => {
    _resetTesseractLoaderForTests();
    createWorkerMock.mockReset();
    createWorkerMock.mockResolvedValue({
      setParameters: vi.fn().mockResolvedValue(undefined),
      // Pretend recognize / terminate exist so type asserts don't blow up.
      recognize: vi.fn(),
      terminate: vi.fn(),
    } as unknown as import('tesseract.js').Worker);
  });

  it('test_m0a2_loads_tesseract_with_eng', async () => {
    await loadTesseractWorker();
    expect(createWorkerMock).toHaveBeenCalledWith('eng');
  });

  it('caches the worker across calls', async () => {
    const a = await loadTesseractWorker();
    const b = await loadTesseractWorker();
    expect(a).toBe(b);
    expect(createWorkerMock).toHaveBeenCalledTimes(1);
  });
});
