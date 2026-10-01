# Review: gaps left by the 2026-09-27 and 2026-09-30 reviews — 2026-09-30

## Verdict

The AI and API-key path is sound. Keys go only to their own provider over hardcoded https URLs, are never logged or written to files, and model output reaches no DOM sink. The three security findings are all minor.

The top risk is prediction data:
- Prediction edits never mark the diagram dirty, so File > Open discards them without the unsaved-changes prompt and file autosave never writes them.
- File > New carries the previous diagram's prediction sets into the new diagram. That puts one client's hypotheses into another client's file.
- One click deletes a whole prediction set, with no confirmation and no undo.

Fix those first.

The browser test found one feature that can't be reached: a Timeline opened from the family focus is meant to follow focus changes, but the focus controls sit under the Timeline's backdrop.

## Coverage

| Area | G-CORRECT | G-SEC | G-STRUCT | G-TEST |
|---|---|---|---|---|
| AI settings, API keys, image import (vlmImport, testApiConnection, customModels, visionImportReadiness, AISettingsModal, DiagramEditor 400-425 / 2830-3014, vercel.json, index.html) | not reviewed (one DATA note only) | covered | not reviewed | not reviewed |
| DiagramCanvas 1-500, familyScope, kinship | covered | not reviewed | not reviewed | covered (familyScope, kinship tests) |
| PredictionsPanel + usePredictionHandlers + predictionSets | covered | not reviewed | not reviewed | covered |
| EventModal, components/sections/* | not reviewed | not reviewed | not reviewed | covered |
| Changed flows in a running browser | runtime check (see below) | — | — | — |

Read: about 30 production files and 12 test files, roughly 9k LOC. Five workers ran: G-SEC, two G-CORRECT, G-TEST and one challenge worker.

Not reviewed:
- The rest of DiagramEditor.tsx and PropertiesPanel.tsx, beyond the ranges listed.
- G-STRUCT anywhere.
- `npm audit` for dependency CVEs.
- Tests were not run under mutation. "Would still pass" claims come from reading the code.

Excluded: node_modules, dist, package-lock.json, the JSON test diagrams in the repo root.

## Browser test (dev server, 1400×900, PRODUCT_DEFAULT diagram)

| Check | Result |
|---|---|
| Right-click hint takes focus, closes on Escape | pass |
| Ribbon help takes focus, closes on Escape, returns focus to the "?" button | pass |
| Add Event draft: no date, category "— select —" | pass |
| Saved event has date, startDate, anchorType, anchorId, eventClass, createdAt, subtype; intensity 0 (not invented) | pass (read from autosaved storage) |
| Other Person saved as the literal text `"None"` | observation — the field's default text is stored as data |
| Timeline from "Timeline for this family": 7 lanes, test event on the right lane | pass |
| Lane search "liam" → "1 of 7 lanes" | pass |
| Timeline follows focus changes | **fail — unreachable** (F-4) |
| Storage writes fail → red Save + alert text | pass |
| Storage works again → warning clears | **does not clear** until the next edit (F-9) |
| One Birth event for the birth date field | pass |
| README docs dialog and Timeline board: Escape / focus | not handled (F-10) |
| Help menu: Escape closes it | does not close |

## Findings

### Blockers

**F-1 · DATA · Prediction edits never mark the diagram dirty.** Verified.
- WHERE: DiagramEditor.tsx:1239-1249 (serializeDiagram), 1302-1314 (dirty effect dependencies), 2346 and 2359-2368 (file autosave).
- WHAT: The dirty snapshot leaves out predictionSets and ideasText. The same is true of functionalFactCategories and nodalCategories, which are in the payload but not the snapshot.
- WHY:
  - File > Open replaces prediction edits without the unsaved-changes prompt (replaceDiagramState at 2450).
  - File autosave never writes them.
  - Browser-storage autosave does keep them, so a page reload keeps them but the file does not.
  - "Save & Close" in the panel only closes it.
- FIX:
  - Add predictionSets, ideasText, functionalFactCategories and nodalCategories to the snapshot, to markSnapshotClean, and to the file-autosave dependencies.
  - Rename "Save & Close" to "Close", or make it save.
  - Add a dirty-state test.
- Confidence: high.

**F-2 · DATA · File > New keeps the previous diagram's prediction sets.** Found in the challenge pass. Verified.
- WHERE: useFileOperations.ts:159-191 (resetDiagramToBlankState); storage.ts:354-363 (clearDiagramLocalStorage).
- WHAT: New resets everything except predictionSets. The 'predictions' storage key is not cleared either.
- WHY: One client's prediction sets are saved into the next client's file, pointing at person IDs that don't exist there.
- FIX: Reset predictionSets in resetDiagramToBlankState, clear the key, and add a test. Do this together with F-1.
- Confidence: high.

### Major

**F-3 · DATA · Deleting a prediction set or prediction has no confirmation and no undo.** Verified.
- WHERE: PredictionsPanel.tsx:664, 448; usePredictionHandlers.ts:63-65.
- WHY: The app has no undo. Because of F-1, reopening the file doesn't bring it back either. PredictionsPanel.test.tsx:94-100 and 158-166 test for the immediate delete.
- FIX: Confirm, naming the item and its counts, and update the two tests.
- Confidence: high.

**F-4 · CORRECT · Timeline follow-focus can't be triggered from the UI.** Confirmed in the browser and in the code.
- WHERE: FamilyScopeChip sits inside AppRibbon (sticky, z-index 950, AppRibbon.tsx:376-378, 562). The Timeline backdrop is fixed, inset 0, z-index 2100 (TimelineBoardModal.tsx:971-979). The effect is at DiagramEditor.tsx:1010-1016.
- WHAT: The chip's "More / Fewer generations" and "Clear focus" buttons are covered by the Timeline backdrop. No other path changes the focus while the Timeline is open. A real click on "More generations up" left the focus at 2.
- FIX: Pick one:
  - Put up/down controls inside the Timeline board.
  - Stop the backdrop from covering the ribbon.
  - Drop the follow-focus feature.
- Confidence: high.

**F-5 · CORRECT · The sibling-conflict overlay goes stale.** Verified.
- WHERE: siblingPosition.ts:694-696 (siblingConflictInputKey), 670-686; DiagramCanvas.tsx:425-429.
- WHAT: The memo key leaves out several fields the result reads: fatherPositionOverride, motherPositionOverride and partnerPositionOverride (read at 717, 722, 727), and partnership relationshipStatus (read at 290-295).
- WHY: After a user sets "Father's position (manual)", or swaps which partnership is current, the overlay keeps showing the old result.
- FIX: Add those fields to the key, with a key-change test for each.
- Confidence: high.

**F-6 · TEST · PersonSiblingSection's write paths have no tests.** Verified.
- WHERE: PersonSiblingSection.tsx:108, 118, 133, 186-190, 356-357, 379 → PropertiesPanel.tsx:709-727, 1780.
- WHAT: Set Position, which writes to another person, the father/mother/partner overrides, birthOrderOverride parsing and the maturity level are all untested. Existing tests only check labels.
- FIX: The four cases in the G-TEST notes: the other person's position, the self override when there is no parent, birth order '0'/'2.7'/'', and maturity level 3 saved as a number.
- Confidence: high.

**F-7 · TEST · Changing a partnership's Type deletes status dates, and nothing tests it.** Verified.
- WHERE: PropertiesPanel.tsx:818-829.
- WHAT: Switching married → engaged → married and saving loses the Married, Separated and Divorced dates. Whether that's intended isn't pinned by any test.
- FIX: The author decides whether the dates survive, then add a test for it.
- Confidence: high.

**F-8 · TEST · Two gaps in PersonSIRSection and PersonPaperoSection tests.** Both verified.
- (a) PersonSIRSection.test.tsx:275-291 would still pass if an edit added a second event instead of replacing the first. Fix: also assert the event count and id.
- (b) No test checks that changing one Papero score keeps the others (PersonPaperoSection.tsx:84). A regression would wipe up to 15 scores.
- Confidence: high.

**F-9 · TEST · The prediction evidence form and condition linkers have no tests.** Verified.
- WHERE: PredictionsPanel.tsx:124-172, 207-374. The addEvidence and updateCondition handlers are untested too.
- WHY: Nothing stops a regression that defaults the evidence date to today, which breaks the 2026-09-30 decision.
- FIX: The tests listed in GTEST-07.
- Confidence: high.

### Minor

**F-10 · CORRECT · 18 of 21 dialogs have no Escape or focus handling.**
- Only HelpModal, RibbonHelpModal and RightClickHintModal use `useDialogFocus`. In the browser, the README viewer and the Timeline board ignored Escape and did not take focus.
- The earlier TODO item covered only those three, so this is an adjacent gap, not a regression.

**F-11 · ERROR · After a storage failure, the warning stays up until the next edit.**
- WHERE: useAutosave callbacks at DiagramEditor.tsx:1790-1870.
- WHAT: Writes happen only when the data changes. After storage became writable again, the warning stayed for more than 75 seconds, and the stored copy still held an event I had deleted.
- WHY: The warning is honest while it shows. But storage keeps a stale copy until the next edit, and the red Save stays on.
- FIX: Retry the failed keys on a timer, or on the next autosave tick.

**F-12 · CORRECT · familyScope gives a birth parent the wrong generation when grandparents adopt the root.** Partly verified.
- WHERE: familyScope.ts:144-150 (isBetter).
- WHAT: When grandparents adopt, the birth mother reaches generation 0 via the down edge and replaces her generation -1. The Timeline then classes her as a sibling and sorts her lane wrongly.
- The claimed half-sibling leak with "Lineal only" was refuted (see below).
- FIX: Prefer `descended === false` before comparing |gen|, and add a grandparent-adoption test.

**F-13 · CORRECT · Changing a prediction condition's person or type keeps the old link.** PredictionsPanel.tsx:458, 462.
- linkedEventId, linkedSIRCategory and linkedPaperoKey stay set, so the saved link points at another person's event.

**F-14 · CORRECT · PredictionsPanel writes description text the user didn't type.** PredictionsPanel.tsx:255, 315.
- It writes "Improve <topic>" and "<category>: <subtype>", and the text goes stale when the topic changes.
- This conflicts with the no-invented-values decision.
- FIX: Use a placeholder instead.

**F-15 · DATA · The prediction loader doesn't normalise conditions, outcomes or evidence.** predictionSets.ts:28-33.
- Evidence with no `type` crashes at PredictionsPanel.tsx:119.
- Two conditions with no id both match every update.

**F-16 · CORRECT · Changing a prediction's status discards an unsaved "+ Evidence" draft.** The card remounts: PredictionsPanel.tsx:442, 710-764.

**F-17 · DATA · Renaming a prediction set accepts an empty name.** PredictionsPanel.tsx:644, 648; usePredictionHandlers.ts:57-61.

**F-18 · SEC · Image import logs extracted clinical data to the console in production.** vlmImport.ts:126-143.
- It logs names, sexes, birth and death years, and relationships.
- FIX: Remove it, or log counts only under `import.meta.env.DEV`.

**F-19 · SEC · No Content-Security-Policy or frame-ancestors on the static site.** vercel.json, index.html.
- API keys live in localStorage. There's no current XSS sink, so this is defence in depth.
- FIX: Add a `headers` block with connect-src limited to api.anthropic.com and api.deepseek.com, plus `frame-ancestors 'none'`.

**F-20 · ERROR · Test Connection fetches have no timeout.** testApiConnection.ts:42-57, 66-77.
- A stalled provider leaves the modal on "Testing…" indefinitely.
- The sibling callClaudeVision has a timeout.

**F-21 · CORRECT · kinship treats every partnership as current.** kinship.ts:50-65, 110-116.
- An ex-spouse's later children are named step-children. See the author question below.

**F-22 · TEST · Smaller test gaps.**
- PersonSIRSection HWDID help test never checks the score was set (test 160-186).
- The EventModal FF free-text category branch is effectively untested (test 479-488).
- Changing a symptom's category wipes its free-text subtype, untested (EventModal.tsx:243-246).
- `test_m5a1_editor_saves_through_the_shared_payload_builder` is a source-text check (familyScope.persistence.test.ts:77-82).

**F-23 · DATA · The image import doesn't check coordinates from the model.** Noted by the G-SEC worker; not verified.
- sanitizeVLMFacts accepts any finite x/y, and dataImport.ts:891-892 doesn't clamp it.
- The import is added to the diagram with no preview.

## Systemic patterns

1. **Data outside the "core" diagram is handled inconsistently** (F-1, F-2, F-11). Predictions, ideas, and the functional-fact and nodal categories are in the file payload, but they're missing from one or more of: the dirty snapshot, file autosave, and the File > New reset. There's no single list of what a diagram contains that all three read. Fix: one `DIAGRAM_PAYLOAD_KEYS`-driven list used by serialize, reset and autosave, with a test that each key is in all three.
2. **Memo keys written by hand fall behind the functions they cache** (F-5). The same risk applies to `siblingPositionInputKey`. Fix: derive the key from the fields the function reads, or test the key against every field the function reads.
3. **Write paths are tested by rendering, not by the data written** (F-6, F-7, F-8, F-9). Sections are tested for labels, but not for what `onUpdatePerson` receives.

## Refuted in challenge pass

- **scope-01's "Lineal only" leak.** familyScope.ts:223 `if (!includeCollaterals && reach.fromChildId && childId !== reach.fromChildId) return;` stops the grandparents from walking down to the birth mother, so her other children don't enter the scope. Only the generation error remains (F-12).
- **PRED-01's "File > New discards prediction edits".** New keeps them instead (F-2).
- **GTEST-01 (SIR saved with an empty subtype) as a violation.** EVENT_TYPE_HAS_SUBTYPE.SIR is `false` (eventConstants.ts:603). For SIR, subtype holds the free-text Behavior field, so this is an author question, not a defect.

## Questions only the author can answer

1. Should a partnership Type change keep the dates for statuses the new type doesn't have (F-7)?
2. Is a SIR entry with no Behavior valid (GTEST-01)?
3. Should an ex-spouse's later children, or a parent's ex-partner's later children, be named step-relatives or "related by marriage" (F-21)?
4. Should a half-sibling be labelled "Brother"/"Sister" or "Half-brother"/"Half-sister"? And should an adopted person's birth parents and adoptive parents both be "Father"/"Mother"?
5. Should follow-focus be made reachable or dropped (F-4)?
6. Should Other Person's default "None" be stored as the text "None", or left empty?
7. Is `resolvedDate` = today on resolving a prediction acceptable? It's an app timestamp, not a user-entered date.

## Fix status (2026-09-30, "fix it all")

Author questions were settled with defaults; the open ones are in `TODO.md`.

| Finding | Status | Proof |
|---|---|---|
| F-1 prediction edits not dirty | done | `utils/diagramPayload.ts` `serializeDiagramContent` (cut from the file payload); `components/DiagramEditor.dirtyContent.test.tsx`, `utils/diagramPayload.test.ts`. "Save & Close" renamed "Close". |
| F-2 New keeps predictions | done | `hooks/useFileOperations.ts` reset; `useFileOperations.test.ts` "clears prediction sets and ideas"; `utils/storage.test.ts`. New also no longer loads the product demo's ideas text. |
| F-3 delete without confirm | done | `hooks/usePredictionHandlers.ts` + `utils/predictionSets.ts` messages; `hooks/usePredictionHandlers.test.ts` |
| F-4 Timeline follow-focus unreachable | done | Focus chip inside the Timeline header (`TimelineBoardModal` `focusControls`). Browser-checked: real clicks on "Fewer generations down" took the board from 7 lanes to 3. |
| F-5 stale sibling overlay | done | `utils/siblingPosition.ts` `siblingConflictInputKey`; `siblingPosition.test.ts` |
| F-6 sibling section writes untested | done | `components/sections/PersonSiblingSection.test.tsx` |
| F-7 type change deletes dates | done (dates kept) | `PropertiesPanel.tsx`; `PropertiesPanel.test.tsx` "keeps recorded status dates…" |
| F-8 SIR edit / Papero scores tests | done | `PersonSIRSection.test.tsx`, `PersonPaperoSection.test.tsx` |
| F-9 evidence form / linkers untested | done | `PredictionsPanel.test.tsx` (evidence now starts with no direction as well as no date) |
| F-10 dialogs without Escape / focus | done | All dialogs and help popovers use `useDialogFocus`, which now closes only the topmost dialog; `hooks/useDialogFocus.test.tsx`; `docs/ui-patterns.md` |
| F-11 storage warning sticks | done | Refused writes retried every 5 s (`DiagramEditor.tsx`); `DiagramEditor.storageFailure.test.tsx` |
| F-12 birth mother's generation | done | `utils/familyScope.ts` `isBetter`; `familyScope.test.ts` "grandparent adoption" |
| F-13 stale condition links | done | `utils/predictionSets.ts` `withConditionUpdate` |
| F-14 auto-written descriptions | done | Placeholder only (`conditionDescriptionPlaceholder`) |
| F-15 loader gaps | done | `normalizePredictionSets`; `predictionSets.test.ts` |
| F-16 evidence draft lost | done | One keyed list in `PredictionsPanel.tsx` |
| F-17 empty set name | done | `renamedSetName` |
| F-18 clinical data in console | done | `vlmImport.ts` logs counts, in dev only |
| F-19 no CSP | done | `vercel.json` headers; `vite preview` serves the same headers; `src/securityHeaders.test.ts`. Browser-checked under the policy: canvas, README viewer, YouTube embed, no violations. |
| F-20 no timeout on Test Connection | done | `utils/testApiConnection.ts` timeout + one retry; `testApiConnection.test.ts` |
| F-21 ex-spouse's later children | done (not step-relatives when born after the partnership ended; unchanged when no end date) | `utils/kinship.ts`, `partnershipEndDate`; `kinship.test.ts` |
| F-22 smaller test gaps | done | HWDID, FF free-text category, symptom name kept on category change; the source-text payload check replaced by a save-through-the-editor test |
| F-23 off-image coordinates | done (dropped and counted, not clamped) | `sanitizeVLMFacts`; `vlmImport.test.ts` |

Every regression test above was run against the previous commit (`ae41d45`)
and fails there.
