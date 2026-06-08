# Implementation Plan: Jennie's Boy Image → Diagram

**Date:** 2026-06-06
**Goal:** Make the existing image-extraction pipeline produce, for `Test Data/Family Diagram Jennies Boy for Import.jpg`, a diagram whose structure matches the reference `jennie_boy_diagram.json` (24 persons, 4 partnerships, child→parent wiring, deceased flags, descriptive notes, dating-vs-married distinction).

`jennie_boy_diagram.json` is the **goal reference**, not a literal-equality target. Pixel-perfect coordinates are not required; topological and field-level fidelity is.

---

## What already exists (do not re-build)

Phases 1–4 of the prior plan (`docs/implementation_plan_2026-05-22.md`) shipped in commits `cfd4bb8` … `e2e6105`:

- `src/frontend/src/utils/imageAnalysis.ts` — Vision API call with `VISION_PROMPT`
- `src/frontend/src/types/imageAnalysis.ts` — `ExtractedDiagramData`, `ExtractedPerson`, `ExtractedRelationship`, `ExtractedAnnotation`
- `src/frontend/src/utils/personInventory.ts`, `inventoryExport.ts`
- `src/frontend/src/utils/extractedDataToDiagram.ts` — extracted → `Person`/`Partnership`
- `src/frontend/src/utils/diagramLayout.ts` — hierarchical auto-layout
- `src/frontend/src/components/modals/ImageDiagramModal.tsx`, `ImageDiagramReviewModal.tsx`
- File menu entry, wiring in `DiagramEditor.tsx` (handlers `handleImageDiagramPicker` / `…Analyze` / `…CreateDiagram` at lines 3142–3224)
- Integration test scaffolding `src/frontend/src/utils/imageAnalysis.integration.test.ts`

The Vision prompt and the extracted→Person/Partnership conversion produce output that diverges from `jennie_boy_diagram.json` in measurable ways. This plan closes those gaps.

---

## Gap analysis (current pipeline vs. target JSON)

| # | Gap | Symptom in pipeline today | Target JSON has |
|---|---|---|---|
| G1 | Children carry no `parentPartnership` | `extractedDataToDiagram.ts` lines 35–62 never set the field | `parentPartnership: "partner2"` on p10–p14, etc. |
| G2 | `horizontalConnectorY` is always 0 | Layout doesn't write back to partnerships | 85 / 109 / 372 / 439 |
| G3 | `notesPosition` always `{x:0,y:0}` | Hard-coded default | Per-person offset (e.g. p3 `{x:111,y:129}`) |
| G4 | Partnership `notes` always `''` | Vision prompt doesn't ask for it; conversion drops it | "Ned (farmer, silent) and Lucy …" |
| G5 | Dating relationships become "married" | Conversion defaults `relationshipStatus: 'married'` regardless of type (line 97) | `relationshipType: 'dating'`, `relationshipStatus: 'ongoing'` for partner4 |
| G6 | Deceased marker not surfaced | `symbols: ["X"]` extracted but never merged into `notes` | `notes: "Generation 1 (deceased)"`, `"…(deceased)"` suffix |
| G7 | Speculative lineage not captured | No equivalent in `ExtractedRelationship` | p16 `notes: "Speculative lineage"` |
| G8 | Unnamed persons may get `extractedName: ""` | Vision could return empty strings; conversion runs `sentenceCaseName('')` | `name: "Unknown Female"` / `"Unknown Male"` placeholders |
| G9 | Per-person descriptive labels lost | Vision prompt asks for `notes` but doesn't enumerate the categories visible in real diagrams (occupation, traits, health) | Rich notes like "Pregnant, religious, superstitious, 'uneducated' …" |
| G10 | `birthSex: 'unknown'` collapses to `male` (line 36) | Always biases toward male | Two genders only in target; unknown becomes a placeholder name |
| G11 | Layout spacing too tight (100px) and partnerships not used for placement | Siblings collide; parents not aligned over children's centroid | Wide layout, parents flanking children |
| G12 | `imageDiagramReviewOpen` wired to `imageDiagramModalOpen && extractedDiagramData !== null` (DiagramEditor.tsx ~4795) creates UX where the upload modal stays open behind the review modal | Both modals visible at once | — (UX issue, must verify) |

---

## Acceptance criteria

Every criterion is verifiable by a specific automated test or output-artifact check on the fixture `Test Data/Family Diagram Jennies Boy for Import.jpg`.

### M1 — Data shape parity with `jennie_boy_diagram.json`

