# Implementation Plan: Family Scope Filter (N generations up / N down)

**Date:** 2026-09-19

**Goal:** Click a person and see only *their* family — by default 2 generations back and
2 forward (grandparents → parents → person → children → grandchildren), adjustable to N
up / N down. The filter also drives the Timeline board (lanes and the events on them),
unless the user has explicitly selected individuals, in which case that selection wins.

**Status:** plan only. No implementation code written. Awaiting approval per
`~/.claude/CLAUDE.md` § Planning rules.

---

## Architecture decisions (locked with the user 2026-09-19 — do not relitigate)

| # | Decision | Ruling |
|---|---|---|
| D1 | Partners of in-scope people are included; we never walk **up** from a married-in partner (their FOO is a different family). Optional toggle for "include partner's family of origin", default off. | confirmed |
| D2 | Collaterals included by default: siblings of the root and of every ancestor, and their descendants within the generation band (→ aunts, uncles, cousins). Toggle, default **on**. | confirmed |
| D3 | Adoption: traverse **both** `parentPartnership` and `birthParentPartnership`. | confirmed |
| D4 | Emotional lines / triangles that cross the scope boundary disappear (existing `emotionalVisibility` and the triangle check already require all endpoints visible). This is the wanted behaviour. | confirmed |
| D5 | Timeline precedence: an explicit individual selection wins; otherwise the scope drives the lanes. Lanes sorted by generation then birth date. **No silent truncation** (P2/P9) — all lanes render, the count is reported. | confirmed |
| D6 | Events anchored on an in-scope person but referencing an out-of-scope person are **shown**, and exclusions are counted and surfaced. With D2 on, most such references are in scope anyway, so the counter will usually read zero. | confirmed |
| D7 | Layout is **not** recompacted. Hidden people leave gaps; `x`/`y` are never touched. "Center on scope" reuses `handleCenterDiagramView`. | confirmed |
| D8 | Scope is view state: never written to the diagram JSON, never autosaved, no effect on Save. Export PNG/SVG renders the Konva stage, so it exports what is visible — that falls out for free and is the wanted behaviour. | confirmed |
| D9 | The scope filter and the timeline-year slider **AND** together; both must be visible simultaneously in the ribbon so a user never sees unexplained disappearances. | confirmed |

### Consequences of D1–D3, stated explicitly

The traversal is a **generation-banded BFS**, not a lineal walk:

- Root is generation `0`. A person is in scope iff `-up ≤ gen ≤ +down` **and** they are
  reachable by a legal edge path.
- **Up edge** (person → `parentPartnership` and `birthParentPartnership` → both partners,
  `gen − 1`): legal only from a *lineal* node, never from a married-in node (D1), and only
  if `gen − 1 ≥ −up`.
- **Down edge** (person → each of their `partnerships` → `children`, `gen + 1`): legal if
  `gen + 1 ≤ +down`.
- **Partner edge** (person → partners via `person.partnerships`, same `gen`): always legal;
  marks the partner *married-in* unless already reached as lineal.
- Siblings, aunts/uncles and cousins therefore fall out of up-then-down paths and need no
  special case. **Boundary rule (R4a):** at `up = 2`, the grandparents' own siblings are
  *not* included, because reaching them needs a great-grandparent partnership at `gen −3`,
  outside the band. This is self-consistent and bounded.
- `includeCollaterals: false` restricts a node reached via an up edge to descending only
  back to the child it came from.
- A partnership is in scope iff **both** partners are in scope — the same rule
  `partnershipVisibility` already applies.

---

## What this builds on (no new rendering work)

- `DiagramEditor.tsx:962-1030` builds `personVisibility` / `partnershipVisibility` /
  `emotionalVisibility`, today driven only by `isVisibleAtTimeline` (`:904`).
- `DiagramCanvas.tsx` honours those maps at **13** render sites; `selectPeopleByMarquee`
  (`DiagramEditor.tsx:4243`) filters on `personVisibility`; `DiagramEditor.tsx:914-928`
  already prunes a selection when the selected entity becomes invisible.
- The scope filter is therefore **one extra predicate AND-ed into three memos**.

**Hard constraint:** the filter must go through the visibility maps. Passing shortened
`people` / `partnerships` arrays into `DiagramCanvas` would break parent lookups,
child-connection anchoring and sibling ordering, which all resolve IDs against the full list.

### Why the Timeline derives at open time, not live

