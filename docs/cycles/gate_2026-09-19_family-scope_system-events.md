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

---

# Pass 7 — re-run after fix commit a6ee222

Date: 2026-09-20
Review: learning-qa failure-pattern sweep (P1–P36 + L1–L6)
Range: `7875bfb...HEAD` (1 commit); the three pass-6 findings cleared
Verdict: **APPROVED**

## Commits

- a6ee222 Clear the three findings carried from gate pass 6

## Gates (re-run on current HEAD `a6ee222`)

| Gate | Result |
|---|---|
| `npx vitest run` | PASS — 59 files, 600 passed, 13 skipped (613) |
| `npx tsc --noEmit` | PASS (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

## The three carried findings — verified by reproduction, not by the commit message

### 1. PropertiesPanel delegates the clone rule to eventDedup (pass-6 finding 1, med-low P3)

Real. `getDisplayEvents` now sets `isAlreadyCloned = (sourceId) => hasSameEvent(sourceId, ownIds)`
(PropertiesPanel.tsx:1656), importing `hasSameEvent` from `utils/eventDedup` (:27). The three
redundant `ownIds.has(event.id)` guards beside it were removed (:1666, :1674, :1689); the exact-id
check is preserved inside `hasSameEvent`'s first line `if (ownEventIds.has(eventId)) return true`
(eventDedup.ts:25), so removing it cannot let a duplicate back in.

Single-source-of-truth confirmed by grep: `CLONE_SUFFIX_PATTERN`, `baseEventId` and `hasSameEvent`
now live only in eventDedup.ts; all three gather paths (PropertiesPanel, TimelineBoardModal,
systemEvents.ts) import `hasSameEvent`. No inline `-p1`/`-p2` dedup copy remains anywhere.

**Differential reproduction** (temporary panel-level test, since the panel's getDisplayEvents has no
direct unit test): two Events-tab fixtures were rendered.
- Classic case (person holds clone `shared-p1`, partnership holds original `shared`): GREEN under
  BOTH the old inline rule and the new `hasSameEvent` rule — behaviour unchanged for the cases that
  already worked.
- New case (person holds original `shared`, partnership holds clone `shared-p1`): RED under the old
  inline rule (duplicate leaked back in — `getAllByText(/zzz partnership event/i)` returned 2, not
  1) and GREEN under `hasSameEvent`. The panel now handles a clone whose original is held, which the
  inline version could not.

The temp test was deleted after use; the working tree is restored to `a6ee222`.

### 2. Shape test now exercises the female/oval half at component level (pass-6 finding 2, low)

Real. The test fixture gives `wife` a `birthDate` and `mum` an `Illness` event, then asserts
`Birth — Wife` (her own lane) and `Illness — Mum` (a system event on Root's lane) both render
`999px` (TimelineBoardModal.systemEvents.test.tsx:294-321).

**Mutation-proven**: `blockShapeForPerson`'s female branch was temporarily changed from `return
'oval'` to `return 'rect'`; the test went RED (`expected '2px' to be '999px'` at line 319). Restored
with `git checkout`; the test went GREEN. The female→oval mapping is now genuinely guarded at the
component level, not just by the pure `blockShapeForPerson` unit test.

### 3. Stale intensity-ramp comment gone (pass-6 finding 3, low)

Confirmed by grep: the old ramp text (`0 / unset → green, 1 → blue, 2 → yellow, 3 → orange, 4 →
pink, 5 → red`) returns zero matches. The comment above `eventStart` now points at
constants/timelineBlockStyle.ts (`intensityStyle()` applies them), TimelineBoardModal.tsx:397-398.

## Events tab — verified not broken

Rendered the panel's Events tab with a full fixture (temporary test, deleted after): own events,
partnership events, `familyEvents`, EPL events, and the synthesized birth all appear exactly once,
with the partnership event (held as the person's clone, the partner's clone, and the partnership's
original) listed once, not three times. No source is dropped and none is duplicated.

## Findings (ranked)

None. The three carried pass-6 findings are all resolved and reproduction-verified; no new finding
was introduced by the fix commit.

## Not covered

- `src/frontend/src/data/version.ts` (version bump only).
- learning-qa scope limits: concurrency/races, authn/authz, injection/security, performance,
  dependency/supply-chain, API-contract compatibility, general test quality.

## Verdict

**APPROVED** — all three carried findings are cleared and verified by reproduction: the clone rule
is now held once in eventDedup.ts (differential test proves behaviour is unchanged for the classic
case and newly correct for a clone whose original is held), the shape test genuinely guards the
female/oval path (mutation goes red), and the stale ramp comment is gone. The Events tab still lists
own / partnership / familyEvents / EPL / synthesized events exactly once. Full suite (600 passed)
and both typecheck gates are green. Clean against P1–P36 and L1–L6; P3/P19-corollary (parallel clone
rule) was the only pattern applicable and it is now closed.

---

# Pass 8 — two display bugs on the Timeline Board (cc70010)

Date: 2026-09-20
Review: learning-qa failure-pattern sweep (P1–P36 + L1–L6)
Range: `5b109ed...HEAD` (1 commit)
Verdict: **APPROVED**

## Commits

- cc70010 Fix the double hover bubble and the clipped year header

## Gates (run on current HEAD `cc70010`)

| Gate | Result |
|---|---|
| `npx vitest run` | PASS — 59 files, 603 passed, 13 skipped (616) |
| `npx tsc --noEmit` | PASS (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

Note: the full suite was run three times. Two runs had one pre-existing timeout
(`DiagramEditor.test.tsx` "starts interactive demo from help…", a 20-click loop, 5000ms) and
one ran clean at 603 passed. The flaky test passes in isolation (1359ms), is in a file the
diff does not touch, and is load-dependent — not a regression from cc70010. Counted here as
the clean run; the flake is recorded for honesty.

## Fix 1 — double hover bubble (title attribute removed)

The block div now sets `aria-label={item.hoverText}` and `data-hover-text={item.hoverText}`
instead of `title` (TimelineBoardModal.tsx:1355-1356). The custom styled bubble is unchanged:
`onMouseEnter`/`onMouseMove` still set `timelineHoverNote` (:1359, :1366), `onMouseLeave`
clears it (:1372), and the bubble renders `timelineHoverNote.text` (:1508). So the browser's
native tooltip no longer joins the styled bubble a second later.

**Verified by reproduction, not the commit message.** Restoring `title={item.hoverText}` in
place of the two attributes and re-running `test_timeline_block_has_no_native_title_tooltip`
goes RED (`expected 0 to be greater than 0` — `div[data-hover-text]` matches nothing once the
attribute is gone). The test genuinely guards the removal; the file was restored with
`git checkout`.

**Nothing lost.** `title` previously provided a hover tooltip and an advisory accessible name.
The hover text is unchanged (both the bubble and the removed title read the same
`item.hoverText`), and `aria-label` is the correct accessibility replacement — it now gives
the block's accessible name the full "what — who — relation" string rather than the bare
three-letter code, a strict improvement for screen readers.

**No other double-tooltip source.** grep for `title=` in the file returns exactly one hit:
the "+ Add Event" button (TimelineBoardModal.tsx:1337). That button has no `onMouseEnter`/
`onMouseMove`/`onMouseLeave` and never sets `timelineHoverNote`, so its native tooltip is the
only one it shows — no competing bubble, no double tooltip.

## Fix 2 — year header clipped to three digits (two-layer strip)

Each year cell previously drew its own centred label inside an opaque, `overflow`-sharing
box, so once a cell was narrower than the four digits the next cell painted over the trailing
digit ("2026" → "202"). The strip is now two sibling layers (TimelineBoardModal.tsx:1211-1253):

- Cells (:1211-1226) carry the background, border and the click target
  (`onClick={() => applyPickedYear(slice.year)}`, :1214); they are self-closing and draw no text.
- Labels (:1227-1253) are a separate layer, centred on the slice via
  `left: ${leftPct + widthPct/2}%` + `transform: translateX(-50%)`, sized by content
  (`whiteSpace: 'nowrap'`, no `width`), `zIndex: 1`, and `pointerEvents: 'none'` (:1247).

**Verified by reproduction.** Reverting to the old single-layer cell (text nested back inside,
`display:flex/justifyContent:center`) and re-running the two year-header tests goes RED — both
`test_timeline_year_labels_show_all_four_digits` and
`test_timeline_year_labels_are_not_drawn_inside_the_year_cells` fail because the
`data-testid="timeline-year-label"` node no longer exists. Restored with `git checkout`.

**Click target survives the new layer.** The label carries `pointerEvents: 'none'` (:1247) and
no `onClick`/`onPointerDown`, so in a real browser the click passes through to the cell beneath;
`applyPickedYear` is unchanged on the cell (:1214). jsdom does no hit-testing, so this is
verified structurally (pointerEvents:none is a CSS guarantee; the label has no handler to
swallow anything), and the test asserts `label.style.pointerEvents === 'none'` (:328) so a
future revert of that style goes red.

**Drag-to-pan survives the new layer.** The strip's `onPointerDown`/`onPointerMove`/`onPointerUp`
handlers (:1145-1185) live on the strip container, not the cells; a pointer-down on a cell
bubbles to the strip exactly as before. The label layer and the "Drag strip to pan years" hint
(:1198) are both `pointerEvents: 'none'`, so neither intercepts the drag. The cells' `onClick`
was not changed by this diff, only their text content moved out.

## Findings (ranked)

None. Both fixes are real and each is guarded by a test proven to go red when the fix is
reverted (mutation-verified above). No sibling path was left carrying a native `title` that
would re-trigger a double tooltip.

## Not covered

- `src/frontend/src/data/version.ts` (version bump only).
- The click-through of `pointerEvents: 'none'` is verified structurally, not by jsdom
  hit-testing (jsdom does not honour `pointer-events`); the guard is the style assertion.
- learning-qa scope limits: concurrency/races, authn/authz, injection/security, performance,
  dependency/supply-chain, API-contract compatibility, general test quality.

## Verdict

**APPROVED** — both reported display bugs are fixed and verified by reproduction, not by the
commit message: restoring `title` makes the no-native-tooltip test fail, and nesting the label
back inside a cell makes both year-header tests fail. The year-cell click target
(`applyPickedYear`) and the drag-to-pan strip are intact because the new label layer is
`pointerEvents: 'none'` with no handlers, and the strip's pointer handlers live on the
container. Accessibility is preserved and improved via `aria-label`. The only remaining
`title` in the file (the "+ Add Event" button) has no competing styled bubble, so it cannot
double. Both typecheck gates are green and the full suite passes (603); the one flaky timeout
observed is pre-existing, load-dependent and in a file the diff does not touch. Clean against
P1–P36 and L1–L6; no pattern was applicable.

---

# Pass 9 — one event per date: stop appending person/partnership records (7f6d7dd)

Date: 2026-09-20
Review: learning-qa failure-pattern sweep (P1–P36 + L1–L6)
Range: `dde4503...HEAD` (1 commit)
Verdict: **REJECTED**

## Commits

- 7f6d7dd One event per date: stop appending person-date and partnership-status records

## Gates (run on current HEAD `7f6d7dd`)

| Gate | Result |
|---|---|
| `npx vitest run` | PASS — 61 files, 618 passed, 13 skipped (631) |
| `npx tsc --noEmit` | PASS (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

## The four requested checks — verified by reproduction, not by the commit message

### (1) No date record written on save; buildPartnershipEvent gone

Real, with one exception. `grep -rn buildPartnershipEvent src/frontend/src` returns ZERO
references — the builder and its only caller are both deleted. `savePersonProperties`
(Person dates) no longer pushes for birth/death/gender/adoption: the `newEvents.push` inside
`PERSON_DEFERRED_DATE_FIELDS.forEach` and the adoption-date push are both removed
(PropertiesPanel.tsx:1226-1246). `savePartnershipProperties` no longer pushes the
"type/status changed" record nor the status-date record (PropertiesPanel.tsx:1309-1331);
`newEvents` is now always empty, so the `if (newEvents.length)` clone block at
:1333-1349 is dead code (harmless, but it will never fire).

Exception: the deathDateKnown-without-a-date path still writes a `buildPersonDateEvent`
(subtype `Death Date`, dated today) at :1238-1241 — see finding 2.

### (2) Nothing became invisible — genderDate and every statusDates key are surfaced

Verified by enumerating the fields, not by trusting the commit message.

- Person date fields (`birthDate`, `deathDate`, `adoptionDate`, `genderDate`): all four now
  have a synthesis slot in `synthesizePersonDateEvents`; `genderDate` is the newly-added one
  (:85), surfacing a field that nothing else would emit once its record stopped being written.
- Partnership: the four legacy fields stay in `dateMap` and the new `statusDates` loop
  (:194-199) emits every key with NO legacy mirror field — `widowed` and any custom status
  (`engaged`, `dating`, `ended`, …) — which previously reached the timeline only through the
  appended record. The `statusesWithLegacyField` guard (:168) prevents double-emitting a
  status that has both a field and a `statusDates` entry.
- No OTHER date field was found that reached the timeline only via an appended record and
  now reaches through nothing: the only date-bearing fields on the three types are the four
  person fields above, the four partnership legacy fields, `statusDates`, and the emotional
  line `startDate`/`endDate` (both already synthesized and unchanged).

### (3) The recognisers vs. user-written events

`personDateEvents.ts` is safe. `isPersonDateRecordEvent` requires BOTH category `Individual`
AND an exact label match against the four `PERSON_DATE_EVENT_LABELS` (`Birth Date`, `Death
Date`, `Gender Date`, `Adoption Date`), case/space-tolerant. Probe of realistic user events:
"Death of pet", "Birthday party" (both category `Individual`) → kept; the category guard is
what makes "Individual" as the Event Creator's default category harmless. `personDateEvents`
passes.

`partnershipStatusEvents.ts` does NOT pass. See finding 1 — the 5-character stem match plus
the absence of any category guard hides realistic user-written relationship events.

### (4) The three rewritten tests guard the new contract

Verified by mutation. The birth-date append was temporarily re-added to
`savePersonProperties` (reintroducing the old `buildPersonDateEvent` push), and the test
"only saves birth/death dates when Save is clicked" went RED (`expected true to be false` at
PropertiesPanel.test.tsx:1329). The file was restored with `git checkout`. The test genuinely
fails if the append comes back — the new contract is guarded, not just asserted.

## Findings (ranked)

### 1. P19-corollary / P2 — high · partnershipStatusEvents.ts:30-37, 79-82

`isPartnershipStatusRecordEvent` silently drops a user-written relationship event. The
matcher compares the event's `subtype` to the status KEY with a shared-5-char-prefix rule
(`sharesStem`, `STEM_LENGTH = 5`) and — unlike `personDateEvents` — imposes NO category
guard. The only other condition is that the event's date equals the status's recorded date.

Reproduced against the real function (tsx probe, not a hand-copy):

- `Marriage counselling` (category `Therapy`) on `marriedStartDate` → HIDDEN
- `Marriage problems` (category `Conflict`) on `marriedStartDate` → HIDDEN
- `Separation anxiety` on `separationDate` → HIDDEN
- `Started counselling` on `relationshipStartDate` → HIDDEN
- `Engagement party` on `statusDates.engaged` → HIDDEN

"Marriage counselling", "Marriage problems", "Separation anxiety" are everyday clinical
entries in a family-therapy diagram, and each is dropped from the Timeline Board, the system
events collector, AND the Events tab with no trace and no undo.

The fuzzy stem was engineered against a false premise. The file's own comment claims
"`separated` is labelled 'Separation', `married` is labelled 'Marriage'" — but the records
the recogniser must catch were written by `buildPartnershipEvent` with
`relationshipDateLabelFor`, whose `RELATIONSHIP_TYPE_STATUS_ROWS` table
(PropertiesPanel.tsx:77-113) returns the -ed forms (`Married`, `Divorced`, `Separated`,
`Widowed`, `Start`, `Ongoing`, `Ended`), never the noun forms. Every record's subtype is
therefore an exact (case-insensitive) match for its status key; the stem is unnecessary to
catch them and is exactly what lets a word *starting with* the key's first five letters
through.

Fix: match the producer's actual label set, not a prefix. Either (a) import the shared
`RELATIONSHIP_TYPE_STATUS_ROWS` dateLabels (or `relationshipDateLabelFor`) and compare the
subtype exactly, or (b) require `normalizeLabel(subtype) === normalizeLabel(statusKey)` (the
records are the same word) — dropping `sharesStem` entirely. Add a category guard mirroring
`personDateEvents` (records were written under `toTitleCase(relationshipType)`) so the
"confusing default category" problem is closed on the partnership side too. Add a regression
test for each of the five reproduced cases above asserting `false`.

### 2. Inconsistency — med-low · PropertiesPanel.tsx:1238-1241 (deathDateKnown without a date)

The path that writes an event when the death checkbox is newly checked with no date was left
deliberately creating a `buildPersonDateEvent('Death Date', today)`. Under the new recogniser
that event IS a person-date record (`category: 'Individual'`, `subtype: 'Death Date'`), so
`withoutPersonDateRecords` now hides it in all three display surfaces. Net effect:

- Dead data: the event is written and then immediately hidden everywhere it could render.
- Timeline regression: a person checked "deceased (date unknown)" no longer produces any
  Timeline/Events block — the only remaining surface is the node's death-X overlay
  (PersonNode.tsx:458-459, keyed off `deathDate || deathDateKnown`).

This is inconsistent with the new contract ("the date field is the record; exactly one event
for death"). There is no date field to synthesize from here, so the two consistent options
are: stop writing the event (deathDateKnown is already surfaced on the node), or synthesize a
`Death` block from `deathDateKnown` when `deathDate` is absent. As committed, it writes an
event that is then suppressed.

## Notes (non-blocking)

- `savePartnershipProperties` retains the now-unreachable `if (newEvents.length)` clone block
  (PropertiesPanel.tsx:1333-1349). Dead code — remove it or it will mislead a future
  maintainer into thinking partnership saves still emit events.
- `EventCreator.tsx` (the raw event editor) still lists `person.events` unfiltered, so the
  legacy date records remain visible there. This is pre-existing behaviour and arguably
  correct for a raw editor (it is where you would delete them), but it is a fourth surface
  that does not apply the "hide at display" rule — recorded for awareness, not blocking.
- `RELATIONSHIP_STATUS_INTENSITY` moved to `constants/timelineBlockStyle.ts` and is carried
  onto synthesized status events, so the divorce > marriage intensity ramp survives the
  removal of the appended records; `widowed` gained a 5 (was absent from the old inline map).

## Not covered

- `src/frontend/src/data/version.ts` (version bump only).
- learning-qa scope limits: concurrency/races, authn/authz, injection/security, performance,
  dependency/supply-chain, API-contract compatibility, general test quality.

## Verdict

**REJECTED** — 1 high, 1 med-low. The core fix is sound and complete: no date record is
written on save (deathKnown aside), `buildPartnershipEvent` is gone, `genderDate` and every
`statusDates` key are now surfaced, and the rewritten tests are proven by mutation to go red
if the appends return. But finding 1 is a shipped-behaviour defect that contradicts the
change's central invariant "a user-written event is never hidden": the partnership recogniser's
5-char stem, with no category guard, silently drops realistic clinical events ("Marriage
counselling", "Separation anxiety", "Engagement party") from three surfaces. It is also built
on a false premise — the records' subtypes are the -ed forms, not the noun forms, so an exact
match against the producer's label set would catch every real record with zero false
positives. Fix finding 1 by matching the producer's actual labels (drop `sharesStem`) and
adding a category guard; resolve finding 2 (stop writing the deathKnown event or synthesize a
Death block from `deathDateKnown`); then re-run the gate. Clean against P1–P36 and L1–L6;
P19-corollary/P2 (fuzzy parallel recogniser, high) and a write-then-hide inconsistency
(med-low) were applicable.

---

# Pass 10 — re-run after fix commit 6a289fc

Date: 2026-09-20
Review: learning-qa failure-pattern sweep (P1–P36 + L1–L6)
Range: `dde4503...HEAD` (2 commits); fix commit `7f6d7dd..6a289fc` swept as its own range
Verdict: **APPROVED**

## Commits

- 7f6d7dd One event per date: stop appending person-date and partnership-status records (pass 9 — REJECTED)
- 6a289fc Stop the status-record filter hiding real events, and clear the dead paths (this pass's fix commit)

## Gates (re-run on current HEAD `6a289fc`)

| Gate | Result |
|---|---|
| `npx vitest run` | PASS — 61 files, 621 passed, 13 skipped (634) |
| `npx tsc --noEmit` | PASS (exit 0) |
| `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | PASS (exit 0) |

## The two pass-9 findings — verified fixed by reproduction, not by the commit message

### Finding 1 (high) — stem removed, exact label match, anchorType guard

The 5-char stem (`sharesStem`, `STEM_LENGTH`) is gone from `partnershipStatusEvents.ts`.
The matcher now:

1. Rejects any event anchored to something other than the relationship
   (`if (event.anchorType && event.anchorType !== 'RELATIONSHIP_PRL') return false`).
2. Requires the subtype to be a label the producer actually writes — either in
   `RELATIONSHIP_STATUS_DATE_LABELS` (extracted to `constants/relationshipStatusLabels.ts`)
   or `normalizeLabel(statusKey) === normalizeLabel(subtype)` for a statusDates key
   (the custom-status fallback via `humanizeOptionLabel`).
3. Requires the event's date to equal that status's recorded date.

The five reproduced cases were re-run against the REAL function via a `tsx` probe (not a
hand-copy), all now return `false` (kept): `Marriage counselling`, `Marriage problems`,
`Separation anxiety`, `Started counselling`, `Engagement party`.

A further 23 realistic attack subtypes of my own choosing all return `false` (kept):
`Marriage counselling session`, `Marriage retreat`, `Marriage breakdown`,
`Counselling for marriage`, `Anniversary of marriage`, `Separation agreement`,
`Separation trial`, `Divorce mediation`, `Divorce lawyer`, `Widowed grief group`,
`Widowed and bereaved`, `Started couples therapy`, `Started a new relationship`,
`Ongoing affair`, `Ongoing conflict`, `Ended the relationship`, `Ended therapy`,
`Engagement announcement`, `Engagement ring`, `Marriage` (noun), `Separation` (noun),
`Married but unhappy`, `Separated then reconciled`.

**Other direction verified.** Every producer label on its own status date still returns
`true` (recognised, hidden — no duplicates come back): `Married`, `Divorced`, `Separated`,
`Widowed`, `Start`, `Ongoing`, `Ended`, plus the custom-status fallback
(`humanizeOptionLabel('cohabiting')` → `Cohabiting` on `statusDates.cohabiting`). The
`RELATIONSHIP_TYPE_STATUS_ROWS` table was extracted byte-for-byte (normalized-whitespace
identical to the copy removed from `PropertiesPanel.tsx`, verified programmatically), so no
label was dropped or altered in the move.

### Finding 2 (med-low) — deathDateKnown-without-a-date no longer writes an event

The `if (field === 'deathDate' && !next && nextDeathKnown && !prevDeathKnown)` block that
appended a `buildPersonDateEvent('Death Date', today)` is removed. `savePersonProperties`
now only sets `updates.deathDateKnown` for the checkbox; the date fields
(`PERSON_DEFERRED_DATE_FIELDS.forEach`) set the field and comment that the field is the
record. Confirmed nothing regressed: `deathDateKnown` is still persisted (:1146), the node's
death marker still keys off `deathDate || deathDateKnown` (PersonNode.tsx, unchanged), and
the full suite + both typecheck gates are green. Note: no dedicated regression test asserts
this specific removal (see findings below) — the guard is the code path itself plus the
existing "no date event appended" tests for birth/gender.

## Removed helpers — no other caller, other paths unaffected

- `buildPersonDateEvent` — grep returns ZERO references. Deleted with its only caller.
- `buildPartnershipEvent` — grep returns ZERO references. Deleted with its only caller.
- `cloneEventForPerson` — grep returns only the explanatory comment. Its only caller was
  the removed clone block in `savePartnershipProperties`.
- `PERSON_DATE_LABELS` — ZERO references (consumed only by `buildPersonDateEvent`).
- `RELATIONSHIP_STATUS_INTENSITY` — relocated to `constants/timelineBlockStyle.ts`, now
  consumed by `syntheticDateEvents.ts:182`; not lost.
- The `if (newEvents.length)` append/clone block in `savePartnershipProperties` — gone;
  `newEvents` is no longer declared there, so nothing is appended.

`appendEventsToPerson` was NOT removed and is NOT dead — it still serves the Papero score
path (`buildPaperoScoreEvent` at PropertiesPanel.tsx:2783).

Partnership events created through the OTHER paths still behave, verified by reading:
the Events-tab "Add Event" flow (`saveEvent` → `onUpdatePartnership(id, { events })`,
:1956-1957) and the Timeline board's own add/edit (`saveEventModal` →
`onUpdatePartnership(id, { events | familyEvents })`, TimelineBoardModal.tsx:224-237) both
write straight to the partnership arrays and use none of the removed helpers.
`familyEvents` are surfaced unfiltered in `getDisplayEvents` (:1490-1493) — correct, since
status records were only ever written to `events`, never `familyEvents`.

## PropertiesPanel.tsx coherence — diffed against dde4503, every hunk sane

The full diff (`git diff dde4503..HEAD -- .../PropertiesPanel.tsx`) is six surgical hunks:
(1) three imports added, each used; (2) `PERSON_DATE_LABELS` + the local
`RELATIONSHIP_TYPE_STATUS_ROWS` removed (the latter now imported, byte-identical);
(3) `cloneEventForPerson` + `RELATIONSHIP_STATUS_INTENSITY` removed (relocated/comment);
(4) `buildPersonDateEvent` removed; (5) `savePersonProperties` / `savePartnershipProperties`
date-event appends, the deathKnown push, the type/status-changed event and the clone block
removed; (6) `getDisplayEvents` now filters `withoutPersonDateRecords` and
`withoutPartnershipStatusRecords`. No hunk deletes unrelated code; `newEvents` in
`savePersonProperties` is still live for the identity fields (`buildPersonIdentityEvent`),
`humanizeOptionLabel`, `normalizeStatusKey`, `toTitleCase`, and `appendEventsToPerson` all
retain callers (confirmed by grep), and `tsc --noEmit` under `noUnusedLocals` passes with no
unused-import/locals errors. The file is coherent.

## Findings (ranked)

### 1. P19-corollary residual — med-low · partnershipStatusEvents.ts:69-73

The `normalizeLabel(statusKey) === normalizedSubtype` branch (kept to catch custom statuses)
still hides a user-written relationship event whose subtype is exactly the STATUS KEY
`Divorce` (noun) on the divorce date. `divorce` is the one standard status whose key
diverges from its dateLabel (`Divorced`); the other six keys spell their label exactly, so
no noun-form false positive exists for them. Reproduced: subtype `Divorce` on
`statusDates.divorce` → `true` (hidden); on any other date → `false`. This predates the fix
(the pass-9 stem hid the same string) and the event is semantically indistinguishable from
the divorce status record, so it is not a shipped-behaviour defect — recorded, not blocking.

### 2. Prefix branch without date/anchorId check — low · partnershipStatusEvents.ts:56

`STATUS_CHANGE_SUBTYPE_PREFIXES` matches any subtype starting `type changed to` /
`status changed to` with no date or anchorId requirement (only the anchorType guard). This
is the app's own generated phrasing (the old producer wrote exactly these strings), so a
clinician writing one freehand is implausible; it was present in 7f6d7dd and pass 9 did not
flag it. Recorded for awareness; non-blocking.

### 3. Test-coverage gap — low · PropertiesPanel.test.tsx

No regression test asserts the deathKnown-without-a-date path writes no event (the existing
guards cover birth and gender dates only). The removal is verified by reading and by the
green suite, but a future re-introduction of the `Death Date` push would not go red.

## Not covered

- `src/frontend/src/data/version.ts` (version bump `v 2.42 → v 2.43` only).
- `.claude/worktrees/eloquent-liskov-52df2a` (worktree submodule pointer, pre-existing).
- learning-qa scope limits: concurrency/races, authn/authz, injection/security, performance,
  dependency/supply-chain, API-contract compatibility, general test quality.

## Verdict

**APPROVED** — the pass-9 blocking finding is fixed and verified by reproduction against the
real recogniser: the stem is gone, the match is exact against the producer's own label set
(extracted byte-identically to a shared constant) plus the partnership's status keys, and the
anchorType guard closes the person-anchored hole. All five reproduced cases and 23 further
attack subtypes are kept; every producer label on its own date — including the custom-status
fallback — is still recognised, so the duplicates do not return. The deathKnown path no
longer writes a dated-today event, and nothing regressed (deathDateKnown still persists, the
node marker is unchanged). All three removed helpers had no other caller, the two remaining
`appendEventsToPerson` call sites are legitimate, and partnership events via the Events tab
and the Timeline board add/edit still write correctly. PropertiesPanel.tsx is coherent and
nothing was lost from it. Three non-blocking findings remain — one med-low residual
(`Divorce` noun via the statusKey branch), one low prefix-branch note, one low test gap —
none is a shipped-behaviour defect. Clean against P1–P36 and L1–L6; P19-corollary/P2
(fuzzy parallel recogniser, resolved) and a write-then-hide inconsistency (resolved) were
the applicable patterns this pass.