**M1.A.1** — Each child in a partnership's `children[]` has its `parentPartnership` field set to that partnership's `id`.
- File to change: `src/frontend/src/utils/extractedDataToDiagram.ts`
- Test: `extractedDataToDiagram.test.ts::test_m1a1_children_have_parentPartnership` — build a fixture with 1 partnership + 2 children, assert both children's `parentPartnership` equals partnership id.

**M1.A.2** — Each partnership's `horizontalConnectorY` is computed from the average of the two partners' `y` after layout, not left at 0.
- File to change: `src/frontend/src/utils/diagramLayout.ts` (or new step in DiagramEditor handler)
- Test: `diagramLayout.test.ts::test_m1a2_horizontalConnectorY_set` — after layout, every partnership has `horizontalConnectorY > 0` and equals `(partner1.y + partner2.y) / 2 + 30` (offset rule documented in test).

**M1.A.3** — `notesPosition` for any person with non-empty `notes` is set to `{ x: person.x + offset, y: person.y - offset }` with `offset = 90` so the note renders near, not on top of, the node.
- File to change: `src/frontend/src/utils/extractedDataToDiagram.ts`
- Test: `extractedDataToDiagram.test.ts::test_m1a3_notesPosition_offset` — given a person at (200, 200) with notes, assert `notesPosition.x !== 0` and `notesPosition.y !== 0`.

**M1.A.4** — Partnership `notes` field is populated from a new `ExtractedRelationship.notes` field returned by the Vision prompt.
- Files to change: `src/frontend/src/types/imageAnalysis.ts` (add `notes?: string` to `ExtractedRelationship`), `src/frontend/src/utils/imageAnalysis.ts` (VISION_PROMPT must request it), `src/frontend/src/utils/extractedDataToDiagram.ts` (pipe it through).
- Test: `extractedDataToDiagram.test.ts::test_m1a4_partnership_notes_piped` — input relationship with `notes: "Ned (farmer) and Lucy (talkative)"`, assert output partnership's `notes` equals that string.

**M1.A.5** — `relationshipStatus` is derived from `relationshipType`: married→`'married'`, dating→`'ongoing'`, affair→`'ongoing'`, common-law→`'ongoing'`.
- File to change: `src/frontend/src/utils/extractedDataToDiagram.ts` (replace hard-coded `'married'` at line 97).
- Test: `extractedDataToDiagram.test.ts::test_m1a5_status_matches_type` — table-driven test over all four type values.

### M2 — Vision prompt fidelity

**M2.A.1** — `VISION_PROMPT` instructs the model to embed key descriptors into `notes`: occupation, character traits, health conditions, age-at-event, deceased status. Prompt explicitly lists the categories.
- File to change: `src/frontend/src/utils/imageAnalysis.ts` (rewrite `VISION_PROMPT`)
- Test: `imageAnalysis.test.ts::test_m2a1_prompt_lists_note_categories` — string contains the words "occupation", "character traits", "health", "deceased".

**M2.A.2** — When `symbols` contains `"X"` (deceased), `extractedDataToDiagram.ts` appends `" (deceased)"` to that person's `notes` (or sets `notes` to `"(deceased)"` if empty).
- File to change: `src/frontend/src/utils/extractedDataToDiagram.ts`
- Test: `extractedDataToDiagram.test.ts::test_m2a2_deceased_in_notes` — given an extracted person with `symbols: ["X"]` and no notes, assert output `notes === "(deceased)"`; with existing notes "Farmer", assert `notes === "Farmer (deceased)"`.

**M2.A.3** — `ExtractedRelationship` gains an optional `speculative: boolean` field. When true, the conversion appends `"Speculative lineage"` to each child's notes (or to the partnership notes — decision recorded in test).
- Files: `types/imageAnalysis.ts`, `imageAnalysis.ts` (prompt asks for it), `extractedDataToDiagram.ts`, `extractedDataToDiagram.test.ts::test_m2a3_speculative_lineage`.

**M2.A.4** — Unnamed persons (Vision returns empty `extractedName` or single "?") get placeholder names `"Unknown Female"` or `"Unknown Male"` based on gender (`gender === 'female'` → female placeholder; `male` → male; `unknown` → `"Unknown Person"`).
- File: `src/frontend/src/utils/extractedDataToDiagram.ts`
- Test: `extractedDataToDiagram.test.ts::test_m2a4_unnamed_placeholders` — three-case table.