`TimelineBoardModal` returns `null` when both `timelineSelectionIds` and
`timelineFamilySelectionIds` are empty (`TimelineBoardModal.tsx:317`) — the selection *is*
the open flag. Auto-deriving lanes from an active scope would pop the modal open the moment
a scope is set. The modal is a blocking overlay, so the ribbon steppers are unreachable while
it is open and live re-derivation would be unobservable. Lanes are therefore computed **at
the moment Timeline is opened**, at the three existing call sites. No change to the open-flag
semantics, no refactor of the eight sites that clear it.

---

## Out of scope for this change

- Recompacting / re-laying-out the diagram around the scope (D7).
- Persisting a scope in the file, or a "saved views" list (D8).
- Scoping the Properties panel, Predictions, Session Notes, Ideas, or Inventory export.
- Multi-root scope (union of two people's families).
- Scoping AI-agent context or transcript processing.

---

## Acceptance criteria

Spec IDs are referenced verbatim in doc-strings
(`Spec: docs/implementation_plan_2026-09-19.md#M1.A.1`) and appear in every test name.

### M1 — Scope computation (pure, no React)

**M1.A.1** — `computeFamilyScope(people, partnerships, rootId, options)` returns
`{ rootId, personIds: Set<string>, partnershipIds: Set<string>, generation: Map<string, number>, marriedIn: Set<string> }`.
`options: { up: number; down: number; includeCollaterals?: boolean; includePartnerFOO?: boolean }`.
- File: `src/frontend/src/utils/familyScope.ts` (new)
- Test: `familyScope.test.ts::test_m1a1_returns_root_only_for_zero_up_zero_down`

**M1.A.2** — Ancestors: `up = 2` from a person with parents and grandparents includes both
partners of each parent partnership at `gen −1` and `gen −2`, and excludes `gen −3`.
- Test: `familyScope.test.ts::test_m1a2_two_up_includes_grandparents_excludes_great_grandparents`

**M1.A.3** — Descendants: `down = 2` includes children (`gen +1`) and grandchildren
(`gen +2`), excludes great-grandchildren.
- Test: `familyScope.test.ts::test_m1a3_two_down_includes_grandchildren_excludes_great_grandchildren`

**M1.A.4** (D1) — Partners of in-scope people are included at the same generation and flagged
in `marriedIn`; no ancestor of a married-in partner is included.
- Test: `familyScope.test.ts::test_m1a4_includes_child_spouse_but_not_spouse_parents`

**M1.A.5** (D1) — With `includePartnerFOO: true`, the root's own partner's parents *are*
included, bounded by `up`.
- Test: `familyScope.test.ts::test_m1a5_partner_foo_toggle_includes_partner_parents`

**M1.A.6** (D2) — With `includeCollaterals: true` (default), `up = 2, down = 2` includes the
root's siblings, aunts/uncles, and cousins; with `false`, none of the three appear.
- Tests:
  - `familyScope.test.ts::test_m1a6_collaterals_on_includes_siblings_aunts_cousins`
  - `familyScope.test.ts::test_m1a6_collaterals_off_excludes_siblings_aunts_cousins`

**M1.A.7** (R4a) — At `up = 2`, a grandparent's sibling is excluded (needs `gen −3`).
- Test: `familyScope.test.ts::test_m1a7_grandparent_sibling_excluded_at_two_up`

**M1.A.8** (D3) — An adopted person reaches **both** adoptive and birth lines.
- Test: `familyScope.test.ts::test_m1a8_adopted_person_traverses_both_parent_partnerships`

**M1.A.9** — Cycle safety: a diagram where a person is (incorrectly) their own ancestor
terminates and returns a finite set. Visited state is keyed by person id and kept at the
least-restrictive `(gen, lineal)` reached.
- Test: `familyScope.test.ts::test_m1a9_cyclic_parent_chain_terminates`

**M1.A.10** — A partnership is in `partnershipIds` iff both partners are in `personIds`.
- Test: `familyScope.test.ts::test_m1a10_partnership_requires_both_partners_in_scope`

**M1.A.11** — Isolated person (no `parentPartnership`, no partnerships, no children) as root
returns just that person, no throw.
- Test: `familyScope.test.ts::test_m1a11_isolated_root_returns_single_person`

**M1.A.12** — `computeScopeExclusions(scope, people, partnerships, allEmotionalLines, triangles)`
returns `{ visiblePeople, totalPeople, hiddenEmotionalLines, hiddenTriangles, boundaryEvents }`
where `boundaryEvents` counts events on in-scope entities whose `anchorId` / other person is
out of scope (D6, P2 — surface, never silently drop).
- Test: `familyScope.test.ts::test_m1a12_counts_hidden_lines_triangles_and_boundary_events`

**M1.A.13** — Fixture check against real data: `dixie 3 generations.json` with the oldest
person as root and `up=0, down=2` yields a strictly smaller person set than the file's total,
and every returned id exists in the file.
- Test: `familyScope.fixture.test.ts::test_m1a13_dixie_three_generations_scope_is_subset`

### M2 — Scope state and visibility integration

**M2.A.1** — `useFamilyScope({ people, partnerships })` exposes
`{ scope, focus, setFocus, clearFocus, adjustUp, adjustDown, exclusions }` where
`focus: { rootId: string; up: number; down: number; includeCollaterals: boolean; includePartnerFOO: boolean } | null`.
Defaults on first focus: `up = 2, down = 2, includeCollaterals = true, includePartnerFOO = false`.
Logic lives in the hook, not in the component (CLAUDE.md rule 8 — `DiagramEditor.tsx` is 5,121 lines).
- File: `src/frontend/src/hooks/useFamilyScope.ts` (new)
- Test: `useFamilyScope.test.ts::test_m2a1_default_focus_is_two_up_two_down_with_collaterals`

**M2.A.2** — `adjustUp` / `adjustDown` clamp at 0 and at the diagram's actual depth, and never
produce a negative value.
- Test: `useFamilyScope.test.ts::test_m2a2_steppers_clamp_at_zero_and_max_depth`

**M2.A.3** — `clearFocus()` restores `scope === null`; every visibility map returns to its
pre-focus state.
- Test: `useFamilyScope.test.ts::test_m2a3_clear_focus_restores_all_visibility`

**M2.A.4** (D9) — `personVisibility` = `isVisibleAtTimeline(birthDate) && inScope(id)`;
`partnershipVisibility` and `emotionalVisibility` inherit unchanged (they already require
their endpoints visible). Three call sites in `DiagramEditor.tsx:962-1030`.
- Test: `DiagramEditor.familyScope.test.tsx::test_m2a4_scope_and_year_slider_and_together`
  — a person inside the scope but born after the slider year stays hidden; a person born
  before the year but outside the scope stays hidden.

**M2.A.5** — When a focus hides a currently-selected person, the selection is pruned, matching
the existing behaviour at `DiagramEditor.tsx:914-928`.
- Test: `DiagramEditor.familyScope.test.tsx::test_m2a5_focus_prunes_hidden_selection`

**M2.A.6** (P8 dirty state) — Focus → change root → clear focus → the visible set is identical
to the pre-focus set, and no `Person` / `Partnership` object was mutated (deep-equal check on
the arrays before and after).
- Test: `DiagramEditor.familyScope.test.tsx::test_m2a6_focus_cycle_leaves_data_unmutated`

**M2.A.7** (D7) — No `x` / `y` on any person changes while a focus is active or when it is
cleared.
- Test: `DiagramEditor.familyScope.test.tsx::test_m2a7_focus_never_moves_a_person`

### M3 — UI

**M3.A.1** — Person right-click gains a **Focus Family** submenu:
`2 up / 2 down`, `1 up / 1 down`, `3 up / 3 down`, `Whole family (all up / all down)`,
`Clear focus` (only shown when a focus is active).
- File: `src/frontend/src/hooks/useContextMenuHandlers.ts` (alongside the existing `Timeline`
  item at `:445`)
- Test: `useContextMenuHandlers.familyScope.test.ts::test_m3a1_person_menu_has_focus_family_submenu`

**M3.A.2** (D9) — A focus chip renders in `AppRibbon` **adjacent to the timeline year slider**
(`AppRibbon.tsx:500-540`), showing root name, `▲▼` steppers for up and down, the live count
`showing X of Y`, and a `✕` that clears the focus. Hidden entirely when `focus === null`.
- File: `src/frontend/src/components/FamilyScopeChip.tsx` (new), rendered from `AppRibbon.tsx`
- Tests:
  - `FamilyScopeChip.test.tsx::test_m3a2_renders_root_name_counts_and_steppers`
  - `FamilyScopeChip.test.tsx::test_m3a2_hidden_when_no_focus`
  - `FamilyScopeChip.test.tsx::test_m3a2_clear_button_calls_clear_focus`

**M3.A.3** (D6) — The chip reports exclusions when non-zero:
`3 patterns · 1 triangle hidden at the boundary`. Zero counts render nothing.
- Test: `FamilyScopeChip.test.tsx::test_m3a3_reports_boundary_exclusions_when_nonzero`

**M3.A.4** — Steppers are keyboard-operable and the chip is never clipped by the viewport
(`ui-patterns.md` § modal viewport safety applies to the ribbon overflow too).
- Test: `FamilyScopeChip.test.tsx::test_m3a4_steppers_respond_to_keyboard`

**M3.A.5** — New ribbon help entry `family-scope` in `data/helpContent.ts` + `?` badge next to
the chip, matching the `timeline-controls` pattern.
- Test: `helpContent.test.ts::test_m3a5_family_scope_help_entry_exists`
  (add file if absent; otherwise assert in `AppRibbon.test.tsx`)

### M4 — Timeline

**M4.A.1** (D5) — `deriveTimelineSelection(scope, selectedPeopleIds, people, partnerships)`
returns `{ personIds, familyIds }`:
explicit `selectedPeopleIds` (length ≥ 1) wins and is returned untouched; otherwise the scope's
people sorted by `(generation asc, birthDate asc, name asc)` and the scope's partnerships.
No focus and no selection → unchanged current behaviour.
- File: `src/frontend/src/utils/familyScope.ts` (same module, pure)
- Tests:
  - `familyScope.test.ts::test_m4a1_explicit_person_selection_wins_over_scope`
  - `familyScope.test.ts::test_m4a1_scope_drives_lanes_when_no_person_selected`
  - `familyScope.test.ts::test_m4a1_lanes_sorted_by_generation_then_birthdate`

**M4.A.2** — All three Timeline entry points call it: `useContextMenuHandlers.ts:445`
(person), `:788` (group), `DiagramEditor.tsx:4128` (family). Per CLAUDE.md § Consistency
protocol, all three change together.
- Test: `useContextMenuHandlers.familyScope.test.ts::test_m4a2_all_three_timeline_entry_points_use_scope`

**M4.A.3** (D5, P2) — No lane truncation. When the derived lane count exceeds 12, the Timeline
header shows `38 lanes (2 up / 2 down from Dave)`; every lane still renders in the scroll area.
- File: `src/frontend/src/components/modals/TimelineBoardModal.tsx` (header only; lane
  building is unchanged because the selection arrays already carry the scope)
- Test: `TimelineBoardModal.familyScope.test.tsx::test_m4a3_reports_lane_count_without_truncating`

**M4.A.4** (D6) — Events on an in-scope person that reference an out-of-scope person still
render on that person's lane.
- Test: `TimelineBoardModal.familyScope.test.tsx::test_m4a4_boundary_event_still_renders_on_lane`

### M5 — Persistence and export guards

**M5.A.1** (D8) — The saved diagram JSON is byte-identical with and without an active focus.
- Test: `familyScope.persistence.test.ts::test_m5a1_focus_absent_from_saved_json`

**M5.A.2** (D8) — Autosave payload is unaffected by focus.
- Test: `familyScope.persistence.test.ts::test_m5a2_autosave_payload_unchanged_under_focus`

**M5.A.3** (D8) — PNG/SVG export renders the Konva stage, so it exports exactly what is
visible. No code change; asserted by inspection of the export path and recorded here.
- **Criterion type: documented, not code-tested.** The export path goes through
  `stageRef.current.toDataURL()`; asserting pixel content in jsdom is not feasible. Flagged
  per CLAUDE.md § Planning rules ("any criterion that cannot be made code-testable").
  **Human-review proposal:** with a focus active, File → Export PNG and confirm the image
  contains only the scoped people. One line in `manual_testing_guide.md`.

### M6 — Docs and version

**M6.A.1** — `docs/features.md` gains a "Family scope filter" section (rules R1–R4a, the
toggles, the timeline precedence rule).
**M6.A.2** — `manual_testing_guide.md` gains the M5.A.3 human-review step.
**M6.A.3** — `data/version.ts` bumped on the implementation push.
**M6.A.4** — `docs/spec_coverage.md` generated as part of the completion status report.

---

## Implementation order (dependencies)

1. **M1** — `utils/familyScope.ts` + tests. Pure, no UI, no dependency on anything else.
2. **M2** — `hooks/useFamilyScope.ts`, then the three memo edits in `DiagramEditor.tsx`.
   Depends on M1.
3. **M5** — persistence guards. Written immediately after M2, before any UI exists, so a
   regression is caught at the earliest point (P10: highest-regression-risk test first —
   silently writing view state into the user's file is the worst failure this change can have).
4. **M3** — context menu + chip + help. Depends on M2.
5. **M4** — timeline derivation + the three call sites + header count. Depends on M1 and M3.
6. **M6** — docs, version bump, spec coverage.

## Files

**New:** `utils/familyScope.ts`, `utils/familyScope.test.ts`,
`utils/familyScope.fixture.test.ts`, `utils/familyScope.persistence.test.ts`,
`hooks/useFamilyScope.ts`, `hooks/useFamilyScope.test.ts`,
`components/FamilyScopeChip.tsx`, `components/FamilyScopeChip.test.tsx`,
`components/DiagramEditor.familyScope.test.tsx`,
`components/modals/TimelineBoardModal.familyScope.test.tsx`,
`hooks/useContextMenuHandlers.familyScope.test.ts`

**Modified:** `components/DiagramEditor.tsx` (3 memos + hook wiring + Timeline call site),
`components/AppRibbon.tsx` (chip + help badge), `hooks/useContextMenuHandlers.ts`
(Focus Family submenu, 2 Timeline call sites), `components/modals/TimelineBoardModal.tsx`
(header lane count), `data/helpContent.ts`, `data/version.ts`, `docs/features.md`,
`manual_testing_guide.md`

## Adjacent issues found, not fixed (CLAUDE.md rule 10)

- `timelineSelectionIds` doubles as the Timeline modal's open flag
  (`TimelineBoardModal.tsx:317`), and eight sites clear it to close the modal. A dedicated
  `timelineOpen` boolean would be cleaner and would allow live lane updates. **Not fixed
  here** — this plan works around it (see "Why the Timeline derives at open time"); a
  sweeping refactor of eight call sites does not belong in this change.
- `DiagramEditor.tsx` is 5,121 lines, well past the `file-maintainability.md` threshold. This
  change adds ~15 lines to it and puts everything else in a hook and a util, but does not
  address the existing size.

## Pre-completion gate (run before declaring done)

```bash
cd src/frontend && npx tsc --noEmit
cd src/frontend && npx vitest run
cd src/frontend && rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b
```

---

# M7 — System events on a person lane

**Added 2026-09-19 after review of the reported bug: "you aren't showing events a person
is directly connected to — marriage, births, parents' deaths."**

**Goal:** a person's lane shows the nodal events of the *system* that person belongs to, not
only the events they personally own or are a named party to.

## M7 root cause (verified in code)

`TimelineBoardModal` builds its person lanes by hand
(`TimelineBoardModal.tsx:415-527`) from five sources only: an inline-synthesized Birth, an
inline-synthesized Death, `person.events[]`, `partnership.events[]` for partnerships the
person belongs to, and EPL spans/events. It **never calls `utils/syntheticDateEvents.ts`**,
which `PropertiesPanel.getDisplayEvents()` does call (`PropertiesPanel.tsx:26-28`,
`:1620-1666`). Consequences:

1. Marriage / separation / divorce / relationship-start are held on `Partnership` date fields
   and surfaced only by `synthesizePartnershipDateEvents()`. The Timeline never calls it, and
   the comment at `:413` defers the PRL to the Family lane — which only renders when that
   partnership is in `timelineFamilySelectionIds`. Open Timeline on a person alone and **the
   marriage is absent entirely**.
2. `partnership.familyEvents[]` (Family and Triangle events) never reach a person lane.
3. Neither surface has any concept of a relative's event. Parents' divorce, a father's death,
   a son's birth, a sister's symptom onset — the person is not a party to any of them, and
   they are the clinically load-bearing items.
4. `CLAUDE.md` currently states that both `PropertiesPanel.getDisplayEvents()` and
   `TimelineBoardModal` call `syntheticDateEvents.ts`. That is false today. **M7.A.1 makes it
   true** rather than amending the doc.

## M7 decisions (locked with the user 2026-09-19)

| # | Decision | Ruling |
|---|---|---|
| D10 | The relation ring **follows the active canvas family scope**. With no scope active, the ring uses the same defaults (2 up / 2 down, collaterals on). One traversal (`familyScope.ts`), two consumers. | confirmed |
| D11 | System events are clipped to the **lifetime of the person** whose lane they appear on. | confirmed |
| D12 | System events render on the **person's own lane**, visually de-emphasised (relation-prefixed label, muted border). Intensity colour is already spoken for and is not reused for this. | confirmed |
| D13 | On by default, with a Timeline header toggle and a count: *"14 own · 9 system events from 6 relatives"* (P2). | confirmed |
| D14 | The Properties panel Events tab gets the same set, with system events **read-only** — editing one opens it on the entity that owns it. Prevents two editable copies of one event. | confirmed |
| D15 | **Symptom events are included** — a relative's SYMPTOM events appear on the lane like any other. The collector filters by relation, never by `eventType`. | confirmed |
| D16 | **Family-level events are included** — `partnership.familyEvents[]` (FAMILY and TRIANGLE) from every partnership in the ring, including the person's own and their parents'. | confirmed |

### Assumption flagged for confirmation (D11 boundary)

Strict lifetime clipping would drop **"Parents married"**, which almost always precedes the
person's birth and is the origin of their nuclear family. The plan therefore implements
lifetime clipping **with one exception: union-formation events on the parental partnership
(relationship start, marriage) are kept regardless of date.** This is a single entry in a
constant, trivially flipped if you disagree. Everything else pre-birth is excluded —
a grandfather who died before the person was born does not appear.

Span events use **overlap**, not start-containment: an event whose `startDate` precedes birth
but whose `endDate` falls inside the lifetime is included.

Lifetime bounds: lower = `person.birthDate`; upper = `person.deathDate` when set, else today.
A person with **no `birthDate`** has no lower bound — all ring events show, and the count in
D13 is annotated *"no birth date — lifetime filter not applied"* (P2: never drop or widen
silently).

## M7 acceptance criteria

### M7.A — Fix the person-lane omissions (regression first, P10)

**M7.A.1** — `TimelineBoardModal` person lanes are built through
`synthesizePersonDateEvents` / `synthesizePartnershipDateEvents` /
`synthesizeEmotionalLineDateEvents` instead of the inline Birth/Death blocks. The inline
synthesis at `:418-443` is deleted, not left alongside (rule 1 — no duplicate logic).
- Test: `TimelineBoardModal.systemEvents.test.tsx::test_m7a1_person_lane_shows_own_marriage_without_family_lane`
  — **fails on today's code**: a person with a partnership carrying `marriedStartDate` and an
  empty `timelineFamilySelectionIds` currently renders no Marriage item.
- Test: `TimelineBoardModal.systemEvents.test.tsx::test_m7a1_person_lane_shows_separation_and_divorce`
- Test: `TimelineBoardModal.systemEvents.test.tsx::test_m7a1_birth_and_death_still_render_once`
  (no duplication now that synthesis is shared)

**M7.A.2** (D16) — `partnership.familyEvents[]` from the person's own partnerships render on
their lane, labelled `Family` / `Triangle` as the Family lane already does at `:387-401`.
- Test: `TimelineBoardModal.systemEvents.test.tsx::test_m7a2_own_family_and_triangle_events_on_person_lane`

**M7.A.3** — `CLAUDE.md` § Date-field synthesis is now accurate; no edit needed. Asserted by
a grep test that `TimelineBoardModal.tsx` imports from `utils/syntheticDateEvents`.
- Test: `TimelineBoardModal.systemEvents.test.tsx::test_m7a3_timeline_imports_shared_synthesizer`

### M7.B — Indicator-backed symptom events (D15)

**M7.B.1** — `synthesizePersonIndicatorEvents(person, definitions)` added to
`utils/syntheticDateEvents.ts` — a `PersonFunctionalIndicator` with a valid `date` and no
backing SYMPTOM event (matched on `sourceIndicatorId`) is surfaced as a synthetic SYMPTOM
event. Saving a symptom through the Properties panel already writes both an event and an
indicator (`PropertiesPanel.tsx:2040-2074`); indicators arriving through
`DiagramEditor.tsx:2827` `mergeIndicators` (transcript / voice import) do not, and are
invisible on every timeline today.
- Per CLAUDE.md, adding it to `syntheticDateEvents.ts` means both consumers pick it up.
- Tests:
  - `syntheticDateEvents.test.ts::test_m7b1_indicator_without_event_becomes_symptom_event`
  - `syntheticDateEvents.test.ts::test_m7b1_indicator_with_backing_event_is_not_duplicated`
  - `syntheticDateEvents.test.ts::test_m7b1_indicator_without_date_is_skipped`

### M7.C — The system-events collector

**M7.C.1** — `collectSystemEvents({ personId, scope, people, partnerships, lines, definitions })`
returns `SystemEvent[] = { event, relationClass, relationLabel, ownerEntityType, ownerEntityId }`.
`relationClass: 'self' | 'union' | 'parental' | 'ascendant' | 'sibling' | 'descendant' | 'spousal'`.
Built **on top of** the synthesizers — no second copy of the date logic.
- File: `src/frontend/src/utils/systemEvents.ts` (new)
- Test: `systemEvents.test.ts::test_m7c1_returns_relation_class_and_label_per_event`

**M7.C.2** (D10) — The ring is `computeFamilyScope(people, partnerships, personId, focusOptions)`
from M1 — the active canvas focus options when one is set, the M2.A.1 defaults otherwise.
- Test: `systemEvents.test.ts::test_m7c2_ring_follows_active_canvas_scope`
- Test: `systemEvents.test.ts::test_m7c2_ring_uses_defaults_when_no_focus_active`

**M7.C.3** — Relation labels are generated, not hardcoded per case: `Father died`,
`Parents divorced`, `Son born`, `Sister — depression onset`, `Wife died`. Derived from
generation offset + `birthSex`/`genderIdentity` + relation class. Vocabulary lives in a
constants map, not inline in the function (global rule 9 — editorial content out of logic).
- File: `src/frontend/src/constants/relationLabels.ts` (new)
- Tests:
  - `systemEvents.test.ts::test_m7c3_labels_father_death_and_parents_divorce`
  - `systemEvents.test.ts::test_m7c3_unknown_sex_falls_back_to_neutral_label`

**M7.C.4** (D15) — No `eventType` filtering anywhere in the collector: a relative's SYMPTOM,
NODAL, EPE, FF, SIR and PAPERO events all come through.
- Test: `systemEvents.test.ts::test_m7c4_relative_symptom_event_reaches_lane`

**M7.C.5** (D16) — `familyEvents[]` of every partnership in the ring are collected, including
the parental partnership (family-of-origin family events).
- Test: `systemEvents.test.ts::test_m7c5_parental_family_events_collected`

**M7.C.6** — Dedup is keyed on `(ownerEntityId, eventId)`, never `eventId` alone. Covers the
existing `-p1` / `-p2` partnership clone suffixes and the `synth-` prefixes.
- Tests:
  - `systemEvents.test.ts::test_m7c6_partnership_clone_p1_p2_not_duplicated`
  - `systemEvents.test.ts::test_m7c6_same_event_from_two_relations_appears_once`

### M7.D — Lifetime clipping (D11)

**M7.D.1** — `clipToLifetime(systemEvents, person)` keeps an event iff its date range
**overlaps** `[birthDate, deathDate ?? today]`.
- Tests:
  - `systemEvents.test.ts::test_m7d1_grandparent_death_before_birth_excluded`
  - `systemEvents.test.ts::test_m7d1_span_starting_before_birth_ending_after_is_kept`
  - `systemEvents.test.ts::test_m7d1_event_after_death_excluded`

**M7.D.2** — Exception: union-formation events (`Relationship Started`, `Marriage`) on the
**parental** partnership are kept regardless of date. Exception list is a named constant.
- Test: `systemEvents.test.ts::test_m7d2_parents_marriage_kept_although_before_birth`

**M7.D.3** — A person with no `birthDate` gets no lower bound, and the result carries
`lifetimeFilterApplied: false` so the UI can say so.
- Test: `systemEvents.test.ts::test_m7d3_no_birthdate_disables_lower_bound_and_flags_it`

### M7.E — Timeline rendering (D12, D13)

**M7.E.1** — System events render on the person's own lane, label prefixed with the relation
(`Father died`), with a muted/dashed border and the same intensity fill rule as any other item
(the intensity scale is not repurposed).
- Test: `TimelineBoardModal.systemEvents.test.tsx::test_m7e1_system_event_renders_on_person_lane_with_relation_label`

**M7.E.2** — Header toggle "System events", default **on**, with the count
`N own · M system events from K relatives`, plus `— no birth date, lifetime filter not applied`
when M7.D.3 applies.
- Tests:
  - `TimelineBoardModal.systemEvents.test.tsx::test_m7e2_toggle_off_hides_system_events_and_updates_count`
  - `TimelineBoardModal.systemEvents.test.tsx::test_m7e2_reports_no_birthdate_caveat`

**M7.E.3** — Clicking a system event opens the owning entity's event in `EventModal`, anchored
to the **owner**, not to the lane's person.
- Test: `TimelineBoardModal.systemEvents.test.tsx::test_m7e3_click_opens_event_on_owning_entity`

### M7.F — Properties panel parity (D14)

**M7.F.1** — `PropertiesPanel.getDisplayEvents()` for a person appends
`collectSystemEvents(...)` under the same ring and lifetime rules.
- Test: `PropertiesPanel.systemEvents.test.tsx::test_m7f1_events_tab_lists_parents_divorce`

**M7.F.2** — System events in the Events tab are **read-only**: the `EventCard` renders
without `onEdit` / `onDelete` writing to the lane person, and instead opens the owner. All
**5 EventCard call sites** are checked per CLAUDE.md, and only the person Events tab changes.
- Tests:
  - `PropertiesPanel.systemEvents.test.tsx::test_m7f2_system_event_card_is_readonly_on_person`
  - `PropertiesPanel.systemEvents.test.tsx::test_m7f2_own_event_card_still_editable`

**M7.F.3** (P6 — verify status against the artifact) — Deleting a relative's event removes it
from the person's lane and Events tab on the next render; no stale copy survives.
- Test: `PropertiesPanel.systemEvents.test.tsx::test_m7f3_deleting_owner_event_clears_it_from_relative_view`

### M7.G — Data integrity

**M7.G.1** — Collecting and rendering system events never writes: no `Person`,
`Partnership` or `EmotionalLine` is mutated, and the saved JSON is byte-identical with the
toggle on and off (rule 7, D8).
- Test: `systemEvents.persistence.test.ts::test_m7g1_system_events_are_read_only_projection`

**M7.G.2** (P8 dirty state) — Switching the lane person, toggling system events off and on,
and changing the canvas scope leaves the own-event set unchanged.
- Test: `TimelineBoardModal.systemEvents.test.tsx::test_m7g2_toggle_cycle_leaves_own_events_unchanged`

## M7 implementation order

1. **M7.A** first — it is the reported bug, its regression test fails on today's code, and it
   is independent of everything else (P10: highest-regression-risk fix gets the first test).
2. **M7.B** — synthesizer extension, still independent of the scope work.
3. **M7.C** — collector. Depends on M1 (`familyScope.ts`).
4. **M7.D** — lifetime clipping. Depends on M7.C.
5. **M7.E** — Timeline rendering. Depends on M7.C/D and M3 (focus state).
6. **M7.F** — Properties panel parity. Depends on M7.C/D.
7. **M7.G** — integrity tests.

M7.A and M7.B can ship **before** M1–M6 if you want the marriage bug fixed immediately; they
have no dependency on the scope filter.

## M7 files

**New:** `utils/systemEvents.ts`, `utils/systemEvents.test.ts`,
`utils/systemEvents.persistence.test.ts`, `constants/relationLabels.ts`,
`components/modals/TimelineBoardModal.systemEvents.test.tsx`,
`components/PropertiesPanel.systemEvents.test.tsx`

**Modified:** `components/modals/TimelineBoardModal.tsx` (lane builder rewritten onto the
shared synthesizers, system-event items, header toggle + counts),
`utils/syntheticDateEvents.ts` (indicator synthesis), `utils/syntheticDateEvents.test.ts`,
`components/PropertiesPanel.tsx` (`getDisplayEvents` + read-only cards),
`components/EventCard.tsx` (read-only variant), `docs/event-system.md`

## M7 adjacent issues found, not fixed (rule 10)

- `TimelineBoardModal.tsx` person-lane builder is a 115-line inline IIFE inside the component
  (`:343-528`). M7.A rewrites its event sourcing but leaves it in place; extracting lane
  building into `utils/timelineLanes.ts` is the natural follow-up
  (`file-maintainability.md`).
- Indicators written by `DiagramEditor.tsx:2827` `mergeIndicators` never create a backing
  event, unlike the Properties-panel path. M7.B.1 covers this at **read** time via synthesis;
  making the import path create real events is a separate change.
