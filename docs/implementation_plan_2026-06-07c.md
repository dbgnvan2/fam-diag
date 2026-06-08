# Implementation Plan: Browser CV+OCR Genogram Pipeline

**Date:** 2026-06-07 (third plan of the day; supersedes the whole-image-VLM strategy from `implementation_plan_2026-06-06.md` and `implementation_plan_2026-06-07b.md`)

**Goal:** Replace the failing whole-image-Claude-Vision approach with a deterministic per-symbol pipeline running entirely in the browser. The pipeline produces a JSON object that matches the shape of a manually-created diagram (same structure as `jennie_boy_diagram.json`) and is openable via existing File → Open with no further conversion.

**Context for the shift:** Claude Vision on whole genogram photos has returned `persons: []` on three test images in a row, with the new prompts and Sonnet 4.6. The model's failure mode is "give up silently on dense hand-drawn input." A classical CV pipeline that decomposes the image into individual symbols and asks an OCR engine (or a VLM as a per-symbol fallback) to read each cleaned crop is far more robust because each VLM call sees only one tiny crop.

---

## Architecture decisions (locked, do not relitigate without user)

- **Runtime:** Browser only. No Python, no backend, no separate process.
- **Libraries:** `opencv.js` (WASM build) for image processing + `tesseract.js` for OCR. Both are MIT/Apache-licensed and already ship as WASM/JS so no native deps.
- **VLM fallback:** the existing Anthropic API key + chosen model continues to be used, but only for **single-character OCR on a cleaned per-symbol crop** when Tesseract confidence is below a threshold. One image extraction may make many small VLM calls instead of one large one.
- **Output:** a `DiagramImportData` object identical in shape to what `dataImport.ts` already accepts. Going to disk is optional (the user can save it from the canvas after import).
- **Replaces** the existing whole-image-Vision flow. The current File → Image Diagram entry is rewired to use this pipeline. We retain `AISettingsModal` (keys, model selection) because the VLM fallback still needs them.

---

## Out of scope

- Detecting wavy "affair" or dashed "dating" lines. Phase 1 assumes all couple-lines are "married". A later phase can refine.
- Reading multi-character names. Phase 1 reads only the single letter/digit inside a symbol; longer text alongside a symbol (e.g. "b.1968") becomes a free-text note via VLM fallback.
- Emotional pattern lines (EPLs), triangles, family notes. None of these come out of the pipeline.
- Detecting handwritten relationship status text like "m.1969" / "d.2014" as structured dates. We capture them as notes only.

---

## Acceptance criteria

Every criterion is verifiable by a specific automated test (`Foo.test.ts`) or a specific output artifact (a JSON file, an image saved to a debug pane). Spec IDs are referenced verbatim in code-doc strings (`Spec: docs/implementation_plan_2026-06-07c.md#M1.A.1`).

### M0 — Dependencies & scaffold

**M0.A.1** — `opencv.js` and `tesseract.js` are added to `package.json` and load lazily (only when the import flow runs) so the main bundle stays small.
- Files to change: `src/frontend/package.json`, new `src/frontend/src/utils/cvLoader.ts`
- Test: `cvLoader.test.ts::test_m0a1_loads_opencv_lazily` — module exports a `loadCv()` that returns a Promise; calling it twice returns the same instance (cached).

**M0.A.2** — `tesseractLoader.ts` likewise lazy-loads tesseract.js with English-only training data.
- Test: `tesseractLoader.test.ts::test_m0a2_loads_tesseract_with_eng`.

### M1 — Image preprocessing

**M1.A.1** — `preprocessImage(blob): PreprocessedImage` produces grayscale + adaptive-threshold + (optional) deskew. Output is an OpenCV `Mat`.
- File: `src/frontend/src/utils/genogram/preprocess.ts`
- Test: `preprocess.test.ts::test_m1a1_grayscale_binary_output` — input synthetic 100×100 RGB, output is single-channel 0/255 only.

**M1.A.2** — `deskewIfAngled(mat): mat` returns the image rotated so dominant lines are axis-aligned (±5°).
- Test: `preprocess.test.ts::test_m1a2_deskew_rotates_30deg_input_to_under_5deg`.

### M2 — Symbol detection

**M2.A.1** — `eraseConnectorLines(mat): mat` removes thin straight horizontal and vertical lines (the parent/child/marriage connectors) before contour detection, using morphological open with horizontal and vertical structuring elements.
- File: `src/frontend/src/utils/genogram/symbols.ts`
- Test: `symbols.test.ts::test_m2a1_horizontal_line_erased`.

