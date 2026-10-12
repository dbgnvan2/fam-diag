# Learning-QA gate — 2026-10-12b (emotional-pattern-pick test)

**Verdict: APPROVED** (0 high, 0 medium, 0 low)

This is the re-sweep of the fix commit for the prior gate's MEDIUM: a test that
drives the `handleSelect` wrap in `DiagramEditor.tsx:4199–4201` — the seam that
routes a pending pick's second click to `openAddEmotionalPatternModal`. The new
`DiagramEditor.emotionalPatternPick.test.tsx` renders the real editor, right-clicks
a person, chooses **Emotional Pattern**, clicks a second person, and asserts the
Add Emotional Pattern dialog opens for the correct two people (Alex Carter → Liam
Carter, names read from the demo fixture, not from the code under test). The test
is **not vacuous**: removing the wrap's interception line makes it go red (verified
by mutation, below). All three CLAUDE.md gates pass.

## Range

`git diff origin/main..HEAD` — 1 commit on `main`:

- `d0bef8d` Test the editor's routing of a pick's second click

2 files changed, +88 / −7 (materialized at `/tmp/sweep_b.diff`, 112 lines):

- `src/frontend/src/components/DiagramEditor.emotionalPatternPick.test.tsx` (+83) —
  new integration test, three cases: second click opens the dialog for both people;
  clicking the first person again keeps waiting; after Cancel a click selects the
  person and opens no dialog.
- `TODO.md` — drops the resolved MEDIUM note (the un-tested `handleSelect` wrap) and
  keeps the still-open LOW (the banner test's self-mirrored hint text).

## Build/test gates (CLAUDE.md)

Run from `src/frontend`:

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx vitest run` | PASS — 125 files, 1236 tests (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

Test count rises +3 over the prior gate (1233 → 1236), +1 file — exactly the three
tests in the new file. All additive; no existing test removed or weakened.

## Non-vacuity check (P27, mutation-verified)

The one test that must fail if the wrap is removed does. Removed the interception
line — `if (handleEmotionalPatternPickClick(personId)) return;` — at
`DiagramEditor.tsx:4200` (leaving the fall-through to the real `handleSelect`), then
ran the file:

```
× clicking a second person opens the Add Emotional Pattern dialog for both
  AssertionError: expected null to be truthy  (dialogOpen() → null)
Tests: 1 failed | 2 passed
```

Restored the line (`git checkout`); the file is clean again. The same edit also made
`handleEmotionalPatternPickClick` unused, confirming the wrap is its only consumer in
the editor — the exact seam the prior gate named. The other two tests (keep-waiting,
after-Cancel) intentionally do not guard the wrap and still pass without it; the
file's coverage of the seam is carried by the first test, which is what the MEDIUM
required.

## Findings

None. The fix commit was swept as its own range (P26 corollary) and came back clean.

## Verified clean

- **Oracle provenance (P32).** The only assertion values that look like literals —
  `'Alex Carter'` / `'Liam Carter'` — come from the demo fixture
  (`data/demofamilydiagram.json` / `data/demoDiagramData.json`), not from the code
  under test; they are read off the rendered dialog's `From:` / `Towards:` fields. The
  `EMOTIONAL_PATTERN_PICK_HINT.cancelLabel` import is used only as a *locator*
  (`getByRole('button', { name: … })`), not as an asserted value, so it tracks the
  real label rather than mirroring it (unlike the still-open LOW in the banner test).
- **No floor assertions (P29).** Every check is exact (`toBeTruthy`, `toBeNull`,
  `toBe('Alex Carter')`) or a presence check on a named element — nothing counts a
  node type or asserts a cardinality bound.
- **No source-text assertion (P19 corollary).** The test fires Konva events and reads
  the DOM; it never greps source.
- **No production side effects (P34).** Rendering `<DiagramEditor />` matches the
  existing integration tests (`sessionNotes`, `addPartner`, `familyTimeline`,
  `replaceState`); the only persistence is jsdom `localStorage`, cleared in
  `beforeEach`. No file or network writes, no real demo data touched.
- **Dirty-state (P8).** `localStorage.clear()` runs before each case, so a prior test's
  persisted editor state cannot leak into the pick state.
- **Seam is the user surface (P25).** The test drives the *editor*, not the hook — it
  exercises the exact `handleSelect` wrap the prior gate found untested, through the
  right-click → pick → click path a user actually takes.
- **Invariants.** No new `any`, no hardcoded event type/category/subtype, no direct
  mutation, no Save=create-event / EventCard-5-call-site / modal-positioning
  involvement (none in this diff — the range is a test file plus a TODO edit).

## Notes for the next loop

- First fix-commit gate: the range is a single commit, so there is no fix-commit
  sub-range to re-sweep beyond this pass.
- The prior gate's LOW (banner test builds its expected text from
  `EMOTIONAL_PATTERN_PICK_HINT.text('A')`) remains open and correctly still listed in
  `TODO.md`; it is out of scope for this commit.
- No `version.ts` change in this range (no `APP_VERSION` bump this commit).
- The workspace still carries the unrelated untracked `test import 1.json` and a
  modified `.claude/worktrees/eloquent-liskov-52df2a` pointer; neither is in the range.
