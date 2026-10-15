# Learning-QA gate — 2026-10-14 (partnership-date-edge-cases)

**Verdict: APPROVED** (0 high, 0 medium, 0 low remaining)

The commit fixes three partnership date edge cases: legacy `-p1`/`-p2` copies of
status records no longer double-list on a person's Events tab or Timeline lane;
`start` and `ongoing` share `relationshipStartDate` with the start date owning
the field (`withPartnershipStatusDate`, `statusKeyMirroredBy`); and
`set_partnership_status` (voice) writes through `withPartnershipStatusDate`.
The first cold sweep returned **3 findings (1 high, 2 medium)** — all real, all
fixed in the working tree. The re-sweep of those fixes then caught a **new bug
the fix itself introduced** (a P26 instance: `statusKeyMirroredBy` returns the
field's own key when the field is unset, so a status date held only in
`statusDates` was silently dropped), which was amended and regression-tested.
All three CLAUDE.md gates now pass on the final code. The fix set is
**uncommitted working-tree change** (5 files) and must be committed alongside
`33384f9`; this repo's convention is not to commit unless asked, so it was left
staged for the user.

## Range

`git diff origin/main...HEAD` — 1 commit on `fix/main-event-audit`:

- `33384f9` Fix partnership date edge cases: legacy status-record copies, start/ongoing, voice

16 files changed, +367 / −42 (materialized at `/tmp/sweep_33384f9.diff`, 654 lines):

- `src/frontend/src/utils/relationshipStatusKeys.ts` — `withPartnershipStatusDate`
  migrates a legacy-field-only date into `statusDates` before a sibling status
  that shares the field overwrites the mirror; new `legacyMirror` and
  `statusKeyMirroredBy`.
- `src/frontend/src/utils/listedEvents.ts` — `listedPersonEvents`/`storedPersonEvents`
  gain a required `partnerships` param; `isStatusRecordCopy` filters a person's
  `-p1`/`-p2` copies of partnership status records.
- `src/frontend/src/utils/syntheticDateEvents.ts` — `partnershipDateSlots` uses
  `statusKeyMirroredBy`; the shared-field skip widened so a differing shared-field
  date (ongoing after start) surfaces as its own slot.
- `src/frontend/src/utils/systemEvents.ts`, `PropertiesPanel.tsx`,
  `TimelineBoardModal.tsx` — call sites gain `partnerships`.
- `src/frontend/src/hooks/useVoiceHandlers.ts` — `set_partnership_status` writes
  through `withPartnershipStatusDate`.
- Tests: `listedEvents.test.ts`, `relationshipStatusKeys.test.ts`,
  `syntheticDateEvents.test.ts`, `useVoiceHandlers.test.ts`,
  `legacyStatusRecordCopies.test.tsx`; docs (`CLAUDE.md`, `LEARNINGS.md`,
  `event-system.md`), `version.ts` bump.

## Build/test gates (CLAUDE.md)

Run from `src/frontend`, against the FINAL code (commit + sweep fixes):

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p tsconfig.app.json` | PASS (exit 0) |
| `./node_modules/.bin/vitest run` | PASS — 126 files, 1256 tests (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && ./node_modules/.bin/tsc -b` | PASS (exit 0) |

Test count went 1253 → 1256: the three sweep-fix regression tests added. The
first vitest run (on the untouched commit) showed one timeout in
`DiagramEditor.familyTimeline.test.tsx`; re-run in isolation it passes (1/1), so
it is environmental flakiness from the machine running the reviewer subagent
concurrently, not a regression in this range.

## Sweep loop

### Cold sweep #1 — 3 findings, all fixed

1. **HIGH · P22 · `listedEvents.test.ts:57,63,71`** — `listedPersonEvents(person, [])`
   still used the old 2-arg arity, so the now-required `partnerships` param is
   `undefined`. Not caught by `tsc` (test files are excluded from typecheck, L5),
   and green only because `isStatusRecordCopy` short-circuits before
   `partnerships.find` when no fixture id has a `-p1`/`-p2` suffix. Latent
   TypeError. **Fix:** pass `[]` as the third argument at the three sites.

2. **MEDIUM · P3 · `relationshipStatusKeys.ts:87-91`** — the `anyHolder` migration
   gate tested field *membership*, not value equality, so a start date held only
   in `relationshipStartDate` (e.g. `statusDates: { ongoing: '1985-01-01' }`,
   `relationshipStartDate: '1980-01-01'`) was silently dropped when `ongoing` was
   rewritten — `legacyMirror` then overwrote the field with the ongoing date,
   contradicting the block's own "or it is lost" comment. **Fix:** gate on
   `entryValue === legacyValue && legacyFieldForStatus(entryKey) === legacyField`.

3. **MEDIUM · P3/P19 · `syntheticDateEvents.ts:112`** — the widened skip
   (`partnership[sharedField] === date`) applied to *every* status with a legacy
   field, so divergent unique-field data (married/separated/divorce where the
   legacy field and `statusDates` disagree) emitted a second slot and
   double-listed. **Fix (first attempt):** `statusKeyMirroredBy(partnership,
   sharedField) === statusKey`.

