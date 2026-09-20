# TODO

Deferred items, each with the reason it was not done at the time. Newest first.

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
