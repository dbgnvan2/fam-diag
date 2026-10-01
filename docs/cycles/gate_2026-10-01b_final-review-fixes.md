# Learning-QA gate — 2026-10-01b (final-review-fixes, re-sweep)

**Verdict: APPROVED** (0 high, 0 medium, 1 low carried, 2 info)

The six findings from the rejected `gate_2026-10-01_final-review-fixes.md` (4 medium,
2 low) are all fixed, each with a regression test that fails without its fix. The
re-sweep of the fix commit found no new medium-or-higher defect. One LOW drift note
is carried to the backlog; two INFO notes are recorded for the record.

## Range

`git diff aabcd3f..HEAD` — 1 commit on `main`:

- `86ce5f8` Fix gate 2026-10-01 findings (REJECTED: 4 medium, 2 low)

18 files changed, +408 / −27 (materialized at `/tmp/sweep_fix.diff`, 663 lines). This
is the fix batch for `gate_2026-10-01_final-review-fixes.md`.

## Build/test gates (CLAUDE.md)

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p tsconfig.app.json` | PASS (exit 0) |
| `./node_modules/.bin/vitest run` | PASS — 121 files, 1162 tests (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && ./node_modules/.bin/tsc -b` | PASS (exit 0) |

Run from `src/frontend` with the local binaries (the `npx` layer is blocked by the
package-threat-intelligence scan noted in the prior gate; same toolchain). Test count
grew from 120 files / 1154 tests to 121 / 1162: exactly the eight new regression
assertions this batch adds (2 categoryRename, 1 dataNormalization, 1 systemEvents,
2 personEventBundle, 1 storage, 1 restore-backup).

## Fix verification (each RED-tested: reverted source → test fails → restored → passes)

1. **MEDIUM (fixed) — P19 · categoryRename.ts:55-59.** `eventUsesCategory` now matches
   `eventTypeForCategory(event)` = the stored `event.eventType` when valid, falling back
   to `inferEventType` only when the stored type is absent/invalid. A colliding-name SIR
   event is no longer hidden from the rename and delete guard. RED: reverting to
   `inferEventType` fails both new tests (`categoryUsage(...).eventCount` = 0; rename
   leaves the category unmoved).

2. **MEDIUM (fixed) — P19 · dataNormalization.ts:184.** "Female × Masculine" now stores
   `male_trans`, matching `deriveGenderSymbol` (female birth + masculine identity). The
   new test round-trips every `GENDER_SYMBOL_OPTIONS` entry through `deriveGenderSymbol`.
   RED: the old `female_trans` fails the round-trip.

3. **MEDIUM (fixed) — P5 · systemEvents.ts:94, timelineItemText.ts:109-115, personSex.ts:24.**
   `genderOf` and `blockShapeForPerson` now delegate to `resolveBinarySex`; the legacy
   `g` → female code moved into the shared `GENDER_CODES` table. A sex recorded only as
   `genderIdentity`/`genderSymbol` now picks the correct relation noun and timeline shape.
   Sibling search confirms no other `startsWith('m'/'f')` sex classifier remains. RED: the
   new systemEvents test yields "Parent died" instead of "Father died".

4. **MEDIUM (fixed) — P6 · useFileOperations.ts:233, DiagramEditor.tsx:2411-2420, 2506.**
   Restore passes `keepSavedBaseline: true`; `replaceDiagramState` then skips
   `markSnapshotClean`, leaving the restored content dirty so autosave writes it to a
   linked file and Open/New prompt before discarding. RED: the new
   `DiagramEditor.restoreBackup.test.tsx` sees the Save button stay CLEAN.

5. **LOW (fixed) — P2 · storage.ts:265-267.** A failed read of the backup record no longer
   calls `put({})` (which was discarding v1..vN); the `onerror` path leaves the record
   intact. RED: the new test observes a write under the old `onerror = () => put({})`.

6. **LOW (fixed) — P19/L9 · personEventBundle.ts:21-22, 366-374.** The bundle's
   `displayName` now calls `personDisplayName` (first+last first), and
   `mergePersonEventsFromBundle` indexes people by both display name and stored `name`, so
   pre-rule-change bundles still match. RED: the new test observes `'Annie'` instead of
   `'Ann Lee'`; the old-name match test fails if the `name` index is dropped.

## Re-sweep findings (fix commit 86ce5f8 is unreviewed code — P26)

### 1. LOW — P5/P6/L9 · PropertiesPanel.tsx:1850, DiagramEditor.tsx:832-837 · the display-name rule is not yet fully single-sourced

Two display sites still hand-roll `[firstName, lastName].filter(Boolean).join(' ').trim()
|| name || fallback` rather than calling `personDisplayName`. Both already use the correct
first+last precedence (the `'Person'` / `Person ${id.slice(0,4)}` fallbacks are the only
difference from the shared rule), so this is drift/maintainability risk, not a correctness
bug. The matching-oriented copies (diagramMerge.ts:150 `normalizeNameKey`,
useVoiceHandlers.ts:25 `fullNameKeys`) are a different purpose (name-key resolution) and
correctly left alone.

Fix (backlog): replace both with `personDisplayName(person, fallback)`.

### 2. INFO · timelineItemText.ts:109, systemEvents.ts:94 (via resolveBinarySex) · legacy `gender` strings that merely start with m/f now classify as unknown

The migration from `startsWith('m'/'f')` to the exact `GENDER_CODES` lookup narrows
classification for a hand-edited `gender` value like `'masculine'`/`'mixed'`. Normal flow
never stores such values (writers set `gender` from `birthSex`), so impact is confined to
hand-edited files; the tightening is intentional and matches the existing comment in
`personSex.ts`. No action.

### 3. INFO · storage.ts:266 · `backedUp = previousJson` in the `onerror` handler is a redundant no-op

The value already equals `previousJson` (initialised at line 250); the real fix is the
removal of `put({})`. Harmless, but the assignment may read as load-bearing. Optional:
drop the assignment, keep the comment.

## Verified clean (re-sweep)

- All six fixes map to their findings and each changes behavior (none is a no-op).
- No new `any` (the `data: any` JSON boundary in `replaceDiagramState` is pre-existing and
  noted in the prior gate); no new hardcoded event type/category; no direct mutation; no
  invariant break (Save=create-event, EventCard 5 call sites, modal `position: fixed`).
- `keepSavedBaseline`'s early return skips only `markSnapshotClean` + `setLastSavedAt(null)`;
  `lastSavedAt`'s value is dead state (`const [, setLastSavedAt]`, never read), so the skip
  is functionally a pure `markSnapshotClean` skip and `isDirty` is set by the existing
  effect (DiagramEditor.tsx:1312-1324).
- `rotateDiagramBackups` return value on read error is `previousJson`; the only consumer
  that reads the return passes `null`, so the return-value path is unobservable.
- P28 test isolation: `storage.test.ts` stubs `indexedDB` and unstubs in `finally`;
  `restoreBackup.test.tsx` mocks `loadDiagramBackups` and clears localStorage.

## Notes for the next loop

- Finding 1 (LOW) is carried to the backlog; it is not a correctness bug. No medium-or-higher
  finding remains, so the loop stops here per the prior gate's rule.
- The workspace still carries the unrelated untracked `test import 1.json` and a modified
  `.claude/worktrees/eloquent-liskov-52df2a` pointer; neither is in the diff range.
