# Learning-QA gate — 2026-10-01 (final-review-fixes)

**Verdict: REJECTED** (0 high, 4 medium, 2 low)

The three build/test gates pass and the fix batch is substantively sound, but the
pattern sweep found four medium findings — two in the save/storage path and two in the
data-integrity utils this batch was meant to make single-source-of-truth. Per P26 the
loop continues while medium-or-higher findings remain.

## Range

`git diff 60c94e1..HEAD` — 2 commits on `main`:

- `aabcd3f` Final-areas review report with fix status; TODO and docs
- `c00e31d` Fix every finding of the final-areas review

137 files changed, +13113 / −8495 (materialized at `/tmp/sweep.diff`, 27637 lines).
This is the fix batch for `REVIEW-final-areas-2026-09-30.md` (DE1-*, DE2-*,
nodes-*, voice-*, bundle-*, settings-*, struct-*, G-TEST-* findings).

## Build/test gates (CLAUDE.md)

| Gate | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | PASS (exit 0) |
| `npx vitest run` | PASS — 120 files, 1154 tests (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

Run from `src/frontend`. `npx` was blocked by a runtime package-threat-intelligence
scan with no user present to approve, so the local binaries
(`./node_modules/.bin/tsc`, `./node_modules/.bin/vitest`) were used — same toolchain,
no `npx` layer.

## Review scope

Reviewed against the generic catalogue P1–P36 (`~/.claude/standards/learnings.md`),
repo patterns L1–L10 (`LEARNINGS.md`), and the CLAUDE.md invariants: Save = create
event with `date`+`startDate`/`anchorType`/`anchorId`/`eventClass`/`createdAt`/`subtype`
and no fabricated defaults; no hardcoded event types/categories; no `any`;
immutability; EventCard 5 call sites with `onEdit`+`onDelete` on the owner; modal
`position: fixed`.

Method: two **cold** passes delegated to independent reviewers given only the diff and
the three rulebooks (area A = save/storage/autosave/session-capture/file-ops/error
boundary; area B = data-transformation utils), plus this gate's own pass over area C
(component/hook refactors and wiring: PropertiesPanelHost, selection/drag handlers,
AppRibbon render-cost move, ErrorBoundary, listedEvents adoption). A third delegation
(area C) could not be dispatched — the one-shot delegation budget (2 children) was
exhausted — so area C was reviewed inline here. Findings from the cold passes were
re-verified against source before being recorded.

Not assessed (out of the failure-pattern family, per the learning-qa scope limits):
logic/algorithmic correctness of the genogram layout and date math, UI-contract/a11y
regression, security, performance, concurrency, dependency/supply-chain. Did not re-run
the gates (already green).

## Findings (ranked)

### 1. MEDIUM — P19 · categoryRename.ts:48-49 · the rename/delete guard keys on the *inferred* event type, not the stored one, so colliding or legacy categories are silently missed

`eventUsesCategory` matches `inferEventType(event) === type`. `inferEventType`
(`eventConstants.ts:558-577`) deliberately *reinterprets* the type: when the stored
type is valid but the category belongs to a different type's list, it returns the type
the category maps to. So an SIR event whose category name collides with a built-in
FAMILY category (or a legacy event with no `eventType` and a custom category, which
`inferEventType` defaults to `NODAL`) is invisible to `renameEvents`, `categoryUsage`
and the delete guard. Renaming the category leaves those events on the old name — the
exact "split under two names" defect settings-01/L10 was fixing — and the delete guard
reports 0 events, letting the user delete a category that still has events (orphaning
them).

Fix: match on the stored `event.eventType === type` (fall back to inference only when
`eventType` is absent), not on `inferEventType(event)`. Add a regression test with an
SIR/NODAL/FF event whose category name collides with another type's built-in category.

### 2. MEDIUM — P19 · dataNormalization.ts:184 · the gender-symbol option table disagrees with the resolver it must mirror

`GENDER_SYMBOL_OPTIONS` gives "Female × Masculine" the symbol `female_trans`. The
canonical resolver (`personSex.ts`) says female-birth + masculine-identity is
`male_trans` (`BIRTH_SEX_FROM_SYMBOL.male_trans === 'female'`; `deriveGenderSymbol:89`
returns `male_trans` for a non-cis female+masculine). So the option table and the
shared resolver disagree on the symbol's meaning, `male_trans` is never offered, and a
person stored via that option carries a `genderSymbol` that contradicts their
`birthSex`/`genderIdentity`. Currently masked because the picker also stores birthSex
and identity alongside, but the stored symbol is still wrong.

Fix: set line 184's symbol to `male_trans` (and keep the `female_trans` option for the
male-birth/feminine entry at :187). Add a test that every option's
`(birthSex, genderIdentity)` round-trips through `deriveGenderSymbol`.