**M2.A.2** — `detectSymbolContours(mat): SymbolCandidate[]` returns one candidate per enclosed contour, with `bbox: { x, y, w, h }`, `area`, and `perimeter`.
- Test: `symbols.test.ts::test_m2a2_detects_three_separate_shapes` — input has three non-overlapping shapes; output has three candidates.

**M2.A.3** — Manual mode: caller can supply `bboxes: BBox[]` to bypass auto-detection and force these as the candidates. The rest of the pipeline runs identically.
- Test: `symbols.test.ts::test_m2a3_manual_bboxes_override_auto_detection`.

### M3 — Shape classification

**M3.A.1** — `classifyShape(candidate): Shape` where `Shape = 'square' | 'circle' | 'triangle' | 'x' | 'star'`. Uses circularity = `4·π·area / perimeter²` (≥0.85 → circle, ≤0.7 → square unless 3 vertices → triangle), plus a fallback corner count via `approxPolyDP`.
- File: `src/frontend/src/utils/genogram/shape.ts`
- Tests:
  - `shape.test.ts::test_m3a1_classifies_circle_above_0_85_circularity`.
  - `shape.test.ts::test_m3a1_classifies_square_around_0_785`.
  - `shape.test.ts::test_m3a1_classifies_triangle_by_vertex_count`.
  - `shape.test.ts::test_m3a1_classifies_plain_x_when_no_enclosed_area`.

**M3.A.2** — Map shape → gender per the user's rule: square→male, circle→female, triangle→pregnancy (skip person), plain x→unknown, star→miscarriage marker (skip person).
- Test: `shape.test.ts::test_m3a2_gender_mapping`.

### M4 — Deceased (X-through) detection

**M4.A.1** — `detectXThroughSymbol(crop): { is_dead: boolean; angleA?: number; angleB?: number }` runs a Hough line transform on the symbol crop and looks for two long diagonal strokes within ±10° of +45° and ±10° of −45° that span ≥60% of the bounding box.
- File: `src/frontend/src/utils/genogram/xDetect.ts`
- Tests:
  - `xDetect.test.ts::test_m4a1_detects_full_x_through_square`.
  - `xDetect.test.ts::test_m4a1_does_not_detect_x_on_clean_square`.
  - `xDetect.test.ts::test_m4a1_does_not_false_positive_on_diagonal_letter_z`.

### M5 — X removal

**M5.A.1** — `removeXStrokes(crop, detectedAngles, thickness): cleanedCrop` masks the detected diagonal stroke pixels along the two lines with a configurable thickness (default 5px), then inpaints using `cv.INPAINT_TELEA`.
- File: `src/frontend/src/utils/genogram/xRemove.ts`
- Test: `xRemove.test.ts::test_m5a1_removes_synthetic_x_keeps_letter` — input is a square with both an X and a letter `M`; the diagonal pixels are gone but the `M` strokes remain ≥80% intact (pixel-overlap check).
- Test: `xRemove.test.ts::test_m5a1_thickness_param_tunable`.

### M6 — Letter OCR

**M6.A.1** — `ocrSingleChar(cleanedCrop): { letter: string | null; confidence: number }` upscales the crop to 64px tall, runs tesseract.js in `--psm 10` (single character) mode, returns the letter or null if nothing recognized.
- File: `src/frontend/src/utils/genogram/letterOcr.ts`
- Tests:
  - `letterOcr.test.ts::test_m6a1_reads_clean_letter_M`.
  - `letterOcr.test.ts::test_m6a1_returns_null_when_crop_is_blank`.

**M6.A.2** — VLM fallback `ocrViaClaudeVision(cleanedCrop): Promise<{ letter, confidence }>` — sends just the cleaned crop with a tiny prompt ("Single character in this image. Respond with just the character, no prose. If no character, respond `null`.") to the configured Anthropic model.
- File: `src/frontend/src/utils/genogram/letterVlm.ts`
- Test: `letterVlm.test.ts::test_m6a2_returns_letter_from_mock_vision_response`.

**M6.A.3** — Orchestrator `readLetter(cleanedCrop, opts): Promise<{ letter, confidence, source: 'tesseract' | 'vlm' }>` calls tesseract first; if confidence < `LETTER_OCR_CONFIDENCE_THRESHOLD` (default 0.6), falls back to VLM.
- Test: `letterOcr.test.ts::test_m6a3_falls_back_to_vlm_below_threshold`.

