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

  // KNOWN LIMITATION (2026-06-08): the browser path is not currently
  // working. The CommonJS-shaped @techstark/opencv-js package fails
  // under Vite's ESM transformation ("Cannot set properties of undefined
  // (setting 'cv')"). The Node-test path below works end-to-end — that's
  // what the `npm run test:genogram` integration suite exercises. The
  // browser fix is tracked in docs/genogram-import-status.md.
  //
  // Wrap the loader in a timeout to prevent long hangs, and catch immediate
  // import errors to provide a clear message to the user.
  cvPromise = Promise.race([
    (async () => {
      try {
        trace('await import(@techstark/opencv-js)…');
        const mod = await import('@techstark/opencv-js');
        const modAny = mod as Record<string, unknown>;
        trace(`import resolved. keys=${Object.keys(mod).join(',')}`);
        // Some opencv-js builds expose `cv` and `default` as separate named
        // exports; others only have `default`. Vitest mocks are strict and
        // throw when accessing a missing key, so we check existence first.
        const pickFirst = (...keys: string[]) => {
          for (const key of keys) {
            if (key in modAny && modAny[key] != null) return modAny[key];
          }
          return modAny;
        };
        const cv = pickFirst('cv', 'default') as {
          onRuntimeInitialized?: () => void;
          Mat?: unknown;
          getBuildInformation?: () => string;
        };
        trace(`cv resolved. typeof Mat=${typeof cv.Mat}, typeof getBuildInformation=${typeof cv.getBuildInformation}`);

        // Test-mode mocks don't have getBuildInformation, but DO have a mocked
        // Mat as a function or object. Resolve immediately — there's no real
        // WASM behind them, so polling for readiness would never finish.
        if (
          typeof cv.getBuildInformation !== 'function' &&
          (typeof cv.Mat === 'function' || typeof cv.Mat === 'object')
        ) {
          trace('test-mode shortcut');
          return cv;
        }

        // Emscripten's cv module is "thenable" — it has a legacy `.then`
        // method. Any `await cv` (or `return cv` from an async function, which
        // implicitly does `Promise.resolve(cv)`) chains through that .then,
        // which never settles, so the await hangs forever.
        //
        // Fix: once we know cv is ready, delete its `.then` so it looks like
        // a plain object. After that, returning cv straight out of an async
        // function works as expected.
        await new Promise<void>((resolve, reject) => {
          let settled = false;
          const finish = (source: string) => {
            if (settled) return;
            settled = true;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            try { delete (cv as any).then; } catch { /* ignore */ }
            trace(`cv ready (${source}), then=${typeof (cv as { then?: unknown }).then}`);
            resolve();
          };
          cv.onRuntimeInitialized = () => finish('onRuntimeInitialized');

          (async () => {
            const deadline = Date.now() + 20_000;
            while (Date.now() < deadline && !settled) {
              if (typeof cv.getBuildInformation === 'function' && typeof cv.Mat === 'function') {
                try {
                  cv.getBuildInformation();
                  const probe = new (cv.Mat as new () => { delete: () => void })();
                  probe.delete();
                  finish('poll');
                  return;
                } catch {
                  // not ready yet
                }
              }
              await new Promise<void>((r) => setTimeout(r, 50));
            }
            if (!settled) {
              reject(new Error('cv (opencv.js) WASM did not initialise within 20 seconds'));
            }
          })();
        });
        return cv;
      } catch (err) {
        // Catch immediate import errors and provide a clearer message
        const message = err instanceof Error ? err.message : String(err);
        trace(`Import failed: ${message}`);
        throw new Error(
          'Image extraction unavailable: OpenCV.js failed to load in the browser due to ' +
          'a JavaScript module compatibility issue. This is a known limitation. ' +
          'See docs/genogram-import-status.md for details and workarounds.'
        );
      }
    })(),
    new Promise<OpenCv>((_, reject) =>
      setTimeout(
        () => reject(new Error(
          'Image extraction unavailable: OpenCV.js initialization timed out. ' +
          'See docs/genogram-import-status.md for details.'
        )),
        25_000
      )
    ),
  ]);
  return cvPromise;
}

/** Clears the cached instance. Test-only — never call in app code. */
export function _resetCvLoaderForTests(): void {
  cvPromise = null;
}
