# Learning-QA gate — 2026-09-27c (review-fixes, pass 2)

**Verdict: REJECTED** (0 high, 2 medium, 3 low)

The three findings from pass 1 are resolved and mutation-verified, but the re-sweep
of the fix commits and a fresh cold pass surfaced two new medium findings plus three
low ones. Per P26, the loop continues while medium-or-higher findings remain.

## Range

`git diff origin/main...HEAD` — merge-base `5e93600`, the 15 commits `ea340c8..824d195`
on top of `origin/main`. 30 files, +2863 / −741.

Commits:
- ea340c8 Ask before Open, Reopen, restore or import-replace discards unsaved work
- 189bd4a Fix merge: no links to skipped people, no re-layout of existing families
- 5bac135 Transcript import: only real names become people
- f2ea760 Image import: match person labels exactly, not by name prefix
- dfaaec6 Read diagram dates as calendar dates, not local time
- 8038361 Restore stored diagram and indicator definitions faithfully on load
- 61e9f12 Image import layout: lay out every family of a remarried parent
- 3737703 Image import: retry transient API failures and validate the model's JSON
- 98f121b Facts import: include every person it creates in the output
- e03d3dc Deletes: clear dangling partnership ids; use functional state updates
- d6a6059 Import sex: treat an explicit "unknown" as unknown; test session capture
- 57a3370 Move multiple-birth anchor alignment out of DiagramEditor
- 4535c70 Transcript import: accept keywords that start with a capital      ← fix for finding 1
- e67f72a Build Demo from the Help menu asks before replacing unsaved work  ← fix for finding 2
- 824d195 Merge: lay out new children of an existing couple                 ← fix for finding 3

## Build/test gates (CLAUDE.md)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx vitest run` | PASS — 780 passed, 13 skipped (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

## Review scope

Reviewed against generic patterns P1–P36 (`~/.claude/standards/learnings.md`) and repo
patterns L1–L7 (`LEARNINGS.md`). One warm pass (this gate) on the whole range plus a
close read of the three fix commits, and two **cold** passes delegated to independent
reviewers given only the diff and the rulebooks (no change narrative): one over the full
range, one over the fix commits alone (`57a3370..HEAD`). Both cold passes ran
read-only.

Not assessed (out of the failure-pattern family): logic/algorithmic correctness of the
genogram layout rules (R1–R17/R20/R21) and date math, UI-contract/a11y regression,
security, performance, concurrency.

## Resolution of the three pass-1 findings (all mutation-verified)

Each fix was reverted one file at a time (working tree restored after); the targeted
regression test went RED without the fix, green again on restore.

| Finding | Fix | Test (fails without fix) |
|---|---|---|
| 1. HIGH P3/P5 — transcript keywords became case-sensitive | 4535c70 `capitalisableKeywords` wraps all 13 patterns | dataImport "still reads Title Case keywords" + "capitalisableKeywords" — 3 tests fail |
| 2. MEDIUM P5 — Build Demo ribbon item bypassed the discard guard | e67f72a ribbon routes through `handleStartBuildDemo` | unsavedChanges "declining keeps the diagram… (ribbon bypassed the guard)" — 1 test fails |
| 3. MEDIUM P3 — new child of a matched couple kept import coordinates | 824d195 post-pass lays new children of non-added partnerships | diagramMerge "places the child in the couple's child row" + "centres a first child" — 2 tests fail |

Fix quality (warm read + cold pass 2 agreed):

