# Implementation Plan: Pure-JavaScript OpenCV Replacement

**Date:** 2026-06-08

**Goal:** Replace `@techstark/opencv-js` WASM dependency with pure-JavaScript implementations of the 15 CV operations used by the genogram extraction pipeline. This eliminates the ESM/CommonJS incompatibility that blocks browser-side image import.

**Context:** 
- Node integration tests pass (npm run test:genogram) — algorithm is correct
- Browser fails: "Cannot set properties of undefined (setting 'cv')" due to Vite ESM transformation
- Temporary fix adds error handling + timeout, but image import still doesn't work
- This plan implements the permanent solution (Option A1 from genogram-import-status.md)

---

## Overview of Required Operations

The pipeline uses 15 CV operations across 6 functional areas:

| Category | Operations | Used in |
|----------|-----------|---------|
| **Image I/O** | matFromImageData, Mat class | preprocess.ts |
| **Color conversion** | cvtColor (RGBA→Gray) | preprocess.ts |
| **Thresholding** | threshold (Otsu) | preprocess.ts |
| **Morphology** | morphologyEx (MORPH_OPEN), getStructuringElement | symbols.ts |
| **Contours** | findContours, boundingRect, arcLength, contourArea | symbols.ts, symbolRecord.ts |
| **Contour analysis** | approxPolyDP, minEnclosingCircle | symbols.ts, shape.ts |
| **Line detection** | HoughLinesP | connectors.ts, xDetect.ts |
| **Advanced** | inpaint (for X removal) | xRemove.ts |

---

## Acceptance Criteria

Every acceptance criterion is verifiable by an existing automated test that currently passes with mock cv objects (vitest).

### A. Mat Data Structure (M-A)

**A.1** — Pure-JS Mat class with:
- Constructor: `new Mat(rows, cols, type, data?)`
- Properties: `rows`, `cols`, `data` (Uint8ClampedArray or Float32Array)
- Methods: `delete()`, `clone()`, `at()`, `set()`
- Support for single-channel (CV_8U) and multi-channel (CV_8UC4) types
- Test: `matFromImageData.test.ts` — must pass existing tests with new Mat class

**A.2** — matFromImageData(imageData): Mat
- Convert browser ImageData → Mat
- Input: ImageData from canvas.getImageData()
- Output: Mat with 4 channels, type CV_8UC4
- Test: `preprocess.test.ts::test_m1a1_grayscale_binary_output` — outputs single-channel 0/255

### B. Color Space Conversion (M-B)

**B.1** — cvtColor(src: Mat, dst: Mat, code: number): void
- Only CV_RGBA2GRAY required initially
- Input: 4-channel RGBA Mat
- Output: 1-channel grayscale Mat (0-255)
- Algorithm: weighted average (0.299R + 0.587G + 0.114B)
- Test: `preprocess.test.ts` — cvtColor called once with COLOR_RGBA2GRAY

### C. Thresholding (M-C)

**C.1** — threshold(src: Mat, dst: Mat, thresh: number, maxVal: number, type: number): number
- Support CV_THRESH_BINARY_INV | CV_THRESH_OTSU
- If OTSU flag set, compute optimal threshold via histogram
- If BINARY_INV flag set, invert (pixel > thresh ? 0 : 255)
- Return the computed threshold value
- Test: `preprocess.test.ts::test_m1a1_grayscale_binary_output` — output is 0/255 binary

### D. Morphological Operations (M-D)

**D.1** — getStructuringElement(shape: number, size: Size): Mat
- Only CV_MORPH_RECT required
- Input: size = {width, height}
- Output: kernel Mat filled with 1s (all elements included)
- Test: `symbols.test.ts` — morphologyEx called with resulting kernel

**D.2** — morphologyEx(src: Mat, dst: Mat, op: number, kernel: Mat): void
- Only CV_MORPH_OPEN required (= erode then dilate)
- Erode: for each pixel, set to min of neighborhood (under kernel)
- Dilate: for each pixel, set to max of neighborhood (under kernel)
- Purpose: remove thin lines (connectors) before contour detection
- Test: `symbols.test.ts::test_m2a1_horizontal_line_erased` — thin lines removed

### E. Contour Detection (M-E)

**E.1** — findContours(image: Mat, contours: MatVector, hierarchy: Mat, mode: number, method: number): void
- Input: binary image (0/255 only)
- Mode: CV_RETR_EXTERNAL (outermost contours only)
- Method: CV_CHAIN_APPROX_SIMPLE (compress contours, keep corner points)
- Output: populate contours (MatVector of contour Mats) and hierarchy (parent/child relationships)
- Algorithm: standard 8-connectivity flood-fill / contour tracing
- Test: `symbols.test.ts::test_m2a2_detects_three_separate_shapes` — 3 separate shapes → 3 contours

