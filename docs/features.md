# Feature Reference

Deep-dives for the assessment frameworks and special entity types. All feature data lives on Person/Partnership entities and uses the standard event system.

## AI Agent — Person entity with hexagon shape

A Person with `birthSex: 'ai-agent'` rendered as a **lavender hexagon** (`#C5B3E6`).

- BirthSex: `'female' | 'male' | 'intersex' | 'ai-agent'`
- GenderSymbol: `'ai_agent'`
- Shape: flat-top hexagon via Konva `Line` with 6 computed points (`PersonNode.tsx`); never gender-split
- Context menu: "Add AI Agent" in stage right-click (`useContextMenuHandlers.ts`)
- Auto-naming: "AI Agent", "AI Agent 2", ... (`addAIAgent()` in `usePersonOperations.ts`)
- `PersonNameSection`: shows "Agent Name" label with "?" help, hides "Maiden Name"
- `PersonDatesSection`: "AI Agent" option in Birth Sex dropdown
- `defaultGenderIdentityForBirthSex('ai-agent')` returns `'nonbinary'`

When adding Person features, check whether AI agents need special handling (hidden maiden name, adoption, etc.). `birthSex === 'ai-agent'` is the canonical detection.

## Papero Assessment

Adapted from Dr Dan Papero — stored on Person entities, shown in a dedicated "Papero" tab.

- Event type: `'PAPERO'`
- Storage: `Person.paperoScores` (`PaperoScores` in `types/index.ts`) — 16 numeric fields, 0 = unset, 1-5 = level
- Component: `PersonPaperoSection.tsx`
- Scales: `PAPERO_SCALES` + `PAPERO_SUBTYPE_TO_KEY` in `eventConstants.ts`
- Scores save immediately on selection via `onUpdatePerson` (no Save button)

### 5 Categories × 16 Topics

| Category | Topics | Score keys |
|----------|--------|------------|
| Resourceful (Avoidance ↔ Engagement) | Engagement with Issue, Problem Solving Activity, Family Awareness of Role, Locus of Control, Leadership | `resourceful_*` |
| Connectedness & Integration (Cutoff ↔ Many Open Relationships) | Extended Family Contact, Knowledge of Situations, Relationship Quality, Openness & Tolerance | `connectedness_*` |
| Tension Management (Unmanaged ↔ Well Regulated) | Anxiety Containment, Perceptual Framework | `tension_*` |
| Systems Thinking (Conventional ↔ Systems) | Fundamental Questions, Family's Focus, Locus of Change | `systems_*` |
| Goal Structure (No Clear Goals ↔ SMART Goals) | Achievement Goals, Process Goals | `goals_*` |

Each topic has a Level dropdown (1-5) and a "?" help button that opens a dialog with 5-level descriptions; clicking a level sets the score. Category averages show in the category header.

## Self in Relationship (SIR) — configurable

Tracks how a person manages themselves in relationship interactions. Dedicated "Self in Rel." tab.

- Event type: `'SIR'`
- Storage: `Person.events[]` as `EmotionalProcessEvent` with `eventType: 'SIR'`
- Field mapping: `intensity` = Event Intensity (1-5), `frequency` = Stress Level (1-5), `howWell` = HWDID score (1-5), `subtype` = behavior description, `otherPersonName` = other person, `category` = SIR category name, `observations` = notes
- Component: `PersonSIRSection.tsx`
- Categories: `ApplicationSettings.sirCategories` / `DefaultDiagramState.sirCategories` (type `SIRCategoryDefinition`: `id`, `name`, `levels: [string, string, string, string, string]`)
- Settings UI: `SIRSettingsModal` (opened from AppRibbon Settings menu)

### Default 6 categories

| Category | Low (1) | High (5) |
|----------|---------|----------|
| Resource to Other | Reactive, Unhelpful | Neutral, Helpful |
| Managing Reactivity | High Reactivity | Calm, Grounded |
| Defining Self | Undefined, Fused | Clear, Differentiated |
| Detriangulating | Fully Triangulated | Fully Detriangulated |
| Emotional Contact | Cutoff, Avoidant | Open, Connected |
| Systems Perspective | Blaming, Linear | Systems View |

