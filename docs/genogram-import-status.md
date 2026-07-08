# Image-to-Diagram Import — Status as of 2026-06-08

> ⚠️ **RETIRED / HISTORICAL.** The classical-CV pipeline described below was replaced
> by a Claude Vision (VLM) approach later on 2026-06-08 and its code has been deleted
> from the repo. See [VLM_Implementation_Summary.md](VLM_Implementation_Summary.md) for
> the active path. This document is kept only for historical context on why the CV
> approach was abandoned (the opencv.js browser-hang blocker below is what triggered the pivot).

This document records the state of the CV-based genogram import pipeline at the close of the 2026-06-07/06-08 work session, what works, what doesn't, and the recommended next steps.

## What works (verified)

### Node-side integration test
`npm run test:genogram` (in `src/frontend/`) runs the full pipeline against three real fixture images and asserts 42 properties of the output. All checks pass.

```
Jennies Boy:  21 people, 6 partnerships,  min-spacing 80px,  same-gen-Y ✓
Dixie:        36 people, 9 partnerships,  min-spacing 80px,  same-gen-Y ✓
Galloway:     22 people, 2 partnerships,  min-spacing 130px, same-gen-Y ✓
```

Assertions exercised per fixture:
- Pipeline completes in under 5 seconds.
- ≥ 1 symbol detected and ≥ 1 person produced.
- Person count is within ±40% of the reference JSON (Jennies Boy only — the others have no reference).
- Partnership count is between 1 and 3× the reference (4).
- Every partnership has `horizontalConnectorY > 0`.
- Every child has a `parentPartnership` that references an actual partnership in the output.
- Every `partnership.children` id references a real person.
- No two people are closer than the minimum spacing (80px).
- At least one deceased symbol is flagged via X-through detection.
- All same-generation people share a Y coordinate (topology layout).
- Every child sits below its parents (topology layout).

The Node integration test exists as `scripts/integration-test.ts` and uses helpers in `src/utils/genogram/__tests__/integrationHelpers.ts`. It uses the `tsx` runner so it executes the real TypeScript pipeline (no separate build).

### Unit test suite
`npx vitest run` passes — 406 tests, 16 skipped (`RUN_VISION_TESTS=1`-gated VLM tests). All 54 test files green.

### Build gates
- `npx tsc --noEmit` — clean
- `npx tsc -b` (Vercel production build) — clean

### Capabilities the pipeline demonstrably has, in Node
1. **Image preprocessing** — image is decoded, downscaled to ≤1600px on the long side, grayscaled, and Otsu-thresholded into a binary image.
2. **Connector erasure** — horizontal and vertical line strokes are removed via morphological opening so they don't merge symbols into connected blobs.
3. **Contour detection** — `cv.findContours` returns all enclosed contours. A filter (size ≥ 20×20, fill-ratio ≥ 0.3, aspect ≤ 2.5, size ≤ 300×300) narrows to plausible person-symbols. On Jennies Boy this filter reduces 545 raw contours to 21 candidates.
4. **Shape classification** — circle vs square vs triangle via `circleFillRatio = area / (π·r²)` from `cv.minEnclosingCircle` (≥ 0.68 → circle, ≤ 0.60 → square; circularity + `cv.approxPolyDP` vertex count breaks ties). Plain X has no enclosed area → classified as "unknown sex".
5. **Gender inference** — square → male, circle → female, triangle → pregnancy marker (not a person), star → miscarriage marker (not a person), plain X → unknown.
6. **Deceased detection** — Hough line transform finds ±45° diagonals through each symbol bbox; both diagonals present → deceased.
7. **Partnership inference** — Hough-detected horizontal lines matched to symbol-pair centroids. Deduplicated by partner pair. Children attached via vertical drops below the couple line.
8. **2D topology layout** — generations computed from `parentPartnership` chain; each generation snapped to a fixed Y; kids' X centered between parents' X bounds; siblings evenly spread; childless people sorted into row gaps.
9. **No-overlap relaxation** — final pass guarantees no two people are within `MIN_PERSON_SPACING` (80px) of each other.
10. **DiagramImportData output shape** — matches `jennie_boy_diagram.json` top-level keys (people, partnerships, emotionalLines, pageNotes, triangles) and would load through the existing File → Open path.

## What's not working

### Browser-side hang on opencv.js load (PRIMARY BLOCKER)