### Cold re-sweep #2 — the fix's own bug (P26)

The re-sweep of the fix set found fixes 1 and 2 correct, but the first fix-3
attempt introduced a new bug:

- **MEDIUM · P26 · `syntheticDateEvents.ts:112`** — `statusKeyMirroredBy` returns
  the field's *own* key when the field value is falsy, so a status date held only
  in `statusDates` with the legacy field unset (`statusDates: { married:
  '1990-01-01' }`, no `marriedStartDate`) was skipped and dropped — verified by
  execution: `synthesizePartnershipDateEvents` returned `[]` where the pre-fix
  predicate returned the date. That state is modelled in the app
  (`PropertiesPanel.test.tsx` carries `statusDates` without legacy fields;
  `diagramMerge.ts` spreads `statusDates` without re-deriving fields).

**Amendment:** require the field to actually hold a value before trusting the
mirror — `partnership[sharedField] && statusKeyMirroredBy(partnership,
sharedField) === statusKey`. This keeps all three behaviours correct: (a) a
statusDates-only date surfaces via the status slot; (b) a divergent unique-field
date stays single (field slot wins); (c) a differing shared-field date (ongoing
after start) still gets its own slot. The amendment is a one-line guard addition
and was verified by tracing all four states plus the full suite; it was not a
third full cold sweep (documented under Not covered).

## Regression tests (mutation-verified)

Three tests added, each asserted with exact values (`==`, no floor):

- `relationshipStatusKeys.test.ts` — "a start date held only in the legacy field
  survives rewriting an ongoing date already in statusDates". Without fix 2 it
  fails (`readPartnershipStatusDate(next,'start')` returns `'1990-01-01'`, not
  `'1980-01-01'`).
- `syntheticDateEvents.test.ts` — "a divergent date on a unique legacy field
  (married) is not double-listed". Without the fix it returned two events
  (`[['Marriage','1991-01-01'],['Married','1990-01-01']]`).
- `syntheticDateEvents.test.ts` — "a status date held only in statusDates (legacy
  field unset) is still listed" (`[['Married','1990-01-01']]`). Without the
  amendment it returned `[]`.

Each was proven red-without/green-with by reverting the fix and re-running the
single test, then restoring.

## Verified clean

- **Single source of truth (derive-from-producer).** `isStatusRecordCopy` reuses
  the producer's actual `isPartnershipStatusRecordEvent` and
  `CLONE_SUFFIX_PATTERN` — no parallel re-implementation of the matching logic.
  `partnershipDateSlots` uses `statusKeyMirroredBy` in both the field-slot map and
  the skip condition, so the field-slot and the skip cannot drift.
- **No floor assertions (P29).** All three new assertions are exact-value.
- **No `any`, no hardcoded event type/category/subtype (rule 2), no direct
  mutation (rule 7), no domain logic in components (rule 8).** The commit's
  `Object.assign(partnership, next)` in `useVoiceHandlers` mutates a draft clone
  within the planning function, not shared state.
- **Every production call site updated (P5/P22).** `listedPersonEvents` and
  `storedPersonEvents` call sites are `PropertiesPanel.tsx:1324,1331`,
  `TimelineBoardModal.tsx:564,822`, `systemEvents.ts:407` — all gain
  `partnerships`; the three test-file call sites were the only stragglers and are
  fixed here.
- **Invariants (CLAUDE.md).** Save=create-event, EventCard 5 call sites, modal
  `position: fixed`, date-field synthesis single-slot — none regressed; this range
  does not add an event builder or a modal.

## Notes for the next loop

- This gate's verdict is conditional on committing the 5-file fix set
  (`listedEvents.test.ts`, `relationshipStatusKeys.ts`, `relationshipStatusKeys.test.ts`,
  `syntheticDateEvents.ts`, `syntheticDateEvents.test.ts`) alongside `33384f9`; they
  are left uncommitted per the repo's no-commit-without-ask convention.
- P26 held again: the re-sweep's value was catching a fix-induced regression
  (the `statusKeyMirroredBy` falsy-field trap), not the original findings. The
  fix-3 amendment was self-verified + full-suite green rather than a third cold
  sweep.
- `APP_VERSION` bumped to `v 2.59-1014-19-48` in this commit.

## Not covered

- The Scope-limits families the reviewer does not assess: logic/algorithmic
  correctness, concurrency/races, auth, injection/security, performance,
  dependency/supply-chain, API-contract compatibility, test quality beyond
  P27/P29, architecture.
- The fix-3 amendment (one-line guard) was not a separate cold sweep; it was
  traced across all four reachable states and covered by the full 1256-test run.
- No end-to-end check against a real legacy-diagram fixture (the tests use
  realistic synthetic fixtures with the same shapes the import/merge paths
  produce).
