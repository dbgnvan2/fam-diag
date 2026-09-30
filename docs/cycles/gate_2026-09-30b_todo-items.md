# Gate — TODO items batch (2026-09-30)

RANGE:       origin/main...HEAD  (3 commits, be4dc2f..93308d8)
COMMITS:
  93308d8  TODO items from 2026-08-24: storage failures, dialog focus, z-index scale
  f6ba114  TODO items from 2026-09-19: Timeline open state, lane search, imports
  be4dc2f  TODO items: review leftovers, 2026-09-27, -09-22, -09-21 and -09-20 lists

APPLICABLE:  P4 (hardcoded constants), P19 (producer/consumer + source-text drift),
             P25 (every writer covered), L9 (operation copied to several places),
             L10 (form/save not fabricating), CLAUDE.md invariants
             (Save=create event shape, no hardcoded event types, no `any`,
             immutability, tests that fail without their fix, no fabricated
             data, no today-date defaults).

CHECKED:     All P1–P36 (generic catalogue), LEARNINGS.md L1–L10, CLAUDE.md hard
             rules 1–10 and the event/EventCard/z-index invariants, over the full
             82-file diff (3,914 lines).

NOT COVERED: Deep logic/algorithmic correctness outside the invariants; security;
             performance; concurrency. The three TODO items deliberately left open
             are out of scope by the user's instruction.

VERDICT:     REJECTED — 1 medium (blocking), 2 low (non-blocking).

---

## Test gates (all three, src/frontend)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx vitest run` | PASS (87 files, 880 tests) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

Note: the gates were run via `./node_modules/.bin/{tsc,vitest}` because the
`npx` form was blocked by a runtime threat-intelligence scan, not by a code
failure. Exit codes are the source of truth (P24).

---

## Findings (ranked)

### 1. MEDIUM — the schizophrenia indicator definition is hand-maintained in three places (drift)

- File: `src/frontend/src/utils/dataImport.ts:30-33`, `:526`, `:1333`
- Pattern: P19 / L9 / Pitfall 2 (parallel hand-maintained copy).
- Evidence: the new `SCHIZOPHRENIA_INDICATOR` const (id
  `indicator-schizophrenia-spectrum`, label `Schizophrenia Spectrum`,
  group `emotional`) duplicates the same definition already emitted by
  `parseTranscriptToDraftDiagram` (line 526) and `factsToDiagramImportData`
  (line 1333), both of which additionally carry `color: '#7b1fa2'` and
  `useLetter: true`. The new const is a *partial* copy (no color/useLetter)
  and drives both `person.functionalIndicators[].definitionId` and the backing
  SYMPTOM event's `subtype`/`sourceIndicatorId` (`recordImportedDiagnosis`).
  The batch added a third hand-kept copy of the same id+label rather than
  becoming the single source; a rename in any one of the three sites silently
  breaks the indicator ↔ definition ↔ event linkage.
- Fix: define one exported indicator-definition constant (with `color` and
  `useLetter`) and reference it at all three sites; derive the symptom subtype
  from `definition.label` rather than a separate literal.

### 2. LOW — `partnershipSeparationMarks` widens "separated" beyond the old rule

- File: `src/frontend/src/utils/partnershipUtils.ts:84-104`;
  classifier at `src/frontend/src/utils/relationshipStatusKeys.ts:104-115`
- Evidence: the refactor to `relationshipEndingForStatus` now classifies every
  `statusDates` key, so a `statusDates.ended` entry marks the partnership
  separated. The old code checked `statusDates` only for `separated`/`separation`
  and treated `ended` solely as a status-*field* value, not a statusDates key.
  Plausibly correct (an "ended" date should draw the slash), but it is a
  behavioural widening beyond "same rule", and only the classifier is tested —
  not `partnershipSeparationMarks` with a `statusDates.ended` input.
- Fix: add a `partnershipSeparationMarks` regression asserting the
  `statusDates.ended` case, or record the widening as deliberate.

### 3. LOW — three source-text assertions remain (brittle)

- Files:
  - `src/frontend/src/constants/zIndex.test.ts:28` — greps component sources for
    `/zIndex:\s*\d/`; can false-positive on a comment (`// zIndex: 1000`) and
    falsely fail a future deliberate `zIndex: 0`.
  - `src/frontend/src/components/DiagramCanvas.visibility.test.tsx:108-111` —
    reads the component's own `interface DiagramCanvasProps` and regex-fills
    spies from prop names; self-maintaining but coupled to interface layout.
  - `src/frontend/src/hooks/useContextMenuHandlers.familyScope.test.ts:26-27` —
    `indexOf("label: 'Timeline'")` + a fixed 300-char `openTimeline(` slice over
    DiagramEditor source; brittle to reordering.
- Pattern: P19-corollary (assert on source text, not behaviour).
- Note: the diff *did* convert most family-scope checks to behavioural tests
  (useContextMenuHandlers.test.ts), which is an improvement; these three remain.
- Fix: non-blocking. Replace the zIndex source grep with a behaviour/ordering
  check where possible, and the two slice-based tests with a rendered/hook test
  when the seams permit.

---

## Verified clean

- Save = create event: the new imported-diagnosis path goes through
  `buildNewEventDraft` + `normalizeEventForSave` (the shared save path, L9),
  setting `date`/`startDate` to `''` (no today default), ratings 0 (not 5/5/5 —
  the fabricated-data fix), and `anchorType`/`anchorId`/`eventClass`/`subtype`.
- `anchorTypeForOwner`/`eventClassForOwner` now follow `owner.list`
  (gate LOW #1); the two family-event surfaces (PropertiesPanel, TimelineBoardModal)
  pass the list; session-note surfaces correctly omit it (they never build family
  events).
- `setStoredValue` removed everywhere; all callers migrated to `trySetStoredValue`
  / `writeStored` (no dangling imports — tsc -b clean).
- No `any` introduced; no hardcoded event *types/categories*; immutability kept
  (companion sync returns a new object, spread/clone).
