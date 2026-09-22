# TODO

Deferred items, each with the reason it was not done at the time. Newest first.

## From the kinship and emotional-pattern batch (2026-09-22)

Gate passes 13-15 (13 and 14 REJECTED, 15 APPROVED). Carried items:

- **Legacy duplicate emotional-pattern events — decided 2026-09-22: the user
  deletes them by hand.** Diagrams written by earlier code hold per-edit
  pattern records in an older shape (NODAL, category = the line's
  relationship type such as "Fusion", intensity 0, no subtype) with no marker
  that separates them from user-written events, so no automatic cleanup will
  be written. New saves no longer create them.
- **Two kin shapes fall back to "Relative by marriage".** A step-sibling (the
  own partner's child's sibling) and a step-grandchild reached through a
  relative's spouse have no dedicated term. Vague but not wrong.
- **`test_kin_a_spouse_who_is_also_a_blood_relative_is_named_by_blood`**
  asserts only the route, while the user-facing noun for a cousin who is
  also the lane person's spouse is "Wife" (spousal wins). Behaviour is right;
  the test name overstates what it checks.
- **A true parent-in-law is only reachable with `includePartnerFOO`**, which
  still has no UI (see the 2026-09-19 entry).

## From the separation/divorce marks fix (2026-09-21)

Gate pass 11 APPROVED. One low, non-blocking note.

- **`partnershipSeparationMarks` hand-maintains its status-key set**
  (`utils/partnershipUtils.ts`): `divorce`/`divorced`, `separated`/
  `separation`, `ended`. There is no shared "is a divorce status" predicate
  to import — `canonicalRelationshipStatusKey` normalises spelling but does
  not classify — so this is a fresh domain map rather than a copy that can
  drift from one. Worth folding into a shared classifier if a third consumer
  ever needs the same question answered.

## From the one-event-per-date batch (2026-09-20)

Gate passes 9 and 10 (pass 9 REJECTED, pass 10 APPROVED). Three residuals,
none blocking.

- **A user event literally titled "Divorce" on the divorce date is hidden.**
  `divorce` is the one status key whose spelling differs from its label
  (`Divorced`), and the recogniser also accepts a partnership's own status
  keys, so the noun matches. Arguably correct — an event called "Divorce" on
  the divorce date IS the divorce — which is why it was left. Revisit if
  anyone reports a missing event by that name.
- **No test covers the "Type changed to…" / "Status changed to…" prefix
  branch on its own.** It is exercised through the higher-level filters, but
  a direct case would pin it.
- **`EventCreator` lists the raw stored events unfiltered**, so the old
  person-date and partnership-status records still appear there. Harmless —
  it is a creation surface, not a timeline — but inconsistent with the
  Timeline and the Events tab now that both hide them.

## Flaky test spotted during gate pass 8 (2026-09-20)

- **`DiagramEditor.test.tsx` "starts interactive demo…" times out under load.**
  The gate's full-suite runs flaked twice and passed once; the test passes in
  isolation (~1.4s) and sits in a file untouched by the batch, so it is
  load-dependent rather than a regression. A suite that fails intermittently
  is the kind of red people learn to ignore — raise its timeout or make the
  demo step deterministic before it trains anyone to shrug at a failure.

## From the timeline readability / duplicate-events batch (2026-09-20)

Gate pass 6 APPROVED after pass 5 rejected the first attempt. Three findings
carried, none blocking.

- **The clone rule still lives in two places.** `utils/eventDedup.ts` holds
  `hasSameEvent`, and the Timeline and the system-events collector use it — but
  `PropertiesPanel.getDisplayEvents` kept its own inline `isAlreadyCloned`
  (~`PropertiesPanel.tsx:1651`), which behaves differently when handed a clone
  id rather than an original. The commit message claiming the rule is "held
  once" was wrong; migrate the panel to `hasSameEvent`.
- **The female-oval half of the shape test is not exercised at component
  level.** `test_timeline_male_events_are_rectangles_and_female_events_are_ovals`
  asserts two male blocks because the fixture has no event owned by a woman.
  The pure function is covered both ways in `timelineItemText.test.ts`; the
  component assertion needs a female-owned event in the fixture.
- **Stale comment** at `TimelineBoardModal.tsx:397` still describes the
  intensity ramp that moved to `constants/timelineBlockStyle.ts`.
- **The single width floor has no jsdom coverage** — jsdom has no
  `ResizeObserver`, so the measured-floor path only runs in a real browser
  (where it was verified by hand). A layout test would need a stubbed observer.

## From the PRL timeline-date fix (2026-09-19)

Gate pass 4 (post-push audit of `8be8446`) APPROVED; two low-severity notes left.

- **The timeline year-bounds scan hand-enumerates partnership date fields.**
  `DiagramEditor.tsx` (~:809) lists `relationshipStartDate` / `marriedStartDate` /
  `separationDate` / `divorceDate` and then loops `statusDates` separately,
  rather than sharing `partnershipDates()`. Not a drop-in: the scan needs a
  per-field label for each entry, which `partnershipDates()` deliberately does
  not carry. Consistent today; worth folding together if a sixth date field
  ever appears.