UI: inline form with Date, With (person select), Category, Behavior, Intensity, Stress, HWDID (with "?" help dialog), Notes. Cards show date, category, other person, color-coded badges, plus Edit/Delete.

Flow: `DiagramEditor` state → `DiagramCanvas` → `PropertiesPanel` → `PersonSIRSection`.

## Functional Facts (FF) — configurable

Per-person event categories users define themselves. Unlike other event types, FF has no fixed categories.

- Event type: `'FF'`
- Storage: `Person.events[]` with `eventType: 'FF'`
- Category source: `ApplicationSettings.functionalFactCategories` / `DefaultDiagramState.functionalFactCategories`
- Type: `FunctionalFactCategoryDefinition` — `{ id: string; name: string }` (name only, no scale)
- `EVENT_CATEGORIES.FF = []` by design — categories are dynamic
- Settings UI: `FunctionalFactSettingsModal`
- Context menu: right-click person → Add → Functional Fact → [Category]; submenu hidden when no categories exist
- EventModal: when `eventType === 'FF'`, category dropdown reads `functionalFactCategoryNames` prop

`buildDiagramPayload` includes `functionalFactCategories`; `replaceDiagramState` restores them.

## Prediction Sets — diagram-level hypotheses

Named sets of If→Then predictions at the diagram level. Accessed via Options → Predictions in `AppRibbon`.

### Data model

- Storage: `DiagramEditor` state `predictionSets: PredictionSet[]`, persisted to localStorage key `'predictions'` and saved in diagram JSON
- Types in `types/index.ts`:
  - `PredictionSet` — `{ id, name, createdDate, predictions: Prediction[] }`
  - `Prediction` — `{ id, title, status, createdDate, resolvedDate?, conditions, outcomes, notes }`
  - `PredictionCondition` — `{ id, type, personId?, description, linkedPaperoKey?, linkedSIRCategory?, linkedEventId?, evidence[] }`
  - `PredictionOutcome` — `{ id, description, personIds[], evidence[] }`
  - `PredictionEvidence` — `{ id, date, type, sourceId?, measurement?, direction, notes }`
- Condition types: `'sir' | 'papero' | 'custom'`
- Statuses: `'active' | 'supported' | 'unsupported' | 'revised'`
- Evidence directions: `'supports' | 'contradicts' | 'neutral'`

### UI (`PredictionsPanel.tsx`)

Two views: Set List (create/rename/delete) → Active Set (predictions within).

- Set List: name input + Create, list with rename/delete
- Active Set: Back, + New prediction, expandable prediction cards
- Expanded card: title, status badges, IF (Conditions), THEN (Outcomes), evidence rows, notes
- SIR linker: when condition is `'sir'` + person selected, shows SIR Category dropdown + existing SIR events (links via `linkedEventId`)
- Papero linker: when condition is `'papero'` + person selected, shows Papero Topic dropdown + current score (via `linkedPaperoKey`)

### Hook (`usePredictionHandlers.ts`)

Deps: `{ predictionSets, setPredictionSets }`. All prediction/condition/outcome/evidence CRUD ops take `setId` as the first parameter. Uses `updatePredInSet` internal helper for immutable nested updates.

## Properties panel — conditional field visibility

### Partnership panel (depends on `relationshipType`)

Only `'married'` shows: Married Date field, "Married" option in Status dropdown.

All types show: Type dropdown (married/friendship/dating/living_together/engaged/affair/common_law), Status (options vary — married gets Married/Separated/Divorced; others get Started/Ongoing/Ended), Notes.

Never show "Married Date" for non-marriage types.

### Person panel

- `adoptionDate` only visible when adopted
- `deathDate` only visible when deceased (or being set to mark deceased)
- `genderDate` only visible when `genderIdentity` differs from `birthSex`

## Notes system (identical pattern per object)

| Object | Note fields | Special case |
|--------|-------------|--------------|
| Person | `notes`, `notesEnabled`, `notesPosition`, `notesSize` | — |
| Partnership (PRL) | same | PRL note only |
| Partnership (Family) | `familyNotes`, `familyNotesEnabled`, `familyNotesPosition`, `familyNotesSize` | Separate from PRL on same Partnership |
| EmotionalLine | same as Person | — |
| Triangle | same as Person | — |