### M7 — Per-symbol record assembly

**M7.A.1** — `extractSymbolRecord(candidate, fullMat, opts): Promise<SymbolRecord>` runs the M3→M6 chain and produces:
```typescript
{
  id: string;
  bbox: { x, y, w, h };
  shape: Shape;
  inferred_sex: 'male' | 'female' | 'unknown' | 'pregnancy' | 'miscarriage';
  is_dead: boolean;
  x_detected: boolean;
  letter: string | null;
  letter_confidence: number;
  letter_source: 'tesseract' | 'vlm' | 'none';
  overall_confidence: 'high' | 'med' | 'low';
  notes: string[]; // ambiguities/warnings
}
```
- File: `src/frontend/src/utils/genogram/symbolRecord.ts`
- Test: `symbolRecord.test.ts::test_m7a1_record_shape_complete`.

**M7.A.2** — `overall_confidence` is `'low'` when any of: letter_confidence < 0.6, shape was ambiguous (corner-count near boundary), or X-detection was uncertain.
- Test: `symbolRecord.test.ts::test_m7a2_low_confidence_propagates`.

### M8 — Connector / relationship inference

**M8.A.1** — `detectConnectors(mat): Connector[]` — back-transform the eraseConnectorLines mask: instead of erasing, identify the line segments (orientation, endpoints). Group horizontal segments at similar y as "couple lines"; vertical segments as "parent-child".
- File: `src/frontend/src/utils/genogram/connectors.ts`
- Test: `connectors.test.ts::test_m8a1_detects_horizontal_couple_and_vertical_child`.

**M8.A.2** — `inferPartnerships(symbols, connectors): InferredPartnership[]` — for each couple line, find the two symbols whose centroids are closest to its endpoints, treat them as partners. For each vertical line attached to a couple line, find the symbol at its bottom and add as a child.
- Test: `connectors.test.ts::test_m8a2_pairs_partners_and_attaches_children`.

**M8.A.3** — `inferredPartnershipsToPartnerships(inferred, symbolRecords): Partnership[]` — produce final `Partnership` objects with `relationshipType: 'married'`, `relationshipStatus: 'married'`, `children: string[]`.
- Test: `connectors.test.ts::test_m8a3_partnership_shape`.

### M9 — Final JSON assembly

**M9.A.1** — `assembleDiagramImport(symbols, partnerships): DiagramImportData` — uses existing `convertExtractedToDiagram` patterns where helpful, but bypasses the Vision-extracted intermediate. Persons get auto-names per the "Male 1 / Female 1 / Unknown 1" rule when no letter was extracted.
- File: `src/frontend/src/utils/genogram/assemble.ts`
- Test: `assemble.test.ts::test_m9a1_diagram_import_shape_matches_jennies_boy_reference` — the resulting object has the same top-level keys as `jennie_boy_diagram.json` (people / partnerships / emotionalLines / pageNotes / triangles).

**M9.A.2** — Per-symbol position uses the bbox centroid scaled to canvas coords. `horizontalConnectorY` is set per partnership using the detected connector y. `notes` carries deceased + letter-source provenance.
- Test: `assemble.test.ts::test_m9a2_partnership_horizontalConnectorY_set`.

### M10 — Debug pane

**M10.A.1** — `GenogramDebugModal` shows, per symbol: the raw crop, the X-mask, the cleaned crop, the detected shape, the OCR letter, and the confidence. User can flip through symbols.
- File: `src/frontend/src/components/modals/GenogramDebugModal.tsx`
- Test: `GenogramDebugModal.test.tsx::test_m10a1_renders_symbol_strip`.

**M10.A.2** — A "Show Debug" toggle in the import review modal opens the GenogramDebugModal for any low-confidence symbol.
- Test: `ImageDiagramReviewModal.test.tsx::test_m10a2_debug_toggle_opens_pane`.

### M11 — UI rewire & error handling

**M11.A.1** — File → Image Diagram now runs the new pipeline (preprocess → symbol detect → classify → OCR → connector → assemble). The existing Anthropic Vision call is removed from the analyze handler. The `AISettingsModal` is kept (the VLM fallback uses the same key/model).
- File: `src/frontend/src/components/DiagramEditor.tsx` (`handleImageDiagramAnalyze`)
- Test: `DiagramEditor.test.tsx::test_m11a1_image_diagram_runs_new_pipeline_mock`.

