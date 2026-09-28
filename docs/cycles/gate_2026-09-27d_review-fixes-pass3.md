# Learning-QA gate — 2026-09-27d (review-fixes, pass 3 — FINAL)

**Verdict: APPROVED** (0 high, 0 medium, 1 low)

Third and final pass. The two medium findings from pass 2 are resolved and mutation-verified;
a warm re-sweep of the four fix commits plus an independent cold pass found no medium-or-higher
findings. Per P26 the loop stops when a pass produces nothing of medium or higher. The one low
finding (stale planning docs) is carried in `TODO.md`, not fixed in-loop.

## Range

`git diff origin/main...HEAD` — merge-base `5e93600`, the 19 commits `ea340c8..98e3900` on top of
`origin/main`. 47 files, +3045 / −3123.

This pass re-swept only the four new commits since pass 2 (`824d195..HEAD`: 22 files,
+185 / −2385) and re-confirmed the pass-1/pass-2 resolutions. The earlier 15 commits
(`ea340c8..824d195`) were already swept in gates 2026-09-27b and 2026-09-27c and are unchanged.

New commits since pass 2:

- 038c7ef Merge: count triangles that collapse to fewer than three people   ← fix for finding 2
- a5ce83a Delete the unreachable image-import review path                    ← fix for finding 1
- 5e5df44 Draw people with no recorded sex as a triangle                     (user decision)
- 98e3900 Session capture: leave an undated event's date blank, not today    (user decision)

## Build/test gates (CLAUDE.md)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx vitest run` | PASS — 744 passed, 0 skipped, 73 files (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

Test count fell 780 → 744 from pass 2: the deletion removed the dead review-modal path's tests
(including all 13 previously-skipped tests), net of the new regression tests added this pass.
A final full-suite run after all mutation probes confirmed the working tree is byte-identical to
the committed state (`git diff -- src/frontend/src` empty).

## Review scope

Reviewed against generic patterns P1–P36 (`~/.claude/standards/learnings.md`) and repo patterns
L1–L8 (`LEARNINGS.md`). One warm pass (this gate) on the four fix commits plus one **cold** pass
delegated to an independent reviewer given only the diff and the rulebooks (no change narrative).
The cold pass agreed with the warm pass: one low L1 finding, nothing higher.

Not assessed (out of the failure-pattern family): logic/algorithmic correctness of genogram layout,
UI-contract/a11y regression, security, performance, concurrency.

## Resolution of the two pass-2 mediums

### Medium #1 — P5 / L1 · dead unhardened review-modal path → resolved by a5ce83a (deletion)

The defect was dead code, so the fix is a deletion and is verified structurally rather than by a
unit test (there is no behaviour to assert):

- grep for every deleted symbol — `analyzeImageToDiagramData`, `ImageDiagramReviewModal`,
  `convertExtractedToDiagram`, `applyNotesPositions`, `autoLayoutExtractedDiagram`,
  `applyHorizontalConnectorY`, `PersonInventoryItem`, `ExtractedDiagramData`, and the module names
  `imageAnalysis`, `extractedDataToDiagram`, `diagramLayout`, `personInventory`, `inventoryExport`
  — returns **zero** references anywhere in `src/frontend/src`.
- All three gates pass with the files gone (L1's actual harm — a parallel implementation drifting
  out of the gates — is eliminated, not patched).
- All 13 previously-skipped tests are gone (`grep` for `.skip(`/`.todo` returns nothing).
- The M5.A.1 "one image modal at a time" test was itself a source-text grep assertion (the P19
  corollary anti-pattern) and was deleted with its subject; `ImageDiagramModal.test.tsx` no longer
  reads `DiagramModals.tsx` source.
- `docs/features.md` now states there is no review step and notes the retry/validation on the live
  `vlmImport` path. The live path (`vlmImport → factsToDiagramImportData`) is untouched.

### Medium #2 — P2 · degenerate triangle dropped uncounted → resolved by 038c7ef

