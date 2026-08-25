# TODO

Deferred items, each with the reason it was not done at the time. Newest first.

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
