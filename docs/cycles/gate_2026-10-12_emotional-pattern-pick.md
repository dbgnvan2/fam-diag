# Learning-QA gate — 2026-10-12 (emotional-pattern-pick)

**Verdict: APPROVED** (0 high, 1 medium-non-blocking, 1 low)

A one-person route now exists to an Emotional Pattern: right-click a person,
choose **Emotional Pattern**, click the second person, and the existing
Add Emotional Pattern dialog opens. A new `useEmotionalPatternPick` hook holds the
pending first person; a banner names them and offers Cancel (Esc also cancels);
and the person-click path in `DiagramEditor` is intercepted so a pending pick's
click routes to `openAddEmotionalPatternModal` instead of a normal select. The
two-person route (select both → "Add Emotional Pattern") is unchanged, and both
routes share the one save path. The one MEDIUM finding is a **test-coverage gap**
on the single seam that makes the feature real — the `handleSelect` wrap at
`DiagramEditor.tsx:4199` that routes a pending pick's click. The hook, the menu
item, and the banner each have tests, but nothing drives the wrap itself, so
deleting the wrap would leave the route dead with a green suite (P25). The feature
is correctly wired and type-checked, so this goes to the backlog rather than a
fix/re-sweep loop (P26). The one LOW is a self-computed expectation in the banner
test (P32). All three CLAUDE.md gates pass with the local binaries, and an
independent cold-pass reviewer (given only the diff and the standards, no
narrative) returned the same verdict, independently raising the MEDIUM.

## Range

`git diff origin/main..HEAD` — 1 commit on `main`:

- `e6ced3c` Emotional Pattern from one person's right-click menu

9 files changed, +235 / −3 (materialized at `/tmp/sweep.diff`, 399 lines):

- `src/frontend/src/hooks/useEmotionalPatternPick.ts` (+ `.test.ts`) — new hook:
  holds the pending first-person id, takes the second from the next person click,
  Esc/cancel clears it, a deleted first person drops the pick.
- `src/frontend/src/hooks/useContextMenuHandlers.ts` (+ `.test.ts`) — single-person
  menu gains an "Emotional Pattern" item that calls `startEmotionalPatternPick`;
  the two-person group menu's "Add Emotional Pattern" is untouched.
- `src/frontend/src/components/DiagramEditor.tsx` — calls `useEmotionalPatternPick`,
  passes `startEmotionalPatternPick` into `useContextMenuHandlers`, wraps `handleSelect`
  to route a pending pick's click, and passes the banner props to `DiagramCanvas`.
- `src/frontend/src/components/DiagramCanvas.tsx` (+ `.visibility.test.tsx`) — renders
  the "click the second person" banner with a Cancel button.
- `src/frontend/src/data/helpContent.ts` — new `EMOTIONAL_PATTERN_PICK_HINT` and a
  help-section tip describing both routes and the Esc cancel.
- `README.md` — documents the one-person route.

## Build/test gates (CLAUDE.md)

Run from `src/frontend` with the local binaries (same toolchain as the prior gates):

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p tsconfig.app.json` | PASS (exit 0) |
| `./node_modules/.bin/vitest run` | PASS — 124 files, 1233 tests (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && ./node_modules/.bin/tsc -b` | PASS (exit 0) |

Test count rises +10 over the prior gate (1223 → 1233): 6 in `useEmotionalPatternPick`,
2 in `useContextMenuHandlers — Emotional Pattern from one person`, 2 in
`DiagramCanvas — Emotional Pattern second-person banner`. All additive — no existing
test was removed or weakened.

## Feature wiring

- **Single save path (CLAUDE.md rule 1).** Both routes converge on
  `openAddEmotionalPatternModal(person1, person2)` — the existing dialog in
  `useEmotionalLineOperations` — so nothing in the save path (`saveAddEmotionalPattern`,
  `utils/eventDraft.ts`) is duplicated or touched. The new hook is a thin picker, not
  a second implementation of "create a pattern".
- **Wiring is type-checked (P21/P25).** `startEmotionalPatternPick` is destructured from
  `useEmotionalPatternPick` (`DiagramEditor.tsx:1949`), passed into
  `useContextMenuHandlers` (`:3442`), consumed by the new menu item
  (`useContextMenuHandlers.ts:433`); the banner props reach `DiagramCanvas` (`:4241–4242`);
  the click interception wraps `handleSelect` (`:4199–4201`). `useContextMenuHandlers`
  gained a required dep, and it has exactly one real caller (DiagramEditor) — tsc
  enforces the new signature, and the test caller's Proxy mocks it. No stale caller (P22).
