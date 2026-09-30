# Learning-QA gate — 2026-09-30 (review-fixes)

**Verdict: APPROVED** (0 high, 0 medium, 1 low, 2 informational)

## Range

`git diff origin/main...HEAD` — 6 commits `0eeb243..0a844d3` on top of `origin/main`
(merge-base `661c79e`). 81 files changed, +4485 / −1481. Reviewed the full
materialized diff (`/tmp/sweep.diff`, 8949 lines) plus targeted reads of the
new modules (`eventDraft.ts`, `syntheticDateEvents.ts`, `relationshipStatusKeys.ts`,
`sessionNoteEvents.ts`, `predictionSets.ts`, `pageNoteSelection.ts`, `siblingPosition.ts`).

Commits:
- 0eeb243 Events: one shared save path, owner routing, and no fabricated defaults
- 71a7373 Session notes: complete events, no invented values, no silent discard
- 25828d7 Family scope, lane kinship and sibling position fixes
- 1e3761e Canvas: Add Triangle, safe add-child, stale selections, note visibility
- 14b3473 Timeline, structure and test-quality fixes from the review
- 0a844d3 Review report, fix status, learnings L9-L10, TODO and version bump

## Build/test gates (CLAUDE.md)

| Gate | Result |
|---|---|
| `tsc --noEmit` | PASS (exit 0) |
| `vitest run` | PASS — 83 files, 846 tests (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && tsc -b` | PASS (exit 0) |

(Invoked via `node_modules/.bin/tsc` / `node_modules/.bin/vitest`; `npx` was
blocked by a runtime package-threat-intelligence scan with no user present to
approve, so the local binaries were used — same toolchain, no `npx` layer.)

## Review scope

Reviewed against the generic catalogue P1–P36 (`~/.claude/standards/learnings.md`),
repo patterns L1–L10 (`LEARNINGS.md`), and the CLAUDE.md invariants: Save = create
event with `date`+`startDate`/`anchorType`/`anchorId`/`eventClass`/`createdAt`/`subtype`;
no hardcoded event types/categories; no `any`; immutability; one event per date field;
no fabricated dates/ratings. Author decisions in
`REVIEW-unread-areas-2026-09-30.md` ("Author decisions" §) treated as authoritative.

CHECKED: event-save path (eventDraft + all four consumers), date-field synthesis,
owner routing, symptom-indicator sync, family-scope reach rules, lane kinship,
sibling position, session-note events, indicator-deletion guard, add-child guards,
context-menu seeds, prediction-set normalisation, and the ~20 "today" UTC-date sites.

NOT COVERED (failure-pattern family only, as always): algorithmic correctness of
Konva drag/click ordering at runtime, visual/UI-contract regression in a browser,
concurrency, security, performance profiling.

## Findings (ranked)

### 1. LOW — `anchorTypeForOwner` / `eventClassForOwner` ignore `owner.list`, so a family event without its own anchor values would be re-anchored to `RELATIONSHIP_PRL` / `relationship`

`src/frontend/src/utils/eventDraft.ts:173-177` (and `ownerList` at `:202-203`)

`ownerList` routes a partnership event to `familyEvents` vs `events`, but the two
anchor helpers key only on `owner.kind` (`'partnership'` → `RELATIONSHIP_PRL` /
`relationship`). A FAMILY event (`eventClass: 'family'`, `anchorType: 'FAMILY'`)
edited through the Properties panel Events tab flows through `normalizeEventForSave`
with `anchorTypeForOwner('partnership')` in the context. Today it survives because
`normalizeEventForSave` prefers the draft's existing `anchorType`/`eventClass`, and
the only creation path (the canvas family modal, `DiagramEditor.tsx` setFamilyPropertyModal)
sets `FAMILY`/`family` explicitly — so a live event never carries a missing anchor.
The fragility is a legacy/partially-formed family event whose `anchorType`/`eventClass`
is absent: it would be silently re-classified to `RELATIONSHIP_PRL`/`relationship`.
No test covers family-event edit anchor preservation (GTEST-01's familyEvents case
tests delete, not edit).

Fix (backlog, not a blocker): make the two helpers list-aware (or branch on
`owner.list === 'familyEvents'` at the call sites), and add a regression test that
a family event edited from a person's Events tab keeps `anchorType: 'FAMILY'` and
`eventClass: 'family'`.

### 2. INFO — Timeline symptom saves do not create a missing symptom type (documented)

`src/frontend/src/components/modals/TimelineBoardModal.tsx:235-237`

`saveEventModal` passes `{ definitions }` to `saveEventOnOwner` with no
`ensureSymptomDefinition`. A symptom whose name matches no existing definition is
stored as an unlinked event (no `sourceIndicatorId`, no indicator entry). This is
deliberate and recorded in `TODO.md` ("Symptom saves from the Timeline do not create
a new symptom type … stored unlinked rather than linked to a wrong type"), and it is
strictly better than the pre-fix behaviour (B1: linking to the wrong symptom). The
pre-diff Timeline wrote no indicator sync at all, so this is not a regression.

### 3. INFO — "meaningful subtype" invariant is relaxed for user-authored drafts, by explicit author decision

`src/frontend/src/utils/eventDraft.ts` `buildNewEventDraft` (module §)

New drafts start with `category: ''` and `subtype: ''` per author decisions 3/4
(nothing filled in that the user did not give). Saving such a draft without choosing
a category/subtype stores an event with blank category/subtype. This is the intended
consequence of the no-fabrication decision; programmatically built events (Papero
score, EPE measurement, identity, SIR, session-note) still set a meaningful subtype,
and that is asserted by the `expectComplete` builder tests in
`PropertiesPanel.reviewFixes.test.tsx`. Flagging only so the CLAUDE.md "meaningful
subtype" clause is read against the 2026-09-30 author decisions, not as a regression.

## Verified clean

- **Save = create event.** `normalizeEventForSave` is the single save path for the
  Properties panel, Timeline, canvas triangle/family dialogs and session notes
  (S1/L9 addressed — the four drifted copies are gone). It sets `date` AND `startDate`
  together, `anchorType`, `anchorId`, `eventClass`, `createdAt`, and numeric ratings;
  `eventDraft.test.ts` asserts each. Date-field edits write the field (one event per
  field — author decision 2), via `saveEventOnOwner` + `DateSlot`.
- **No fabricated dates/ratings.** `toISOString().slice(0,10)` survives only in a
  comment (`dateFormatting.ts:64`). Every event-date default of "today" is gone
  (EventCreator, personEventBundle, useEmotionalLineOperations, useUpdateHandlers,
  dataImport, PredictionsPanel, PersonSIRSection, session-note inference, canvas
  triangle/family drafts). `localDateString` is used only where "now" is legitimately
  recorded (prediction created/resolved, lifetime clip), never as an event's date.
  Ratings default to 0 (unset), not 1/5.
- **No hardcoded event types/categories.** The EventsSection Group filter enumerates
  `EVENT_TYPE_LABELS` keys; context-menu seeds and builders are validated against
  `EVENT_CATEGORIES`/`EVENT_SUBTYPES` (behaviour-tested in
  `useContextMenuHandlers.test.ts` "every seed names a category the event dialog
  knows"); the app-written categories (`Individual`, `Emotional Pattern`, `Coaching`,
  `Relationship`, `Triangle Functioning`) are now in `eventConstants.ts`.
- **No `any` in domain code.** Every `any` site flagged by the review was replaced
  (`nextValue` typed; `(updates as any)` → `Record<string, unknown>`; `category as any`
  → `string`; `items: any[]` → `ContextMenuState`; `sessionSaveDirectoryHandleRef: any`
  → `SessionNoteDirectoryHandle`). Remaining `any` are pre-existing File System Access
  API / demo-snapshot casts, not introduced by this diff.
- **Immutability.** `useCanvasDragHandlers` switched the five `setPartnerships(
  partnerships.map(...))` to functional updates; `dataNormalization` replaced
  `delete (x as any).functionalIndicators` with `{ ...person, functionalIndicators:
  undefined }`.
- **EventModal no longer rewrites data on open (L10).** The mount effect now only
  normalises a case-only category difference; empty stays empty, unknown values are
  offered as options. `EventModal.test.tsx` asserts `onSetDraft` is not called on
  mount for the shapes the app itself writes.
- **Symptom indicator sync (B1).** `syncSymptomIndicator` finds the indicator by
  label only; a symptom with no name links to nothing; the "first in group" fallback
  is gone; renaming moves the entry. `ensureSymptomDefinition('')` returns null.
- **Indicator deletion guard (M20).** `removeFunctionalIndicatorDefinition` counts
  usage (entries + linked symptom events) across people and refuses with a
  who/how-many message; `useIndicatorHandlers.test.ts` covers it.
- **familyScope reach rules (M4/M5).** `lineal: reach.lineal && !reach.descended` and
  `fromChildId` carried across the partner edge; `familyScope.test.ts` adds the
  spouse-with-child and step-parent/half-sibling fixtures.
- **Lane kinship (M3).** `collectSystemEvents` derives blood from a lane-rooted
  `LANE_KINSHIP_REACH` scope, not the focus ring's `marriedIn`; the son's-mother
  case is tested.
- **Sibling-position memo (M22).** `effectiveSiblingPositions` is keyed on
  `siblingPositionInputKey`. I traced `deriveOwnPosition` line-by-line: it reads only
  sibling data (override, parent ids, sex, dates, order, `siblingsComplete`), never
  coordinates; the x-coordinate fallback lives in `parentMatchForRole`, which feeds
  only the partner-conflict result, not the cached map. The key is complete for
  `effective_position`.
- **Regression-test honesty.** The vacuous tests the review named were replaced with
  exact assertions (`familyScope.fixture.test.ts` exact membership; `depth` exact
  `{maxUp: 2, maxDown: 0}`; `birth_and_death_still_render_once` exact block counts;
  source-grep tests replaced with `renderHook` behaviour tests; the three
  `expect(true)` placeholders deleted; `partnershipUtils.test.ts` reuses
  `isVisibleAtCutoff` instead of a re-implemented copy).
- **Family-lane `+ Add Event` dead button and year-input clamping** both fixed
  (`TimelineBoardModal.tsx` `kind` field; `TimelineYearInput` commits on blur/Enter).

## Notes for the fix loop

- The one low finding (anchor helper not list-aware) is latent and unreachable through
  any current creation/edit path; it can go to the backlog without holding the merge.
- I did **not** independently re-run the mutation checks (revert-each-fix-and-confirm-
  red). The author's review report claims this was done for every finding; the
  regression tests assert exact values rather than floors, and the full suite is
  green, but "fails without its fix" was verified here only by reading the tests'
  assertions, not by executing the reverts.