When the user clicks File → Image Diagram → Analyze in the browser, the page hangs. The hang happens during opencv.js WASM initialisation. Symptoms:

- Browser shows repeated "this page isn't responding — Wait / Cancel" dialogs.
- Main thread is blocked long enough that even our 20s polling timeout cannot fire (the `setTimeout` callback never runs while the thread is pegged).
- An earlier attempt to load opencv.js via a `<script>` tag (to bypass Vite's ESM transformation) regressed the file picker entirely — the modal stopped rendering. That change has been reverted.

#### Root causes (compounding)

1. **`@techstark/opencv-js` is CommonJS-shaped.** Its module body does `module.exports.cv = …`. When Vite imports it as ES, the `module.exports` reference is `undefined` and the package throws `Cannot set properties of undefined (setting 'cv')` — visible in the import log.
2. **The 9MB WASM compile is CPU-bound on the main thread.** Even if the module loaded cleanly, Emscripten's runtime initialisation (which generates JS bindings for thousands of cv functions) is synchronous and pegs the main thread for 10–30s on first import. Browser shows the unresponsive dialog during this window.
3. **Vite's `optimizeDeps.exclude` (added to `vite.config.ts`) helps but is not sufficient** — Vite still transforms the package on-the-fly even when not pre-bundling it.

#### Attempts that did not work

| Attempt | Outcome |
|---|---|
| `optimizeDeps.exclude: ['@techstark/opencv-js']` in vite.config.ts | Did not prevent the `module.exports` error. Kept in place as it does no harm and is documented as a recommended setting. |
| `<script>` tag loader using Vite `?url` asset import (`loadCvViaScriptTag` in cvLoader.ts) | Broke the ImageDiagramModal entirely — the modal would not even render. The `?url` import path may not resolve correctly for files inside `node_modules`. **Reverted.** |
| Pre-warming cv on modal open (calling `loadCv()` in `useEffect` when the modal opens) | Pulled the same broken import path into the modal's render chain. **Reverted.** |
| Polling for `cv.getBuildInformation` as a readiness signal | Works in Node (the integration tests use this code path) but the browser never reaches this code because the import itself fails earlier. |
| Deleting `cv.then` to escape Emscripten's thenable trap | Works correctly in Node (verified). In the browser the import fails before this code runs. |

#### Other browser-side regressions (resolved during the session)

These were found during earlier iterations and are now fixed:
- **Double file picker** — clicking File → Image Diagram opened the OS file picker before the modal. (Fixed: modal opens first, owns its own file input.)
- **`adaptiveThreshold` on full-resolution phone photos** — took 10+ seconds even when WASM loaded. (Fixed: downscale + Otsu threshold instead.)
- **Contour filter too loose → 545 candidates → Tesseract called 245 times** = 73 second hang. (Fixed: filter tightened to ~21 candidates per fixture.)
- **Shape classifier called 70% of person symbols "star"** — hand-rolled vertex-count heuristic was junk on wobbly hand-drawn contours. (Fixed: replaced with `cv.approxPolyDP` + `minEnclosingCircle` ratio.)
- **Dangling `parentPartnership` references** when a partnership was filtered out. (Fixed: only set parentPartnership for surviving partnerships.)

### Tier-2 capabilities that are wired but not yet validated

These have implementations in the pipeline but no integration assertions backing them up — they may or may not work end-to-end:

- **Letter OCR on individual symbols** — `letterOcr.ts` calls Tesseract first, then falls back to the Anthropic VLM per-symbol. Integration tests run with `skipOcr: true` because running Tesseract on 21 symbols × 3 fixtures was painfully slow during iteration.
- **VLM fallback** — `letterVlm.ts` is wired into the orchestrator but never exercised in test (gated on a key being present). The single-character read may have reliability issues on hand-drawn input that have not been measured.
- **Hints from the upload dialog** — generation count, expected person count, hand-drawn/printed, has-notes — are plumbed end-to-end (modal → DiagramEditor → pipeline → assemble). The layout doesn't use them yet (it auto-detects generations from `parentPartnership` chains); the wire is in place for a future variant.

### Lower-priority issues observed in the test output

- **Gender accuracy is low.** The classifier conservatively returns "square" for borderline `circleFillRatio` (0.60–0.68). On Jennies Boy 19/21 symbols are classified as square (reference has roughly 10 female / 14 male). Tuning the threshold lower than 0.60 risks calling perfect squares (ratio = 2/π ≈ 0.637) circles.
- **Partnership over-detection still possible.** Current rules dedupe by partner pair and require the line to be within 50px of both partner centroids. Jennies Boy detects 6 partnerships against a reference of 4 — within tolerance but not exact.
- **Triangles (pregnancy/miscarriage) are not asserted.** Galloway shows 2 triangles in its shape distribution but the integration test doesn't verify that's correct.

## Recommended next steps (in priority order)

### A. Unblock the browser path

Two viable directions, each ≈ half a day:

**Option A1 — replace `@techstark/opencv-js` with a pure-JS implementation of the small set of cv operations the pipeline actually uses.** The pipeline only needs: Otsu threshold, morphological opening (small kernel), connected-components contour finding, bounding rect, `arcLength`, `contourArea`, `approxPolyDP`, `minEnclosingCircle`, `HoughLinesP`, `cv.threshold`. All implementable in pure JS in roughly 500–800 lines. Slower than WASM but eliminates the 9MB blob entirely and avoids every transformation issue.

**Option A2 — move opencv.js into a Web Worker.** Worker-loaded WASM doesn't block the main thread, so the unresponsive dialog stops appearing. Wrap each cv operation in a worker `postMessage` round-trip. Adds ~1–2ms per call (negligible for our 200ms-total budget). The `@techstark/opencv-js` package is not designed for worker use out of the box; we'd build a thin worker wrapper.

A1 is more work up front but produces a smaller, more debuggable codebase. A2 reuses the well-tested cv operations we already have.

### B. Validate end-to-end with letter OCR enabled

Once the browser path works, run a real import against Jennies Boy with the VLM fallback enabled. Measure: total time, accuracy of single-character reads, total VLM cost. Compare against the goal-reference `jennie_boy_diagram.json`.

### C. Use the upload-dialog hints

`generationCount` in particular: when set, snap the topology layout to exactly that many rows even if the parent-partnership chain produces fewer (handles cases where the auto-detection misses a generation). `expectedPersonCount` could drive a confidence warning if the actual count differs by > 30%.

### D. Add gender-accuracy + deceased-count assertions

Right now the integration test asserts ≥ 1 deceased symbol and same-generation Y, but not exact gender counts. A `jennie_boy_topology.json` reference (separate from the hand-curated `jennie_boy_diagram.json`) could enumerate expected per-symbol shape + deceased status. The test then asserts ≥ 80% match.

## Files of interest

- `src/utils/genogram/pipeline.ts` — top-level orchestrator
- `src/utils/genogram/preprocess.ts` — image decode + threshold
- `src/utils/genogram/symbols.ts` — contour detection + filtering
- `src/utils/genogram/shape.ts` — circle/square/triangle classification
- `src/utils/genogram/xDetect.ts` — deceased X detection
- `src/utils/genogram/xRemove.ts` — inpaint X strokes before OCR
- `src/utils/genogram/letterOcr.ts` — Tesseract + VLM letter OCR
- `src/utils/genogram/letterVlm.ts` — Anthropic per-symbol fallback
- `src/utils/genogram/connectors.ts` — partnership inference from Hough lines
- `src/utils/genogram/assemble.ts` — `applyTopologyLayout` + `resolveOverlaps` + final JSON shape
- `src/utils/genogram/__tests__/integrationHelpers.ts` — Node polyfills
- `scripts/integration-test.ts` — standalone integration runner (`npm run test:genogram`)
- `src/utils/cvLoader.ts` — opencv.js loader (Node works, browser blocked — see above)
- `vite.config.ts` — has `optimizeDeps.exclude: ['@techstark/opencv-js', 'tesseract.js']`

## Reference fixture

`jennie_boy_diagram.json` (repo root) is the goal-reference. It was hand-built and has:
- 24 people (10 female, 14 male per `birthSex`)
- 4 partnerships
- Specific names ("Wayne", "Jennie", "Charlie", "Macwhite Mother", etc.)
- Deceased markers on Charlie, Helen, Dennis, and one Gen-1 male
- Per-person notes synthesised from handwritten text near the symbols

The pipeline cannot reproduce the curator-chosen ids, the auto-inferred names ("Macwhite Mother"), or the synthesised notes (those come from text *adjacent* to the symbols, which we do not yet detect). The integration test compares topology (counts and shape) rather than exact equality.