**M2.A.5** — When `gender === 'unknown'`, do not collapse to `'male'`. Use `birthSex: 'intersex'` (existing valid value) and `genderIdentity: 'nonbinary'`.
- File: `src/frontend/src/utils/extractedDataToDiagram.ts` (line 36)
- Test: `extractedDataToDiagram.test.ts::test_m2a5_unknown_gender_not_male`.

### M3 — Layout fidelity

**M3.A.1** — `HORIZONTAL_SPACING` increases from 100 to 180 (children should not overlap given default node size 45 + label width). `GENERATION_SPACING` increases from 150 to 200.
- File: `src/frontend/src/utils/diagramLayout.ts`
- Test: `diagramLayout.test.ts::test_m3a1_no_node_overlap` — for a partnership with 5 children, all child `x` values differ by ≥ 100.

**M3.A.2** — When a partnership has children, the two partners are positioned to flank the centroid of their children's x-range (parent1 = centroidX − partnerOffset, parent2 = centroidX + partnerOffset), instead of being placed independently in their own generation row.
- File: `src/frontend/src/utils/diagramLayout.ts`
- Test: `diagramLayout.test.ts::test_m3a2_parents_centered_over_children` — partner1.x < min(child.x) < partner2.x.

### M4 — End-to-end on the Jennie's Boy fixture

**M4.A.1** — Integration test calls `analyzeImageToDiagramData` on `Test Data/Family Diagram Jennies Boy for Import.jpg` (using `ANTHROPIC_API_KEY` from env, `.skip` if absent) and the result satisfies all M4.A.2–M4.A.7 below.
- File: `src/frontend/src/utils/imageAnalysis.integration.test.ts` (extend, do not rewrite)

**M4.A.2** — Extracted person count is between 18 and 28 (target is 24; allow ±25% for Vision variance).
- Test: `imageAnalysis.integration.test.ts::test_m4a2_person_count_jennies_boy`

**M4.A.3** — Extracted partnership count is between 3 and 5 (target is 4).
- Test: `imageAnalysis.integration.test.ts::test_m4a3_partnership_count_jennies_boy`

**M4.A.4** — At least one extracted relationship has `type: 'dating'` (the Jennie + father-of-children pair).
- Test: `imageAnalysis.integration.test.ts::test_m4a4_dating_relationship_present`

**M4.A.5** — After conversion + layout, every child has a non-null `parentPartnership` and every partnership has `horizontalConnectorY > 0`.
- Test: `imageAnalysis.integration.test.ts::test_m4a5_post_conversion_structure`

**M4.A.6** — At least 5 persons have non-empty `notes` (Charlie, Lucy, Ned, Jennie, Wayne, Rose, Dennis, etc.). Names of key people (case-insensitive substring match) appear in the extracted set: `"jennie"`, `"wayne"`, `"lucy"`, `"ned"`, `"charlie"`.
- Test: `imageAnalysis.integration.test.ts::test_m4a6_key_names_and_notes`

**M4.A.7** — Persons drawn with X (Helen, Dennis, Charlie, the gen-1 male parent, etc.) have `(deceased)` in `notes` after conversion.
- Test: `imageAnalysis.integration.test.ts::test_m4a7_deceased_marked`

### M5 — UX correctness

**M5.A.1** — When the review modal opens, the file-upload modal closes (only one image-flow modal visible at a time).
- File: `src/frontend/src/components/DiagramEditor.tsx` (the `imageDiagramReviewOpen` boolean composition near line 4795 plus `imageDiagramModalOpen` state)
- Test: `DiagramEditor.test.tsx::test_m5a1_only_one_image_modal_at_a_time` — simulate upload-then-analyze flow, assert upload modal is closed when review modal opens.

**M5.A.2** — `Test Data/Family Diagram Jennies Boy for Import.jpg` exists and is loadable as a Blob in the integration test (verifies fixture path).
- Test: `imageAnalysis.integration.test.ts::test_m5a2_fixture_loadable` — `fs.statSync(path).size > 100_000`.

---

## Implementation order (with dependencies)

1. **M2.A.4, M2.A.5** — placeholder names & unknown-gender fix. No deps. Pure functions, easy to test first.
2. **M2.A.1** — rewrite `VISION_PROMPT`. No code deps.
3. **M1.A.4, M2.A.3** — extend `ExtractedRelationship` type with `notes` + `speculative`. Update type guard.
4. **M2.A.2** — deceased marker synthesis.
5. **M1.A.1** — wire `parentPartnership`.
6. **M1.A.3** — `notesPosition` offsetting.
7. **M1.A.5** — `relationshipStatus` derivation.
8. **M3.A.1, M3.A.2** — layout updates (now that all data is correct).
9. **M1.A.2** — `horizontalConnectorY` write-back after layout.
10. **M5.A.1** — modal stacking fix.
11. **M4.A.*** — integration tests on the fixture (last, since they depend on everything above).

