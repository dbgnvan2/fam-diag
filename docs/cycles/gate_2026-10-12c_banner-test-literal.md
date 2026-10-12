# Learning-QA gate — 2026-10-12c (banner-test-literal)

**Verdict: APPROVED** (0 high, 0 medium, 1 low)

This is the fix for the prior gates' LOW (P32): the banner test's expected
string was built from the same helper the component renders —
`EMOTIONAL_PATTERN_PICK_HINT.text('A')` — so a typo in the hint's wording would
stay green. The test now asserts the literal copy
`Click the second person for the Emotional Pattern with A. (Esc cancels)`, which
is a real oracle: it pins the user-visible string, so the template stopping
interpolating the name (or a rewording typo) goes red. `TODO.md` drops the
now-fixed note; both its halves are stale (the LOW is this commit's fix, the
MEDIUM was already resolved by `DiagramEditor.emotionalPatternPick.test.tsx`).
All three CLAUDE.md gates pass, and the non-vacuity mutation is verified below.
The one LOW (P19) is the intended coupling that makes copy drift loud rather than
silent — non-blocking.

## Range

`git diff origin/main..HEAD` — 1 commit on `main`:

- `eb5cea4` Banner test asserts the literal copy, not the template's own output

2 files changed, +6 / −6 (materialized at `/tmp/sweep.diff`, 34 lines):

- `src/frontend/src/components/DiagramCanvas.visibility.test.tsx` — the
  second-person-banner test asserts a literal string instead of
  `EMOTIONAL_PATTERN_PICK_HINT.text('A')`.
- `TODO.md` — drops the 5-line "Emotional Pattern pick notes" entry (its LOW is
  fixed here; its MEDIUM was fixed by the prior commit's pick-routing test).

## Build/test gates (CLAUDE.md)

Run from `src/frontend`:

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p tsconfig.app.json` | PASS (exit 0) |
| `./node_modules/.bin/vitest run` | PASS — 125 files, 1236 tests (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && ./node_modules/.bin/tsc -b` | PASS (exit 0) |

Test count is unchanged from the prior gate (1236): this commit rewrites one
assertion and adds no tests, so no existing test was removed or weakened and none
added. The touched file's 5 tests still pass (verified alone before and after).

## Non-vacuity check (P27, mutation-verified)

The point of the fix is that the test must fail when the template stops
interpolating the name. Mutated the template at `helpContent.ts:276` — removed
the `${firstPersonName}` interpolation so it read
`Click the second person for the Emotional Pattern.` — and ran the file:

```
× names the first person and cancels from its button
  Expected element to have text content:
    Click the second person for the Emotional Pattern with A. (Esc cancels)
  Received:
    Click the second person for the Emotional Pattern. (Esc cancels)Cancel
  Tests: 1 failed | 4 passed
```

Restored the template verbatim; `git diff` on `helpContent.ts` is empty and the
file is clean. Under the same mutation the old mirror test would have stayed
green (both sides compute the same name-less string) — which is exactly the P32
defect this commit removes.

## Findings

### 1. LOW · P19 · DiagramCanvas.visibility.test.tsx:160–162

The literal pins the *entire* banner copy — the template text, the inter-word
space, and `escapeNote` — so any deliberate reword of `EMOTIONAL_PATTERN_PICK_HINT`
(`helpContent.ts:274–279`) now fails this test and demands a coordinated edit.
That is the intended (and correct) tradeoff — making copy drift loud instead of
silent — but it is a coupling the old mirror test did not have. If the copy
churns, prefer asserting the interpolated name separately from the boilerplate.
Confidence: low on severity (independently raised by the cold pass; informational,
not a defect).

## Verified clean

- **Oracle provenance (P32).** The replacement literal is sourced from the
  user-visible rendered output, not computed by the test: the component renders
  `EMOTIONAL_PATTERN_PICK_HINT.text(personDisplayName(...)) + ' ' + escapeNote`
  (`DiagramCanvas.tsx:1168–1169`); `personDisplayName(people[0])` = `'A'` (fixture
  name `'A'` at `DiagramCanvas.visibility.test.tsx:15`, via `personNames.ts:15–16`);
  `text('A')` = `Click the second person for the Emotional Pattern with A.`
  (`helpContent.ts:275–276`) and `escapeNote` = `(Esc cancels)`. The concatenation
  equals the literal exactly.
- **Provable-failing (P27).** The mutation above went red with the verbatim
  original template, not a paraphrase.
- **No floor assertion (P29).** The assertion is an exact literal string, not a
  cardinality bound; the banner is located by its unique `aria-label`
  (`Emotional Pattern second person`), not by a node-class count (L8).
- **No source-text assertion (P19 corollary).** The test reads the rendered DOM;
  it never greps source.
- **Sibling check (P5).** No other test still mirrors via `.text('A')`: the only
  other `EMOTIONAL_PATTERN_PICK_HINT` consumer
  (`DiagramEditor.emotionalPatternPick.test.tsx`) uses `cancelLabel` as a button
  *locator*, not as an asserted expected value.
- **TODO note drop.** Loses nothing still true — the LOW half is this commit's
  fix and the MEDIUM half is already covered by
  `DiagramEditor.emotionalPatternPick.test.tsx` (its header states it covers the
  gate-2026-10-12 MEDIUM).
- **Invariants.** No new `any`, no hardcoded event type/category/subtype, no
  direct mutation, no Save=create-event / EventCard-5-call-site / modal-positioning
  involvement (none in this diff — the range is one test assertion plus a TODO edit).

## Notes for the next loop

- Fix-commit gate (P26 corollary): a single commit, swept as its own range. The
  cold pass returned APPROVED with one LOW (the intended P19 coupling above), so
  there is no further fix/re-sweep loop.
- No `version.ts` change in this range (no `APP_VERSION` bump this commit).
- The workspace still carries the unrelated untracked `test import 1.json` and a
  modified `.claude/worktrees/eloquent-liskov-52df2a` pointer; neither is in the
  range.
