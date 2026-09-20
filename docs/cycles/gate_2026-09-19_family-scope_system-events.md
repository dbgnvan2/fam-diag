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
