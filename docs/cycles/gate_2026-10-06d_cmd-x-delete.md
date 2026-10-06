# Learning-QA gate — 2026-10-06d (cmd-x-delete)

**Verdict: APPROVED** (0 high, 1 medium-non-blocking, 2 info)

CMD-X / Ctrl-X now deletes the selected people after a confirm that names everyone
and states there is no undo. `removePeople(personIds[])` replaces the single-person
`removePerson` internals (kept as a thin wrapper, so the context-menu "Delete Person /
Delete Child" path is unchanged), and the Space-pan handler's editable-target check is
extracted into a shared util. The one MEDIUM finding — the dialog-suppression guard
tracks only `useDialogFocus` dialogs, not the right-click context menu or ribbon
dropdowns — is confirm-gated (no silent loss) and triggered only by a contrived
mouse-overlay scenario, so it is recorded for the backlog rather than forced into a
fix/re-sweep loop (P26). The three CLAUDE.md gates pass with the local binaries, and an
independent cold-pass reviewer (given only the diff and the standards, no narrative)
also returned APPROVED.

## Range

`git diff origin/main..HEAD` — 1 commit on `main`:

- `d0085ec` CMD-X (Ctrl-X) deletes the selected people, after a confirm

(The task brief named commit `1ad6c83`; that object does not exist in the repo. The
single commit on `main` ahead of `origin/main` is `d0085ec`, whose message matches the
description — treated as the intended range.)

10 files changed, +329 / −37 (materialized at `/tmp/sweep_cmdx.diff`, 545 lines):

- `src/frontend/src/components/DiagramEditor.tsx` — Space handler uses the shared
  `isEditableTarget`; `usePersonOperations` call drops the now-unused `selectedPeopleIds`
  prop; `useDeleteSelectionShortcut` is wired in
- `src/frontend/src/hooks/usePersonOperations.ts` — `removePerson` generalized into
  `removePeople(personIds[])`; `removePerson(id) => removePeople([id])`
- `src/frontend/src/hooks/useDeleteSelectionShortcut.ts` (+ `.test.ts`) — the new hook
- `src/frontend/src/hooks/useDialogFocus.ts` — exports `isDialogOpen()`
- `src/frontend/src/utils/deleteSelectionShortcut.ts` (+ `.test.ts`) — `isEditableTarget`,
  `isDeleteSelectionShortcut`, `deletePeopleConfirmMessage`
- `src/frontend/src/hooks/usePersonOperations.test.ts` — 4 new `removePeople` tests
- `src/frontend/src/data/helpContent.ts` — help tip documenting the shortcut
- `src/frontend/src/data/version.ts` — `APP_VERSION` → `v 2.58-1006-14-15`

## Build/test gates (CLAUDE.md)

Run from `src/frontend` with the local binaries (`npx` is blocked by the package-threat
scan, so the gate uses the same local toolchain as the prior gates):

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p tsconfig.app.json` | PASS (exit 0) |
| `./node_modules/.bin/vitest run` | PASS — 123 files, 1209 tests (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && ./node_modules/.bin/tsc -b` | PASS (exit 0) |

Test count rises +2 files / +20 tests over the prior gate (121/1189): 9 in
`useDeleteSelectionShortcut.test.ts`, 7 in `deleteSelectionShortcut.test.ts`, 4 in the
`removePeople` describe block. All additive — no existing test was removed or weakened.

## Refactor fidelity (the `removePerson` → `removePeople` generalization)

The batch body is a faithful N-way generalization of the original single-person body,
verified line-by-line against the fixture:

- `partnershipsToRemove` (was the single person's partnerships) becomes a `Set` of every
  partnership where either partner ∈ `ids`; `setPartnerships` filters on `ids` and clears
  deleted ids from survivors' `children` lists.
- `setPeople` filters on `ids`, drops removed partnerships from surviving partners, and
  unlinks `parentPartnership` / `birthParentPartnership` (plus `connectionAnchorX`) for
  children of a removed partnership — identical to the original, batched.
- `setEmotionalLines` / `setTriangles` filter on `ids` across all endpoint fields.
- `setSelectedPeopleIds` improves on the original (functional update instead of reading
  the possibly-stale `selectedPeopleIds` prop); `setPropertiesPanelItem(null)` and
  `setContextMenu(null)` are preserved.

The `isEditableTarget` extraction is byte-for-byte semantically identical to the inline
Space-pan check (`Boolean(el?.isContentEditable)` ≡ the original `|| target?.isContentEditable`
truthiness), and both consumers (`DiagramEditor` Space handler, `isDeleteSelectionShortcut`)
read the one shared util — single source of truth, no parallel copy (Pitfall 2).

## Findings

### 1. MEDIUM (non-blocking) · P13 / P3 · useDeleteSelectionShortcut.ts:34 + useDialogFocus.ts:14

`isDialogOpen()` returns `openDialogs.length > 0`, which only counts dialogs that call
`useDialogFocus`. The right-click `ContextMenu` (rendered from `DiagramCanvas`) and the
`AppRibbon` dropdown menus are overlays that do not register there, so CMD-X is *not*
suppressed while one of them is open — a key pressed with one of those overlays up acts
on the diagram behind it, contradicting the hook's own doc comment ("while any dialog is
open"). **Not a data-integrity bug:** the delete is confirm-gated and the confirm names
everyone and states "This cannot be undone", and the triggering gesture (CMD-X while a
transient mouse-driven menu is open) is contrived. Fix for the backlog: suppress on any
open overlay (a shared `anyOverlayOpen` signal fed by the context-menu and ribbon state)
or, at minimum, narrow the doc comment to "any dialog that uses `useDialogFocus`" so the
gap is visible. Confidence: medium. (Independently raised by the cold pass.)

### 2. INFO · P4 · deleteSelectionShortcut.ts:22–27

The matcher accepts Ctrl-X on macOS as well as Windows (`metaKey || ctrlKey`), but the
help tip scopes "Ctrl-X on Windows" only. A Mac user pressing Ctrl-X pops the delete
confirm even though the documented Mac gesture is CMD-X. Confirm-gated, harmless;
document Ctrl-X as cross-platform or gate the `ctrlKey` branch to non-Mac. Confidence:
medium.

### 3. INFO (pre-existing, out of scope) · usePersonOperations.ts:354–358

`removePeople` — like `removePerson` before it — does not clear `selectedPartnershipId`,
`selectedEmotionalLineId`, or `selectedChildId` when the referenced entity is
cascade-deleted, and clears `propertiesPanelItem` only when it points to a deleted
*person*, not a cascade-deleted *partnership/line*. This gap predates the change (the
context-menu delete had it too) and the batch path simply preserves it; the CMD-X path
widens the surface only in that it deletes more in one keypress. Not introduced here.

## Verified clean

- **Refactor:** no dropped side effect (P12) — all six state writes of the original
  `removePerson` survive in `removePeople`; no return/contract drift (P22) — `removePerson`
  keeps its `(personId: string) => void` signature and the context-menu callers are
  unchanged (tsc confirms no stale `selectedPeopleIds` prop remains at any call site).
- **Wiring (P21/P25):** the hook is genuinely mounted in `DiagramEditor` (line 3302) and
  documented in the help text; the hook's behaviour is covered by 9 tests including
  latest-selection, empty-selection, text-field, dialog-open and unmount cases.
- **Tests are provable-failing and exact (P27/P29):** every new test asserts an exact value
  (`toEqual(['bea', 'kid'])`, `toHaveBeenCalledWith(['ann', 'sam'])`, exact confirm
  strings) — no floor assertions, no source-text greps (P19 corollary), no
  self-computed expectations.
- **Guard scope (P13):** the hook's early returns (not-shortcut / dialog-open / empty
  selection) each guard exactly one concern; no unconditional step sits inside a
  conditional.
- **Invariants:** no new `any`, no hardcoded event type/category/subtype, no direct
  mutation (spread/delete-on-copy throughout), no `Save=create-event` / EventCard-5-call-
  site / modal-positioning involvement (none are in this diff).
- **Stale-closure:** the hook reads the latest props through a ref updated every render —
  the repo's own L7 pattern — so a once-added `[]`-effect listener never acts on stale
  `people`/`removePeople`.

## Notes for the next loop

- The MEDIUM is below the fix bar for this pass: confirm-gated, contrived trigger, and
  forcing a fix would add unreviewed surface for a gap that cannot silently lose data
  (P26 — grade before fixing; below-the-bar findings go to the backlog).
- Minor test-isolation fragility: `useDeleteSelectionShortcut.test.ts` and
  `useDialogFocus.test.tsx` share the module-level `openDialogs` array; a test that fails
  before `dialog.unmount()` would leak a token into later tests in the same file. Current
  ordering never depends on it, but a `beforeEach` reset of `openDialogs` would harden it.
- `version.ts` bumped `APP_VERSION` to `v 2.58-1006-14-15`; no separate release step unless
  the deploy process requires one.
- The workspace still carries the unrelated untracked `test import 1.json` and a modified
  `.claude/worktrees/eloquent-liskov-52df2a` pointer; neither is in the range.
- First-pass gate (no fix commits): the range is a single commit, so there is no
  fix-commit sub-range to re-sweep (P26 corollary) — the next gate, if any, should re-sweep
  the whole range when a follow-up addresses finding 1.