**E.2** — MatVector data structure
- Container for multiple Mat objects (contours)
- Methods: get(index), push_back(mat), size()
- Equivalent to C++ std::vector<Mat>

**E.3** — boundingRect(contour: Mat): Rect
- Input: single contour (list of x,y points)
- Output: {x, y, width, height}
- Rect object: { x, y, width, height, area?, perimeter? }

### F. Contour Analysis (M-F)

**F.1** — arcLength(curve: Mat, closed: boolean): number
- Input: contour points (Nx1 or Nx2 Mat of floats)
- Output: perimeter (sum of distances between consecutive points)
- closed: true → distance from last to first point included
- Test: `shape.test.ts` — circularity = 4π·area/perimeter²

**F.2** — contourArea(contour: Mat): number
- Input: contour points
- Output: enclosed area (shoelace formula)
- Test: `shape.test.ts::test_m3a1_classifies_circle_above_0_85_circularity` — area used in circularity

**F.3** — minEnclosingCircle(contour: Mat): {center: {x, y}, radius: number}
- Input: contour points
- Output: smallest enclosing circle (Welzl's algorithm or similar)
- circleFillRatio = area / (π·radius²) used in shape classification
- Test: `shape.test.ts::test_m3a1_classifies_circle_above_0_85_circularity` — ratio ≥0.85 → circle

**F.4** — approxPolyDP(curve: Mat, approxCurve: Mat, epsilon: number, closed: boolean): void
- Input: contour points, epsilon = 0.015 * arcLength
- Output: simplified polygon (fewer points, within epsilon distance)
- Ramer-Douglas-Peucker algorithm
- Used to count corners (triangles have 3, squares have 4)
- Test: `shape.test.ts::test_m3a1_classifies_triangle_by_vertex_count` — triangle = 3 vertices

### G. Line Detection (M-G)

**G.1** — HoughLinesP(image: Mat, lines: Mat, rho: number, theta: number, threshold: number, minLineLength: number, maxLineGap: number): void
- Input: binary image, rho=1, theta=π/180, threshold=30-40, minLen=80-100, maxGap=6-8
- Output: lines Mat (Nx4) with [x1, y1, x2, y2] per line
- Probabilistic Hough transform for line detection
- Used in:
  - connectors.ts: detect horizontal (couple) and vertical (parent-child) lines
  - xDetect.ts: detect ±45° diagonals (deceased X marks)
- Test: `connectors.test.ts::test_m8a1_detects_horizontal_couple_and_vertical_child` — lines detected and grouped

### H. Advanced Operations (M-H)

**H.1** — inpaint(image: Mat, mask: Mat, dst: Mat, radius: number, flags: number): void
- Input: source image, mask (0/255), radius (pixels to inpaint), flags=CV_INPAINT_TELEA
- Output: image with masked regions reconstructed
- Purpose: remove X-stroke pixels before OCR
- Algorithm: Telea's fast marching method (or simple diffusion fallback)
- Test: `xRemove.test.ts::test_m5a1_removes_synthetic_x_keeps_letter` — X gone, letter ≥80% intact

**H.2** — subtract(src1: Mat, src2: Mat, dst: Mat): void
- Input: two Mats
- Output: dst = src1 - src2 (clamped to 0)
- Used in connector erasure (preprocessing)
- Test: `symbols.test.ts::test_m2a1_horizontal_line_erased` — connector lines removed

---

## Implementation Order

**Phase 1: Core Image Ops (M-A, M-B, M-C)**
- Justification: Required for preprocessing; all downstream depends on this
- Files: new `src/utils/cv-js/matCore.ts`, update `cvLoader.ts`
- Tests: preprocess.test.ts (currently mocked, will pass with new impl)
- Effort: ~100 LOC

**Phase 2: Morphology (M-D)**
- Justification: Next step in preprocessing pipeline
- File: new `src/utils/cv-js/morphology.ts`
- Test: symbols.test.ts::test_m2a1_horizontal_line_erased
- Effort: ~150 LOC (erode/dilate are straightforward)

**Phase 3: Contour Detection & Analysis (M-E, M-F)**
- Justification: Core algorithm; most complex (~50% of work)
- File: new `src/utils/cv-js/contours.ts`
- Tests: symbols.test.ts (detection), shape.test.ts (analysis)
- Effort: ~500 LOC
  - findContours: ~200 LOC (8-connectivity tracing)
  - arcLength, contourArea: ~40 LOC each
  - approxPolyDP: ~100 LOC (Ramer-Douglas-Peucker)
  - minEnclosingCircle: ~80 LOC (Welzl's algorithm)
  - boundingRect: ~20 LOC

**Phase 4: Line Detection (M-G)**
- Justification: Required for partnership inference
- File: new `src/utils/cv-js/hough.ts`
- Test: connectors.test.ts::test_m8a1_detects_horizontal_couple_and_vertical_child
- Effort: ~250 LOC (Probabilistic Hough is complex but well-documented)

**Phase 5: Advanced Ops (M-H)**
- Justification: Optional for MVP (can use fallback without X removal)
- File: new `src/utils/cv-js/inpaint.ts`
- Test: xRemove.test.ts
- Effort: ~150 LOC (simple diffusion OK as fallback)

---

## Dependencies & Critical Path

```
Phase 1 (Mat, cvtColor, threshold)
    ↓
Phase 2 (morphologyEx) ──┐
    ↓                     ├→ Phase 3 (findContours)
Phase 3 (contours)       │
    ├────────────────────┘
    ↓
Phase 3 analysis (arcLength, area, approxPolyDP, minEnclosingCircle)
    ↓
Shape classification (uses Phase 3 analysis)
    ↓
Phase 4 (HoughLinesP) ← can start once Phase 1 done
    ↓
Partnership inference
    ↓
Phase 5 (inpaint) ← optional
```

**Critical path:** Phase 1 → Phase 2 → Phase 3 (contour detection) → shape analysis
**Parallelizable:** Phase 4 can start after Phase 1; Phase 5 is optional

---

## Module Structure

```
src/utils/cv-js/
├── index.ts               # Exports a cv-like namespace
├── matCore.ts             # Mat class, matFromImageData, cvtColor, threshold
├── morphology.ts          # morphologyEx, getStructuringElement
├── contours.ts            # findContours, boundingRect, arcLength, contourArea, etc.
├── hough.ts               # HoughLinesP
├── inpaint.ts             # inpaint, subtract (optional)
└── types.ts               # Mat, Rect, Size, etc. type definitions
```

**Replacement in cvLoader.ts:**
```typescript
// Change from:
const cv = await import('@techstark/opencv-js');

// To:
const cv = await import('./cv-js');
```

No consumer code changes needed—the cv namespace is identical.

---

## Test Strategy

1. **Existing unit tests:** Keep all existing mocks during development, then swap implementations
2. **Integration test:** Run `npm run test:genogram` with real fixture images
3. **Regression:** All 406 vitest tests must pass
4. **Performance:** Ensure preprocess completes in <1s for typical phone photo (downscaled to 1600px)

---

## Risk Mitigation

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| Contour detection off-by-one errors | High | Extensive unit tests per coordinate system; compare against test fixtures |
| HoughLinesP accuracy | Medium | Parameter tuning (rho, theta, threshold, minLen, maxGap) via integration test |
| Inpaint visual artifacts | Medium | Keep fallback (skip X removal) if Telea too slow; simple diffusion is OK |
| Performance regression | Low | Benchmark Phase 1 ops on realistic images; target <200ms total |
| Browser compatibility | Low | Pure JS, no platform-specific code; IE11 not required (modern browsers only) |

---

## Acceptance Checklist

- [ ] All 406 vitest tests pass
- [ ] `npm run test:genogram` passes (all 3 fixtures, 42 assertions per)
- [ ] `npx tsc --noEmit` clean
- [ ] `npx tsc -b` (Vercel build) clean
- [ ] Image import works end-to-end: File → Image Diagram → Analyze → ~3 seconds → diagram appears
- [ ] Preprocessing completes in <1s for 1600px image
- [ ] Error log shows no "cv undefined" errors
- [ ] At least 1 person extracted from each test fixture

---

## Files to Modify

- `src/utils/cvLoader.ts` — change import source
- `src/utils/cv-js/` — all new files (7 files, ~1500 LOC total)
- `package.json` — remove @techstark/opencv-js dependency ✓ (bonus: reduces bundle)
- `vite.config.ts` — remove `optimizeDeps.exclude: ['@techstark/opencv-js']` (no longer needed)

---

## Effort Estimate

- Phase 1: 3-4 hours (Mat + basic ops)
- Phase 2: 2 hours (morphology)
- Phase 3: 6-8 hours (contours + analysis; most complex)
- Phase 4: 3-4 hours (Hough; moderate complexity)
- Phase 5: 2 hours (inpaint; optional)
- Testing + integration: 2-3 hours
- **Total: 18-24 hours** (2-3 days solo)

---

## Success Criteria

**The feature works when:**
1. User uploads a diagram image (File → Image Diagram)
2. Clicks "Analyze"
3. ~3 seconds later (vs 30s+ with WASM): diagram loads with extracted people/partnerships
4. Extraction accuracy within ±40% of reference (per integration tests)
5. No "Cannot set properties of undefined" or module loading errors in console