- **No dropped side effect (P12).** No existing function was narrowed; `handleSelect` is
  wrapped, not replaced — the `(personId, additive)` signature and the fall-through to
  the real `handleSelect` when no pick is pending are preserved.
- **Guard scope (P13).** The Esc effect's `if (!pending) return`, the `personId === pending`
  keep-waiting branch (no self-pattern), and the delete-dropped-pick derivation each guard
  one concern; `handlePickClick`'s `!pending → false` early return sits before any state
  write or modal open.

## Findings

### 1. MEDIUM (non-blocking) · P25 · DiagramEditor.tsx:4199–4201

The wrap that routes a pending pick's click to `openAddEmotionalPatternModal` is the
seam that makes the feature real, and none of the three test files drives it: the hook
is tested in isolation, the menu item is tested to call `startEmotionalPatternPick`,
and the banner is tested to render and cancel — but nothing renders (or otherwise
exercises) the `handleSelect` wrap, so deleting it would leave the whole one-person
route dead while the suite stays green. The feature is correctly wired and type-checked
today, so this is a coverage gap, not a functional bug. Fix for the backlog: a test that
mounts `DiagramEditor` (or extracts the wrap to a unit-testable seam) and asserts that
while `patternPickFirstPerson` is set, a person click calls
`openAddEmotionalPatternModal` and not `handleSelect`. Confidence: high. (Independently
raised by the cold pass as its top finding.)

### 2. LOW · P32 / P19-corollary · DiagramCanvas.visibility.test.tsx (second-person banner describe)

`toHaveTextContent(EMOTIONAL_PATTERN_PICK_HINT.text('A'))` derives its expected string
from the same helper the component renders, so the literal part of the hint text is a
mirror of the implementation rather than an oracle — a typo in the hint's wording would
stay green. The test still pins banner presence (`getByLabelText`) and name
interpolation (a wrong interpolated name would fail), so the circularity is limited to
the literal wording. Consider asserting a literal expected string, or asserting the
interpolated name independently. Confidence: medium on the mechanism, low severity.

## Verified clean

- **Stale-state (P8).** `firstPersonId` raw state is never explicitly cleared when the
  first person is deleted, but the derived `firstPerson`/`pending` null out (so the
  banner disappears and `handlePickClick` returns false), and the dangling id can never
  resolve: person ids are `nanoid()` (never reused) and there is no undo. The
  deleted-first-person case is covered by a test asserting the observable behaviour.
  (The cold pass traced this and cleared it independently.)
- **Esc/cancel soundness.** The `window` keydown listener is registered only while a
  pick is pending (`[pending]` dep) and removed on cleanup; it does not collide with the
  global Space pan handler or a modal's own Esc — pick and dialog are mutually exclusive
  by state (opening the dialog clears the pick).
- **Click coverage.** The interception rides the existing `onSelect` prop, which Konva
  fires for both mouse click and touch tap; right-click is excluded by the `button !== 0`
  guard. `handleSelect` was already a per-render function, so the wrap destabilizes
  nothing (no L7-style timer/closure issue).
- **Tests exact and provable-failing (P27/P29).** Every new assertion is exact
  (`toBe(true/false)`, `toHaveBeenCalledWith('a', 'b')`, `toBeNull()`) or an anchored
  structural check — no floor assertions, no self-computed expected values beyond the one
  LOW above, no source-text greps (the context-menu test calls `onClick()` and checks the
  mock, not the label string).
- **Invariants.** No new `any`, no hardcoded event type/category/subtype, no direct
  mutation, no Save=create-event / EventCard-5-call-site / modal-positioning involvement
  (none are in this diff).

## Notes for the next loop

- The MEDIUM is a coverage gap, not a defect — the feature demonstrably works and is
  type-checked. Per P26, a fix here is new (unreviewed) test surface, so it goes to the
  backlog rather than into a fix/re-sweep loop this pass.
- First-pass gate (no fix commits): the range is a single commit, so there is no
  fix-commit sub-range to re-sweep. If a follow-up adds the wrap test or addresses the
  LOW, re-sweep the whole range then.
- No `version.ts` change in this range (no `APP_VERSION` bump this commit).
- The workspace still carries the unrelated untracked `test import 1.json` and a modified
  `.claude/worktrees/eloquent-liskov-52df2a` pointer; neither is in the range.
