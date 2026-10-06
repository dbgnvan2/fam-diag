# Learning-QA gate — 2026-10-06e (cmd-x-page-notes)

**Verdict: APPROVED** (0 high, 1 medium-non-blocking, 2 low, 1 info)

CMD-X / Ctrl-X now deletes the selected page notes alongside the selected people,
after a single confirm that names everything and states there is no undo.
`handlePageNoteDelete` is generalized into `removePageNotes(noteIds[])` (the
editor's Delete button is now a one-note call into it, so that path is unchanged),
`deletePeopleConfirmMessage` becomes `deleteSelectionConfirmMessage(personNames,
noteTitles)`, and a new `allSelectedPageNoteIds` joins the open note with an active
marquee's notes. The one MEDIUM finding is the widening of the *carried* 2026-10-06d
`isDialogOpen` gap: the open note always counts as selected, and the note editor is
not a `useDialogFocus` overlay, so CMD-X offers to delete a note the user has open
for editing whenever focus is outside its text fields — confirm-gated (no silent
loss) and documented as intent, so it goes to the backlog rather than a fix/re-sweep
loop (P26). The three CLAUDE.md gates pass with the local binaries, and an independent
cold-pass reviewer (given only the diff and the standards, no narrative) returned the
same verdict, independently raising the MEDIUM.

## Range

`git diff origin/main..HEAD` — 1 commit on `main`:

- `7358f9b` CMD-X also deletes the selected page notes

12 files changed, +234 / −46 (materialized at `/tmp/sweep_cmdx_pagenotes.diff`, 524 lines):

- `src/frontend/src/components/DiagramEditor.tsx` — `useDeleteSelectionShortcut` now
  receives `pageNotes`, `selectedPageNoteIds` (via `allSelectedPageNoteIds`) and
  `removePageNotes`; the hook moved below the `useSelectionHandlers` call so
  `removePageNotes` is in scope
- `src/frontend/src/hooks/useSelectionHandlers.ts` (+ `.test.ts`) — `handlePageNoteDelete`
  generalized into `removePageNotes(noteIds[])`
- `src/frontend/src/hooks/useDeleteSelectionShortcut.ts` (+ `.test.ts`) — hook now
  deletes notes too, one confirm
- `src/frontend/src/utils/deleteSelectionShortcut.ts` (+ `.test.ts`) —
  `deletePeopleConfirmMessage` → `deleteSelectionConfirmMessage(personNames, noteTitles)`
- `src/frontend/src/utils/pageNoteSelection.ts` (+ `.test.ts`) — new `allSelectedPageNoteIds`
- `src/frontend/src/data/helpContent.ts` — help tip now says "people and general notes"
- `src/frontend/src/data/version.ts` — `APP_VERSION` → `v 2.58-1006-15-40`
- `TODO.md` — drops the carried note "Page notes caught in a marquee selection are not
  deleted by CMD-X" (this change resolves it)

## Build/test gates (CLAUDE.md)

Run from `src/frontend` with the local binaries (`npx` is blocked by the package-threat
scan, so the gate uses the same local toolchain as the prior gates):

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p tsconfig.app.json` | PASS (exit 0) |
| `./node_modules/.bin/vitest run` | PASS — 123 files, 1223 tests (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && ./node_modules/.bin/tsc -b` | PASS (exit 0) |

Test count rises +14 over the prior gate (1209 → 1223): 5 in the
`useDeleteSelectionShortcut — page notes` block, 4 in the `useSelectionHandlers —
removePageNotes` block, 3 in the `deleteSelectionConfirmMessage — page notes` block, 2 in
the `allSelectedPageNoteIds` block. All additive — no existing test was removed or
weakened, and the renamed-message tests were updated in the same commit (no stale
`deletePeopleConfirmMessage` import remains; tsc confirms).

## Refactor fidelity

- **`handlePageNoteDelete` → `removePageNotes` (P12).** The original single-note delete
  had exactly two effects: filter the note from `pageNotes`, and — if the deleted note
  was the one open in the editor — clear `selectedPageNoteId` and `pageNoteDraft`. Both
  survive in `removePageNotes`; `handlePageNoteDelete(noteId)` is now
  `removePageNotes([noteId])`, so the editor's Delete button is behaviour-identical.
  The `if (selectedPageNoteId && ids.has(selectedPageNoteId))` guard is equivalent to the
  original `if (selectedPageNoteId === noteId)` for the one-note case (a `null`
  `selectedPageNoteId` was never equal to a string noteId), and the added `ids.size === 0`
  early return is defensive only — no caller passes an empty list.
- **`deletePeopleConfirmMessage` → `deleteSelectionConfirmMessage` (P22).** The rename is
  a contract change; grep confirms zero remaining references to the old name. The
  people-only output is byte-identical to the old message (verified by the retained exact
  string test), and the notes path reuses the same `listNames`/`count` helpers rather than
  a parallel copy (Pitfall 2). The cascade-sentence pronoun is deliberately disambiguated:
  people-only keeps "Their …", people+notes uses "The person's/The people's …" so "their"
  cannot be misread as the notes'.
- **`allSelectedPageNoteIds` single source of truth.** It composes the existing
  `activeMarqueePageNoteIds` (the exact helper the group-drag path already uses) rather
  than re-deriving marquee activity, and de-dupes with a `Set`. No parallel copy of the
  "is this marquee still active" referential-equality check.

## Findings

### 1. MEDIUM (non-blocking) · P13 / P3 + ui-regression · pageNoteSelection.ts:24–30, DiagramCanvas.tsx:1083–1123

`allSelectedPageNoteIds` always folds in `selectedPageNoteId` — the note open in the
editor — so CMD-X now targets a note the user has open *for editing*, not merely one they
marquee-selected. The note editor is an inline overlay in `DiagramCanvas.tsx` (aria-labels
"General note title/text/…"), not a `useDialogFocus` dialog, so `isDialogOpen()` is `false`
while it is open and the delete fires whenever focus is outside its text fields (right
after clicking a note, or on its colour/Delete/Save controls — in those fields `isEditableTarget`
correctly suppresses it). This widens the *carried* 2026-10-06d `isDialogOpen` gap from
people-only to people+notes. **Not a data-integrity bug:** the confirm names the note and
states "This cannot be undone", and the `allSelectedPageNoteIds` doc comment documents the
open-note inclusion as intent — so the deletion is confirm-gated and deliberate, never
silent. Fix for the backlog: either register the note editor as a suppressible overlay, or
narrow the open-note contribution to marquee-originated selection and say so in the help
tip. Confidence: medium. (Independently raised by the cold pass; consistent with the
carried 2026-10-06d MEDIUM.)

### 2. LOW · P3 / P19 · pageNoteSelection.ts:14–17 vs 24–30

Two "which notes are selected" helpers now diverge by design: group drag uses
`activeMarqueePageNoteIds` (marquee only) while delete uses `allSelectedPageNoteIds`
(open note + marquee). A clicked note is therefore deletable via CMD-X but not
group-draggable. Not a correctness bug — a single note has its own drag handle — but the
split is implicit. Document it explicitly in `pageNoteSelection.ts`, or unify on one helper
and have the drag path drop the single-note id. Confidence: high on the fact, low severity.

### 3. LOW · P3 / P8 · useSelectionHandlers.ts:129–137

`removePageNotes` does not clear `marqueePageNoteSelection`, so a notes-only CMD-X delete
leaves deleted note ids in the stale marquee state. Harmless today because both the delete
hook and the drag path filter against the live `pageNotes` array (a deleted id resolves to
no note), but it relies on downstream filtering rather than clearing the source. Consider
clearing `marqueePageNoteSelection.pageNoteIds` when notes are removed. Confidence: high on
mechanism, low severity.

### 4. INFO · terminology · deleteSelectionShortcut.ts:52 vs helpContent.ts:35 / DiagramCanvas.tsx:1083–1123

The confirm message says "page note(s)", but that term appears nowhere else in the UI: the
aria-labels, context-menu item ("Add General Note"), default title, and the help tip added
in this same commit all say "general note(s)". The confirm is the only user-facing surface
that says "page note". Pick "general note" (the established user-facing term) and drop the
code-internal "page note" from the message, or accept the mismatch consciously. Non-blocking.

## Verified clean

- **Refactor:** no dropped side effect (P12) — both original effects of
  `handlePageNoteDelete` survive in `removePageNotes`; no return/name-contract drift (P22) —
  zero stale references to `deletePeopleConfirmMessage`, and tsc confirms every call site
  compiles against the new `(personNames, noteTitles)` signature.
- **Wiring (P21/P25):** the hook is genuinely mounted in `DiagramEditor` (line 3704) after
  `useSelectionHandlers` exposes `removePageNotes` (destructured at line 3659); the note
  editor's Delete button and CMD-X share the one `removePageNotes` path, proven by a test
  that calls both. Help text documents the shortcut.
- **Stale-closure (L7):** the hook's `[]`-effect listener reads the latest props — including
  the inline `allSelectedPageNoteIds(...)` array — through a ref updated every render, so a
  selection change mid-session cannot be acted on as its mount-time value.
- **Tests are provable-failing and exact (P27/P29/P32):** every new test asserts an exact
  value (`toEqual(['n1', 'n2'])`, `toHaveBeenCalledWith(['n2'])`, exact full message
  strings) or an anchored `stringMatching(/^…/)` — no floor assertions, no source-text
  greps (P19 corollary), no self-computed expectations, no un-failable bodies.
- **Guard scope (P13):** the hook's early returns (not-shortcut / dialog-open / nothing-
  selected) each guard one concern; the empty-list guard in `removePageNotes` sits before
  any state write.
- **Invariants:** no new `any`, no hardcoded event type/category/subtype, no direct
  mutation (filter/spread throughout), no Save=create-event / EventCard-5-call-site /
  modal-positioning involvement (none are in this diff).

## Notes for the next loop

- The MEDIUM is below the fix bar for this pass: confirm-gated, documented as intent, and
  forcing a fix would add unreviewed surface for a gap that cannot silently lose data
  (P26 — grade before fixing; below-the-bar findings go to the backlog).
- The cold-pass reviewer could not run the vitest gate (its environment blocked the run);
  the gate results above are from this session's own run of the local binaries and stand on
  their own.
- `version.ts` bumped `APP_VERSION` to `v 2.58-1006-15-40`; no separate release step unless
  the deploy process requires one.
- First-pass gate (no fix commits): the range is a single commit, so there is no
  fix-commit sub-range to re-sweep (P26 corollary). If a follow-up addresses finding 1 or 3,
  re-sweep the whole range then.
- The workspace still carries the unrelated untracked `test import 1.json` and a modified
  `.claude/worktrees/eloquent-liskov-52df2a` pointer; neither is in the range.
