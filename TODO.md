# TODO

Deferred items, each with the reason it was not done at the time. Newest first.

## Open

Only items that were decided, deliberately, to be left as they are:

- **Manual "Add Person" and voice commands default to female**
  (`usePersonOperations.addPerson`, `useVoiceHandlers`). Decided 2026-09-27:
  leave as is (user-created, changeable at once). The same rule covers the
  other one-click person builders: "Add Adopted Child" creates a female
  child, and Add Parents creates a male father and a female mother by role.
  Voice now takes the sex from the words spoken or the name when it can
  (review 2026-09-30 voice-02), and uses the default only when neither says.
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

- **Kept as they are, by decision (2026-09-30):** Other Person is stored as
  the text `"None"` (the app's value for "no other person"; changing it
  changes the file format); resolving a prediction stamps `resolvedDate`
  with today (an app timestamp, not a user-entered date); a SIR entry may be
  saved with an empty Behavior.

- **A new event in the Event Creator starts with no category** (review
  2026-09-30 bundle-03 / struct-05). It is built through `eventDraft` with
  nothing chosen for the user, by the 2026-09-30 rule that the app does not
  fill in what the user did not give.
- **Six lint warnings** (`npm run lint`): three `react-hooks/exhaustive-deps`
  warnings in `DiagramEditor.tsx` (`buildDiagramPayload` and
  `replaceDiagramState` are plain functions used as hook dependencies; the
  Timeline open/close effect), and three in `PropertiesPanel.tsx` (an unused
  `_symptomIntensityHelpOpen` state and two hook dependency lists). Each fix
  changes when a callback is rebuilt, so each needs its own test; they were
  left out of the review batch to keep it reviewable.

- **Two display-name copies left** (gate `gate_2026-10-01b` LOW #1):
  `PropertiesPanel.tsx:1850` and `DiagramEditor.tsx:832-837` build
  "First Last" inline instead of calling `personDisplayName`. Same
  precedence, only the fallback text differs, so not a bug; carried rather
  than fixed after the approval so the pushed code is what the gate read.

## Done on 2026-10-01 — final review (REVIEW-final-areas-2026-09-30.md)

Every finding is fixed with a test that fails on the old code; see that
file's "Fix status" table. Also in this batch:

- vite 5 → 8 and `@vitejs/plugin-react` 6; `npm audit` reports 0.
- `utils/dataImport.ts` is imported statically by `DiagramEditor` (the
  dynamic import split nothing and caused a build warning).

## Done on 2026-09-30 — remaining TODO items

- Gate `gate_2026-09-30f` LOW notes: the CSP guard reads string literals
  with the TypeScript parser and classifies each by use (fetched / framed /
  linked), reporting any other https literal with its file and line; an
  older saved event with a listed category and no type has a test.
- The menu-wiring source check is replaced by a behavioural test: a real
  right-click on a Konva person node, Focus Family › Timeline for this family,
  then the focus changed from inside the Timeline
  (`DiagramEditor.familyTimeline.test.tsx`, which also gives follow-focus its
  first behavioural test).
- The z-index rule stays a source check (it is about the source), now done
  with the TypeScript parser; it found three bare `zIndex={2000}` props the
  line regex had missed, now in the scale.
- `DiagramCanvas.visibility.test.tsx` renders a real `<DiagramCanvas />`
  element; a discovery pass learns which props it reads.

## Done on 2026-09-30 — gap-review TODO items

- Half-siblings are labelled Half-brother / Half-sister, and an adopted
  person's birth parents Birth father / Birth mother (`utils/kinship.ts`
  `isHalfSibling` / `isBirthParentOnly`; `kinship.test.ts`).
- Changing an event's category to one with a type list clears the type for
  the user to pick, and Save waits for it (`utils/eventDraft.ts`
  `applyEventCategoryChange`; `EventModal.test.tsx`).
- Gate `gate_2026-09-30e` LOW notes: `frame-src` allows only
  `www.youtube-nocookie.com`; the CSP guard ignores comments, works out
  framed, linked and fetched origins from the code, and requires the policy
  to match each set exactly (`src/frontend/src/securityHeaders.test.ts`).

## Done on 2026-09-30 — gap review

Everything in `REVIEW-gap-areas-2026-09-30.md` (F-1 to F-23) was fixed with
tests except the items above; see that file's "Fix status" table.

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
