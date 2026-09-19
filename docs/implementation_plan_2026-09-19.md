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