### 3. MEDIUM — P5 · systemEvents.ts:90-95 · `genderOf` is a parallel, narrower sex classifier the single-rule migration skipped

`genderOf` reads only `person?.birthSex || person?.gender`, ignores
`genderIdentity`/`genderSymbol`, and hardcodes `'g'` → female (a code the canonical
`GENDER_CODES` does not map at all). The struct-07/nodes-10 fix made `personSex.ts`
the one sex rule used by layout, canvas, kinship and partner creation — but
`systemEvents.ts` still has its own copy, so a person whose sex is recorded only via
identity or symbol gets the wrong relation noun (Son/Daughter/Spouse/Uncle/Aunt) in the
Timeline system events.

Fix: migrate `genderOf` to `resolveBinarySex` (personSex.ts), or a thin
`RelationGender` shim over it. Add a regression test with a person carrying only
`genderIdentity`/`genderSymbol`.

### 4. MEDIUM — P6 · useFileOperations.ts:223-235 · restoring a backup marks the diagram clean but never writes it to the still-linked file

`handleRestoreBackupVersion` calls `replaceDiagramState(data, …)` without clearing the
file handle. `replaceDiagramState` (`DiagramEditor.tsx:2497`) calls `markSnapshotClean`,
which sets `isDirty = false` and writes the fingerprint — but nothing persists the
restored content to the file. The editor shows "saved" while the file holds different
content; autosave does not fire (not dirty); and a subsequent Open/New discards the
restore without prompting (the discard guard only warns when dirty). Partially
mitigated only by a later page reload (fingerprint + DE1-12 file-link mismatch).

Fix: after a backup restore, if a file handle is still set, either mark the diagram
dirty (so autosave persists the restored content) or null the handle and set a
`fileNotice` stating the file was not updated. Add a regression test that restoring a
backup over an open file leaves the editor dirty (or clears the handle), not clean.

### 5. LOW — P2 · storage.ts:262 · `rotateDiagramBackups` discards existing backups on a read error

`request.onerror = () => put({})` collapses a failed read of the existing backup record
into `{}` and writes a fresh rotation (`nextBackupVersions({}, …)`), silently discarding
v1/v2/v3. "Read failed" and "no backups yet" are conflated, and the failure destroys
the very backups the feature exists to keep. Pre-existing shape retained by the
rewritten function.

Fix: on `request.onerror`, resolve without calling `put` (leave prior backups intact);
only write when the read succeeded.

### 6. LOW — P19/L9 · personEventBundle.ts:20-21 · the bundle module keeps its own display-name helper with opposite precedence to the canonical one

`displayName` uses `person.name || [firstName, lastName].join(' ')`, while the new
canonical `personDisplayName` (`personNames.ts:10-17`) uses
`[firstName, lastName].join(' ') || name`. A person with both `name` and first/last set
therefore exports a different person name in a bundle than the UI shows, leaving the
struct-11 "one couple/name format" migration incomplete.

Fix: import `personDisplayName` from `personNames.ts` and drop the local `displayName`.

## Verified clean

- Save = create event holds for the new paths: `sessionCaptureApply.ts` routes events
  through `buildNewEventDraft` + `normalizeEventForSave` (sets `date`+`startDate`,
  anchor, `eventClass`, `createdAt`, `subtype`; no default-today, no invented rating).
- No dropped autosave keys: the 10 storage keys the deleted `useAutosave` wrote are all
  covered by `useBrowserStorageWriter`. `ErrorBoundary` is wired around both
  `DiagramEditor` and `EventCreator` (`App.tsx`). `useBrowserStorageWriter` is called on
  the run path.
- `PropertiesPanelHost` is rendered (`DiagramEditor.tsx:4241`) and handed to the canvas
  as its `propertiesPanel` slot; the three PropertiesPanel instances share one props
  object; the section popups use `position: fixed` with the `Z_INDEX` scale (L6).
- `useSelectionHandlers` / `useCanvasDragHandlers` use spread/clone throughout (no
  mutation); the drag group returns unchanged arrays on empty groups (struct-03).
- `listedEvents.ts` is genuinely the single "listed events for an owner" rule — adopted
  by `PropertiesPanel.tsx`, `TimelineBoardModal.tsx`, and `systemEvents.ts` (struct-06).
- No `any` in the new modules (grep found only comment prose). No new hardcoded event
  types/categories (category literals read from `eventConstants`).

## Notes for the fix loop

- Findings 1–4 are medium and must be fixed, then this range re-swept (the fix commits
  are unreviewed code — P26). Findings 5–6 are low; fix alongside or carry to the
  backlog.
- The workspace carries an unrelated untracked file (`test import 1.json`) and a
  modified `.claude/worktrees/…` pointer; neither is in the diff range and neither was
  touched.
- `replaceDiagramState(data: any, …)` still types its JSON boundary as `any`; it is
  pre-existing and not introduced by this range, so it is noted rather than gated.
