# TODO

Deferred items, each with the reason it was not done at the time. Newest first.

## Open

Only items that were decided, deliberately, to be left as they are:

- **Manual "Add Person" and voice commands default to female**
  (`usePersonOperations.addPerson`, `useVoiceHandlers`). Decided 2026-09-27:
  leave as is (user-created, changeable at once).
- **Legacy duplicate emotional-pattern events — decided 2026-09-22: the user
  deletes them by hand.** Diagrams written by earlier code hold per-edit
  pattern records in an older shape (NODAL, category = the line's
  relationship type such as "Fusion", intensity 0, no subtype) with no marker
  that separates them from user-written events, so no automatic cleanup will
  be written. New saves no longer create them.
- **A user event literally titled "Divorce" on the divorce date is hidden**
  (`utils/partnershipStatusEvents.ts`). Left on 2026-09-20 as arguably
  correct: an event called "Divorce" on the divorce date IS the divorce, and
  with one event per date field (2026-09-30) it is that field's event.
  Revisit if anyone reports a missing event by that name.

- **Two checks still read source text, deliberately** (gate
  `gate_2026-09-30b` #3). `constants/zIndex.test.ts` scans components for a
  bare-number z-index: the rule is about the source itself, so there is no
  behaviour to test instead. `useContextMenuHandlers.familyScope.test.ts`
  checks that DiagramEditor passes the scope derivation into the menu hook:
  that wiring has no seam short of rendering the canvas and right-clicking a
  Konva node. Every other menu and Timeline check is now behavioural.

## Done on 2026-09-30

Every other item previously listed here was fixed, with tests, in
`be4dc2f`, `f6ba114` and the commit after them. By the list it came from:

- **Review of the unread areas (2026-09-30):** sibling-conflict overlay
  cached; DiagramCanvas render test for hidden triangles and notes; the
  lifetime-clip test pinned east of UTC; date-field companions re-dated on
  every update; family events keep FAMILY / family (gate LOW #1); Timeline
  symptom saves create a missing symptom type.
- **2026-09-27:** a death with no date is an undated Death event; New / demo
  prompts use `confirmDiscardUnsavedChanges`; the startup test compares with
  the product default; merged new children step past people in their row;
  retired banners on four old plans.
- **2026-09-22:** step-sibling and step-grandchild terms; the cousin-spouse
  test checks the "Wife" label; "Include spouses' families" exposes
  `includePartnerFOO`.
- **2026-09-21:** one divorce / separation status classifier
  (`relationshipEndingForStatus`).
- **2026-09-20:** the prefix branch was already tested directly
  (`test_prl_status_change_record_is_recognised`); the Event Creator bundle
  leaves out hidden date records; the demo test has a load-safe timeout; the
  panel already used `hasSameEvent`; the female-oval fixture and the stale
  comment were already fixed; the width floor has a stubbed-observer test.
- **2026-09-19:** the year-bounds scan uses the shared date slots; the
  statusDates-only dates were already synthesized; the menu wiring is
  behaviour-tested; the Timeline has its own open flag and follows the focus
  when opened from it; a lane search box; imported diagnoses get a backing
  symptom event (and no invented 5 / 5 / 5 ratings).
- **2026-08-24:** refused storage writes turn Save red with a message; the
  hint and both help dialogs take focus, close on Escape and give focus
  back; a "don't show this again" that cannot be stored is reported; every
  z-index is in `constants/zIndex.ts`; the canvas pan hint uses shared copy
  and a persisted "don't show this again", like the right-click hint.