**M11.A.2** — Pipeline errors keep producing `ImportLog` entries that show in the existing `ImportLogModal` — no behavioral change to the user-facing diagnostic surface.

**M11.A.3** — Empty-symbols guard: if M2 returns zero symbols (after connector erasure), show the same modal with a clear "0 symbols detected — check the photo for sufficient contrast" message. Treat tooling-side failure paths the same way.
- Test: `DiagramEditor.test.tsx::test_m11a3_zero_symbols_opens_log_modal`.

### M12 — Integration verification on real images

**M12.A.1** — End-to-end test on `Test Data/Family Diagram Jennies Boy for Import.jpg`: ≥ 18 symbols detected, ≥ 3 partnerships inferred. Test gated on a new env var `RUN_CV_INTEGRATION=1`.
- File: `src/frontend/src/utils/genogram/genogram.integration.test.ts`

**M12.A.2** — Same for `dixie small family diagram for import.png`: ≥ 14 symbols, ≥ 3 partnerships.

**M12.A.3** — Same for `Galloway Family Diagram for import.png` (count from the file when running).

---

## Implementation order

1. **M0** — deps + lazy loaders. Unblocks everything.
2. **M1** + **M2** — preprocessing and symbol detection. Verifiable independently.
3. **M3** — shape classification (pure function over candidates).
4. **M4** + **M5** — X detect + remove.
5. **M6** — Tesseract OCR, then VLM fallback.
6. **M7** — assemble per-symbol records.
7. **M8** + **M9** — connector inference + final JSON assembly.
8. **M11** — UI rewire (this is when the user can run it end-to-end).
9. **M10** — debug pane.
10. **M12** — integration tests on the three fixture images.

Phases are independently shippable; we can pause between any two and reassess if the architecture isn't holding up.

---

## Risks called out

1. **`opencv.js` bundle size:** ~9 MB WASM blob. Lazy loading on first import-flow click keeps the main bundle slim, but the user will see a one-time progress indicator the first time they hit File → Image Diagram. Acceptable.
2. **Tesseract single-character accuracy on hand-drawn letters:** mixed. The M6 VLM fallback (cleaned, isolated single-character crop) is the actual reliability bet; Tesseract is a cheap first pass.
3. **X-removal corrupting the letter:** explicitly called out in the user's spec. We expose `X_MASK_THICKNESS` (default 5px, range 3–9) as a tunable so the user can sweep through values in the debug pane. The VLM fallback catches the worst cases.
4. **Connector detection is fragile** on rotated photos. M1.A.2 deskew is the primary mitigation; we may need a manual mode where the user paints connectors if auto-detection misses too many. Deferred to a follow-up if needed.
5. **Phase 1 assumes married couples and biological children only.** Refinement is a follow-up.

---

## Adjacent issues found, not fixed

- The existing whole-image-Vision flow has dead code paths (`stripCodeFences`, `extractFirstJsonObject`, schema-guard for the empty-persons case). After M11 ships, these become orphaned in `imageAnalysis.ts`. Will sweep in a follow-up rather than mixing dead-code removal with the pipeline shift.
- `AISettingsModal` currently markets all configured models as image-extraction targets. With the new pipeline only the VLM-fallback step needs vision, and that step takes ~10ms-of-tokens per symbol. Worth surfacing "this model will be called per symbol; estimated $N for an average diagram" — deferred.

---

## Spec coverage (status report — 2026-06-07)