- `capitalisableKeywords` (dataImport.ts:91–122) is correct on every construct the 13
  patterns carry: backslash escapes copy verbatim and reset the word-start flag, the
  `\`-branch runs before the in-class branch so `\n`/`\d` inside `[...]` never read as
  the closing `]`, character classes (name captures) stay case-sensitive, alternations
  and multi-word phrases get only their word-initial letter case-tolerated. It only
  broadens keyword matching; no false negative introduced. `factsToDiagramImportData`'s
  count regex still uses the `i` flag directly but captures only a count token (no name),
  so it is safe and out of scope.
- Build Demo guard: `setBuildDemoOpen(true)` is now called only inside
  `handleStartBuildDemo` (useFileOperations.ts:492), which confirms on `isDirty` first.
  Both entry points (AppRibbon help menu, HelpModal) route through it; grep found no
  remaining unguarded opener.
- diagramMerge child placement: id-space is correct (`addedPartnershipIds` and
  `newPersonIds` are in merged-id space; `parentPartnership` is remapped via
  `partnershipIdMap`), `horizontalConnectorY` is a required `number`, `alignAllAnchors`
  only writes multi-birth anchor X and never mutates x/y, and existing people are
  untouched (asserted by test).

## New findings (ranked)

### 1. MEDIUM — P5 / L1 · `src/frontend/src/utils/imageAnalysis.ts:204` · a dead, unhardened sibling VLM import path is still compiling and under test

`analyzeImageToDiagramData` makes the identical `POST api.anthropic.com/v1/messages`
call that `callClaudeVision` (`genogram/vlmImport.ts`) hardened with retry/backoff/timeout
in 3737703 — and it has **no non-test caller** (only `imageAnalysis.test.ts` and
`imageAnalysis.integration.test.ts` import it; production imports only its `type`s). So
3737703 applied the hardening to one call, not the class (P5), and the retired path was
left in place compiling and under test (the L1 shape this repo has already been bitten
by). The dead file is not itself in this diff — the defect is that the hardening change
in this diff was class-incomplete.

Fix: delete the dead path (and retire its docs, per L1) or reroute it through
`callClaudeVision`; if kept, apply the same retry/backoff/timeout. Confidence: high.

### 2. MEDIUM — P2 · `src/frontend/src/utils/diagramMerge.ts:433` · a degenerate triangle is dropped without being counted

A triangle whose three refs collapse to `<3` unique ids after remap hits
`if (uniquePeople.size !== 3) return;` with no increment to `droppedTriangles`, while the
sibling branch at :419 (`trianglePeople.some((id) => !id)`) does count. The triangle is
correctly dropped (data integrity preserved), but the "N items not added" alert silently
undercounts it. Fix: increment `droppedTriangles` (or a dedicated counter) before the
return so the drop is surfaced. Confidence: med.

### 3. LOW — P5 (consistency) · `src/frontend/src/hooks/useFileOperations.ts:326,385,396,483` · three discard sites still use inline `window.confirm` with divergent messages

`handleNewFile`, `handleLoadDemoDiagram`, and `handleStartBuildDemo` use raw
`window.confirm`, while `confirmDiscardUnsavedChanges` (added by ea340c8) is applied at
the six other discard sites (useFileOperations:223/243/357, DiagramEditor:1747/2723/3102).
Each still guards correctly — this is message/behaviour drift, not a bypass. Fix: route
all three through the helper for one message and behaviour. Confidence: high (low severity).

### 4. LOW — P29 · `src/frontend/src/components/DiagramEditor.startupState.test.tsx:92` · floor assertion

`expect(readStored<Person[]>('people').length).toBeGreaterThan(0)` would stay green if the
default diagram were halved. Fix: assert the exact known default count or membership of
named default people. Confidence: med.

### 5. LOW (layout quality, outside the gate's family) — P5-by-analogy · `src/frontend/src/utils/diagramMerge.ts:515–523` · new-child placement has no same-row collision check

`startX = max(existing.x) + 90` (or centred under the couple for a first child) does not
check overlap with adjacent families, while the sibling `applyFamilyXLayout`
(dataImport.ts:743–764) already nudges same-row collisions. A dense merge can place a new
child on top of the next family's leftmost person. Fix: reuse `applyFamilyXLayout`'s
`collides()` nudge for the placed child. Confidence: med. Backlog — this is layout
quality, the family the gate explicitly does not assess.

## Severity grading (before any fix)

Blockers: findings 1 and 2 (medium). Backlog (below-medium, per P26 corollary —
do not fix in-loop): findings 3, 4, 5.

## Notes

- Pass 1's "Verified clean" items re-confirmed this pass: `normalizeImportedChildLayout`
  contract change has no stale call site (5 call sites updated); `mergeDiagramState` →
  `mergeDiagramData` extraction intact; `callClaudeVision` retry vs terminal status
  distinction intact; startup restore empty-array-vs-missing-key semantics intact.
- Finding 1 is the same shape the gate exists to catch and is a pre-existing path that
  this diff's hardening change failed to cover class-wide; it did not surface in pass 1's
  warm review, which is exactly why the cold pass is mandatory.
