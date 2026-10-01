# Review: the areas no earlier pass covered — 2026-09-30

## Verdict

This pass covered DiagramEditor (all of it), the canvas node components, voice input, the Event Creator and person-event bundles, session capture, the settings and other modals, the ribbon, a structural review of the whole frontend, and a dependency audit.

The worst problems are in saving and importing:
- **File autosave:** after File > Open, the first autosave cannot write to the opened file. It downloads a copy instead, marks the diagram saved, and stops.
- **Browser storage:** the copy in browser storage is written only after a full autosave interval of no edits. Nothing writes it when the tab closes, so steady editing followed by closing the tab loses work.
- **Session capture:** a ticked "partnership" operation creates no partnership but is reported as applied.
- **Family dialogs:** they still seed ratings the user never gave.

Voice commands and bundle imports also act on the wrong person, or invent data, in common cases.

Fix the save and storage paths first.

## Coverage

| Area | G-CORRECT | G-SEC | G-STRUCT | G-TEST |
|---|---|---|---|---|
| DiagramEditor.tsx 1-2400 | covered | — | covered (targeted) | covered (data-writing parts) |
| DiagramEditor.tsx 2400-end | covered | — | covered (targeted) | covered (data-writing parts) |
| Canvas nodes (PersonNode, PartnershipNode, EmotionalLineNode, NoteNode, SiblingConflictOverlay, MultiPersonPropertiesPanel) | covered | — | partial | covered by assertions |
| Voice, Event Creator, bundles, session capture, demo tour | covered | covered (untrusted text) | partial | covered |
| Settings and other modals, AppRibbon, DiagramModals, data/* | covered | — | partial | partial |
| Whole frontend structure | — | — | covered (targeted reads of ~26 files, sweeps of all) | — |
| Dependencies | — | `npm audit` run | — | — |

Read: about 45 production files in full or in the ranges named in each worker's report. Workers ran: seven review workers and two challenge workers.

Not reviewed:
- runtime behaviour of the File System Access API, which was inferred from the code;
- SpeechRecognition;
- a full dead-export sweep.

Excluded: node_modules, dist, lockfiles.

**Dependencies.** `npm audit` reported 26 advisories (1 critical, 17 high), all but one in build and test tools. The one runtime package affected, `nanoid`, is used only through its default generator, which the advisory does not cover. `npm audit fix` and an upgrade of vite 5 → 8 with `@vitejs/plugin-react` 6 bring this to **0**. The build, the dev server and all tests pass on the new versions.

## Findings (all verified by the challenge pass unless noted)

### Blockers
- **DE1-01 · ERROR** — After File > Open, the handle is read-only. The first file autosave cannot get write access, so it drops the handle, downloads a copy and marks the diagram clean. The opened file is never updated, and autosave then stops. (The challenge pass narrowed this: only one copy is downloaded, not one per autosave.)
- **DE2-01 · CORRECT** — Session capture `upsert_partnership` never creates a partnership but counts as applied.

### Major
- **DE1-02 · DATA** — Browser storage is written only after `autoSaveMinutes` with no edits, and is never written when the tab closes.
- **DE1-03 · DATA** — Each storage key has its own timer, so the stored partnerships can refer to people who were never stored.
- **DE1-04 · DATA** — The diagram restored from storage is marked clean, so New or Open discard a diagram that was never saved to a file without asking.
- **DE1-05 · ERROR** — Session-note autosave calls `localStorage.setItem` unguarded. With no error boundary, a quota error unmounts the app.
- **DE1-06 · CORRECT** — Family focus is not cleared on Open, New or root deletion, so everyone is hidden.
- **DE1-07 · CORRECT** — Replacing the diagram leaves the panel, selections and popups pointing at stale objects. A panel edit after a backup restore can undo the restore.
- **DE1-10 · ERROR** — Failed file writes are never reported.
- **DE1-12 · DATA** — The restored file handle is linked to the storage copy without comparing contents, so a stale copy can autosave over a newer file.
- **DE2-02 / capture-04 · DATA** — Session-capture events and person upserts skip `eventDraft`. They have no anchor or subtype, a made-up category, and payload values that are never checked.
- **DE2-03 / struct-04 · DATA** — Family property drafts seed intensity, frequency and impact as 1, use mixed `eventClass` values, and "Add Event" pre-selects Triangles / Functioning.
- **DE2-05 · DATA** — A successful image import hides the model's uncertainties and appends with no replace/merge choice.
- **nodes-01..04 · CORRECT/DATA:**
  - age shown to today for a death with no date, a miscarriage or a stillbirth;
  - an unrated EA shows "0";
  - family indicators use the last-created event, not the latest dated;
  - a mixed-size multi-select resizes everyone to 60 on a double blur.
- **voice-02..06 · CORRECT/DATA:**
  - spoken order forces the partners' sexes;
  - "man/woman/son" are ignored or become part of the name;
  - multi-word child names are split into separate children;
  - names are matched exactly with the last one winning, and a miss silently creates a person;
  - a child already in another family is silently moved.
- **bundle-01..03 · DATA/CORRECT:**
  - a bundle import replaces and deletes events with no preview;
  - name matching is ASCII-only with the last one winning;
  - Event Creator date edits are lost because `startDate` is not updated, and new events skip `eventDraft`.
- **settings-01..03 · DATA:**
  - renaming a symptom type splits the symptom under two names;
  - renaming or deleting an SIR, Nodal or FF category orphans events, and delete has no usage check;
  - Add Family creates three blank, preset-sex children.
- **struct-01..03 · PERF:**
  - a 500 ms tick re-renders the whole editor while unsaved;
  - Timeline lanes are rebuilt on every render and mouse move;
  - drag frames force extra renders and recompute the family scope.
- **struct-05 · ARCH** — bundle and Event Creator events bypass `eventDraft` (same defect as bundle-03).
- **struct-06 · ARCH** — the "listed events for an owner" rule is written in five places and has drifted: the Events tab shows status records that the Timeline does not.
- **G-TEST-01..08** — the test gaps behind the defects above, and `addParentsForPerson` overwriting an existing birth family.

### Minor
- **DE1-08:** the slider defaults to the current year, so future-dated items are hidden.
- **DE1-09:** past the end of the range, the slider jumped to the oldest year.
- **DE1-11:** backup failures are silent.
- **DE1-13:** the Session Notes target is reset by any edit.
- **DE1-14:** a restored session note gets a duplicate library entry.
- **DE1-15:** Add Partner sets the status to "married".
- **DE2-04:** image-import hints are ignored.
- **DE2-06:** Cancel during the image import is missed.
- **DE2-07:** session matching takes the first prefix match.
- **DE2-08:** Save As write errors are swallowed.
- **DE2-09:** a failed import half-replaces the diagram.
- **DE2-10:** "Export SVG" writes a PNG.
- **DE2-11:** Quit always warns and cannot close the tab.
- **capture-03:** duplicate operation ids share one checkbox.
- **nodes-05..12:**
  - the multi-select border colour ignores `borderEnabled`;
  - status-date labels are hidden under the family-name box;
  - line endings ignore person size;
  - cutoff bars are not perpendicular to the line;
  - a stillborn person of unknown sex is drawn as a circle;
  - `gender` 'b' / 'Male' is drawn as female;
  - right-click also fires badge clicks;
  - note text spills outside the note.
- **voice-07:** a trailing "s" is stripped from names.
- **bundle-04:** a malformed timeline file crashes the Event Creator.
- **settings-04..10:**
  - SIR level placeholders all get the same number;
  - category edit state survives Close;
  - "V1 (most recent backup)" means different things on the two save paths;
  - duplicate and empty names are accepted;
  - a category name can collide with another type's;
  - emptied lists come back as the defaults;
  - Help › Help Demo bypasses the demo loader.
- **struct-07..11:**
  - the sex rule is copied in several places;
  - category literals are hard-coded outside `eventConstants`;
  - three settings dialogs use a local `MODAL_Z`;
  - prop drilling through DiagramCanvas;
  - couple names are formatted three ways.
- **G-TEST-09..13:**
  - no test for possessive "s" in voice names;
  - vacuous EmotionalLineNode tests;
  - the miscarriage test passes without its branch;
  - the AppRibbon test only checks source text;
  - the demo file name was never recognised.

## Systemic patterns

1. **Save paths that bypass `utils/eventDraft.ts`.** Session capture, family dialogs, Event Creator and bundle merge each build events their own way (DE2-02, DE2-03, bundle-03, struct-04/05). This is the same failure as LEARNINGS L9.
2. **Person-name matching.** There are three matchers with three sets of rules (voice, session capture, bundles), and all pick the first or last of several matches without saying so (voice-05, DE2-07, bundle-02).
3. **Save and storage reliability.** Writes that can fail silently, run late or race each other (DE1-01..05, DE1-10..12).
4. **Defaults the user never chose.** Preset sexes, ratings, statuses and children (voice-02, DE2-03, settings-03, DE1-15) — the same rule as the 2026-09-30 author decisions.

## Refuted in challenge pass

- **G-TEST-13** (demo file name never recognised) was already fixed in the working tree when it was checked.
- **voice-01** (voice defaults to female) is not a defect: it is the author decision of 2026-09-27 recorded in TODO.md. voice-02 (sexes forced by speaking order) is a separate defect and stands.

## Questions only the author can answer

- **Bundle imports (bundle-01):** should importing a bundle remove events missing from it? It does today. The fix keeps that, but asks first and shows the counts.
- **"Export SVG" (DE2-10):** Konva has no SVG export. The fix removes the menu item instead of writing a PNG with a .svg name.

## Fix status (2026-10-01)

Every finding is fixed, with a test that fails on the code before the fix, except voice-01 (refuted: an author decision). The fix-status check ran each new or changed test file against the code at `60c94e1`; tests that also pass there are the "still works" partners of a failing test, not the regression test.

| Finding | Fix | Test (under `src/frontend/src/`) |
|---|---|---|
| DE1-01 | Autosave without write permission keeps the file link, downloads nothing and says why beside Save. | `components/DiagramEditor.autosave.test.tsx` |
| DE1-02, DE1-03 | `hooks/useBrowserStorageWriter.ts` writes every key in one pass a second after the last change, and at once on pagehide / tab hidden. | `hooks/useBrowserStorageWriter.test.ts` |
| DE1-04 | A fingerprint of the last saved content; a restored diagram that differs starts unsaved. | `components/DiagramEditor.dirtyContent.test.tsx` |
| DE1-05 | Session-note writes go through the guarded writer; an `ErrorBoundary` wraps the app. | `components/DiagramEditor.storageFailure.test.tsx`, `components/ErrorBoundary.test.tsx` |
| DE1-06 | A focus whose root is gone is dropped; Open and New clear it. | `hooks/useFamilyScope.test.ts` |
| DE1-07 | `clearTransientEditorState` on every diagram replacement. | `components/DiagramEditor.replaceState.test.tsx` |
| DE1-08, DE1-09 | The Timeline year starts unset (shows everything); past the end it clamps to the last year. | `utils/dateFormatting.test.ts` |
| DE1-10 | Failed file writes are reported beside Save and, on a manual save, in an alert. | `hooks/useFileOperations.test.ts` |
| DE1-11 | Backup-folder failures are reported beside Save. | `components/DiagramEditor.autosave.test.tsx` ("a backup copy that cannot be written…") |
| DE1-12 | The remembered file is linked only if it holds the restored diagram. | `components/DiagramEditor.autosave.test.tsx`, `utils/diagramPayload.test.ts` |
| DE1-13, DE1-14 | The Session Notes target follows the single selection only; a restored note keeps its record id. | `components/DiagramEditor.sessionNotes.test.tsx` |
| DE1-15 | Add › Partner creates an "ongoing" partnership. | `components/DiagramEditor.addPartner.test.tsx` |
| DE2-01, DE2-02, DE2-07, capture-03, capture-04 | `utils/sessionCaptureApply.ts`: partnerships are created; events go through `eventDraft`; a name matches exactly, then by a unique first name, else is reported as ambiguous; operation ids are made unique. | `utils/sessionCaptureApply.test.ts`, `components/DiagramEditor.sessionCapture.test.tsx` |
| DE2-03, struct-04 | `buildFamilyEventDraft`: no seeded ratings, FAMILY / family, "Add Event" starts blank. | `utils/eventDraft.test.ts` ("family event drafts") |
| DE2-04 | Upload hints are sent to the model; off-image positions are dropped. | `utils/genogram/vlmImport.test.ts` |
| DE2-05, DE2-06 | Image import goes through Replace / Merge and lists the model's uncertainties; Stop during reading adds nothing. | `components/DiagramEditor.imageImport.test.tsx` |
| DE2-08 | Save As reports a picker failure before the download fallback. | `components/DiagramEditor.saveAs.test.tsx` |
| DE2-09 | A failed import names the reason and leaves the diagram as it was. | `components/DiagramEditor.importError.test.tsx` |
| DE2-10 | "Export SVG" removed (Konva has no SVG export). | `components/AppRibbon.test.tsx` |
| DE2-11 | Quit asks only when there are unsaved changes and says when the tab cannot be closed. | `components/DiagramEditor.replaceState.test.tsx` |
| nodes-01..04 | `utils/canvasIndicators.ts` (age, unrated EA, latest dated indicator); multi-select size kept on blur. | `utils/canvasIndicators.test.ts`, `components/MultiPersonPropertiesPanel.test.tsx` |
| nodes-05..12 | Border colour, status-date labels, line ends by size, perpendicular cutoff bars, stillborn unknown sex, sex values in any case, right-click on badges, note text clipped. | `components/PersonNode.test.tsx`, `PartnershipNode.test.tsx`, `EmotionalLineNode.test.tsx`, `NoteNode.test.tsx`, `SiblingConflictOverlay.test.tsx`, `MultiPersonPropertiesPanel.test.tsx`, `utils/personSex.test.ts` |
| voice-02..07 | Sex from stated words or name evidence, not speaking order; sex words from `data/voiceVocabulary.json`; multi-word names; exact-then-unique matching with a review line; a child in another family is reported; possessive "s" handled. | `hooks/useVoiceHandlers.test.ts`, `utils/voiceCommands.test.ts` |
| bundle-01..04 | A bundle import shows what it will add, replace and remove and asks first; Unicode name matching, ambiguous names reported; Event Creator dates set `date` and `startDate` and new events go through `eventDraft`; a malformed file is reported, not a crash. | `utils/personEventBundle.test.ts`, `components/EventCreator.test.tsx` |
| settings-01, settings-02 | Renaming a symptom type or a SIR / Nodal / FF category moves its events; delete is refused while in use and asks otherwise. | `utils/categoryRename.test.ts`, `hooks/useIndicatorHandlers.test.ts`, the three settings modal tests, `components/DiagramEditor.settingsLists.test.tsx` |
| settings-03 | Add Family opens with no child rows. | `components/DiagramEditor.settingsLists.test.tsx` |
| settings-04 | A blank SIR level is numbered by its own position. | `components/modals/SIRSettingsModal.test.tsx` ("blank levels") |
| settings-05 | Category edit state is cleared on Close. | Nodal / SIR / FF settings modal tests |
| settings-06 | Both save paths put the version the save replaced in V1 (the browser backup record keeps the last saved JSON for the download path); the dialog names V1 "before the last save" and shows when each version was replaced. | `utils/storage.test.ts` (`nextBackupVersions`), `components/modals/BackupRestoreDialog.test.tsx`, `components/DiagramEditor.saveBackups.test.tsx` |
| settings-07, settings-08 | Empty, duplicate and other-type built-in names are refused with a message. | `SettingsListModal`, `IndicatorSettingsModal`, Nodal / SIR / FF modal tests |
| settings-09 | An emptied list stays empty after a reload. | `data/defaultDiagramState.test.ts`, `data/applicationSettings.test.ts`, `components/DiagramEditor.settingsLists.test.tsx` |
| settings-10 | Help › Help Demo uses the demo loader. | `components/AppRibbon.test.tsx`, `components/DiagramEditor.settingsLists.test.tsx` |
| struct-01 | The Save-button clock lives in AppRibbon; the canvas no longer re-renders on it. | `components/DiagramEditor.renderCost.test.tsx` |
| struct-02 | Timeline system events cached per lane and diagram. | `components/modals/TimelineBoardModal.perf.test.tsx` |
| struct-03 | Drag frames skip unchanged lists; the family scope is keyed on topology. | `hooks/useCanvasDragHandlers.test.ts`, `hooks/useFamilyScope.test.ts` |
| struct-05 | Same fix as bundle-03. | `components/EventCreator.test.tsx` |
| struct-06 | `utils/listedEvents.ts` is the one rule for listed events (Properties panel, Timeline, system events). | `utils/listedEvents.test.ts` |
| struct-07 | One sex rule (`utils/personSex.ts`) used by layout, canvas, kinship and partner creation. | `utils/personSex.test.ts`, `utils/dataNormalization.test.ts` |
| struct-08 | Category literals read from `eventConstants`. | `components/modals/NodalCategorySettingsModal.test.tsx` |
| struct-09 | The settings dialogs use `constants/zIndex.ts`. | `constants/zIndex.test.ts` |
| struct-10 | The Properties panels moved out of DiagramCanvas into `components/PropertiesPanelHost.tsx`, passed to the canvas as one `propertiesPanel` slot (29 props fewer on the canvas); the three PropertiesPanel instances share one props object; the owner-selection logic moved to `useSelectionHandlers`. | `components/PropertiesPanelHost.test.tsx`, `hooks/useSelectionHandlers.test.ts` |
| struct-11 | One couple-name format (`joinCoupleNames`, "A + B"). | `utils/personNames.test.ts` |
| G-TEST-01..13 | The tests listed above; vacuous EmotionalLineNode tests replaced; the miscarriage test asserts the branch; the AppRibbon test clicks the menu. | as above |
| voice-01 | Not changed: the 2026-09-27 author decision (voice and manual Add Person default to female). | — |