---

## Adjacent issues found, not fixed

Per CLAUDE.md workflow rule 8, listing for follow-up rather than silently fixing:

- `extractedDataToDiagram.ts` line 53 sets `notesEnabled: !!person.notes` — but target JSON omits `notesEnabled` entirely on most persons (defaults to undefined). Inconsistency; defer.
- `extractedDataToDiagram.ts` constructs `Person` objects with hard-coded `size: 45` and `paperoScores: {}`. Target JSON has no `size`/`paperoScores` fields on any person. Conversion fills more than the target shape strictly needs. Defer; harmless.
- `imageAnalysis.ts` model is pinned to `claude-3-5-sonnet-20241022`. Newer vision-capable models (Sonnet 4.6/Opus 4.7) may improve extraction quality. Defer model upgrade as a separate task with measurable accuracy comparison.
- API key is read from `localStorage.getItem('anthropic_api_key')` (DiagramEditor.tsx line 3164). No UI for setting it. The "Please set your Anthropic API key in settings" alert dead-ends. Defer; out of scope for this image-fidelity work.
- `imageAnalysis.ts` lines 124–142 perform deduplication on `personIdMap` but never actually rewrites IDs — the map is populated and discarded. Dead code. Defer.

---

## Spec coverage (status report — 2026-06-07)

| Spec ID | Description | Implementation | Test | Status |
|---|---|---|---|---|
| M1.A.1 | parentPartnership on children | `src/frontend/src/utils/extractedDataToDiagram.ts` | `extractedDataToDiagram.test.ts::test_m1a1_children_have_parentPartnership` | done |
| M1.A.2 | horizontalConnectorY set after layout | `src/frontend/src/utils/diagramLayout.ts` (`applyHorizontalConnectorY`) | `diagramLayout.test.ts::test_m1a2_horizontalConnectorY_set` | done |
| M1.A.3 | notesPosition offset from person | `src/frontend/src/utils/extractedDataToDiagram.ts` (`applyNotesPositions`) | `extractedDataToDiagram.test.ts::test_m1a3_notesPosition_offset` | done |
| M1.A.4 | Partnership notes piped through | `src/frontend/src/types/imageAnalysis.ts`, `src/frontend/src/utils/imageAnalysis.ts`, `src/frontend/src/utils/extractedDataToDiagram.ts` | `extractedDataToDiagram.test.ts::test_m1a4_partnership_notes_piped` | done |
| M1.A.5 | relationshipStatus derived from type | `src/frontend/src/utils/extractedDataToDiagram.ts` (`relationshipStatusFor`) | `extractedDataToDiagram.test.ts::test_m1a5_status_matches_type` | done |
| M2.A.1 | Vision prompt lists note categories | `src/frontend/src/utils/imageAnalysis.ts` (`VISION_PROMPT`) | `imageAnalysis.test.ts::test_m2a1_prompt_lists_note_categories` | done |
| M2.A.2 | Deceased symbol → notes suffix | `src/frontend/src/utils/extractedDataToDiagram.ts` (`synthesizePersonNotes`) | `extractedDataToDiagram.test.ts::test_m2a2_deceased_in_notes` | done |
| M2.A.3 | Speculative lineage capture | `src/frontend/src/types/imageAnalysis.ts`, `src/frontend/src/utils/imageAnalysis.ts`, `src/frontend/src/utils/extractedDataToDiagram.ts` | `extractedDataToDiagram.test.ts::test_m2a3_speculative_lineage` | done |
| M2.A.4 | Unnamed → placeholder names | `src/frontend/src/utils/extractedDataToDiagram.ts` (`placeholderName`) | `extractedDataToDiagram.test.ts::test_m2a4_unnamed_placeholders` | done |
| M2.A.5 | Unknown gender → intersex/nonbinary | `src/frontend/src/utils/extractedDataToDiagram.ts` (`birthSexFor`/`genderIdentityFor`) | `extractedDataToDiagram.test.ts::test_m2a5_unknown_gender_not_male` | done |
| M3.A.1 | Layout spacing increased, no overlap | `src/frontend/src/utils/diagramLayout.ts` (`HORIZONTAL_SPACING=180`, `GENERATION_SPACING=200`) | `diagramLayout.test.ts::test_m3a1_no_node_overlap` | done |
| M3.A.2 | Parents centered over children | `src/frontend/src/utils/diagramLayout.ts` (parent-centering pass) | `diagramLayout.test.ts::test_m3a2_parents_centered_over_children` | done |
| M4.A.2 | Person count 18–28 on fixture | `src/frontend/src/utils/imageAnalysis.integration.test.ts` | `test_m4a2_person_count_jennies_boy` | done (live test, gated on `RUN_VISION_TESTS=1`) |
| M4.A.3 | Partnership count 3–5 on fixture | `src/frontend/src/utils/imageAnalysis.integration.test.ts` | `test_m4a3_partnership_count_jennies_boy` | done (live test, gated on `RUN_VISION_TESTS=1`) |
| M4.A.4 | At least one dating relationship | `src/frontend/src/utils/imageAnalysis.integration.test.ts` | `test_m4a4_dating_relationship_present` | done (live test, gated on `RUN_VISION_TESTS=1`) |
| M4.A.5 | Post-conversion structure valid | `src/frontend/src/utils/imageAnalysis.integration.test.ts` | `test_m4a5_post_conversion_structure` | done (live test, gated on `RUN_VISION_TESTS=1`) |
| M4.A.6 | Key names and notes present | `src/frontend/src/utils/imageAnalysis.integration.test.ts` | `test_m4a6_key_names_and_notes` | done (live test, gated on `RUN_VISION_TESTS=1`) |
| M4.A.7 | Deceased persons marked | `src/frontend/src/utils/imageAnalysis.integration.test.ts` | `test_m4a7_deceased_marked` | done (live test, gated on `RUN_VISION_TESTS=1`) |
| M5.A.1 | One image modal at a time | `src/frontend/src/components/DiagramModals.tsx` line 716 — `<ImageDiagramModal open={imageDiagramModalOpen && !imageDiagramReviewOpen} … />` (already correct) | `ImageDiagramModal.test.tsx::test_m5a1_only_one_image_modal_at_a_time` (source-shape check) + render tests for `open=true/false` | done |
| M5.A.2 | Fixture loadable | `src/frontend/src/utils/imageAnalysis.integration.test.ts` | `test_m5a2_fixture_loadable` | done |

