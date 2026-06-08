/**
 * Lazy loader for OpenCV.js (WASM build).
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M0.A.1
 *
 * The dynamic import keeps the ~9MB WASM blob out of the main bundle. The
 * first call returns a Promise that resolves once OpenCV is ready;
 * subsequent calls return the cached Promise so it never reloads.
 */

// `@techstark/opencv-js` exports the cv namespace as the module default.
// The WASM blob loads asynchronously inside it — onRuntimeInitialized fires
// when it's ready to use. We wrap that into a Promise.

// The opencv-js package exposes the `cv` namespace as the module body; both
// `import cv from '@techstark/opencv-js'` and the namespace import work, so we
// just type the loader's return as `unknown` and let consumers cast.
export type OpenCv = unknown;

let cvPromise: Promise<OpenCv> | null = null;

const trace = (msg: string) => {
  // Browser: always log to console so users can diagnose without env vars.
  // Node + GENOGRAM_DEBUG=1: write to stderr (test-script debug mode).
  if (typeof window !== 'undefined' && typeof console !== 'undefined') {
    console.log(`[cvLoader] ${msg}`);
    return;
  }
  if (typeof process === 'undefined' || process.env?.GENOGRAM_DEBUG !== '1') return;
  if (!process.stderr?.write) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('fs').writeSync(2, `  [cvLoader] ${msg}\n`);
  } catch {
    process.stderr.write(`  [cvLoader] ${msg}\n`);
  }
};

export function loadCv(): Promise<OpenCv> {
  if (cvPromise) return cvPromise;

  // SOLUTION (2026-06-08): Replace WASM opencv.js with pure-JavaScript
  // implementations of the 15 CV operations used by the pipeline.
  // This eliminates the ESM/CommonJS incompatibility entirely.
  //
  // See docs/implementation_plan_2026-06-08-opencv-js.md for implementation.
  cvPromise = (async () => {
    trace('loading pure-JS cv-js module…');
    const cvModule = await import('./cv-js');
    trace('cv-js loaded successfully');
    return cvModule.default as OpenCv;
  })();

  return cvPromise;
}

/** Clears the cached instance. Test-only — never call in app code. */
export function _resetCvLoaderForTests(): void {
  cvPromise = null;
}
