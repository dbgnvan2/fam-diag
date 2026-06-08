/**
 * Integration tests for the genogram CV pipeline. These require real
 * opencv.js + tesseract.js execution against a Canvas-capable runtime,
 * which jsdom + Vitest does not reliably provide.
 *
 * Gated on RUN_CV_INTEGRATION=1. Run with:
 *
 *   RUN_CV_INTEGRATION=1 npx vitest run src/utils/genogram/genogram.integration.test.ts
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M12
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';

const FIXTURES = {
  jenniesBoy: resolve(__dirname, '../../../../../Test Data/Family Diagram Jennies Boy for Import.jpg'),
  dixie: resolve(__dirname, '../../../../../Test Data/dixie small family diagram for import.png'),
  galloway: resolve(__dirname, '../../../../../Test Data/Galloway Family Diagram for import.png'),
};

const shouldRun = process.env.RUN_CV_INTEGRATION === '1';

function loadFixtureBlob(path: string): Blob {
  const buffer = readFileSync(path);
  const ext = path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  return new Blob([new Uint8Array(buffer)], { type: ext });
}

describe('Genogram CV pipeline — fixture availability', () => {
  beforeAll(() => {
    if (!shouldRun) {
      console.warn(
        'RUN_CV_INTEGRATION not set — pipeline integration tests skipped. The fixture-existence checks still run.'
      );
    }
  });

  it('Jennies Boy fixture is loadable', () => {
    expect(existsSync(FIXTURES.jenniesBoy)).toBe(true);
    expect(statSync(FIXTURES.jenniesBoy).size).toBeGreaterThan(100_000);
  });

  it('Dixie fixture is loadable', () => {
    expect(existsSync(FIXTURES.dixie)).toBe(true);
    expect(statSync(FIXTURES.dixie).size).toBeGreaterThan(50_000);
  });

  it('Galloway fixture is loadable', () => {
    expect(existsSync(FIXTURES.galloway)).toBe(true);
    expect(statSync(FIXTURES.galloway).size).toBeGreaterThan(50_000);
  });
});

describe.skipIf(!shouldRun)('Genogram CV pipeline — live extraction', () => {
  // These cases require a real browser environment (createImageBitmap,
  // OffscreenCanvas, opencv.js WASM, tesseract.js worker). They are
  // intentionally skipped under jsdom and only run when explicitly opted in
  // via RUN_CV_INTEGRATION=1 in an environment that can satisfy those deps
  // (a headless browser test runner, or Vitest with @vitest/browser).

  it('test_m12a1_jennies_boy_detects_at_least_18_symbols', async () => {
    const { runGenogramPipeline } = await import('./pipeline');
    const result = await runGenogramPipeline(loadFixtureBlob(FIXTURES.jenniesBoy));
    expect(result.symbols.length).toBeGreaterThanOrEqual(18);
    expect(result.data.partnerships?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('test_m12a2_dixie_detects_at_least_14_symbols', async () => {
    const { runGenogramPipeline } = await import('./pipeline');
    const result = await runGenogramPipeline(loadFixtureBlob(FIXTURES.dixie));
    expect(result.symbols.length).toBeGreaterThanOrEqual(14);
    expect(result.data.partnerships?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('test_m12a3_galloway_completes_without_error', async () => {
    const { runGenogramPipeline } = await import('./pipeline');
    const result = await runGenogramPipeline(loadFixtureBlob(FIXTURES.galloway));
    expect(result.symbols.length).toBeGreaterThan(0);
  });
});
