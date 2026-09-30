# Gate — TODO items batch, re-sweep after fix (2026-09-30)

RANGE:       origin/main...HEAD  (4 commits). `git merge-base origin/main HEAD`
             is c7bd7e5; the reviewed commits are be4dc2f..14fc879.
COMMITS:
  14fc879  Fix gate 2026-09-30b findings (REJECTED: 1 medium, 2 low)
  93308d8  TODO items from 2026-08-24: storage failures, dialog focus, z-index scale
  f6ba114  TODO items from 2026-09-19: Timeline open state, lane search, imports
  be4dc2f  TODO items: review leftovers, 2026-09-27, -09-22, -09-21 and -09-20 lists

APPLICABLE:  P4 (hardcoded constants), P19 (producer/consumer + source-text drift),
             P25 (every writer covered), P26 (the fix commit is the least-reviewed
             code — swept as its own range), L9 (operation copied to several
             places), L10 (form/save not fabricating), CLAUDE.md invariants
             (Save=create event shape, no hardcoded event types, no `any`,
             immutability, tests that fail without their fix, no fabricated
             data, no today-date defaults).

CHECKED:     All P1–P36 (generic catalogue), LEARNINGS.md L1–L10, CLAUDE.md hard
             rules 1–10 and the event/EventCard/z-index invariants, over the
             full 86-file range diff plus commit 14fc879 as its own range (P26).

NOT COVERED: Deep logic/algorithmic correctness outside the invariants; security;
             performance; concurrency. The three TODO items deliberately left
             open are out of scope by the user's instruction. Source-text test
             files whose readFileSync lines were NOT touched by this range
             (AppRibbon.test.tsx, familyScope.persistence.test.ts,
             TimelineBoardModal.systemEvents.test.tsx, AISettingsModal.test.tsx)
             are pre-existing and outside this range's diff.

VERDICT:     APPROVED — the blocking MEDIUM is fixed; the two LOWs are either
             tested-and-documented-deliberate or converted to behavioural with
             the residue documented. One new non-blocking LOW is recorded below.

---

## Test gates (all three, src/frontend)

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit` | PASS (exit 0) |
| `./node_modules/.bin/vitest run` | PASS (87 files, 882 tests) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && ./node_modules/.bin/tsc -b` | PASS (exit 0) |

The gates were run via `./node_modules/.bin/…` (the `npx` form is blocked by a
runtime threat-intelligence scan, not by a code failure). Exit codes are the
source of truth (P24). Test count 882 = 880 + the fix's net +2 (one
`familyTimelineLanes` test, two `partnershipSeparationMarks` tests, minus one
removed source-slice test).

---

## Fix verification (gate 2026-09-30b findings, one per finding)

### #1 MEDIUM — schizophrenia indicator single-sourced. FIXED.

- `src/frontend/src/utils/dataImport.ts:36` now exports one
  `SCHIZOPHRENIA_INDICATOR_DEFINITION` carrying id, label, group, `color:
  '#7b1fa2'` and `useLetter: true`. Both import sites emit it by spread
  (`parseTranscriptToDraftDiagram:539`, `factsToDiagramImportData:1346`).
  The derived `SCHIZOPHRENIA_INDICATOR` const (line 43) takes its id/label/group
  *from* the definition rather than re-listing literals, and
  `recordImportedDiagnosis` builds the functional-indicator entry and the backing
  SYMPTOM event's `subtype` from that derived label — no hand-kept literal left
  to drift. `dataImport.test.ts` asserts the emitted definition
  `toEqual(SCHIZOPHRENIA_INDICATOR_DEFINITION)` and that the symptom subtype
  equals `definition.label`.
- Note (not a finding): the lower-case `category: 'emotional'` seed is
  normalized to `'Emotional'` by `normalizeEventForSave` (proven by
  `eventDraft.test.ts:114-119`), so the SYMPTOM category is valid.

### #2 LOW — `statusDates.ended` counts as a separation. TESTED + RECORDED DELIBERATE.

- `relationshipEndingForStatus('ended')` → `'separation'`
  (`relationshipStatusKeys.ts:97-102`), so `partnershipSeparationMarks` now
  draws one slash for a recorded `statusDates.ended`. Two regression tests were
  added (`partnershipUtils.test.ts`): an `ended: '2010-01-01'` date →
  `{separated: true, divorced: false}`, and a whitespace-only `ended: ' '` → not
  separated. The widening is recorded as deliberate — the status field and the
  status dates now classify alike. This is the finding's own accepted
  resolution ("add the regression … or record the widening as deliberate").

### #3 LOW — source-text assertions reduced 3 → 2, remainder documented.

- `DiagramCanvas.visibility.test.tsx` no longer reads the component's own
  interface; a `Proxy` supplies a spy for any prop not explicitly listed.
- The family right-click Timeline slice test was replaced by a behavioural
  `familyTimelineLanes` function (`familyScope.ts`) with its own test; the
  extraction is faithful to the inline code it replaced (the empty-people
  ternary and the `[...selectedPeopleIds]` copy are equivalent, and the
  "family survives a derivation that would drop it" branch is asserted).
- Two checks still read source, and both are now documented in `TODO.md` with
  a sound reason: `constants/zIndex.test.ts` (the rule genuinely targets the
  source — "no bare-number z-index") and
  `useContextMenuHandlers.familyScope.test.ts` (the DiagramEditor→hook wiring,
  which has no seam short of a full canvas render).

---

## Findings (ranked)

### 1. LOW (non-blocking) — the Proxy render test calls the component as a plain function

- File: `src/frontend/src/components/DiagramCanvas.visibility.test.tsx:111-113`
- Pattern: P26 corollary (a fix commit's replacement introduces a subtler
  smell); test-quality, not a product defect.
- Evidence: `const Wrapper = () => renderComponent(props)` invokes
  `DiagramCanvas` as an ordinary function inside `Wrapper`'s render body, so its
  hooks are registered against `Wrapper`'s fiber rather than its own. This works
  today (one synchronous render, deterministic hook order, `stageRef` still
  populated) and the test is green, but it is a rules-of-hooks violation that
  will break if the component's hook count ever varies or the test re-renders.
- Fix: `render(React.createElement(DiagramCanvas, proxyProps))` passes the
  Proxy as the element's props object without spreading (so the lazy `get` still
  fires) and lets React render DiagramCanvas as a proper component. Non-blocking.

---

## Verified clean (re-confirmed over the full range + fix commit)

- Save = create event: the imported-diagnosis path still goes through
  `buildNewEventDraft` + `normalizeEventForSave` (the shared save path, L9),
  setting `date`/`startDate` to `''` (no today default), ratings 0 (no invented
  5/5/5), and `anchorType`/`anchorId`/`eventClass`/`subtype`.
- No `any` introduced: the full range diff adds no `: any` / `as any` / `<any>`
  lines (the only matches are in comments/docs); pre-existing `any` in
  `useFileOperations.ts` is untouched by this range.
- No hardcoded event types/categories introduced; immutability kept
  (`familyTimelineLanes` copies both arrays, spreads only).
- `familyTimelineLanes` extraction is differential-faithful to the inline block
  it replaced (Pitfall 3): same `familyIds` prepend, same empty-selection
  handling, same "re-add the family if the derivation dropped it" tail.