### Context menu labels (standardized)

```typescript
label: obj.notes ? (obj.notesEnabled ? 'Hide Note' : 'Show Note') : 'No Note'
onClick: () => { if (!obj.notes) return; update(id, { notesEnabled: !obj.notesEnabled }); }
```

Partnership has two entries: "Hide/Show PRL Note", "Hide/Show Family Note".

### Where notes textareas live

- Person: `PersonNameSection` (Name sub-tab) with inline `notesEnabled` checkbox
- PRL: `PartnershipPropertiesSection`
- Family: `PropertiesPanel` Family tab, "Family" sub-tab
- EPL: `EPLPropertiesSection`
- Triangle: `EPLPropertiesSection` inside the `{triangleId && ...}` block

### Canvas rendering (`DiagramCanvas.tsx`)

Anchor points:
- Person → `(x, y)`
- PRL → `((p1.x+p2.x)/2, horizontalConnectorY)`
- Family → PRL anchor offset `+60y`
- EPL → segment midpoint
- Triangle → centroid

`noteVisibility.ts` predicates (`shouldShow*Note`) all follow the same rule:
- `false` if no notes text
- `false` if `notesEnabled === false`
- `true` if `notesEnabled === true` OR `notesLayerEnabled === true`
- Person additionally `true` on hover (`hoveredPersonId === person.id`)

`useCanvasDragHandlers.ts` has `handle{Type}NoteDragEnd` / `handle{Type}NoteResizeEnd` for each.

## Image import — hand-drawn genogram → diagram (Claude Vision VLM)

Turns a photo/scan of a hand-drawn family diagram into an editable diagram via a single
Claude Vision call. Entry point: File > **Import Family Diagram** (`AppRibbon.tsx`) →
`DiagramEditor.handleImageDiagramAnalyze`.

Pipeline:
1. `utils/genogram/vlmImport.ts` — downscales the image and calls the Anthropic API
   (browser-direct; key from `localStorage['anthropic_api_key']`). Prompt encodes standard
   genogram notation + drawn-line and twin rules. Returns `FactsImportData`.
2. `applyDataRules` in `utils/genogram/genogramRules.ts` — PHASE 1 fact-check/auto-fix
   rules **R1–R6** (filter pregnancy/miscarriage markers, dedupe names, clean dangling
   refs, block sibling marriages).
3. `factsToDiagramImportData` in `utils/dataImport.ts` — builds people/partnerships, then
   PHASE 2 layout rules **R7–R21**: longest-path generations (R7–R10, married-in inherits
   partner), unknown-sex/stillbirth sizing with a 30px floor (R16/R17), twin grouping
   (R18), and the horizontal `applyFamilyXLayout` (R19 no-overlap + couple-brackets-kids,
   R20 married-in mate anchoring, R21 Reingold-Tilford centering). Age is only a soft
   check — it never overrides a drawn line.
4. `ImageDiagramReviewModal.tsx` — review draft before it loads.

The full rule catalogue (R1–R21) is documented in the `genogramRules.ts` header and mirrored
in the layout comment block of `dataImport.ts`. Design/status: [VLM_Implementation_Summary.md](VLM_Implementation_Summary.md).
The retired classical-CV pipeline is described in [genogram-import-status.md](genogram-import-status.md)
(historical only).

## Family focus — N generations up / N down

**Spec:** [`implementation_plan_2026-09-19.md`](implementation_plan_2026-09-19.md) (M1–M6)
**Code:** `utils/familyScope.ts`, `hooks/useFamilyScope.ts`, `components/FamilyScopeChip.tsx`

Right-click a person → **Focus Family** shows only that person's family. Default is
2 generations up and 2 down (grandparents → parents → person → children → grandchildren),
adjustable with the `±` steppers on the chip that appears beside the timeline-year slider.

### Traversal rules (`computeFamilyScope`)