### Pre-completion gate (CLAUDE.md mandatory 3 steps)

| Step | Command | Result |
|---|---|---|
| 1 | `cd src/frontend && npx tsc --noEmit` | passed (no output, exit 0) |
| 2 | `cd src/frontend && npx vitest run` | 303 passed, 13 skipped, 0 failed (35/35 files) |
| 3 | `cd src/frontend && rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | passed (no output, exit 0) |

### Live-test runbook

The M4.A tests make real Claude Vision API calls. To run them:

```bash
cd src/frontend
RUN_VISION_TESTS=1 ANTHROPIC_API_KEY=sk-ant-... npx vitest run src/utils/imageAnalysis.integration.test.ts
```

Without `RUN_VISION_TESTS=1`, those tests skip — keeping `npx vitest run` deterministic and free of network/API-cost surprises in CI or sandboxed environments.

### Version

Bumped `src/frontend/src/data/version.ts` from `v 1.97-0522-12-56` → `v 1.98-0607-08-22`.

### Human-only verification (still pending)

- Visual diagram match on screen after running the pipeline on the Jennie's Boy image, comparing side-by-side with `jennie_boy_diagram.json` rendered in the app.
- Notes-content sufficiency — sample-check that descriptive content (occupation, traits) is roughly captured for the named figures.

---

## Human-only verification

Criteria that cannot be fully automated:

- **Visual diagram match.** After running the pipeline on the Jennie's Boy image and saving the result, a human compares it side-by-side with the target `jennie_boy_diagram.json` rendered in the app. Looks for: correct family-tree topology, readable labels, partnership types annotated correctly. Captured as a manual checklist row in the status report.
- **Notes content sufficiency.** The Vision API will produce note text that varies in wording. M4.A.6 covers presence of key names but a human must sample-check that the descriptive content (occupation, traits) is roughly captured for the named figures.

---

## Out of scope (do not address in this work)

- Editing `notesPosition` interactively in the review modal
- Drag-to-reorder persons within a partnership in the review modal
- Image preprocessing (rotation, contrast) before sending to Vision
- Caching of Vision responses
- Upgrading the Vision model
- Anthropic API key management UI
