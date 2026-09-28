# Learning-QA gate — 2026-09-27b (review-fixes)

**Verdict: REJECTED** (1 high, 2 medium findings)

## Range

`git diff origin/main...HEAD` — merge-base `5e93600`, the 12 commits `ea340c8..57a3370` on top of `origin/main`. 29 files, +2653 / −729.

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

## Build/test gates (CLAUDE.md)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx vitest run` | PASS — 771 passed, 13 skipped (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

## Review scope

Reviewed against generic patterns P1–P36 (`~/.claude/standards/learnings.md`) and repo patterns L1–L7 (`LEARNINGS.md`). One warm pass (this gate) + one cold pass (independent reviewer given only the diff and the rulebooks, no change narrative). Both passes independently found finding 1.

Not assessed (out of the failure-pattern family): general algorithmic correctness of the genogram layout rules (R1–R17/R20/R21), UI-contract/a11y regression, concurrency, security, performance, dependency risk.

## Findings (ranked)

### 1. HIGH — P3/P5 · transcript regex: removing the `i` flag made keyword matching case-sensitive

`src/frontend/src/utils/dataImport.ts:1823-1937` (the 11 `parseTranscriptToDraftDiagram` patterns)

The fix for "pronouns became people" removed the `i` flag from every pattern, so the case-sensitive `[A-Z][a-z]+` name capture is now correct — but the *keyword* portions (married, died, born, had/have, killed, argued/fight/conflict, cut off/estranged, fused/enmeshed, focused on/projected) are also case-sensitive now. Only `dxPattern` got compensation (`[Dd]iagnos`, `[Ss]chizophrenia`). The other 10 patterns silently stop matching a capitalized keyword ("Ann Died 1995", "Tom and Ann Married in 1970"), producing no person/partnership/event with no signal. Tests cover only lowercase keywords plus the one capitalized diagnosis case; a capitalized verb is never asserted.

Fix: match keywords case-insensitively (character class on the leading letter, e.g. `[Mm]arried`, `[Dd]ied`, `[Bb]orn`, `[Hh]ad`, `[Kk]illed`, …) while keeping the name capture case-sensitive; add a regression test asserting a capitalized keyword still parses.

### 2. MEDIUM — P5 · the unsaved-changes guard misses the Build Demo replace path

`src/frontend/src/components/AppRibbon.tsx:324-328` + `src/frontend/src/hooks/useFileOperations.ts:412-420, 502-506`

The guard added by ea340c8 covers Open/Reopen/Restore/import-replace, but not Build Demo. `handleStartBuildDemo` does confirm when dirty, yet it is wired only to `HelpModal`'s `onStartBuildDemo`. The ribbon Help-menu "Build Demo" item opens `BuildDemoModal` directly (`setBuildDemoOpen(true)`) without that confirm, and step navigation (`handleBuildDemoStepChange` → `applyBuildDemoStep` → `replaceDiagramState`) replaces the diagram with no prompt — silently discarding unsaved changes. This is the same class ea340c8 fixed, missed at a second entry point.

Fix: route the ribbon "Build Demo" action through `handleStartBuildDemo`, or add a `confirmDiscardUnsavedChanges` guard inside `applyBuildDemoStep`/`handleBuildDemoStepChange`.

### 3. MEDIUM — P3 · merge lays out only *added* partnerships, so a new child in a matched couple is left unlaid-out

`src/frontend/src/utils/diagramMerge.ts:482-485`

The layout pass runs over `newPersonIds` × `addedPartnershipIds`. A new child merged into an existing (name-matched) partnership is in `newPersonIds` but its partnership is *not* in `addedPartnershipIds`, so `normalizeImportedChildLayout([child], [])` hits its early return and the child keeps its raw imported x/y (grid or VLM coordinates), possibly overlapping existing people. Data links are correct; the defect is purely visual and silent, and no test covers "new child added to a matched couple".

Fix: include matched partnerships that absorbed new children in the layout set (or lay new children out against their matched partnership); add a regression test for a new child merged into an existing couple.

## Mutation testing (does each regression test fail without its fix?)

Nine fixes reverted one at a time (working tree restored after each); every targeted regression test went RED, then green again on restore:

| Fix | Test | Without fix |
|---|---|---|
| `resolveImportedGender` "unknown" | dataNormalization "explicit unknown" | FAIL |
| `removePartnership` functional update | usePersonOperations "two removePartnership" | FAIL |
| `removeChildFromPartnership` functional update | usePersonOperations "removeChildFromPartnership works from the latest" | FAIL |
| `removePerson` dangling-partnership cleanup | usePersonOperations "removes the deleted person's partnership ids" | FAIL |
| import-replace confirm guard | DiagramEditor.unsavedChanges "declining keeps the dialog open" | FAIL |
| `clearDiagramLocalStorage` writes `[]` | storage "stores an empty diagram" | FAIL |
| transcript `isName` guard | dataImport "does not turn pronouns or role words into people" | FAIL |
| image-import `exactNamesOnly` | dataImport "does not merge M and M (b.1968)" | FAIL |
| `mergeDiagramData` `resolvePersonId` drop | diagramMerge "does not add … a skipped person" | FAIL |

Not individually mutated (verified by inspection / round-trip design): `sessionCapture` (reads people back from autosave, per d6a6059 "fails when the old female/male defaults are restored"), `startupState` (round-trips autosave), `dateFormatting` (TZ pinned to America/Vancouver), `vlmImport` retry (stubbed fetch + fake timers), `normalizeImportedChildLayout` purity (deepFreeze).

## Verified clean

- `normalizeImportedChildLayout` return-type change (`Person[]` → `{people, partnerships}`) and mutation→pure change: all call sites updated (grep + both typecheck gates); no stale caller, no `as any` remnants.
- `mergeDiagramState` → `mergeDiagramData` extraction: `mergeDiagramState` still exists only as the DiagramEditor wrapper; both documented behaviour changes (drop skipped-person refs; scope layout to new people) are implemented and tested.
- `alignMultipleBirthAnchors` extraction: the dropped `derivedAssignments` branch was confirmed never populated (dead code).
- Startup restore: `savedSnapshotRef` starts `''` but is populated by `markSnapshotClean` on mount (DiagramEditor.tsx:1548), so the empty-snapshot "always dirty" trap does not fire; empty-array-vs-missing-key distinction is correct.
- `callClaudeVision` retry loop: retryable (429/5xx/529/network) vs terminal (400/401/timeout/abort) is correctly distinguished; abort during backoff is handled.
- `sanitizeVLMFacts`: every drop is recorded into `uncertainties` (loud, not silent).

## Notes for the fix loop

Finding 1 is the only blocker for the high tier; findings 2 and 3 are medium and can be scheduled without holding the merge if the team wants to split them. All three are in the silent-failure family this gate exists to catch, and none is caught by the current test suite.
