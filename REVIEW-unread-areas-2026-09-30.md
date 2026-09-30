# Review: areas not covered by the 2026-09-27 pass — 2026-09-30

## Verdict

The pure graph utilities (familyScope, kinship, systemEvents) are well structured and immutable, but their reach rules are wrong in two common family shapes, and that feeds wrong kinship labels into the Timeline. The larger risk is in the event UI: event edit and save logic exists in three copies (PropertiesPanel, TimelineBoardModal, useSessionNoteHandlers), and they have drifted apart. As a result, several ordinary actions silently write wrong data. Examples: opening and saving an event changes its category, adding a symptom overwrites another symptom's scores, and editing on the Timeline stores ratings as strings. Fix first: the symptom definition fallback (the one blocker), then the EventModal category auto-correct together with the context-menu seeds that trigger it, then a single shared event-save normaliser used by all three copies. No finding was refuted in the challenge pass; six had their scope or severity corrected.

## Coverage

| Area | G-CORRECT | G-SEC | G-STRUCT | G-TEST |
|---|---|---|---|---|
| A. PropertiesPanel, sections/*, EventModal, EventsSection, EventCard, SessionEventModal | covered | not reviewed | covered (PersonNameSection, PersonFormatSection, PersonSiblingSection 300-503 by grep only) | partial (EventModal, most sections not read) |
| B. DiagramCanvas + useContextMenu/Selection/CanvasDrag/Update/Indicator handlers | covered | not reviewed | partial (DiagramCanvas 1-380 not read) | partial (DiagramCanvas grep only; ContextMenu/Selection hooks not read) |
| C. TimelineBoardModal, PredictionsPanel, usePredictionHandlers, useSessionNoteHandlers | covered | not reviewed | partial (PredictionsPanel outside 170-350 not read) | partial (TimelineBoardModal ranges only; PredictionsPanel not read) |
| D. familyScope, kinship, systemEvents, siblingPosition, syntheticDateEvents, partnershipUtils | covered | not reviewed | partial (familyScope, kinship not read) | covered |

Read: the 21 listed production files plus `components/sections/*`, about 15.7k LOC, and all 21 related test files. Seven workers ran: four G-CORRECT (one per area), one G-STRUCT and one G-TEST across the whole scope, and one challenge worker.

Not reviewed:
- **G-SEC.** Nothing in scope calls fetch, uses storage directly or uses innerHTML, and the request asked for correctness, invariants and tests.
- **Runtime behaviour.** Konva drag and click ordering, and whether EventModal's mount effect runs before first paint, were checked by reading the code only.
- **Tests were not run and no mutation tool was used.** Claims that a test "would stay green" come from reading the code.

Excluded (already reviewed and fixed on 2026-09-27): autosave, storage, file ops, imports, merge, person deletion and date parsing.

## Findings

Format: TAG · WHERE · WHAT · WHY · FIX · confidence · verified · corroborated-by.
"Verified" means the challenge worker re-traced the finding against the code.

### Blockers

**B1. Adding a symptom overwrites a different symptom's indicator scores**
- TAG: DATA
- WHERE: `components/PropertiesPanel.tsx:1689`, `:1856-1885`, `components/EventModal.tsx:256,272`
- WHAT: The draft copies `symptomType` from the most recent symptom event. EventModal's "Type" field edits `subtype`, not `symptomType`. saveEvent looks up the definition by `symptomType`, and if that fails it falls back to the first definition in the group.
- WHY: Adding "Headache" when "Back pain" exists links the new event to Back pain and replaces Back pain's intensity, frequency and impact in `functionalIndicators`. A new label never reaches `onEnsureSymptomCategoryDefinition`. The data is wrong and nothing tells the user.
- FIX: Take the label from the field the modal edits. Stop copying `symptomType` from the latest event. Remove the "first in group" fallback so that an unknown label always creates or reuses a definition by label.
- Confidence: high · verified · corroborated-by: G-CORRECT(A)

### Major

**M1. EventModal silently rewrites categories the app itself writes** (see systemic S2)
- TAG: DATA
- WHERE: `components/EventModal.tsx:119-130`
- WHAT: On mount, any category not in `EVENT_CATEGORIES[type]` is reset to the first option, and `subtype` is cleared. The app writes categories that are not in those lists:
  - Identity events use NODAL/`Individual` (`PropertiesPanel.tsx:991`).
  - EPE pattern and measurement events use `Emotional Pattern` (`PropertiesPanel.tsx:1064`, `useEmotionalLineOperations.ts:111`).
- WHY: Opening "Birth Sex: Male" to fix a note and pressing Save stores it as `Birth` with no subtype. The Timeline uses the same modal, so it has the same fault.
- FIX: Add the builder-written categories to `eventConstants.ts`. Do not auto-correct a category the app wrote, and never clear an existing subtype.
- Confidence: high · verified · corroborated-by: G-CORRECT(A), G-CORRECT(B), G-STRUCT

**M2. Context-menu seeds use categories that do not exist, so events are saved as something else**
- TAG: DATA, ARCH (hard rule 2)
- WHERE: `hooks/useContextMenuHandlers.ts:376,403`, `hooks/useSelectionHandlers.ts:222,306-308`, `hooks/useUpdateHandlers.ts:328,350`, `DiagramEditor.tsx:3500-3538`
- WHAT: M1's auto-correct rewrites each of these seeds:
  - "FoO Triangle" becomes Family Stability.
  - "Coach Event" becomes +/- Adequate.
  - EPL "Add Event…" becomes +/- Adequate.
  - Partnership "Relationship" becomes Birth.
  - The three triangle items (Functioning/Flexibility/Stress) all become `Primary` with an empty subtype, so they produce identical events.
- WHY: The modal title still names what the user clicked, so the wrong category is easy to save without noticing.
- FIX: Seed only values that exist in `EVENT_CATEGORIES`/`EVENT_SUBTYPES`, adding the missing ones first. Add a test that every seed survives EventModal's mount unchanged.
- Confidence: high · verified · corroborated-by: G-CORRECT(B), G-STRUCT

**M3. Timeline kinship labels are computed from the scope root, not the lane person**
- TAG: CORRECT
- WHERE: `utils/systemEvents.ts:267-277`; callers `TimelineBoardModal.tsx:678-680`, `PropertiesPanel.tsx:1456-1458`
- WHAT: `bloodIds` comes from the canvas focus ring, which is rooted at the focus person.
- WHY: Focus on father F and open son S's lane. S's own mother is in `marriedIn`, so she is reached only as F's spouse and labelled "Step-mother". Every existing test roots the scope at the lane person.
- FIX: Use the ring for membership only. Derive blood with a lane-rooted `computeFamilyScope`. Add a test where the root and the lane differ.
- Confidence: high · verified · corroborated-by: G-CORRECT(D)

**M4. familyScope promotes a married-in spouse to lineal when the couple has a child**
- TAG: CORRECT
- WHERE: `utils/familyScope.ts:190-201`, `isBetter` `:148`
- WHAT: The child's up edge reaches the spouse as `{lineal:true, blood:false}`. `isBetter` prefers lineal, so the spouse is re-queued as lineal and their parents and siblings enter the scope, even though `includePartnerFOO` is off.
- WHY: This breaks rule D1 for every couple with a child under the default 2/2 band. Tests m1a4 and m1a5 use childless couples.
- FIX: A parent reached by walking back up from a descendant is not a lineal ancestor, or `isBetter` must never upgrade a non-blood reach. Add a root + spouse + child test.
- NOTE: This fix changes `test_inlaw_she_is_a_sister_in_law_to_her_husbands_siblings` (`systemEvents.test.ts:679`); see Questions.
- Confidence: high · verified · corroborated-by: G-CORRECT(D)

**M5. familyScope leaks half-siblings and step-parent families when collaterals are off**
- TAG: CORRECT
- WHERE: `utils/familyScope.ts:177-182`, `:214`
- WHAT: The partner edge sets no `fromChildId`, so the collateral guard does not apply. A parent's second partner's children come in at gen 0 and are lineal. Their up edge then makes the step-parent lineal, the same mechanism as M4.
- WHY: A lineal-only focus shows half-siblings and the step-parent's family of origin. The only collaterals-off test uses a single-partnership fixture.
- FIX: Carry `fromChildId` across the partner edge, or block the collateral descent. Test dad + mum + carol, where carol's child is excluded. Test M3, M4 and M5 together.
- Confidence: high · verified · corroborated-by: G-CORRECT(D), G-TEST

**M6. SIR save and delete overwrite events with a stale draft copy**
- TAG: DATA
- WHERE: `components/sections/PersonSIRSection.tsx:129,176`; `PropertiesPanel.tsx:634-637,2453`
- WHAT: The SIR writers build from `personDraft.events`, which is not refreshed while `personPristine` is false.
- WHY: Type a date without saving, add an event elsewhere (Events tab, Timeline, session note), then save an SIR entry. The new event is erased.
- FIX: Build from `selectedPerson.events`, and move the SIR builder into a util (hard rule 8).
- Confidence: high · verified · corroborated-by: G-STRUCT (rated blocker, med confidence)

**M7. Any auto-saving person edit discards pending date and sex edits**
- TAG: DATA
- WHERE: `PropertiesPanel.tsx:822,829`, `sections/PersonPaperoSection.tsx:94`, `sections/PersonFOOSection.tsx:141`, effect at `:634-637`
- WHAT: Each auto-save path calls `setPersonPristine(true)`, and the effect then copies `selectedPerson` over `personDraft`.
- WHY: Type a birth date, then change the first name, a colour, a FOO or a Papero score. The date disappears and Save goes disabled, with no warning.
- FIX: After an auto-save, merge only the auto-saved fields into the draft, and leave pristine false while deferred fields still differ.
- Confidence: high · verified · corroborated-by: G-CORRECT(A), G-STRUCT

**M8. Events-tab Edit and Delete act only on `person.events`, though the tab lists rows the person does not own**
- TAG: CORRECT
- WHERE: `PropertiesPanel.tsx:1360,1845-1849,1898-1903`, `EventsSection.tsx:167-168`
- WHAT: Rows the person does not own (EPL events and synthesized rows):
  - Delete does nothing.
  - Edit appends a copy under the same id, and `isAlreadyCloned` then hides the original.
  - Editing a `synth-*` row turns it into a real event (see M11).
- WHY: The user edits one record and sees it change here while the partner, the pattern and the Timeline keep the old values.
- FIX: Carry owner type and id on each row, and route edit and delete to the owner, as `TimelineBoardModal.saveEventModal` already does. Share one router.
- Confidence: high · verified (scope: EPL and synth rows are the reachable cases because of M9) · corroborated-by: G-CORRECT(A), G-STRUCT, G-TEST

**M9. The Events tab and Timeline disagree about which events a person has**
- TAG: CORRECT, ARCH
- WHERE: `EventsSection.tsx:74-79`; `PropertiesPanel.tsx:1409-1431` vs `TimelineBoardModal.tsx:515`
- WHAT: There are two separate causes:
  - (a) EventsSection's ownership filter drops the PRL, marriage, divorce and familyEvents rows that `getDisplayEvents` adds on purpose.
  - (b) `getDisplayEvents` never calls `synthesizePersonIndicatorEvents`.
- WHY: A person's own marriage and imported symptoms show on the Timeline but not on their Events tab. This breaks the CLAUDE.md sync invariant, and no panel test covers M7.A.
- FIX: Remove the filter in EventsSection and add the indicator synthesizer to `getDisplayEvents`. Add a parity test on ids.
- Confidence: high · verified · corroborated-by: G-CORRECT(A), G-CORRECT(C), G-STRUCT

**M10. Timeline edits store ratings as strings**
- TAG: DATA
- WHERE: `TimelineBoardModal.tsx:250-253`
- WHAT: `onEventDraftChange` stores EventModal's string values unchanged.
- WHY: EventCard shows "—" and PersonNode drops EA events. Opening the event later in the panel resets the rating to 0.
- FIX: Use the shared normaliser (systemic S1).
- Confidence: high · verified (scope narrowed: the value is zeroed only when that event is next opened in the panel) · corroborated-by: G-CORRECT(C), G-STRUCT

**M11. Editing a synthesized block promotes it to a real event, and the date field stops reaching the views**
- TAG: DATA
- WHERE: `TimelineBoardModal.tsx:794-825` (`id = item.eventId`); `PropertiesPanel.tsx:1847-1848`; `syntheticDateEvents.ts:45-49`
- WHAT: The saved copy has a `synth-*` id, and `hasEventForSlot` then suppresses the field forever. The Timeline draft also hard-codes the event type to NODAL or EPE, sets `subtype:''` and `intensity:0`, and drops `sourceIndicatorId`.
- WHY: A later correction to `birthDate` or `marriedStartDate` never shows in either view.
- FIX: Open the source event, not a rebuilt draft. For date-field synths, edit the owning field instead of appending an event.
- Confidence: high · verified · corroborated-by: G-CORRECT(A), G-CORRECT(C), G-STRUCT

**M12. The EPL tab mixes up the line-style level and `event.intensity`**
- TAG: DATA (CLAUDE.md "two intensity concepts")
- WHERE: `PropertiesPanel.tsx:678-685,694-701,1242-1249,1304-1311`
- WHAT: The draft is loaded from the style level but compared with the latest EPE `event.intensity`. When they differ, the form is dirty as soon as it opens, and any Save, even a notes-only edit, appends a "– Measurement" event dated today.
- WHY: This produces events the user never recorded. Cancel cannot clear it.
- FIX: Use one baseline source, and build a measurement only when a metric actually changed. Extend `PropertiesPanel.test.tsx:42` to assert `updates.events` is undefined.
- Confidence: high · verified (PARTLY: lines made through the pattern modal seed both values the same, so they are clean. Cutoff lines, imports and later events with a different or 0 intensity are dirty on open) · corroborated-by: G-CORRECT(A), G-STRUCT

**M13. The Patterns-tab modal drops edits to adequate person, frequency, impact and intensity**
- TAG: DATA
- WHERE: `PropertiesPanel.tsx:2798-2808` vs `EmotionalPatternModal.tsx:93-98`
- WHAT: onSave writes only the ids, type, status, style, dates, notes and colour.
- WHY: The user edits these fields, clicks Save, and nothing changes. There is no error.
- FIX: Include `adequatePersonId`, and record frequency, impact and intensity as a measurement, or remove those fields from the modal.
- Confidence: high · verified · corroborated-by: G-CORRECT(A)

**M14. Identity events are dated today and appended on every change**
- TAG: DATA (never-fabricate)
- WHERE: `PropertiesPanel.tsx:190-191,1135-1153`
- WHAT: With no birth or gender date, the event gets today's (UTC) date. Each change adds another "Birth Sex:" or "Gender:" event.
- WHY: This puts invented dates on the timeline and leaves contradictory identity events. It is the same class as fix 98e3900.
- FIX: Leave the date blank when there is no source date, and replace the existing identity event instead of appending.
- Confidence: high · verified · corroborated-by: G-CORRECT(A)

**M15. The panel shows a person with unknown sex as Female, and unknown cannot be restored**
- TAG: CORRECT
- WHERE: `sections/PersonDatesSection.tsx:28-32,82-85`
- WHAT: An unset sex resolves to female and feminine, and there is no Unknown option. Choosing the displayed "Female" fires no change event.
- WHY: This contradicts the canvas triangle added in 5e5df44. To record female the user must first pick another value, and a sex can never be set back to unknown.
- FIX: Add an "Unknown / not recorded" option, and bind the select to the raw values with no default.
- Confidence: high · verified · corroborated-by: G-CORRECT(A)

**M16. Session-note events break the event invariant and invent values**
- TAG: DATA
- WHERE: `hooks/useSessionNoteHandlers.ts:265-289,379-405`; `SessionEventModal.tsx:90,124`
- WHAT: Four problems:
  - The events have no `startDate`, `anchorType`, `anchorId` or `subtype`.
  - `intensity` and `howWell` default to 5, and the modal uses a 1-10 scale.
  - A `YYYY-01-01` date is built from any four-digit year in the text.
  - The other person is matched by plain substring, so "Al" matches "also".
- WHY: Captured events are saved as maximum intensity on 1 January, with no anchor. This breaks the global never-fabricate rule.
- FIX: Set the invariant fields in `appendEventToTarget`, default ratings to 0, leave the date blank, and match names on word boundaries. Add a builder test.
- Confidence: high · verified · corroborated-by: G-CORRECT(A), G-CORRECT(C), G-STRUCT, G-TEST

**M17. Session-note New and Open discard work in progress**
- TAG: DATA
- WHERE: `hooks/useSessionNoteHandlers.ts:173-201`
- WHAT: There is no unsaved-changes check. The localStorage primary autosave (`DiagramEditor.tsx:1343-1362`) is overwritten as soon as New or Open changes the payload, so it gives no protection.
- WHY: One click loses an unsaved session note.
- FIX: Reuse `confirmDiscardUnsavedChanges` with a dirty flag against the last saved library record.
- Confidence: high · verified (PARTLY: an autosave exists, contrary to the worker's claim, but it does not protect this case) · corroborated-by: G-CORRECT(C)

**M18. Add Triangle cannot be reached the documented way, and where it does appear it uses the wrong people**
- TAG: CORRECT
- WHERE: `hooks/useContextMenuHandlers.ts:188-190,590-595,891-913`
- WHAT: With three people selected, right-clicking one of them opens the group menu, which has no triangle item. The item appears only when right-clicking a fourth person, and then it passes the stale set of three ids.
- WHY: The only way to create a triangle does not work as documented (`helpContent.ts:70`).
- FIX: Move the item to `showGroupContextMenu` when `length === 3`.
- Confidence: high · verified · corroborated-by: G-CORRECT(B)

**M19. Click-to-add-child re-parents without a cycle check and stays armed**
- TAG: DATA
- WHERE: `hooks/useSelectionHandlers.ts:333-343` → `DiagramEditor.tsx:2004-2047`
- WHAT: This is a documented feature (`helpContent.ts:50`), but:
  - `addChildToPartnership` silently removes the person from their existing parents.
  - It has no ancestor check, so a partner's parent can become their own grandchild.
  - The PRL stays selected, so every later plain click re-parents someone else.
- WHY: Plain clicking to select people is the most common canvas action.
- FIX: Clear the PRL selection after the add, reject ancestors, and confirm before replacing an existing `parentPartnership`.
- Confidence: high · verified (PARTLY: the feature is intended; the defects are the missing guards and the persistent mode) · corroborated-by: G-CORRECT(B)

**M20. Removing any indicator definition deletes its entries from every person, with no confirmation**
- TAG: DATA
- WHERE: `hooks/useIndicatorHandlers.ts:43-51,144-146` → `utils/dataNormalization.ts:25-39`; `IndicatorSettingsModal.tsx:251`
- WHAT: `sanitizePeopleIndicators` strips entries for the removed id from all people. The SYMPTOM events stay, so the two drift apart.
- WHY: One click in settings deletes clinical data across the whole diagram. There are no tests for the hook or for the sanitizers.
- FIX: Confirm, showing the count of affected people and entries, and add `useIndicatorHandlers.test.ts`.
- Confidence: high · verified (PARTLY: the worker framed this as "last definition only"; it applies to any definition) · corroborated-by: G-TEST

**M21. New event drafts copy the previous event's date, notes and ratings**
- TAG: DATA
- WHERE: `PropertiesPanel.tsx:1655-1687`
- WHAT: "+ Add Event" opens with the latest same-type event's date, subtype, WWWWH, observations and reflections. With no seed, it defaults to `intensity: 1` and `howWell: 5`.
- WHY: Saving after changing only the category stores content the user never entered for this event.
- FIX: Start from the seed only, with `intensity: 0`. Offer "copy from last" as an explicit action.
- Confidence: med (the copying may be deliberate; see Questions) · not challenged

**M22. Sibling-position analysis runs for every person on every canvas render**
- TAG: PERF
- WHERE: `DiagramCanvas.tsx:939-941`
- WHAT: This is O(N²·P) per render and repeats on every drag frame. `SiblingConflictOverlay` repeats the full calculation.
- WHY: Large diagrams will drag slowly. This was not profiled.
- FIX: Build a `useMemo` map keyed on `[people, partnerships]` using an own-position-only helper.
- Confidence: med · verified (rated minor by the challenge worker) · corroborated-by: G-STRUCT

### Minor

Items marked "not challenged" were found by one worker and were not re-traced.

- **CORRECT · `utils/siblingPosition.ts:309-318`.** The positional father/mother fallback runs whenever the wanted sex is missing. It can return the same parent for both roles, or a male parent as "Mother". Verified.
- **CORRECT · `utils/siblingPosition.ts:629-664`.** A synthetic partner built from `partnerPositionOverride` is always sexed male, so a sex conflict is reported as "same-sex pair". Not challenged.
- **DATA · `utils/syntheticDateEvents.ts:168`.** Panel-written `statusDates.start`/`ongoing` produce a second event ("Start"/"Ongoing") beside "Relationship Started". `divorce` survives only through the date+category dedup, which has no test. Verified PARTLY.
- **CORRECT · `utils/systemEvents.ts:313-317`.** The cross-relation dedup key includes the owner, so legacy `-p1`/`-p2` clones show up to three times, and `undatedDropped` counts before the dedup. Not challenged.
- **DATA · `TimelineBoardModal.tsx:215-248`.** Timeline save writes only `startDate`, so a stale `date` is read by `PredictionsPanel.tsx:116`, `EventCreator.tsx:35/276`, `personEventBundle.ts:15` and the `DiagramEditor.tsx:2498` dedup key. It also skips the symptom indicator sync. Verified.
- **CORRECT · `TimelineBoardModal.tsx:1317-1348`.** The `lane.id === 'family'` check never matches `family-<id>`, so Family lanes show a "+ Add Event" button that does nothing. Not challenged.
- **CORRECT · `TimelineBoardModal.tsx:1056-1064,1105-1113`.** The Start and End year inputs clamp on every keystroke, so a year cannot be typed. Not challenged.
- **CORRECT · `hooks/useCanvasDragHandlers.ts:73-78`.** `selectedPageNoteIds` is set only by the marquee and never cleared, so later group drags move notes that are no longer selected. Verified.
- **DATA · `hooks/useSelectionHandlers.ts:232-236`.** Deleting a cutoff line leaves the child's `familyCutoffLineId` pointing at a line that no longer exists. Not challenged.
- **CORRECT · `DiagramCanvas.tsx:1159-1164`.** Triangle notes are drawn when a vertex is hidden by focus or timeline. Not challenged.
- **CONCUR · `hooks/useCanvasDragHandlers.ts:192,216,224,232,240`.** These use non-functional `setPartnerships(partnerships.map…)`, the same class already fixed in usePersonOperations. Not challenged.
- **CORRECT · `DiagramCanvas.tsx:729-732,763-767`.** `suppressStageClickRef` stays set when a marquee ends over a node, so the next deselect click is swallowed. Med confidence, not challenged.
- **DATA · `PropertiesPanel.tsx:2615-2621`.** Deleting a symptom leaves its `functionalIndicators` entry, so the Timeline brings the symptom back. Not challenged.
- **CORRECT · `PropertiesPanel.tsx:1810`, `EventModal.tsx:340`.** An event's start date cannot be cleared, because `startDate || date` restores the old value. Not challenged.
- **CONCUR · `PropertiesPanel.tsx:639-642,674-688`.** Partnership and EPL drafts reset on any change to the entity's identity, so saving an event from the Events tab discards unsaved Properties-tab edits. Med confidence, not challenged.
- **DATA · `sections/PersonSIRSection.tsx:149`.** An SIR edit overwrites the original `createdAt`. Not challenged.
- **ARCH · `PropertiesPanel.tsx:96-128,887-912`.** The line-style table is copied twice although `LINE_STYLE_VALUES` is imported. `emotionalLineStyleLevelFor` disagrees with `intensityValueForLineStyle` for legacy styles. Not challenged.
- **ARCH · `EventsSection.tsx:70-72,114-129`.** The Group filter hardcodes 7 of the 10 types and compares the raw `eventType`, so PAPERO, SIR and FF cannot be filtered and legacy events vanish. Hard rule 2. Not challenged.
- **API · `PropertiesPanel.tsx:2742-2743`.** Six Events-tab row menu actions are wired to `() => {}`. Not challenged.
- **MAINT · `CLAUDE.md`, `docs/event-system.md:108-112`.** The EventCard call-site list names SessionEventModal, which renders no EventCard. The real five are EventsSection:156, EventsSection:204, and PropertiesPanel:2215, :2602 and :2673. `event-system.md:15-16` lists `eventClass` values that are not in the `EventClass` union. Not challenged.
- **ARCH · `sections/PersonFOOSection.tsx:8-29`, `PersonPaperoSection.tsx:10-32`, `EPLPropertiesSection.tsx:15-62`.** Scale text duplicates private tables in eventConstants, or lives only in the component (global rule 9). Not challenged.
- **ARCH · `any` usages.** Found at `PropertiesPanel.tsx:751,1139,1192,1281,1591,1613,1865`, `useContextMenuHandlers.ts:39`, `useSelectionHandlers.ts:35`, `DiagramCanvas.tsx:67-68` and `useSessionNoteHandlers.ts:33,204`. The untyped context-menu `items: any[]` is what let the M2 seeds through. Hard rule 6. Not challenged.
- **MAINT · `hooks/useUpdateHandlers.ts:79,193`.** These `console.log` the full update payload on every person and EPL update. Not challenged.
- **Low, from worker notes:**
  - `renderFamilyEventCard` onEdit queries a `data-ev-id` that nothing renders.
  - `notesPosition?.x || fallback` snaps a note at 0 back to its default spot (`DiagramCanvas.tsx:1027,1067,1134`).
  - `partnershipUtils.isMale` does not accept `'male'`.
  - `partnershipSeparationMarks` treats a whitespace-only date as recorded.
  - Loading a diagram file sets `predictionSets` without a shape check (`DiagramEditor.tsx:2399`).
  - `getSessionNotesLibrary` returns `[]` on a parse error, and the next save then overwrites the stored library (`DiagramEditor.tsx:1122-1131`). This one is data loss and is worth promoting when it is fixed.

### Test coverage gaps (G-TEST)

Gaps, where real risk has no test:
- **GTEST-01.** Events-tab Edit and Delete on rows the person does not own (synth, EPL, familyEvents). This is the test for M8.
- **GTEST-02.** `useIndicatorHandlers`, `sanitizePeopleIndicators`, `sanitizeSinglePersonIndicators` and `ensureSymptomDefinition` have no tests (M20, B1).
- **GTEST-03.** The session-note event builder has no invariant test (M16).
- **GTEST-04.** The `syntheticDateEvents` statusDates branch and the date+category dedup have no test. Deleting the dedup line keeps every test green.
- **GTEST-05.** No collaterals-off test uses a step-parent (M5).
- **GTEST-06.** siblingPosition has no tests for birth-order overrides, twins, duplicate overrides or the positional parent fallback.
- **GTEST-08.** `buildPaperoScoreEvent` and `buildEmotionalPatternMeasurementEvent` have no builder tests. CLAUDE.md testing policy requires them.
- **GTEST-12.** DiagramCanvas has no test that the visibility maps hide triangles, EPLs and notes.

Vacuous tests, which pass whatever the code does:
- **GTEST-07.** `test_m7e2_relative_count_counts_people_not_owner_entities` cannot tell the two counts apart (both are 3). Every other relativeCount assertion is a floor.
- **GTEST-09.** The "no event appended on date save" tests reject one subtype string instead of asserting `toHaveLength(0)`. The symptom-edit test at `:1068` would pass if a duplicate were appended.
- **GTEST-10.** Source-grep tests (`useContextMenuHandlers.familyScope.test.ts`, `timelineItemText.test.ts:228-238`) and the three `expect(true)` placeholders in `DiagramEditor.test.tsx:55-80` stand in for behaviour tests. renderHook would work for the hook.
- **GTEST-11.** Other tests that cannot fail:
  - `same_event_from_two_relations_appears_once`: no event is reachable twice in its fixture.
  - `m1a9 size <= people.length`: always true.
  - Dixie `maxDown >= 0`: always true.
  - `birth_and_death_still_render_once`: allows two Birth matches and never checks Death.
  - Two kinship tests repeat earlier ones.
  - `partnershipUtils.test.ts:33-38` re-implements the production rule it claims to test.

## Systemic patterns

**S1. Event draft and save logic exists in three copies that have drifted apart.**
- The copies: PropertiesPanel (`handleEventDraftChange`, `saveEvent`, `buildEventDraft`), TimelineBoardModal (`onEventDraftChange`, `saveEventModal`, the draft built from an item), useSessionNoteHandlers (`inferSessionEventDefaults`, `appendEventToTarget`), and the DiagramEditor triangle and family modal handlers (`:4626-4645`).
- Only PropertiesPanel converts numbers, sets `date = startDate`, and syncs symptom indicators. Only the Timeline routes edits to the owning entity.
- Findings from this pattern: M8, M10, M11, M16, the Timeline-save minor, and part of B1.
- Fix: one `utils/eventDraft.ts` with `applyDraftFieldChange`, `normalizeEventForSave` and `routeEventToOwner`, used by all copies, with builder tests.

**S2. The app writes categories its own EventModal considers invalid.**
- Builder and seed categories outside `EVENT_CATEGORIES` (`Individual`, `Emotional Pattern`, `Triangle Functioning`, `Coaching`, `Relationship`, `Triangle`) meet an auto-correct that rewrites them without telling the user.
- Findings from this pattern: M1 and M2.
- Fix: put every app-written category in eventConstants, and add a test that every builder and seed survives EventModal unchanged.

**S3. "Today" is computed in UTC.**
- `new Date().toISOString().slice(0,10)` appears at about 20 sites, including `useUpdateHandlers.ts:292-293`, `useEmotionalLineOperations.ts:54,69,105`, `usePredictionHandlers.ts:40`, `PredictionsPanel.tsx:137`, `TimelineBoardModal.tsx:171,795`, `PropertiesPanel.tsx:191,1016,1057,1655`, `PersonSIRSection.tsx:91`, `DiagramEditor.tsx:333,3511,3552`, `EventCreator.tsx:10`, `personEventBundle.ts:15`, `emotionalLineNormalization.ts:108` and `dataImport.ts:427`.
- West of UTC in the evening, new events, predictions and measurements are dated tomorrow.
- `systemEvents.ts:208` also compares UTC-midnight dates with `now` for the lifetime clip.
- Fix: one local-date helper in `utils/dateFormatting.ts`, used at every site in one change.

**S4. The person draft and pristine model loses edits.**
- A single `personPristine` flag controls both "reset the draft" and "nothing pending". Auto-save paths set it and discard deferred edits (M7), and section writers read the stale draft (M6). The partnership and EPL drafts reset on identity change (minor).
- Fix: keep deferred fields separate from auto-saved fields, and have writers read the live entity.

**S5. familyScope reach rules.**
- `isBetter` lets a non-blood reach become lineal (M4), and the partner edge has no `fromChildId` (M5). Both change `marriedIn`, which M3's labels then consume.
- Fix these three together, with shared fixtures.

## Refuted in challenge pass

None of the 26 blocker and major candidates was fully refuted. These were corrected:

- **SYNTH-STATUS-DUP.** `divorce` is not duplicated, because the date+category dedup catches it. `start` and `ongoing` are duplicated. Downgraded to minor.
- **SESSION-NOTE-DISCARD (M17).** The claim "not autosaved" was wrong: a localStorage autosave exists. It is overwritten as soon as New or Open runs, so the finding stands.
- **CLICK-REPARENT (M19).** Click-to-add-child is a documented feature, not an accident. The missing ancestor check and the persistent mode are the defects.
- **EPL-INTENSITY-CONFLATION (M12).** Lines created through the pattern modal are not dirty on open. The finding applies to lines with no matching EPE event, or whose later event has a different intensity.
- **INDICATOR-DELETE-WIPE (M20).** The claim "last definition only" was wrong. It applies to any definition.
- **TIMELINE-STRING-NUMBERS (M10).** The rating is zeroed when that event is next opened in the panel, not on any panel save.
- **Severity changes:** EVM-AUTOCORRECT blocker → major. SYSEVENTS-LANE-ROOT blocker → major. SIR-STALE-DRAFT blocker (med) → major (high). SIB-PARENT-FALLBACK, SIB-PERF and TIMELINE-SAVE-NORMALIZE → minor.

## Fix status (2026-09-30)

Every finding above was fixed in commits `0eeb243`, `71a7373`, `25828d7`,
`1e3761e`, `14b3473` and the version/notes commit that follows, each with a
regression test that fails on the old code (checked by running the new tests
against the pre-fix files). Summary:

- **B1, M1, M2, M8–M16, M21, S1, S2** — `utils/eventDraft.ts` (shared save,
  owner routing, date slots, symptom indicator sync), EventModal no longer
  rewrites categories, seeds valid in `eventConstants.ts`.
- **M3–M5, S5** — `familyScope.ts` reach rules; lane-rooted kinship in
  `systemEvents.ts`.
- **M6, M7, S4** — pending person edits kept across auto-saves; SIR writes
  from the live person.
- **M17** — session-note New / Open confirm; unreadable library not overwritten.
- **M18, M19** — Add Triangle on the group menu; add-child checks.
- **M20** — removing a used symptom type is refused.
- **M22** — sibling positions cached on the canvas.
- **S3** — no event date defaults to today anywhere; `localDateString` for
  record dates; lifetime clip uses the local date.
- **All minors, low items and GTEST-01..12** — done; see TODO.md
  "From the review of the unread areas" for the four items left, and why.

## Author decisions (2026-09-30)

The author answered the questions this review raised. Fixes follow these decisions.

1. **Rule D1 (M4).** A married-in spouse's family of origin stays out of the default focus, even when the couple has children. `test_inlaw_she_is_a_sister_in_law_to_her_husbands_siblings` (`systemEvents.test.ts:679`) depends on the bug. It must be changed to use `includePartnerFOO`, or a lane-rooted scope.
2. **Synthesized rows (M11, M8).** Editing a synthesized birth, marriage or other date block edits the underlying date field. Each date field has exactly one event tied to it. Editing never creates a second, independent event.
3. **New event drafts (M21).** Do not copy the previous event's date, notes or ratings. New drafts start from the seed only, with `intensity: 0`.
4. **Default dates (S3, M14, M12, context-menu Add Event, family modal, new drafts).** Pre-filling today's date is fabrication. The date field starts blank unless a real source date exists. This also covers identity events (M14) and EPL measurement events (M12). S3's local-date helper is still needed for fields that legitimately record "now", such as `createdAt`, and for comparisons.
5. **Indicator definitions (M20).** Removing a definition is blocked while any person has an entry for it. The user must first delete those entries or reassign them to another definition. The block must say how many people and entries are affected.
6. **Sibling position.** Use the adoptive family: prefer `parentPartnership` over `birthParentPartnership`.
7. **Death of a relative.** This is a NODAL event on the relative's own record, and it reaches other people's lanes through system events, like births and marriages. A "Death" event on a person's own record is therefore that person's death, so category-based suppression of their Death synth is correct. Per decision 2, that event is the single event tied to `deathDate`.
8. **Seed `eventClass`.** This needed no author decision. `eventClass` records what the event is attached to (person, partnership, line), and nothing depends on the seeds' value. Keep the overwrite in `useUpdateHandlers.ts:291`, and delete the unused `eventClass: 'emotional-pattern'` values from the EA, FoO and Coach seeds.