- **`syntheticDateEvents` still does not surface `statusDates`-only dates.**
  A "Widowed" date has no legacy mirror field, so it never becomes an event in
  the Events tab or on a Timeline lane. Pre-existing and separate from the
  visibility fix — `earliestPartnershipDate()` is the wrong tool for it, since
  synthesis wants each date as its own event with its own category.

## From the family-focus / system-events batch (2026-09-19)

Raised by the external Hermes `learning-qa-sweep` gate over `aa081d3..HEAD`
(gate file: `docs/cycles/gate_2026-09-19_family-scope_system-events.md`).
Pass 1 REJECTED, pass 2 APPROVED. Everything functional was fixed in the batch;
these are what remains.

- **Menu/Timeline wiring is asserted by source-text greps.**
  `hooks/useContextMenuHandlers.familyScope.test.ts` proves the three Timeline
  entry points and the Focus Family submenu are wired by `toContain(...)` over
  the hook's own source, plus a regex over `setTimelineSelectionIds(...)` that
  breaks on multi-line or nested-paren arguments. It is brittle (a refactor
  turns it red without a behaviour change) and it can match a comment rather
  than a call site. Flagged in both gate passes and deliberately not fixed:
  replacing it properly means rendering the context menu through the hook with
  its ~50 dependencies, which is a bigger job than the batch it guards. The
  behaviour it stands in for — an explicit selection beating the scope, and the
  scope supplying the lanes otherwise — is covered behaviourally in
  `utils/familyScope.test.ts`.
- **`includePartnerFOO` has no UI.** The traversal supports it and it is tested
  (`test_m1a5_partner_foo_toggle_includes_partner_parents`), but nothing in the
  Focus Family menu turns it on, so a user cannot pull in a spouse's family of
  origin. Needs a decision on where it belongs — a submenu entry, or a toggle on
  the chip.
- **Timeline lane count can get large.** At 2 up / 2 down on a real family the
  scope-driven Timeline opens 15-25 lanes. Nothing truncates (deliberately — the
  count is reported instead), but the board has no lane search or collapse, so
  reading one person against the others means scrolling.
- **`timelineSelectionIds` doubles as the Timeline modal's open flag.**
  `TimelineBoardModal` returns `null` when both selection arrays are empty, and
  eight sites clear the array to close the board. A dedicated `timelineOpen`
  boolean would separate the two concerns and would let the focus steppers
  re-derive lanes while the board is open. Not done here: it touches all eight
  clear-sites for no behaviour change in this batch.
- **Imported indicators still create no backing event.** `mergeIndicators`
  (`DiagramEditor.tsx`, transcript / voice import) writes a
  `functionalIndicator` with a date and no SYMPTOM event. The batch covers this
  at read time with `synthesizePersonIndicatorEvents`, so nothing is invisible
  any more, but the import path itself still differs from the Properties-panel
  path, which writes both.

## From the right-click hint batch (2026-08-24)

Raised by `learning-qa` sweeps over commits `1a5db8d`..`8e98d09` and deliberately
deferred — none is a regression, and each is wider in scope than that batch.

- **Surface failed localStorage writes to the user.** `setStoredValue` throws on a
  refused write (quota exceeded, Safari private mode), but no caller handles it:
  in the autosave path the throw escapes a `setTimeout` in `hooks/useAutosave.ts`,
  so a lost diagram save is invisible; in the effect path an unhandled throw with
  no error boundary would unmount the app. Route write failures to the existing
  dirty/red Save affordance. (Referenced from the `trySetStoredValue` docblock in
  `src/frontend/src/utils/storage.ts`.)
- **Accessibility of the startup hint.** `RightClickHintModal` is a non-modal
  `role="dialog"` with no focus move on open, no focus restore on close, and no
  Escape handler, so screen-reader users get no announcement and keyboard users
  must tab the whole ribbon to reach it. The same gap exists in `HelpModal` and
  `RibbonHelpModal`, so fix it as a class.
- **A refused "Don't show this again" write is console-only.** `DiagramEditor`
  warns to the developer console; the user simply sees the hint return next
  launch with no explanation.
- **Finish the z-index scale.** `src/frontend/src/constants/zIndex.ts` holds only
  the two constants whose relative order is load-bearing (hint vs ribbon). ~29
  other inline `zIndex` literals remain across five bands, including stacking
  contexts that make a declared value misleading — the ribbon's sticky
  `z-index` scopes its dropdowns' declared 1000 to the ribbon's own level.
- **Two divergent hint mechanisms.** The older canvas scroll hint
  (`DiagramCanvas.tsx`) is a corner toast with its copy hardcoded in the
  component, session-scoped via a ref, with no "don't show again". The new hint
  follows the standards (copy in `data/helpContent.ts`, persisted preference).
  Align the old one, or decide deliberately that they differ.
