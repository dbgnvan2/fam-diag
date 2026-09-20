# Gate — family-scope filter + system events (aa081d3..HEAD)

Date: 2026-09-19
Review: learning-qa failure-pattern sweep (P1–P36 + L1–L6)
Range: `aa081d3...HEAD` (5 commits)
Verdict: **REJECTED**

## Commits

- ce7ef62 Add implementation plan for the family scope filter (N up / N down)
- bc7e8a3 Add M7 (system events on a person lane) to the 2026-09-19 plan
- 75d2aa4 Add the family scope filter (M1-M5) and repair the test environment
- e4e120a Add system events on person lanes (M7)
- 36e5907 Docs, spec coverage and version bump for the family focus work (M6)

## Gates

| Gate | Result |
|---|---|
| `npx vitest run` | PASS — 56 files, 533 passed, 13 skipped |
| `npx tsc --noEmit` | PASS (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

## View-only invariant — VERIFIED

The feature is view-only as intended. Verified by reading (not trusting) the code:

- `computeFamilyScope`, `buildPersonVisibility`, `computeScopeExclusions`,
  `deriveTimelineSelection`, `pruneSelectionToScope`, `collectSystemEvents`,
  `clipToLifetime`, and all `syntheticDateEvents` helpers build new Sets/Maps/objects
  and spread before `sort()`; no field assignment, no `.push` on source arrays,
  no mutation of `Person`/`Partnership`/`EmotionalLine`.
- `useFamilyScope` holds the focus in `useState` only — never persisted, never autosaved.
- `buildDiagramPayload` (DiagramEditor.tsx:2201) and `serializeDiagram` contain no
  scope/focus key.
- Immutability tests (test_m2a6, test_m5a2, test_m2a7, test_m7g1) are behavioural
  (`structuredClone` + `toEqual`), not source-text assertions — they would fail on a mutation.

## Findings (learning-qa, ranked)

### 1. P3 — high · systemEvents.ts:183 (call sites PropertiesPanel.tsx:1697, TimelineBoardModal.tsx:582)

The documented default ring is not wired. `collectSystemEvents`'s `inRing()` returns
`false` for every non-lane person when `scope` is `null`, and both production callers
pass `scope: familyScope` (null when no focus is active). The file's own header promises
"the active canvas focus when one is set, its defaults otherwise (D10)", and spec D10
says "with no scope active, the ring uses the same defaults (2 up / 2 down)" — but nothing
computes that default, so the feature is **silently empty until the user right-clicks →
Focus Family**. This contradicts D13 ("on by default") and is the exact silent-drop class
this review exists to catch. The unit test `test_m7c2_ring_uses_defaults_when_no_focus_active`
passes an explicitly-computed default scope (never `null`), and both component test
harnesses inject a scope, so the `null` production path has zero coverage.

Fix: in `collectSystemEvents`, when `scope` is null, compute
`computeFamilyScope(people, partnerships, personId, defaultFocusForRoot(personId))` — or
have both callers pass a default scope. Add a `scope: null` test asserting a relative's
event still appears.

### 2. P19-corollary / P27 — high · familyScope.persistence.test.ts:31 (assertion :55–63)

The "focus never persists" guard regex-extracts keys from `buildDiagramPayload`'s source
literal with `/^[A-Za-z][A-Za-z0-9_]*[,:]$/`, which only matches shorthand `key,`/`key:`
lines. A scope persisted as a nested object (e.g. `familyScopeFocus: { … }`) ends its line
with `{` and escapes the guard, so the test stays green while the saved JSON gains a focus.
`fileMeta: {` already demonstrates the regex skipping a real nested key. The invariant
holds today, but the guard cannot catch the regression it exists to prevent.

Fix: export `buildDiagramPayload` (or a pure serializer) and assert on the returned
object's actual keys / `JSON.stringify` output, not source text.

### 3. P19-corollary — med · useContextMenuHandlers.familyScope.test.ts:28–33, 42–51, 54–60

Timeline/focus wiring is asserted by bare substring greps over component/hook source
(`toContain("label: 'Focus Family'")`, `'focusFamilyOnPerson('`, `'derived.personIds'`,
`'deriveTimelineSelection('`) plus a regex over `setTimelineSelectionIds(...)` that breaks
on multi-line or nested-paren arguments. These break green on refactor and can match
comments rather than call sites.

Fix: assert behaviourally (call the pure `deriveTimelineSelection` and assert the returned
ids), or anchor source matches to whole lines.

## Not covered

- Caller-excluded (not independently verified): `docs/`, `Testdiagram 1.json`,
  `src/frontend/src/data/version.ts`, `src/frontend/src/data/helpContent.ts`.
- learning-qa scope limits: logic/algorithmic correctness, concurrency/races, authn/authz,
  injection/security, performance, dependency/supply-chain, API-contract compatibility,
  general test quality, architecture.

## Verdict

**REJECTED** — 3 findings, 2 high. All gates green and the view-only invariant verified
(no mutation, no persistence), but finding 1 is a high-confidence spec violation: the
system-events feature is silently empty in its default (no-focus) state, contradicting its
own D10/D13 contract. This is a functional gap, not a cosmetic nit, and it ships an empty
"on by default" surface.

---

# Pass 2 — gate re-run after fix commit 548676a

Date: 2026-09-19
Review: learning-qa failure-pattern sweep, fix commit swept as its own range
Fix range: `36e5907..548676a` (the new code since pass 1, part of `aa081d3..HEAD`)
Verdict: **APPROVED**

## Gates (re-run on current HEAD)

| Gate | Result |
|---|---|
| `npx vitest run` | PASS — 56 files, 548 passed, 13 skipped (561) |
| `npx tsc --noEmit` | PASS (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

## The ten claimed fixes — verified real, not test-only

Each was checked against the current code, not the commit message.

1. **D10 default ring** — real. `collectSystemEvents` now computes
   `ring = scope ?? computeFamilyScope(people, partnerships, personId, defaultFocusForRoot(personId))`
   (systemEvents.ts:191-192) and `inRing`/`generationOf`/`marriedIn` read `ring`. The two
   misleading tests were rewritten to assert the D10 behaviour (systemEvents.test.ts:190-234,
   PropertiesPanel.systemEvents.test.tsx `test_m7f1_*`).
2. **Timeline read-only** — real. `isSystemEvent` set on system items (TimelineBoardModal.tsx:616),
   `handleTimelineItemClick` returns early (line 665-671), `handleTimelinePersonPropertyChange`
   guards (line 730), name/notes inputs `readOnly` (1306/1317) and the Add Event button is
   suppressed for system selections (1317-1324).
3. **Own-partnership events not emitted** — real. `if (ownPartnershipIds.has(partnership.id)) return;`
   (systemEvents.ts:299). The own-partnership familyEvents are still rendered by the Timeline
   person lane (TimelineBoardModal.tsx:509-530) and now by the Events tab
   (PropertiesPanel.tsx:1670-1673) — parity verified, no loss.
4. **`deriveTimelineIdsForRoot`** — real. New callback in DiagramEditor (988-1002) derives lanes
   from the focus being set, passed through to the "Timeline for this family" handler.
5. **Persistence guard** — real. Payload moved to pure `utils/diagramPayload.ts`; the guard now
   asserts on `buildDiagramPayload(...)`'s real object keys + `JSON.stringify` output, with an
   adversarial contaminated-payload case.
6. **`computeScopeDepth` honours focus options** — real. Options param threaded
   (familyScope.ts:400-414); steppers pass `prev.includeCollaterals`/`includePartnerFOO`.
7. **Undated events counted** — real. `undatedDropped` added and the date test moved ahead of
   the dedup key (systemEvents.ts:214-220). Confirmed by reproduction: the reorder is what
   prevents the same-owner `-p1`/`-p2` undated-twin from burning the altKey.
8. **Ambiguous counterpart names** — real. `idsByName: Map<string, string[]>` replaces
   last-wins `nameToId` (familyScope.ts:247-264); `unresolvedBoundaryRefs` reported.
9. **Storage reset** — real. `afterEach` clears `localStorage`/`sessionStorage` (setupTests.ts).
10. **DEFAULT_SCOPE_UP/DOWN** — real. Constants added; menu presets and "Whole family" clamp
    (`computeScopeDepth`) use them; the literal 2/2 removed from the four handlers.

## Findings (pass 2, ranked)

### 1. P10/P27 — med · systemEvents.test.ts:518 (`test_m7c6_an_undated_reach_does_not_lock_the_event_out_of_another_relation`)

The regression test written for fix #7 does not exercise the changed path. Its fixture puts the
same event id `'shared'` on two **different owners** (`mum` dated, `sister` undated). The dedup
key is `ownerType:ownerId:eventId` (systemEvents.ts:221), so two different owners never collide;
the dated `mum` copy is collected regardless of whether the date test runs before or after the
key is reserved. Verified by reproduction: the test's assertion
(`result.events.some(id === 'shared')`) is `true` under BOTH the old and new `push` ordering —
it cannot go red on the pre-fix code. The bug the fix actually prevents (an undated `-p1`/`-p2`
twin on the **same owner** burning the `altKey` so the dated twin is skipped) only manifests in a
same-owner clone-twin fixture, which this test does not build. The fix itself is correct — the
reproduction shows old ordering drops `marriage-p1`, new ordering collects it — but the guard for
it is ineffective. The P2 half (undated events are counted) IS covered by
`test_m7c6_undated_events_are_counted_not_silently_dropped`.

Fix: rebuild the fixture as a same-owner `-p1`/`-p2` twin with the undated twin pushed first, and
assert the dated twin survives; keep the existing different-owner test as a separate case.

### 2. P19-corollary persistence — low · useContextMenuHandlers.familyScope.test.ts

Pass-1 finding #3 (menu wiring asserted by bare substring source greps) was not addressed and was
instead extended: three new tests grep `toContain('DEFAULT_SCOPE_UP')`, `toContain('DEFAULT_SCOPE_DOWN')`,
`toContain('computeScopeDepth(people, partnerships, person.id)')`, `toContain('deriveTimelineIdsForRoot(person.id')`
and `not.toMatch(/up: people\.length, down: people\.length/)`. The call-pattern greps are more
specific than the pass-1 originals, but `DEFAULT_SCOPE_UP`/`DEFAULT_SCOPE_DOWN` are bare
identifiers and the whole family of tests remains source-text-bound (breaks green on rename,
can match a comment). Not a functional bug; brittleness only.

## Not covered (unchanged from pass 1)

`docs/`, `Testdiagram 1.json`, `src/frontend/src/data/version.ts`,
`src/frontend/src/data/helpContent.ts`; learning-qa scope limits as before.

## Verdict

**APPROVED** — the three pass-1 findings are resolved: finding 1 (D10 high) and finding 2
(persistence guard high) are fixed behaviourally and verified; finding 3 (source greps, med)
persists at low severity. All ten claimed fixes are real code changes with behavioural or
structural effect, none is test-only, and no fix broke a sibling path (own-partnership parity,
read-only guards, and the default ring were each traced end-to-end). One medium finding remains:
the regression test for the dedup-key reorder does not exercise the path it names (finding 1
above) — fix that fixture before the next chunk, but it is not a shipped-behaviour defect. The
two typecheck gates and the full suite are green.

---

# Pass 3 — final gate, re-run on the commit to be pushed

Date: 2026-09-19
Review: learning-qa failure-pattern sweep (P1–P36 + L1–L6)
Final range: `aa081d3...HEAD` — 7 commits (pass 1 reviewed 5, pass 2 reviewed the
fix commit `548676a`, pass 3 reviews `5134556`, the test-rebuild + docs commit that
landed since pass 2). Note: the request said "8 commits" and "two commits since
pass 2"; the range is actually 7 commits, of which one (`5134556`) landed after
pass 2 — that single commit contains both the test rebuild and the docs.
Verdict: **APPROVED**

## Gates (re-run on current HEAD `5134556`)

| Gate | Result |
|---|---|
| `npx vitest run` | PASS — 56 files, 549 passed, 13 skipped (562) |
| `npx tsc --noEmit` | PASS (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

## Pass-2 finding #1 — rebuilt regression test, verified it guards the reorder

Pass 2 flagged `test_m7c6_an_undated_reach_does_not_lock_the_event_out_of_another_relation`
as vacuous: its fixture put one event id on two **different owners**, whose dedup keys
never collide, so it passed green on the pre-fix ordering. That test is now split into:

- `test_m7c6_an_undated_clone_twin_does_not_lock_out_its_dated_twin` — a **same-owner**
  `-p1`/`-p2` clone pair on `mum`, with the undated `twin-p1` pushed **first**. Both twins
  collapse to the same `altKey` (`twin` after `/-p[12]$/` is stripped), so the ordering is
  the only thing that decides whether the dated `twin-p2` survives.
- `test_m7c6_a_dated_event_on_another_owner_is_unaffected_by_an_undated_namesake` — the
  original different-owner case, kept separately so it no longer masquerades as the ordering
  guard.

**Red/green verified independently** (not trusted from the commit message): the `push()`
body was temporarily reverted to reserve the dedup key before the date test (the old
ordering), the twin test went RED (`expected false to be true` at the `twin-p2` assertion),
the file was restored with `git checkout`, and the twin test went GREEN. The rebuilt test
fails on the pre-fix code and passes on the fixed code — it genuinely guards the reorder.

## Docs commit `5134556` — confirmed behaviour-neutral

Files touched and their nature:

- `README.md` — two Key Features bullets (Family Focus, System Events). Docs only.
- `TODO.md` — records the carried findings, each with its reason (see below). Docs only.
- `docs/cycles/gate_2026-09-19_*.md` — the gate file itself. Docs only.
- `src/frontend/src/utils/systemEvents.test.ts` — the test rebuild above. Test only.

No production source (`.ts`/`.tsx` outside `*.test.*`) changed in `5134556`; the only
non-docs file is a test. The full suite and both typecheck gates confirm no behaviour shift.

## Carried findings — documented, all non-functional

Pass-2 finding #1 (vacuous test) is resolved above. The remaining pass-1/pass-2
brittleness finding (Timeline/Focus wiring asserted by source-text greps in
`useContextMenuHandlers.familyScope.test.ts`) and the four pre-existing deferrals are
recorded in `TODO.md` under "From the family-focus / system-events batch" with the reason
each was not fixed: source-grep brittleness (would need a ~50-dependency render harness),
`includePartnerFOO` having no UI, unbounded Timeline lane count, `timelineSelectionIds`
doubling as the modal open flag, and imported indicators writing no backing SYMPTOM event.
None is a shipped-behaviour defect; each names the reason it was left.

## Verdict

**APPROVED** — the single substantive item the gate has held open across two passes is now
closed: the dedup-key reorder is guarded by a test that is proven to go red on the pre-fix
ordering and green on the fixed ordering. The docs commit is behaviour-neutral, all three
gates are green on the exact commit to be pushed, and every remaining finding is a
non-functional deferral recorded in `TODO.md` with a reason. Clean against P1–P36 and L1–L6,
of which P3 (once), P19-corollary/P27 (once, resolved), P10/P27 (once, resolved) and
P19-corollary persistence (carried, low) were applicable.

---

# Pass 4 — post-push audit of the PRL timeline fix (8be8446)

Date: 2026-09-19
Review: learning-qa failure-pattern sweep (P1–P36 + L1–L6), post-push (commit already on main)
Range: `38a25a2..8be8446` (1 commit)
Verdict: **APPROVED**

## Context

User-reported bug: on the canvas year-slider timeline, a partner relationship line
(PRL) was drawn from the partners' BIRTH instead of the relationship's own date.
Root cause confirmed by reading (not trusting) PropertiesPanel.tsx:317-335
`withPartnershipStatusDate` — a "Married" date is written to `statusDates.married`
AND the legacy `marriedStartDate`, never `relationshipStartDate`. The old visibility
rule read `relationshipStartDate` alone; `isVisibleAtTimeline` treats a missing date
as visible-at-every-year, so the line appeared as soon as both partners existed.

## Fix — complete across all five consumers

`earliestPartnershipDate()` (partnershipUtils.ts:58) reports the earliest valid date
across `relationshipStartDate`, the legacy mirrors (`marriedStartDate`/`separationDate`/
`divorceDate`) and every `statusDates` value. Verified applied to all five consumers:

1. Canvas `partnershipVisibility` memo — `buildPartnershipVisibility` extracted to
   familyScope.ts:323, called by DiagramEditor.tsx:1032.
2. Selection-pruning effect — `setSelectedPartnershipId` (DiagramEditor.tsx:939).
3. Selection-pruning effect — `setPropertiesPanelItem` partnership branch
   (DiagramEditor.tsx:968).
4. Timeline year-bounds scan — statusDates loop added (DiagramEditor.tsx:814).
5. Timeline board family-lane PRL span — `prlStart = earliestPartnershipDate(...)`
   (TimelineBoardModal.tsx:390).

## Remaining `relationshipStartDate` consumers — audited, none missed

Every occurrence of `relationshipStartDate` in src/frontend was checked. The only
ones left are NOT "when did the relationship exist" computations and correctly do
NOT use the earliest date:

- PartnershipNode.tsx:170 — renders a per-field "Start:" label; not a visibility/time
  decision (a marriage-only partnership still shows "Married:").
- syntheticDateEvents.ts:147 — per-field event synthesis, already enumerates all four
  legacy fields; earliest-date is the wrong tool (it wants each date as its own event).
- useVoiceHandlers.ts:262, dataImport.ts, DiagramEditor.tsx:3002 — producers/merge, not
  timeline consumers.

## Tests genuinely guard the rule — verified by reproduction

The new tests in partnershipUtils.test.ts were NOT trusted. `earliestPartnershipDate`
was temporarily reverted to the old `relationshipStartDate`-only rule and the suite
run: 6 of 13 tests went RED (marriage-only reports its date, status-dates-only, earliest-
of-several, ending-date-alone, and the two visibility-hiding cases). File restored with
`git checkout`. The tests fail on the old rule and pass on the new rule.

## Gates (run on 8be8446)

| Gate | Result |
|---|---|
| `npx vitest run` | PASS — 57 files, 562 passed, 13 skipped |
| `npx tsc --noEmit` | PASS (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |
| `npm run lint` | PASS — 0 errors (8 pre-existing warnings, none in touched files) |

## Findings (ranked)

### 1. P3 / parallel field-list copy — low · DiagramEditor.tsx:809-816

The year-bounds scan manually enumerates the partnership date fields
(`relationshipStartDate`, `marriedStartDate`, `separationDate`, `divorceDate`,
`statusDates`) instead of calling `partnershipDates()`. This is a hand-maintained copy
of the field list `partnershipDates()` owns, so a future Partnership date field could be
added to one and missed by the other. It is consistent today, and the scan needs
per-field labels that `partnershipDates()` doesn't return, so sharing is not a drop-in.
Consequence is limited: `timelineEntries` is consumed only for min/max year bounds
(DiagramEditor.tsx:832-841), never rendered, so the duplicate entries the scan now
produces for a PropertiesPanel-saved marriage (legacy `marriedStartDate` AND
`statusDates.married`) are harmless. Recorded, not blocking.

### 2. Pre-existing gap (out of scope) — low · syntheticDateEvents.ts:146-151

`statusDates`-only dates (e.g. widowed) are now counted by PRL visibility and the year-
bounds scan but are still absent from the Events-tab synthesis
(`synthesizePartnershipDateEvents` enumerates only the four legacy fields). This predates
the fix and is a different feature (surfacing each date as its own event), so
`earliestPartnershipDate` is not the right tool. Follow-up only.

## Verdict

**APPROVED** — the fix is complete (all five consumers changed together), no remaining
`relationshipStartDate` consumer that should use the earliest date was missed, the tests
are proven to go red on the old rule by reproduction, all three gates plus lint are green,
and the design decision (any recorded relationship date, including an ending date alone,
beats drawing from birth; undated stays visible) is implemented and documented. Two
low-severity notes are recorded above; neither is a shipped-behaviour defect. Clean against
Clean against P1–P36 and L1–L6; P3 (parallel field-list copy, low) and a pre-existing syntheticDateEvents
gap (out of scope) were the only patterns applicable.

---

# Pass 5 — timeline-block readability fix (d3fa56b..HEAD)

Date: 2026-09-19
Review: learning-qa failure-pattern sweep (P1–P36 + L1–L6)
Range: `d3fa56b...HEAD` (2 commits)
Verdict: **REJECTED**

## Commits

- efe9855 Untrack the local scratch test diagram
- 448d90a Make timeline blocks readable: 3-letter code in the box, identification on hover

Commit 1 (efe9855) untracks `Testdiagram 1.json` and gitignores it — trivial, no behaviour.
Commit 2 (448d90a) is the substance: the timeline block now carries a 3-letter code (Bir, Dea,
Mar) and the hover bubble carries "what — who — relation"; `SYNTHETIC_EVENT_NOTE` is exported and
treated as "no note"; `SystemEvent` gains `relationNoun`/`ownerName`; `phraseFor` delegates to
`eventDisplayName`; a `MIN_BLOCK_PCT` width floor is applied to both the block style and the row
packing; `stripSelfName` is deleted.

## Gates (run on current HEAD `448d90a`)

| Gate | Result |
|---|---|
| `npx vitest run` | PASS — 58 files, 579 passed, 13 skipped (592) |
| `npx tsc --noEmit` | PASS (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

## Audit of the four questions asked

### Builder consistency — all nine builders updated, none missed

Every timeline item builder sets both `abbrev` and `hoverText`, verified by reading the file
(TimelineBoardModal.tsx): family-lane PRL span (:406), family PRL events (:428), family events
(:453), person own events (:502), person PRL events (:542), person family events (:571), EPL span
(:600), EPL events (:632), system events (:679). No builder was left rendering a bare sentence in
the box. `label` is retained and still read (side-panel `itemLabel` :740 and the synthesized-draft
`category` :789), so it is not dead — only `detail` and `notes` are (finding 2).

### Test vacuousness — none of the migrated assertions are vacuous

`hoverTexts()` joins every `[title]` attribute and `blockCodes()` reads `div[title] strong`. The
new block-code test asserts exact membership (`toContain('Bir')`, `toContain('Mar')`) plus a
length bound, and fails if `<strong>` stops rendering (`codes.length > 0`). The
`not.toContain('auto-generated from date field')` guard is behavioural (realNote strips the
placeholder through `buildTimelineHoverText`). The only source-text assertion in the file,
`test_m7a3_timeline_imports_shared_synthesizer` (:182–188), is pre-existing and unchanged by this
diff — the known P19-corollary brittleness, already recorded in `TODO.md`, not a new finding.

### eventDisplayName sourceIndicatorId heuristic — sound today, implicit and leaky (finding 3)

### Width floor — one floor is in the packing math, the other is not (finding 1)

## Findings (ranked)

### 1. Correctness — med-high · TimelineBoardModal.tsx:1328 (`minWidth: 34`) vs :1243–1257 (packing)

The `MIN_BLOCK_PCT = 4` floor is correctly applied to both the block `width` and the row-packing
right-edge, and the comment (:1237–1242) states exactly why: the drawn width must match what the
packer reserves or blocks overlap. But the block style *also* sets `minWidth: 34` (px) — a second,
independent floor that is **not** in the packing math. At the minimum supported content column
(960 − 340 properties − 12 gap − 150 lane = **458px**), 4% = 18.3px, so `minWidth: 34px` is the
*effective* floor (34px = 7.4%), while the packer still reserves only 4%. Two point events 5% of
the range apart (≥ the 4.6% same-row threshold) land in the same row, and the first block's
rendered 7.4% width overlaps the second by ~11px — the packer's 0.6% gap is only 2.75px.
`minWidth` binds on any viewport narrower than ~1470px (content < 850px), i.e. essentially every
laptop, so this is the common case. The old code (no floor, no minWidth) did not overlap. This is
a regression in the very axis the change fixes: blocks now bleed into each other instead of being
truncated. Not caught by the suite because jsdom does no layout.

Fix: make the two floors agree — either drop `minWidth: 34` and raise `MIN_BLOCK_PCT` so 4% ≥ 34px
at the minimum width (needs ~7.5%), or keep `minWidth` and fold the *effective* width (px, not %)
into the packer's right-edge. One floor, one place.

### 2. Dead fields — med · TimelineBoardModal.tsx:60–61 + all nine builders

`TimelineBlockItem.detail` and `.notes` are now write-only: every builder sets them, nothing reads
them (the block renders only `item.abbrev`; `title` and the hover use `item.hoverText`). The
`realNote(event.observations)` results folded into `detail:` are dead computation — `realNote` is
only live inside `buildTimelineHoverText`. Write-only fields invite drift (a maintainer sets
`detail` expecting it to render) and are the inverted shape of P21. Fix: delete `detail` and
`notes` from the type and from all nine builders; the hover already carries everything they held.

### 3. Heuristic fragility — med-low · timelineItemText.ts:27–28 (`isSymptomLike`)

`isSymptomLike = eventType === 'SYMPTOM' || !!sourceIndicatorId`. Verified against all producers:
`sourceIndicatorId` is set only on symptom events today (demo-data FF symptoms, and
`synthesizePersonIndicatorEvents`), so the heuristic is currently correct — and it is a genuine
improvement over the old `eventType === 'SYMPTOM'`-only rule (real data records indicator-backed
symptoms as `FF`). But the invariant "has sourceIndicatorId ⟹ is a symptom" is implicit and
unenforced: `PropertiesPanel.saveEvent` (:2078) copies `eventDraft.sourceIndicatorId` through on
**every** save regardless of type, while clearing `symptomType` for non-SYMPTOM (:2079). A symptom
re-keyed to a non-symptom type (or any future producer that sets `sourceIndicatorId` on a
non-symptom) would then have `eventDisplayName` return its `subtype` instead of `category`
(e.g. "Interstate" instead of "Relocation"). No current reproducer. Fix: key on
`eventType === 'SYMPTOM' || !!event.symptomType` (the symptom *name*, not the indicator id), or
explicitly clear `sourceIndicatorId` when a non-symptom event is saved.

### Note (not blocking) — side-panel `Item:` still shows the old phrasing

For system events `item.label = entry.relationLabel` ("Father died"), rendered in the Timeline
Properties `Item:` line, while the block/hover now use the new "Death — Dad — Father". Cosmetic
inconsistency; the side panel is not wrong, just phrased differently. Also the family-lane PRL
span abbreviates on the lowercase `relationshipType` ("mar" for "married"), unlike the capitalized
"Mar" from the Marriage event — same cosmetic class.

## Not covered

- `Testdiagram 1.json` deletion + `.gitignore` (scratch data, no behaviour).
- learning-qa scope limits: logic/algorithmic correctness (finding 1 is reported at the caller's
  explicit request, outside the pattern catalogue), concurrency, authn/authz, injection/security,
  performance, dependency/supply-chain, API-contract compatibility, general test quality.

## Verdict

**REJECTED** — 3 findings (1 med-high, 1 med, 1 med-low). All three gates are green and the
substantive work is otherwise well-executed: all nine item builders are updated consistently, the
`MIN_BLOCK_PCT` floor is (for its part) correctly mirrored into the packing math, the
`phraseFor → eventDisplayName` delegation keeps lane label and hover from disagreeing, and none of
the migrated tests are vacuous. But finding 1 is a shipped-behaviour visual regression — the
`minWidth: 34` pixel floor is not accounted for in the row packing, so blocks overlap on typical
laptop viewports, the exact defect the change set out to remove. That is a functional gap on the
rendered surface, not a cosmetic nit. Fix finding 1 (make the two width floors agree), drop the
dead `detail`/`notes` fields (finding 2), and harden or document the `sourceIndicatorId` marker
(finding 3) before re-running the gate.

---

# Pass 6 — re-run after fix commit e6cb9ac

Date: 2026-09-20
Review: learning-qa failure-pattern sweep (P1–P36 + L1–L6)
Range: `d3fa56b...HEAD` (3 commits); fix commit `448d90a..e6cb9ac` swept as its own range
Verdict: **APPROVED**

## Commits

- efe9855 Untrack the local scratch test diagram (reviewed pass 5 — trivial)
- 448d90a Make timeline blocks readable (reviewed pass 5 — REJECTED)
- e6cb9ac Fix duplicate timeline events, shape blocks by sex, shade them by intensity

## Gates (re-run on current HEAD `e6cb9ac`)

| Gate | Result |
|---|---|
| `npx vitest run` | PASS — 59 files, 600 passed, 13 skipped (613) |
| `npx tsc --noEmit` | PASS (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

## The three pass-5 findings — verified fixed by reproduction, not by the commit message

### 1. Double width floor → ONE floor (pass-5 finding 1, med-high)

Gone, verified by reading and grep. `MIN_BLOCK_PX = 34` (TimelineBoardModal.tsx:83) is
the only floor constant; `minWidth: 34` is deleted from the block style (grep confirms no
block `minWidth` remains — only the unrelated `minWidth: 960` content-column). The lane
body is measured by `laneBodyRef` + a ResizeObserver `useEffect` (:136–150), attached to
lane 0's body div (`ref={laneIndex === 0 ? laneBodyRef : undefined}`, :1319), and converted
to a percentage once: `MIN_BLOCK_PCT = laneWidthPx > 0 ? (MIN_BLOCK_PX / laneWidthPx) * 100 : 0`
(:1258–1259). That single value feeds BOTH the block width — `spanPct = Math.max(naturalSpanPct,
MIN_BLOCK_PCT)` (:1268), rendered as `width: ${item.spanPct}%` (:1350) — AND the packer's
reserved right edge `leftPct + spanPct` (:1273). With `boxSizing: 'border-box'` the drawn
width equals exactly what the packer reserves, so blocks can no longer overhang the gap.

Zero/stale measurement is handled without a correctness failure: before the first
measurement `laneWidthPx === 0` and the floor is 0 (the honest natural span — no overlap,
just no floor for one frame); on resize or reopen the deps-triggered re-measure corrects
any stale value. jsdom has no `ResizeObserver`, so the floor path has no automated coverage
— the mechanism is verified by reading, not by a test (see notes).

### 2. Write-only detail/notes removed (pass-5 finding 2, med)

Gone. `detail`/`notes` deleted from `TimelineBlockItem` (replaced by `shape`/`intensity`,
:66–69) and from all nine builders (family PRL span, family PRL events, family events, person
own events, person PRL events, person family events, EPL span, EPL events, system events).
The `realNote` import is removed from TimelineBoardModal; `realNote` now lives only inside
`buildTimelineHoverText` (timelineItemText.ts:97). grep confirms no `item.detail`/`item.notes`
remain — the surviving `.notes` reads are `partnership.notes`/`line.notes`/`person.notes`
(real data fields).

### 3. sourceIndicatorId dropped on non-symptom save (pass-5 finding 3, med-low)

Real. PropertiesPanel.saveEvent now sets
`sourceIndicatorId: normalizedType === 'SYMPTOM' || normalizedType === 'FF' ? eventDraft.sourceIndicatorId : undefined`
(PropertiesPanel.tsx:2085–2088). FF = "Functional Fact" (eventConstants.ts:463) has subtype
(:522), and FF-typed symptom events are exactly what real diagrams carry. Traced end-to-end:
an FF symptom keeps its `sourceIndicatorId`, `isSymptomLike = eventType === 'SYMPTOM' || !!sourceIndicatorId`
(timelineItemText.ts:34–35) stays true, so it is still named by subtype — not broken. The
chosen fix is the producer-side clear that pass-5 listed as acceptable; the residual (the
invariant "has sourceIndicatorId ⟹ symptom" is still implicit in the consumer) is recorded
below, non-blocking.

## New work — audited

### eventDedup (clone-aware) — correct, and cannot hide a distinct event

`baseEventId` strips `-p[12]$`; `hasSameEvent` checks the exact id, the base, and both
clones. The `-p1`/`-p2` suffix is produced ONLY by `cloneEventForPerson` (PropertiesPanel.tsx:241–251,
suffix `'p1'`/`'p2'`); synthetic ids are `synth-…` and never end in `-p1`/`-p2`, so
`baseEventId` cannot strip a legitimate id and `hasSameEvent` cannot suppress a distinct
event. Used by TimelineBoardModal's four person-lane gather points (ownEvents :516, prlEvents
:557, familyEvents :584, eplEvents :643) and systemEvents' push (:226). No gather point still
dedupes on exact ids in a way that reproduces the duplicate: the family-lane gather points
(:443/:466) read only the partnership's own arrays (no cross-source clone mixing); the
system-events loop's `personEventIds.has(entry.event.id)` (:689) is a redundant guard, because
`collectSystemEvents`' push already applied `hasSameEvent` against the lane person's ids and
its `ownPartnershipIds`/`involvesLanePerson` filters guarantee no overlap between system events
and person-lane events.

### Block shape by sex + fill by intensity — correctly wired

`blockShapeForPerson` (timelineItemText.ts:108) maps male→rect / female→oval / unknown→neutral,
matching `genderOf` in systemEvents.ts. `intensityStyle` (:120) maps 1–5 to the ramp and
0/undefined/null/out-of-range to the grey unrated fill; the border follows the same ramp.
`BLOCK_BORDER_RADIUS` and the ramp live in constants/timelineBlockStyle.ts. Couples/family/
pattern events are hard-coded `'neutral'`; person and system events use `blockShapeForPerson`.
Fill uses `event.intensity`, never the emotional-line graphic level — the two "intensity"
concepts stay distinct.

### Hook-order crash — fix verified by mutation, not trusted

Moved the ResizeObserver `useEffect` back below the early `return null` (:387), ran
`test_timeline_board_survives_being_opened_after_being_closed`, and it failed with
"Rendered more hooks than during the previous render" — then restored with `git checkout`.
The closed→open→closed test genuinely guards the ordering.

## Findings (ranked)

### 1. P3 / P19-corollary — parallel hand-maintained clone rule — med-low · PropertiesPanel.tsx:1651–1653, 1663, 1671, 1686

`getDisplayEvents` still carries its own inline `isAlreadyCloned` (`ownIds.has(\`${sourceId}-p1\`)
|| ownIds.has(\`${sourceId}-p2\`)`) rather than importing `hasSameEvent` from eventDedup.ts.
The commit message says the clone rule is now "held once", but it is held twice: eventDedup.ts
and this inline copy. The two rules are semantically equivalent for the current data flow
(both receive only original partnership-event ids — PropertiesPanel never passes a clone id),
so this is not a shipped-behaviour defect today. But it is the exact parallel-copy drift class
this sweep exists to catch, and they DO diverge on a clone input: `hasSameEvent('foo-p1', own)`
strips the suffix and checks the base and both clones, while `isAlreadyCloned('foo-p1')` only
checks `foo-p1-p1`/`foo-p1-p2` (never the base). Fix: import `hasSameEvent` in PropertiesPanel
and delete `isAlreadyCloned`, so the rule has one home.

### 2. Test overclaim — low · TimelineBoardModal.systemEvents.test.tsx (male/female shape test)

`test_timeline_male_events_are_rectangles_and_female_events_are_ovals` asserts only two MALE
blocks (Root's birth and Son's birth-as-system-event, both `2px`). It never asserts an oval, and
the fixture has no female person with a date or event (wife/mum have no `birthDate`/`events[]`),
so there is no female block to render. The female→oval path is covered only by the pure
`blockShapeForPerson` unit test; the component-level wiring is asserted by name, not by any
female assertion. Fix: give wife a `birthDate` (or an event) and assert `Birth — Wife` renders
`999px`, or rename the test to what it actually checks.

### 3. Stale comment — low · TimelineBoardModal.tsx:397–399

The comment above the (now-deleted) `intensityToColor` block still documents the old ramp
("0/unset → green, 1 → blue, 2 → yellow, 3 → orange, 4 → pink, 5 → red"); the real ramp is
1 blue → 2 green → 3 amber → 4 orange → 5 red with grey unrated (constants/timelineBlockStyle.ts).
Misleading to a future maintainer. Fix: update or delete it.

## Notes (non-blocking)

- The one-floor mechanism (measured `MIN_BLOCK_PCT`) has no automated coverage: jsdom lacks
  `ResizeObserver`, so every test renders with `laneWidthPx === 0` and the floor at 0. Verified
  by reading; the degradation is safe (honest natural span, no overlap).
- The sourceIndicatorId fix leaves the consumer heuristic on `!!sourceIndicatorId`; the invariant
  "has sourceIndicatorId ⟹ symptom" remains implicit for any future producer that sets the field
  on a non-symptom. Pass-5 accepted producer-side clear; residual fragility only.
- `test_timeline_producer_drops_the_indicator_link_on_a_non_symptom_save` is a source-grep
  assertion (reads PropertiesPanel.tsx). It IS effective (goes red on revert) but brittle — the
  known P19-corollary class already deferred in TODO.md, extended here, not a new defect.

## Not covered

- `Testdiagram 1.json` deletion + `.gitignore` (scratch data, no behaviour).
- `src/frontend/src/data/version.ts` (version bump only).
- learning-qa scope limits: concurrency/races, authn/authz, injection/security, performance,
  dependency/supply-chain, API-contract compatibility, general test quality.

## Verdict

**APPROVED** — all three pass-5 findings are genuinely fixed (verified by reproduction, including
a mutation test that proves the hook-order regression test fails when the hook is moved back below
the early return). The new work is correct: the clone-aware dedup cannot suppress a distinct event
(the `-p1`/`-p2` suffix is produced only by the clone path), no gather point still dedupes on exact
ids in a way that reproduces the duplicate, shape/intensity is wired through
constants/timelineBlockStyle.ts and keeps event.intensity distinct from the graphic level. Three
non-functional findings remain — one med-low P3 parallel-copy (PropertiesPanel's inline
`isAlreadyCloned` should be migrated to eventDedup so the rule is genuinely held once), one low
test overclaim, one low stale comment — none is a shipped-behaviour defect. Clean against P1–P36
and L1–L6; P3/P19-corollary (parallel clone rule, med-low), test-quality (low) and doc-drift (low)
were applicable.