`diagramMerge.ts:436` now increments `droppedTriangles` before the early return, and the summary
message was updated in the same change to read "triangles that involved them or no longer had
three different people" (so the broadened count's message did not go stale — the P26-corollary
failure shape is avoided).

Mutation-verified: reverting `droppedTriangles += 1` to the old bare `return` makes
`diagramMerge.test.ts` → "counts a triangle whose people merge into fewer than three" go RED
(`droppedTriangles` 0 ≠ 1); green on restore. The test asserts the **exact** `toBe(1)` and
`toHaveLength(0)` — not a floor — so an over-count would also fail (P29 satisfied).

## New commits (5e5df44, 98e3900) — user-decision changes, reviewed for patterns

- **5e5df44** `isSexUnknown` (utils/personSex.ts) enumerates all four sex fields on `Person`
  (`gender`, `birthSex`, `genderIdentity`, `genderSymbol`), so there is no narrow-scope miss (P3).
  It is not a duplicate of the existing predicates: `deriveGenderSymbol`/`deriveBirthSex`
  deliberately fall back to female for unset sex (the very conflation this commit undoes), so the
  "is nothing recorded" question did not previously have an answer to share. The unknown fill is
  `DEFAULT_INTERSEX_FILL_COLOR` (`#D9D9D9`, neutral gray) — the correct neutral fill; no separate
  "unknown" fill constant exists. The two maturity-badge tests that counted `Circle` children (an
  instance of the newly-documented L8) now match the badge `Rect` by its fill. Mutation-verified:
  removing the `if (sexUnknown) return renderShape('triangle-up')` branch makes the "renders …
  as a triangle, not a circle" test go RED; green on restore.
- **98e3900** the session-capture builder leaves `date`/`startDate` blank instead of stamping
  today, and (newly) sets `startDate` from the capture — closing a latent invariant gap. The
  undated count is incremented only **after** the dedupe fingerprint return, so skipped events are
  not double-counted, and the "Applied" alert reports the count loudly (the opposite of a P2 silent
  drop). Mutation-verified: restoring `new Date().toISOString().slice(0, 10)` makes the "leaves
  the date blank" test go RED (date became `2026-09-28` ≠ ''); green on restore.

## Findings (ranked)

### 1. LOW — L1 · four implementation-plan docs still enumerate the deleted review-modal pipeline

`docs/implementation_plan_2026-05-22.md`, `-06-06.md`, `-06-07.md`, `-06-07c.md` still list
`imageAnalysis.ts`, `personInventory.ts`, `extractedDataToDiagram.ts`, `diagramLayout.ts`,
`inventoryExport.ts`, `types/imageAnalysis.ts` and `ImageDiagramReviewModal.tsx` as the current
implementation path. The living docs were handled — `docs/features.md` now points at `vlmImport`
and records the deletion, and CLAUDE.md's index repoints the active path — but these planning docs
were not retired, so a reader following them chases files that no longer exist. The primary L1 harm
(undeployable gates from a parallel implementation) is absent. Fix: add a RETIRED banner to each
plan (or repoint its file references to `vlmImport.ts`/`genogramRules.ts`). Confidence: high that
the references are stale, low that it matters. **Backlog** — below-medium, not fixed in-loop
(per P26 corollary); carried in `TODO.md`.

## Severity grading

No blockers. One low finding (backlog). Below-medium items from earlier passes remain carried in
`TODO.md` (pass-2 lows #3–#5 plus the session-capture `howWell` default), unchanged.

## Notes

- The cold reviewer was given only the materialized diff (`git diff 824d195..HEAD`) and the two
  rulebooks, no change narrative. It independently returned "1 finding, 0 high" and the same single
  L1 low finding the warm pass found — agreement, not self-echo (P26).
- The deletion commit a5ce83a also removed a genuine anti-pattern test (source-text grep for the
  modal gate, P19 corollary) — a bonus, not a regression.
- Housekeeping outside the gate's family: an untracked `test import 1.json` sits in the repo root
  (a manual app export, not a test leak — the suite uses localStorage/jsdom, and no test writes
  files). Should be removed or gitignored.