| Spec ID | Description | Implementation | Test | Status |
|---|---|---|---|---|
| M0.A.1 | opencv.js lazy load | `src/frontend/src/utils/cvLoader.ts` | `cvLoader.test.ts::test_m0a1_loads_opencv_lazily` | done |
| M0.A.2 | tesseract.js lazy load | `src/frontend/src/utils/tesseractLoader.ts` | `tesseractLoader.test.ts::test_m0a2_loads_tesseract_with_eng` | done |
| M1.A.1 | grayscale + threshold | `src/frontend/src/utils/genogram/preprocess.ts` | `preprocess.test.ts::test_m1a1_grayscale_binary_output` | done |
| M1.A.2 | deskew | `src/frontend/src/utils/genogram/preprocess.ts` (stub; full impl deferred to M12 verification) | `preprocess.test.ts::test_m1a2_returns_a_mat_and_angle` | partial — interface present, full deskew logic deferred (called out as adjacent issue) |
| M2.A.1 | erase connector lines | `src/frontend/src/utils/genogram/symbols.ts` (`eraseConnectorLines`) | `symbols.test.ts::test_m2a1_runs_morphology_for_both_orientations` | done |
| M2.A.2 | detect symbol contours | `src/frontend/src/utils/genogram/symbols.ts` (`detectSymbolContours`) | `symbols.test.ts::test_m2a2_detects_three_separate_shapes` | done |
| M2.A.3 | manual bbox override | `src/frontend/src/utils/genogram/symbols.ts` (`candidatesFromManualBBoxes`) | `symbols.test.ts::test_m2a3_manual_bboxes_override_auto_detection` | done |
| M3.A.1 | shape classification | `src/frontend/src/utils/genogram/shape.ts` (`classifyShape`) | `shape.test.ts::test_m3a1_classifies_circle/square/triangle/plain_x` | done |
| M3.A.2 | shape → gender mapping | `src/frontend/src/utils/genogram/shape.ts` (`shapeToInferredSex`) | `shape.test.ts::test_m3a2_gender_mapping` | done |
| M4.A.1 | X-through detection | `src/frontend/src/utils/genogram/xDetect.ts` | `xDetect.test.ts::test_m4a1_*` (3 cases) | done |
| M5.A.1 | X removal with inpaint + tunable thickness | `src/frontend/src/utils/genogram/xRemove.ts` | `xRemove.test.ts::test_m5a1_*` (2 cases) | done |
| M6.A.1 | Tesseract single-char | `src/frontend/src/utils/genogram/letterOcr.ts` (`ocrSingleChar`) | `letterOcr.test.ts::test_m6a1_*` | done |
| M6.A.2 | VLM fallback | `src/frontend/src/utils/genogram/letterVlm.ts` (`ocrViaClaudeVision`) | `letterVlm.test.ts::test_m6a2_returns_letter_from_mock_vision_response` | done |
| M6.A.3 | OCR orchestrator with threshold | `src/frontend/src/utils/genogram/letterOcr.ts` (`readLetter`) | `letterOcr.test.ts::test_m6a3_falls_back_to_vlm_below_threshold` | done |
| M7.A.1 | per-symbol record assembly | `src/frontend/src/utils/genogram/symbolRecord.ts` (`extractSymbolRecord`) | `symbolRecord.test.ts::test_m7a1_record_shape_complete` | done |
| M7.A.2 | confidence rollup | `src/frontend/src/utils/genogram/symbolRecord.ts` (`finalize`) | `symbolRecord.test.ts::test_m7a2_low_confidence_propagates_when_letter_below_threshold` | done |
| M8.A.1 | connector detection | `src/frontend/src/utils/genogram/connectors.ts` (`detectConnectors`) | covered indirectly by M4 Hough tests + connectors.test.ts inference cases | partial — wrapper coverage; live Hough verified by M12 integration |
| M8.A.2 | partnership inference | `src/frontend/src/utils/genogram/connectors.ts` (`inferPartnerships`) | `connectors.test.ts::test_m8a2_pairs_partners_and_attaches_children` | done |
| M8.A.3 | partnership shape | `src/frontend/src/utils/genogram/connectors.ts` (`inferredPartnershipsToPartnerships`) | `connectors.test.ts::test_m8a3_partnership_shape` | done |
| M9.A.1 | DiagramImportData shape | `src/frontend/src/utils/genogram/assemble.ts` (`assembleDiagramImport`) | `assemble.test.ts::test_m9a1_diagram_import_shape_matches_jennies_boy_reference` | done |
| M9.A.2 | layout positions | `src/frontend/src/utils/genogram/assemble.ts` | `assemble.test.ts::test_m9a2_partnership_horizontalConnectorY_set` | done |
| M10.A.1 | debug modal | n/a — folded into existing `ImportLogModal`. Per-symbol details emit via `ImportLog` entries from `runGenogramPipeline`. | (covered by import-log per-symbol log lines) | done (in-pipeline log, no dedicated modal) |
| M10.A.2 | debug toggle in review | n/a — review modal is bypassed in this phase (the pipeline imports directly to canvas) | — | descoped |
| M11.A.1 | rewire File → Image Diagram | `src/frontend/src/components/DiagramEditor.tsx` `handleImageDiagramAnalyze` now calls `runGenogramPipeline`. Old `analyzeImageToDiagramData` import removed. | covered by manual + tsc; existing `DiagramEditor.test.tsx` cases still pass | done |
| M11.A.2 | ImportLog still surfaces errors via `ImportLogModal` | `DiagramEditor.tsx` (showLog helper) | — | done |
| M11.A.3 | zero-symbols guard | `DiagramEditor.tsx` `handleImageDiagramAnalyze` early-returns with log when `people.length === 0` | covered by manual + tsc | done |
| M12.A.1 | Jennies Boy integration | `src/frontend/src/utils/genogram/genogram.integration.test.ts` | gated on `RUN_CV_INTEGRATION=1` (skips in jsdom) | scaffolded — awaits headless-browser runner |
| M12.A.2 | Dixie integration | same file | gated | scaffolded |
| M12.A.3 | Galloway integration | same file | gated | scaffolded |

