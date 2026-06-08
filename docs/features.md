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