Generation-banded BFS, not a lineal walk. The root is generation 0; a person is in scope iff
`-up ≤ gen ≤ +down` and reachable by a legal edge:

| Edge | Target | Legal when |
|---|---|---|
| up | `parentPartnership` + `birthParentPartnership` → both partners, `gen − 1` | the node is **lineal** (never from a married-in partner — their FOO is a different family), and `gen − 1 ≥ −up` |
| down | each partnership → `children`, `gen + 1` | `gen + 1 ≤ +down` |
| partner | partners via `person.partnerships`, same `gen` | always; marks the partner *married-in* |

- **Siblings, aunts, uncles and cousins** fall out of up-then-down paths — no special case.
  `includeCollaterals: false` ("Lineal only" in the menu) restricts a node reached by an up
  edge to descending back only to the child it came from.
- **Boundary rule R4a:** at `up = 2` a grandparent's own siblings are *not* included — reaching
  them needs a great-grandparent partnership at `gen −3`, outside the band.
- **Adoption:** both `parentPartnership` and `birthParentPartnership` are traversed.
- **`includePartnerFOO: true`** (not currently exposed in the menu) allows the up edge from a
  married-in partner.
- A partnership is in scope iff **both** partners are — the rule `partnershipVisibility`
  already applies on the canvas.

### Composition with the year slider

The focus is ANDed into `personVisibility` (`buildPersonVisibility`), which the timeline-year
slider already drove. A person must pass **both** filters to be drawn, which is why the chip
sits next to the slider. Emotional lines and triangles need every endpoint visible, so
boundary-crossing patterns disappear — the chip reports how many (`N patterns · M triangles
hidden`).

### What it never does

Focus is view state: never written to the diagram JSON, never autosaved, and it never moves a
person. Hidden people leave gaps; layout is not recompacted. "Center" re-centres the view on
what remains. PNG/SVG export renders the stage, so it exports what is visible.

### Timeline

All three Timeline entry points route through `deriveTimelineSelection`: an explicit person
selection wins, otherwise the active scope supplies the lanes, sorted by generation then birth
date. Lanes are never truncated — the count is reported in the header.

## System events — the nodal events of a person's system

**Spec:** [`implementation_plan_2026-09-19.md`](implementation_plan_2026-09-19.md) (M7)
**Code:** `utils/systemEvents.ts`, `constants/relationLabels.ts`

A person's Timeline lane and Events tab show the events of the **family system** they belong
to, not only the events they own or are a named party to: a father's death, the parents'
divorce, a son's birth, a sister's symptom onset, the family's own FAMILY/TRIANGLE events.

- **Ring** = the active family scope (its defaults when no focus is set).
- **Labels** are generated from generation offset + sex — `Father died`, `Parents divorced`,
  `Son born`, `Sister Depression`. Vocabulary lives in `constants/relationLabels.ts`, not in
  the collector.
- **No event-type filter:** SYMPTOM, NODAL, EPE, FF, SIR and PAPERO all come through.
- **Lifetime clip:** an event is kept when its range *overlaps* `[birthDate, deathDate ?? today]`.
  The one exception is the **parental union's formation** (relationship start / marriage),
  which precedes every person by construction — the exception list is
  `UNION_FORMATION_CATEGORIES`. A person with no birth date gets no lower bound, and the UI
  says so rather than filtering silently.
- **Dedup** is keyed on `(owner, event)`, never the event id alone, because partnership events
  are cloned onto both partners with `-p1` / `-p2` suffixes.
- **Rendering:** on the person's own lane, dashed and muted, behind a "System events" toggle
  (default on) that reports `N own · M system events from K relatives`. In the Events tab they
  are **read-only** — the `↗` control opens the event on the entity that owns it, so there is
  never a second editable copy.

### Date-field synthesis (extended)

`utils/syntheticDateEvents.ts` also synthesizes `synthesizePersonIndicatorEvents`: a
`functionalIndicator` carrying a date with no backing SYMPTOM event becomes one at read time.
Indicators written by the Properties panel always have a backing event; those arriving through
transcript / voice import (`DiagramEditor` `mergeIndicators`) do not, and were invisible on
every timeline before this.