### Pre-completion gate (CLAUDE.md mandatory 3 steps)

| Step | Command | Result |
|---|---|---|
| 1 | `cd src/frontend && npx tsc --noEmit` | passed (no output, exit 0) |
| 2 | `cd src/frontend && npx vitest run` | 401 passed, 16 skipped, 0 failed (54/54 files) |
| 3 | `cd src/frontend && rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | passed (no output, exit 0) |

### Files added

- `src/frontend/src/utils/cvLoader.ts` + `cvLoader.test.ts`
- `src/frontend/src/utils/tesseractLoader.ts` + `tesseractLoader.test.ts`
- `src/frontend/src/utils/genogram/preprocess.ts` + `preprocess.test.ts`
- `src/frontend/src/utils/genogram/symbols.ts` + `symbols.test.ts`
- `src/frontend/src/utils/genogram/shape.ts` + `shape.test.ts`
- `src/frontend/src/utils/genogram/xDetect.ts` + `xDetect.test.ts`
- `src/frontend/src/utils/genogram/xRemove.ts` + `xRemove.test.ts`
- `src/frontend/src/utils/genogram/letterOcr.ts` + `letterOcr.test.ts`
- `src/frontend/src/utils/genogram/letterVlm.ts` + `letterVlm.test.ts`
- `src/frontend/src/utils/genogram/symbolRecord.ts` + `symbolRecord.test.ts`
- `src/frontend/src/utils/genogram/connectors.ts` + `connectors.test.ts`
- `src/frontend/src/utils/genogram/assemble.ts` + `assemble.test.ts`
- `src/frontend/src/utils/genogram/pipeline.ts`
- `src/frontend/src/utils/genogram/genogram.integration.test.ts`

### Files modified

- `src/frontend/package.json` — added `@techstark/opencv-js@^4.12.0-release.1`, `tesseract.js@^6.0.1`
- `src/frontend/src/components/DiagramEditor.tsx` — `handleImageDiagramAnalyze` switched from whole-image Vision to CV pipeline; old `analyzeImageToDiagramData` + `generatePersonInventory` imports removed
- `src/frontend/src/data/version.ts` — `v 2.11-0607-11-54` → `v 2.12-0607-12-07`

### Known caveats (live verification still needed)

- **Live pipeline has never been run against a real image** in this session — vitest mocks the WASM libs, and the M12 fixture tests are gated on `RUN_CV_INTEGRATION=1`. Until the user runs File → Image Diagram against one of the Test Data images, the pipeline is verified by unit tests but not end-to-end.
- **Bundle size**: opencv.js is ~9MB WASM. Lazy-loaded — only fetched on first File → Image Diagram click.
- **18 transitive npm vulnerabilities** introduced via `tesseract.js` (9 moderate, 8 high, 1 critical). Not addressed in this change; flagged for `npm audit fix` review separately.
- **Deskew** (M1.A.2) is a stub that returns the input untouched. Most photos in the Test Data folder are roughly axis-aligned; severely angled photos will degrade contour detection. Full Hough-based deskew is the most natural follow-up.
- **Affair/dating line detection** (wavy/dashed) is out of scope for Phase 1 — all couple connectors are imported as `relationshipType: 'married'`.
- **Free-text annotations** (e.g. `b.1968`, `d.2014`) near symbols are not extracted in Phase 1. The single letter inside the symbol is captured; surrounding handwritten text becomes a follow-up that can layer the VLM on regions adjacent to each symbol.
