# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Family Diagram App — Claude Code Instructions

## MANDATORY: Pre-Completion Checklist

**Every task MUST pass all 3 steps before you declare work complete:**

1. `cd src/frontend && npx tsc --noEmit` — MUST pass with zero errors
2. `cd src/frontend && npx vitest run` — MUST pass with zero failures
3. `cd src/frontend && rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` — MUST pass (Vercel build)

If any step fails, fix the issue before responding. Never tell the user "done" with failing checks.

---

## RULES — Never Break These

1. **NEVER duplicate logic.** Before writing any helper, lookup, or transformation, search the codebase for existing implementations. Reuse what exists.
2. **NEVER hardcode event types, categories, or subtypes.** Always use `eventConstants.ts` lookups (`EVENT_CATEGORIES`, `EVENT_SUBTYPES`, `EVENT_TYPE_HAS_PERSONS`, etc.).
3. **NEVER modify a modal or form without first reading its test file** and running those tests before AND after your change.
4. **NEVER add a new event type or category** without updating `eventConstants.ts` first, then updating all consuming components.
5. **NEVER skip writing a regression test** when fixing a bug. The test must fail without the fix and pass with it.
6. **NEVER use `any` type.** Use proper types from `src/frontend/src/types/index.ts` or `src/frontend/src/types/diagramEditor.ts`.
7. **NEVER mutate objects directly.** Always spread/clone — this codebase uses immutable transforms throughout.
8. **NEVER put domain logic in components.** Components render; hooks and utils contain logic.
9. **NEVER add imports without removing them when done.** `noUnusedLocals: true` is enforced.
10. **NEVER make a change in one place without checking ALL similar places.** If you fix a pattern in EventModal, check SessionEventModal, PropertiesPanel, and EventsSection for the same issue.

---

## Running Without Approval Prompts

```bash
claude --dangerously-skip-permissions
```

## Project Overview

React 18 + TypeScript + Konva.js + Vite frontend at `src/frontend/`.

```bash
cd src/frontend && npx tsc --noEmit                    # Check for TS errors
cd src/frontend && npx vitest run                      # Run all tests
cd src/frontend && npx vitest run src/path/to/Foo.test.tsx  # Run single test file
cd src/frontend && npm run lint                        # ESLint check
cd src/frontend && npm run dev                         # Start dev server (http://localhost:5173)
```

**Build command for Vercel:** `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` — always run before pushing.

---

## Domain Model — The 10 Entity Types

The app models family systems using 10 entity types. **Every entity type follows the same patterns for properties, events, and display.** When you implement something for one entity type, you MUST implement it the same way for ALL entity types that share that pattern.

### The 10 entities and their event groups:

| Entity | Panel | Event Group (eventType) | eventClass | category pattern |
|--------|-------|------------------------|------------|-----------------|
| **Person** | Individual Functional Facts | NODAL, SYMPTOM, SIR, FF | `'individual'` | `'Individual'` |
| **AI Agent** | Same as Person (hexagon shape) | NODAL, SYMPTOM, PAPERO, SIR, FF | `'individual'` | `'Individual'` |
| **Partner Relationship** | Partner Relationship Line (PRL) | NODAL | `'relationship'` | `toTitleCase(relationshipType)` |
| **Emotional Pattern** | Emotional Pattern Line (EPL) | EPE | `'emotional-pattern'` | `'Emotional Pattern'` |
| **Family** | Family view | FAMILY | `'family'` | from event |
| **Triangle** | Triangle view | TRIANGLE | `'triangle'` | from event |
| **Family of Origin** | FoO view | FOO | `'foo'` | from event |
| **Emotional Autonomy** | EA view | EA | `'ea'` | from event |
| **Symptom** | Symptoms tab (Person) | SYMPTOM | `'symptom'` | physical/emotional/social |
| **Papero Assessment** | Papero tab (Person) | PAPERO | `'individual'` | Resourceful/Connectedness/Tension/Systems/Goals |
| **Self in Relationship** | Self in Rel. tab (Person) | SIR | `'individual'` | Configurable via SIR Settings |
| **Functional Fact** | Events tab (Person) | FF | `'individual'` | Configurable via FF Settings |

### Where entities store events:

- `Person.events[]` — individual events, symptoms, and copies of relationship events
- `Partnership.events[]` — relationship events (also copied to both partners' `Person.events[]`)
- `Partnership.familyEvents[]` — family-level events
- `EmotionalLine.events[]` — emotional pattern events
- Triangle events go through Family events

---

## CRITICAL: Save = Create Event (EVERY entity type)

**Every Save button on every properties panel creates an `EmotionalProcessEvent` record.** This is a deliberate design choice — the event log is the audit trail.

### Rules for event creation on save:

1. **Every property change creates an event.** Date changes, type changes, status changes, metric changes — ALL of them.
2. **Every event MUST set both `date` AND `startDate`.** EventCard uses `startDate || date || ''`. If `startDate` is missing, the date column will be blank.
3. **Every event MUST set `anchorType` and `anchorId`** to link back to the source entity (person, partnership, emotional line, etc.).
4. **Every event MUST set `eventClass`** to identify which entity type created it.
5. **Every event MUST set `createdAt: Date.now()`** for sort stability.
6. **Partnership events get cloned to both partners** via `appendEventsToPerson()` + `cloneEventForPerson()`.

### Event builder template — follow this EXACTLY for every new builder:

```typescript
const buildSomeEvent = (...): EmotionalProcessEvent => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: createEventId(),
    date: dateValue || today,
    startDate: dateValue || today,        // ← ALWAYS set both
    category: '...',
    eventType: '...' as const,
    anchorType: '...' as const,           // ← ALWAYS link back
    anchorId: entity.id,                  // ← ALWAYS link back
    status: 'discrete' as const,
    subtype: '...',                       // ← ALWAYS provide meaningful subtype
    intensity: 0,
    frequency: 0,
    impact: 0,
    howWell: DEFAULT_HOW_WELL,
    otherPersonName: '...',
    primaryPersonName: '...',
    wwwwh: DEFAULT_OBSERVATION,
    observations: DEFAULT_OBSERVATION,
    eventClass: '...' as const,           // ← ALWAYS set
    createdAt: Date.now(),                // ← ALWAYS set
  };
};
```

### Existing event builders in PropertiesPanel.tsx:

- `buildPersonDateEvent` — person date field changes (birth, death, gender date)
- `buildPersonIdentityEvent` — person birth sex / gender identity changes
- `buildPartnershipEvent` — partnership status date changes
- `buildEmotionalLineEvent` — emotional pattern date changes
- `buildEmotionalPatternMeasurementEvent` — emotional pattern metric changes (intensity/frequency/impact)

### Common bugs to NEVER repeat:

- **Missing `startDate`** — causes blank date on EventCard. ALWAYS set both `date` and `startDate`.
- **Wrong `eventType`** — emotional pattern events use `'EPE'`, NOT `'NODAL'`. Match the entity type.
- **Missing `anchorType`/`anchorId`** — breaks event filtering by entity. ALWAYS link back.
- **Missing `subtype`** — causes blank space on EventCard. ALWAYS provide descriptive text.
- **Not creating event for type/status changes** — ONLY creating events for date changes. ALL property changes need events.

---

## Intensity Fields — TWO Different Things (NEVER confuse)

There are TWO unrelated "intensity" concepts:

1. **`event.intensity`** (on `EmotionalProcessEvent`) — the user-facing "Intensity Level" rating (1-5 scale, 0 = unset). Displayed in the EventCard badge box. When 0, shows "—".

2. **`intensityLevel`** (on emotional line drafts in `diagramEditor.ts`) — controls the **graphic rendering** of the emotional line on the canvas (line thickness/style). This is NOT the same as event intensity.

**NEVER confuse these.** When displaying event intensity on EventCard, use `event.intensity`. When configuring line appearance, use `intensityLevel` / `intensityValueForLineStyle()`.

---

## AI Agent — Person Entity with Hexagon Shape

An **AI Agent** is a Person entity with `birthSex: 'ai-agent'` that renders as a **lavender hexagon** (`#C5B3E6`) on the canvas. It has all the same properties, events, relationships, and emotional patterns as a regular Person.

### Key implementation details:
- **BirthSex type:** `'female' | 'male' | 'intersex' | 'ai-agent'`
- **GenderSymbol:** `'ai_agent'`
- **Shape:** Flat-top hexagon rendered via Konva `Line` with 6 computed points (in `PersonNode.tsx`)
- **No split shape:** AI agents always render as a single hexagon (no gender-split rendering)
- **Context menu:** "Add AI Agent" in the stage right-click menu (via `useContextMenuHandlers.ts`)
- **Auto-naming:** "AI Agent", "AI Agent 2", etc. (via `addAIAgent()` in `usePersonOperations.ts`)
- **PersonNameSection:** Shows "Agent Name" label with "?" help text instead of "First Name"; hides "Maiden Name"
- **PersonDatesSection:** "AI Agent" option in Birth Sex dropdown

### When adding new Person-related features:
- Always check if the feature needs special handling for AI agents (e.g., hiding irrelevant fields like maiden name, adoption)
- The `birthSex === 'ai-agent'` check is the canonical way to detect AI agents
- `defaultGenderIdentityForBirthSex('ai-agent')` returns `'nonbinary'`

---

## Papero Assessment — Family Unit Response to Challenge Framework

The **Papero Assessment** (adapted from Dr Dan Papero) is an assessment framework stored on Person entities. It appears in a dedicated **"Papero" tab** in the PropertiesPanel.

### Data model:
- **Event type:** `'PAPERO'` (added to `EventType` union)
- **Storage:** `Person.paperoScores` object (`PaperoScores` type in `types/index.ts`) with 16 numeric fields (0 = unset, 1-5 = level)
- **Component:** `PersonPaperoSection.tsx` — renders all categories and topics with Level dropdowns

### 5 Categories with 16 Topics:

| Category | Topics | Score keys |
|----------|--------|------------|
| **Resourceful** (Avoidance ↔ Engagement) | Engagement with Issue, Problem Solving Activity, Family Awareness of Role, Locus of Control, Leadership | `resourceful_*` |
| **Connectedness & Integration** (Cutoff ↔ Many Open Relationships) | Extended Family Contact, Knowledge of Situations, Relationship Quality, Openness & Tolerance | `connectedness_*` |
| **Tension Management** (Unmanaged ↔ Well Regulated) | Anxiety Containment, Perceptual Framework | `tension_*` |
| **Systems Thinking** (Conventional ↔ Systems) | Fundamental Questions, Family's Focus, Locus of Change | `systems_*` |
| **Goal Structure** (No Clear Goals ↔ SMART Goals) | Achievement Goals, Process Goals | `goals_*` |

### UI pattern:
- Each topic has a **"Level" dropdown** (1-5) and a **"?" help button**
- Clicking "?" opens a dialog showing all 5 levels with detailed descriptions (same pattern as FOO/Symptom scales)
- Clicking a level in the help dialog sets the score and closes the dialog
- Category averages are displayed in the category header
- Scales are defined in `eventConstants.ts` as `PAPERO_SCALES` with `PAPERO_SUBTYPE_TO_KEY` mapping to `PaperoScores` fields

### When modifying Papero:
- All scale definitions are in `constants/eventConstants.ts` — never hardcode level labels
- The `PAPERO_SUBTYPE_TO_KEY` map connects subtype names to `PaperoScores` field keys
- Scores save immediately on selection (no Save button needed) via `onUpdatePerson`

---

## Self in Relationship (SIR) — Configurable Assessment Framework

The **Self in Relationship (SIR)** tab tracks how a person manages themselves in relationship interactions. It appears in a dedicated **"Self in Rel."** tab in the PropertiesPanel for Person entities.

### Data model:
- **Event type:** `'SIR'` (added to `EventType` union)
- **Storage:** `Person.events[]` as `EmotionalProcessEvent` records with `eventType: 'SIR'`
- **Field mapping:** `intensity` = Event Intensity (1-5), `frequency` = Stress Level (1-5), `howWell` = HWDID score (1-5), `subtype` = behavior description, `otherPersonName` = other person, `category` = SIR category name, `observations` = notes
- **Component:** `PersonSIRSection.tsx` — renders entry cards and inline add/edit form

### Configurable Categories:
- Categories are stored in `ApplicationSettings.sirCategories` and `DefaultDiagramState.sirCategories`
- Type: `SIRCategoryDefinition` with `id`, `name`, `levels: [string, string, string, string, string]`
- Each category has a name and 5-level HWDID (How Well Did I Do) scale descriptions
- Categories are configurable via **Settings > Self in Relationship Categories** (opens `SIRSettingsModal`)

### Default 6 categories:
| Category | Low (1) | High (5) |
|----------|---------|----------|
| Resource to Other | Reactive, Unhelpful | Neutral, Helpful |
| Managing Reactivity | High Reactivity | Calm, Grounded |
| Defining Self | Undefined, Fused | Clear, Differentiated |
| Detriangulating | Fully Triangulated | Fully Detriangulated |
| Emotional Contact | Cutoff, Avoidant | Open, Connected |
| Systems Perspective | Blaming, Linear | Systems View |

### UI pattern:
- Inline form with Date, With (person select), Category (dropdown), Behavior (text), Intensity (1-5), Stress (1-5), HWDID (1-5 with ? help), Notes
- HWDID ? button opens a dialog showing all 5 level descriptions; clicking a level sets the score
- Entry cards show date, category, other person, and color-coded badges for Intensity/Stress/HWDID
- Every card has Edit and Delete buttons
- Settings modal (`SIRSettingsModal`) allows Create/Edit/Delete of categories with inline editing

### When modifying SIR:
- Category definitions come from `ApplicationSettings.sirCategories` — never hardcode category names
- `SIRCategoryDefinition` type is in `types/index.ts`
- Categories flow: `DiagramEditor` state → `DiagramCanvas` → `PropertiesPanel` → `PersonSIRSection`
- Settings flow: `DiagramEditor` → `DiagramModals` → `SIRSettingsModal`
- `AppRibbon` has the Settings menu item that opens SIR settings

---

## EventCard — Universal Card Pattern (HIGH PRIORITY)

**EventCard.tsx is the SINGLE component for rendering event/symptom/pattern records everywhere.** There are exactly 5 call sites. When touching ANY of them, you MUST check ALL of them.

### The 5 EventCard call sites:

1. **Events tab** — `EventsSection.tsx:144` via `PropertiesPanel.tsx`
   - Data: `EmotionalProcessEvent[]` from `getEvents()`
   - Props: `date` from `startDate||date`, `type` from `EVENT_TYPE_LABELS[inferEventType()]`, `category` from `normalizeCategory()`, `subtype` from `symptomType||subtype`

2. **Symptoms tab** — `PropertiesPanel.tsx` (Symptoms section)
   - Data: `symptomRows[]` derived from person indicators + SYMPTOM events
   - Props: `date` from sourceEvent, `type="Symptom"`, `category` via `toTitleCase()`, `subtype` from `symptom.type`, `leftBorderColor` per category (physical=#1f77b4, emotional=#d81b60, social=#2e7d32)

3. **Patterns tab** — `PropertiesPanel.tsx` (Patterns section)
   - Data: `allEmotionalLines[]` filtered by person
   - Props: `date` from `el.startDate`, `type="Emotional Pattern"`, `category` from `typeLabels[el.relationshipType]`, `subtype` from `"with ${otherName}"`, `leftBorderColor` from `el.color`

4. **Family view (Triangles/Stressors/Events tabs)** — `PropertiesPanel.tsx` via `renderFamilyEventCard()`
   - Data: `familyPartnership.familyEvents[]`
   - Props: `date` from `startDate||date`, `type` from `EVENT_TYPE_LABELS`, `category`, `subtype`

5. **Session Events** — `modals/SessionEventModal.tsx`
   - Data: events from session capture import flow
   - Props: similar to Events tab pattern

### EventCard invariants:

- **Every EventCard MUST have both onEdit and onDelete.** No exceptions. Every row must show the pencil ✏️ and trash 🗑 icons. If the data source doesn't support delete natively, add a delete path (e.g., `deleteIndicatorOnly` for legacy indicator rows without a backing event).
- **Every row MUST show a date.** If the source record has no date, show today's date or "—" — never leave blank.
- **`intensity` display:** Shows the number when > 0, shows "—" when 0 or null. This is the event's intensity level (1-based), NOT the graphic intensity.

### Rules for EventCard changes:

- **ANY visual change** to EventCard.tsx affects all 5 sites — verify all look correct
- **ANY change to how props are computed** at one call site — check if the other sites need the same fix
- Common bugs: inconsistent `date` field (some use `startDate`, some `date`, some `startDate||date`) — always use `startDate || date || ''`
- Common bugs: inconsistent `category` normalization — Events tab uses `normalizeCategory()`, Symptoms tab uses `toTitleCase()`, Family view uses raw `ev.category`. These SHOULD all use the same normalization.
- Common bugs: inconsistent `subtype` — Events tab checks `symptomType||subtype`, other tabs use different fields. Must match the data source.
- **When adding a new field to EventCard** — add it to the EventCardProps interface AND update all 5 call sites

---

## Notes System — Same Pattern for Every Object

Every canvas object that supports notes follows an **identical pattern**. When implementing or changing notes for any object, apply the same pattern to ALL objects.

### Fields on each type (in `types/index.ts`):

| Object | Note fields | Special case |
|--------|-------------|--------------|
| Person | `notes`, `notesEnabled`, `notesPosition`, `notesSize` | — |
| Partnership (PRL) | `notes`, `notesEnabled`, `notesPosition`, `notesSize` | PRL note only |
| Partnership (Family) | `familyNotes`, `familyNotesEnabled`, `familyNotesPosition`, `familyNotesSize` | Separate from PRL note; same Partnership object |
| EmotionalLine | `notes`, `notesEnabled`, `notesPosition`, `notesSize` | — |
| Triangle | `notes`, `notesEnabled`, `notesPosition`, `notesSize` | — |

**Why Partnership has two note sets:** the Partnership object serves as both the PRL (relationship line) and the Family. They are independently togglable.

### Right-click context menu labels (standardized — NEVER deviate):

All objects use this exact pattern:
```typescript
label: obj.notes ? (obj.notesEnabled ? 'Hide Note' : 'Show Note') : 'No Note'
onClick: () => { if (!obj.notes) return; update(id, { notesEnabled: !obj.notesEnabled }); }
```

Partnership has two entries (PRL and Family):
- "Hide PRL Note" / "Show PRL Note" / "No PRL Note"
- "Hide Family Note" / "Show Family Note" / "No Family Note"

### Properties panel — where notes textarea lives:

- **Person** — `PersonNameSection` (Name sub-tab) with inline `notesEnabled` checkbox
- **PRL** — `PartnershipPropertiesSection` (main section)
- **Family** — `PropertiesPanel` Family tab, "Family" sub-tab, Notes label + Save/Cancel buttons
- **EPL** — `EPLPropertiesSection` main section
- **Triangle** — `EPLPropertiesSection` inside the `{triangleId && ...}` block (Triangle Notes label)

### Canvas NoteNode rendering (`DiagramCanvas.tsx`):

Every NoteNode uses `shouldShow*Note()` from `noteVisibility.ts` to gate visibility. Anchor points:
- Person → person's `(x, y)`
- PRL → `((p1.x+p2.x)/2, horizontalConnectorY)`
- Family → same as PRL anchor, offset `+60y`
- EPL → `((p1.x+p2.x)/2, (p1.y+p2.y)/2)`
- Triangle → centroid `((p1.x+p2.x+p3.x)/3, (p1.y+p2.y+p3.y)/3)`

### Visibility logic (`noteVisibility.ts`):

All functions follow this identical rule:
- Returns `false` if no notes text
- Returns `false` if `notesEnabled === false` (explicitly hidden)
- Returns `true` if `notesEnabled === true` OR `notesLayerEnabled === true`
- Person additionally returns `true` on hover (`hoveredPersonId === person.id`)

### Drag/resize handlers (`useCanvasDragHandlers.ts`):

Each note type has `handle{Type}NoteDragEnd` and `handle{Type}NoteResizeEnd` updating the matching `*Position` and `*Size` fields respectively. For Family: `handleFamilyNoteDragEnd` / `handleFamilyNoteResizeEnd`.

---

## Properties Panel — Field Visibility Rules

### Partnership panel — fields depend on `relationshipType`:

Only `'married'` shows:
- Married Date field
- "Married" in Status dropdown

All relationship types show:
- Type dropdown (married, friendship, dating, living_together, engaged, affair, common_law)
- Status dropdown (but options vary by type — married gets "Married/Separated/Divorced", others get "Started/Ongoing/Ended")
- Notes

**When changing relationship type, hide/show fields accordingly.** Never show "Married Date" for non-marriage types.

### Person panel — conditional fields:

- `adoptionDate` only visible when person is adopted
- `deathDate` only visible when person is deceased (or can be set to mark as deceased)
- `genderDate` only visible when genderIdentity differs from birthSex

---

## Functional Facts (FF) — Configurable Per-Person Event Categories

The **Functional Facts** feature allows users to define custom event categories for recording discrete observations about a person's functioning. Unlike other event types with fixed categories, FF categories are fully user-configurable via Settings.

### Data model:
- **Event type:** `'FF'` (added to `EventType` union)
- **Storage:** `Person.events[]` as `EmotionalProcessEvent` records with `eventType: 'FF'`
- **Category source:** `ApplicationSettings.functionalFactCategories` / `DefaultDiagramState.functionalFactCategories`
- **Type:** `FunctionalFactCategoryDefinition` — `{ id: string; name: string }` (simple name-only, no 5-level scale)

### UI architecture:
- **Settings:** Settings > Functional Fact Categories opens `FunctionalFactSettingsModal` for CRUD
- **Context menu:** Right-click person > Add > Functional Fact > [Category] — submenu dynamically built from configured categories; only appears when at least one category exists
- **EventModal:** When `eventType === 'FF'`, category dropdown shows user-configured categories (via `functionalFactCategoryNames` prop) instead of the empty `EVENT_CATEGORIES.FF` static array
- **Events tab:** FF events appear in the person's Events tab with type label "Functional Fact"

### When modifying Functional Facts:
- Category definitions come from `ApplicationSettings.functionalFactCategories` — never hardcode category names
- Categories flow: `DiagramEditor` state → `DiagramCanvas` → `PropertiesPanel` → `EventModal`
- Context menu flow: `DiagramEditor` → `useContextMenuHandlers` (receives `functionalFactCategories` dep)
- Settings flow: `DiagramEditor` → `AppRibbon` (settings menu) → `DiagramModals` → `FunctionalFactSettingsModal`
- `EVENT_CATEGORIES.FF = []` by design — categories are dynamic, not static
- `buildDiagramPayload` includes `functionalFactCategories` for file save
- `replaceDiagramState` restores `functionalFactCategories` from loaded file data

---

## Prediction Sets — Diagram-Level Hypothesis Tracking

The **Prediction Sets** feature allows users to create named sets of If→Then predictions at the diagram level. Each diagram can have multiple prediction sets (e.g., one per person, relationship, or clinical theme). Accessed via **Options → Predictions** in the AppRibbon.

### Data model:
- **Storage:** `DiagramEditor` state `predictionSets: PredictionSet[]`, persisted to localStorage key `'predictions'` and saved in diagram JSON as `predictionSets`
- **Types** (all in `types/index.ts`):
  - `PredictionSet` — `{ id, name, createdDate, predictions: Prediction[] }`
  - `Prediction` — `{ id, title, status, createdDate, resolvedDate?, conditions, outcomes, notes }`
  - `PredictionCondition` — `{ id, type, personId?, description, linkedPaperoKey?, linkedSIRCategory?, linkedEventId?, evidence[] }`
  - `PredictionOutcome` — `{ id, description, personIds[], evidence[] }`
  - `PredictionEvidence` — `{ id, date, type, sourceId?, measurement?, direction, notes }`
- **Condition types:** `'sir' | 'papero' | 'custom'` — SIR and Papero conditions link to existing assessment data
- **Prediction statuses:** `'active' | 'supported' | 'unsupported' | 'revised'`
- **Evidence directions:** `'supports' | 'contradicts' | 'neutral'`

### UI architecture (PredictionsPanel.tsx):
- **Two-view panel:** Set List view (create/rename/delete sets) → Active Set view (predictions within a set)
- **Set List view:** Name input + Create button, list of sets with rename/delete, click to open
- **Active Set view:** Back button, + New prediction, prediction cards with expand/collapse
- **Prediction card (expanded):** Title, status badges, IF (Conditions) section, THEN (Outcomes) section, evidence rows, notes
- **SIR Condition Linker:** When condition type is `'sir'` + person selected → shows SIR Category dropdown + list of existing SIR events for linking via `linkedEventId`
- **Papero Condition Linker:** When condition type is `'papero'` + person selected → shows Papero Topic dropdown + current score display via `linkedPaperoKey`

### Hook (usePredictionHandlers.ts):
- Deps: `{ predictionSets, setPredictionSets }`
- Returns: `{ predictionSets, addSet, renameSet, deleteSet, addPrediction, updatePrediction, deletePrediction, resolvePrediction, addCondition, updateCondition, removeCondition, addOutcome, updateOutcome, removeOutcome, addEvidence, removeEvidence }`
- All prediction/condition/outcome/evidence CRUD ops take `setId` as first parameter
- Uses `updatePredInSet` internal helper for immutable nested updates

### When modifying Predictions:
- All CRUD operations are set-scoped — always pass `setId` first
- PredictionsPanel callbacks all include `setId` in their signatures
- Prediction data is diagram-level (not per-person) — stored alongside people, partnerships, etc.
- localStorage persistence fires on every `predictionSets` change via `useEffect`
- `buildDiagramPayload` includes `predictionSets` for file save
- `DiagramImportData` in `diagramEditor.ts` includes `predictionSets` for import

---

## Code Patterns — Follow These Exactly

### Hook Pattern (all hooks in `src/frontend/src/hooks/`)

Every hook MUST follow this structure:

```typescript
// 1. Type imports first
import type { Dispatch, SetStateAction } from 'react';
import type { Person, Partnership } from '../types';

// 2. Deps interface — named Use<HookName>Deps or Use<HookName>Props
interface UseMyHookDeps {
  // State data (read-only values)
  people: Person[];
  partnerships: Partnership[];
  // State setters
  setPeople: Dispatch<SetStateAction<Person[]>>;
  // Passed functions from parent or other hooks
  focusItem: (id: string) => void;
}

// 3. Named export, destructure deps inline
export function useMyHook({
  people,
  partnerships,
  setPeople,
  focusItem,
}: UseMyHookDeps) {
  // Implementation — return object of handler functions
}
```

**Key rules:**
- Deps are organized: State Data → State Setters → Passed Functions
- Always named exports (never default)
- Use `nanoid()` for all new entity IDs
- Standard setters use `Dispatch<SetStateAction<T>>`
- Alignment/batched setters use `(updater: (prev: T) => T) => void`

### Component/Modal Pattern

Every component MUST follow this structure:

```typescript
// Props interface at top of file
interface MyModalProps {
  draft: SomeType | null;
  open: boolean;
  // Callbacks — components NEVER mutate state directly
  onChange: (field: keyof SomeType, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function MyModal({ draft, open, onChange, onSave, onCancel }: MyModalProps) {
  // Early return for closed state
  if (!open || !draft) return null;

  // Local UI state only (e.g., tooltip open) — never domain data
  const [tooltipOpen, setTooltipOpen] = useState(false);

  // Render — inline styles (no CSS files)
}
```

**Key rules:**
- Components are READ-ONLY — all mutations go through callbacks to parent
- Parent pre-computes options (e.g., `primaryPersonOptions` array) — components don't derive data
- DiagramEditor.tsx is the single coordinator: state lives there, flows down via props
- Inline styles with `React.CSSProperties` — no CSS files

### Event System Pattern

The event hierarchy is strict and centralized in `constants/eventConstants.ts`:

```
EventType → EVENT_CATEGORIES[type] → string[] of valid categories
EventType → EVENT_SUBTYPES[type]?.[category] → string[] of valid subtypes (only FAMILY, TRIANGLE)
EventType → EVENT_TYPE_HAS_PERSONS[type] → boolean (show person fields?)
EventType → EVENT_TYPE_HAS_SUBTYPE[type] → boolean (show subtype dropdown?)
EventType → getIntensityScale(type, category?, subtype?) → correct scale
```

**The 10 event types:** SYMPTOM, EPE, NODAL, EA, FAMILY, FOO, TRIANGLE, PAPERO, SIR, FF

**When touching any event-related code:**
1. Read `eventConstants.ts` first
2. Use the lookup maps — never hardcode category lists or subtype lists
3. Auto-correct invalid category/subtype combos on mount (see EventModal.tsx pattern)
4. Test every event type variant

### Utility Pattern (`src/frontend/src/utils/`)

- All utils are **pure functions** — no side effects, no state
- Always return new objects (immutable transforms)
- Co-locate tests: `foo.ts` → `foo.test.ts`
- Import types from `../types`, constants from `../constants/`

### Type Locations

- **Domain model:** `src/frontend/src/types/index.ts` — Person, Partnership, EmotionalLine, Triangle, EmotionalProcessEvent, EventType, PaperoScores, BirthSex (incl. `'ai-agent'`), GenderSymbol (incl. `'ai_agent'`), Prediction, PredictionSet, PredictionCondition, PredictionOutcome, PredictionEvidence, FunctionalFactCategoryDefinition
- **UI/editor types:** `src/frontend/src/types/diagramEditor.ts` — PropertiesPanelIntent, SessionNoteFileRecord, drafts, import/export, DiagramImportData (incl. `predictionSets`)
- **Event constants:** `src/frontend/src/constants/eventConstants.ts` — all event hierarchy lookups, PAPERO_SCALES, PAPERO_SUBTYPE_TO_KEY
- **Indicator scales:** `src/frontend/src/constants/functionalIndicatorScales.ts` — frequency/intensity/impact ratings

---

## Consistency Protocol — THE MOST IMPORTANT SECTION

**The #1 source of bugs in this codebase is fixing something in one place and not fixing it in all similar places.** Follow this protocol EVERY time:

### Before writing ANY code:

1. **Search first:** Use grep/glob to find ALL files using the same pattern
2. **List them:** Note every file that needs the same change
3. **Read all of them:** Understand each variant before changing any
4. **Apply everywhere:** Make the change in ALL locations, not just the one the user pointed to
5. **Verify:** Run `tsc --noEmit` and `vitest run` to catch anything missed

### Critical cross-check lists:

**Save handlers** — if you change how ANY save creates events, check ALL saves:
- `savePersonProperties()` — person tab save
- `savePartnershipProperties()` — partnership tab save
- `saveEmotionalLineProperties()` — emotional pattern tab save
- Family event save handlers
- All `build*Event()` functions — they MUST all follow the same template

**EventCard rendering** — if you change any EventCard call site, check all 5:
- `EventsSection.tsx` (Events tab)
- `PropertiesPanel.tsx` Symptoms section
- `PropertiesPanel.tsx` Patterns section
- `PropertiesPanel.tsx` Family `renderFamilyEventCard()`
- `EventCard.tsx` (the component itself)

**Event modal/form** — if you change event editing, check all of:
- `EventModal.tsx`
- `SessionEventModal.tsx`
- `EventsSection.tsx`
- `PropertiesPanel.tsx` (openNewEvent, openEditEvent, saveEvent)
- `EventCard.tsx` (onEdit/onDelete callbacks)

**Event constants** — if you change `eventConstants.ts`, check all consumers:
- `EventModal.tsx`
- `EventsSection.tsx`
- `SessionEventModal.tsx`
- `PropertiesPanel.tsx`
- `EventCard.tsx`

**onEdit/onDelete** — if you add or change edit/delete on one card, check ALL cards:
- Every EventCard MUST have both `onEdit` AND `onDelete`
- No exceptions — even legacy indicator rows need a delete path

---

## Testing Policy

**Write tests whenever you touch UI logic or data transformation.** Do not wait to be asked.

### When tests are required:
- Any new component with conditional rendering, filtering, or field visibility logic
- Any data normalization or migration function (`dataNormalization.ts`, etc.)
- Any modal/form: verify each field type renders correctly for every relevant input variant
- Any bug fix — add a regression test that would have caught the bug before it reached production
- Any event builder function — verify it sets all required fields (date, startDate, anchorType, anchorId, eventClass, createdAt, subtype)

### What to test in forms/modals:
- Every event type shows the correct category options
- Every event type shows the correct subtype field (dropdown vs text input)
- Auto-correction fires on mount when stale/invalid data is present
- Field visibility toggles (e.g. person fields hidden for FAMILY, shown for NODAL)
- Save/Cancel callbacks fire correctly
- Save creates the correct event record with all required fields

### Test file conventions:
- Co-locate with the component: `Foo.tsx` → `Foo.test.tsx`
- Use `@testing-library/react` + `vitest`
- Run before every commit: `cd src/frontend && npx vitest run`

### Existing test files:
**Component tests:**
- `EventModal.test.tsx` — all 10 event types (incl. PAPERO, SIR, FF), subtype dropdown, category auto-correct, lockEventType, modalTitle (click-path breadcrumb), FF configurable categories
- `EventCard.test.tsx` — event card rendering
- `PropertiesPanel.test.tsx` — person/partnership/emotional-line tabs, symptom bars, seeded event modals, triangle notes, family notes, Add Pattern from Patterns tab
- `MultiPersonPropertiesPanel.test.tsx` — multi-select panel
- `SessionNotesPanel.test.tsx` — session notes workspace
- `DiagramEditor.test.tsx` — top-level orchestration, file load, demo tour, context menu (Add AI Agent)
- `DiagramCanvas.tsx` related: `PartnershipNode.test.tsx`, `PersonNode.test.tsx` (incl. AI agent hexagon), `TriangleNode.test.tsx`, `EmotionalLineNode.test.tsx`, `EmotionalLineNode.regression.test.tsx`, `ChildConnection.test.tsx`, `NoteNode.test.tsx`, `SiblingConflictOverlay.test.tsx`
- `sections/PersonPaperoSection.test.tsx` — Papero Assessment: 5 categories, 16 topics, Level dropdowns, help dialogs, score updates, category averages
- `sections/PersonSIRSection.test.tsx` — Self in Relationship: entry cards, add/edit/delete, HWDID help dialog, form fields, event filtering
- `PredictionsPanel.test.tsx` — Prediction Sets: set CRUD, two-view navigation, prediction cards, conditions (SIR/Papero/Custom), outcomes, evidence, SIR/Papero linking

**Utility tests (co-located in `utils/`):**
- `dataCleanup.test.ts`, `noteVisibility.test.ts` (all 5 object types incl. Triangle + Family), `personEventBundle.test.ts`, `saveButtonState.test.ts`, `siblingPosition.test.ts`, `voiceCommands.test.ts`, `dateFormatting.test.ts`

**Reusable component tests:**
- `DatePickerField.test.tsx` — partial date expansion, calendar picker toggle, disabled state

**Data tests:**
- `defaultDiagramState.test.ts`

---

## Modal Viewport Safety Rules

**Every modal/dialog MUST stay within the browser viewport.** These rules apply to all existing modals and any new ones.

### Fixed positioning pattern (DO NOT deviate from this)

All modals use `position: fixed` directly on the dialog element — never `position: absolute` inside a flex backdrop. The two valid centering strategies:

**Centered modal** (no `position` prop):
```typescript
style={{
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  maxHeight: `calc(100vh - ${MODAL_MARGIN * 2}px)`,
  overflowY: 'auto',
}}
```

**Positioned modal** (opened near a canvas object, has `position` prop):
```typescript
// Clamp top/left so dialog never escapes the viewport
const dialogTop = Math.max(MARGIN, Math.min(rawTop, vh - MIN_HEIGHT - MARGIN));
const dialogLeft = Math.max(MARGIN, Math.min(rawLeft, vw - MODAL_WIDTH - MARGIN));
const dialogMaxHeight = Math.max(MIN_HEIGHT, vh - dialogTop - MARGIN);
style={{
  position: 'fixed',
  top: dialogTop,
  left: dialogLeft,
  maxHeight: dialogMaxHeight,
  overflowY: 'auto',
}}
```

**Backdrop** is a separate sibling div (`position: fixed; inset: 0; pointerEvents: none`) — never the parent.

### Why not `position: absolute` inside a flex backdrop

Browsers render `position: absolute` inside `position: fixed` with `alignItems: stretch/center` inconsistently — the dialog can extend below the viewport. Always use `position: fixed` on the dialog itself.

### ContextMenu viewport safety

`ContextMenu.tsx` clamps root position with `useLayoutEffect` (not `useEffect` — no flash). `SubMenuContainer` also uses `useLayoutEffect` to shift up when bottom overflow is detected.

**NEVER add `overflowY: auto` or `maxHeight` to `SubMenuContainer`** — it clips absolutely-positioned grandchildren (third-level submenus).

The root menu uses `visibility: hidden` until position is computed to prevent flash at unclamped coordinates.

---

## Context Menu Click-Path Titles (modalTitle)

Every "Add Event..." context menu item passes a breadcrumb string as `modalTitle` to the EventModal so users see the full action path in the dialog header.

### The pipeline

```
useContextMenuHandlers / useSelectionHandlers
  → openContextualEventCreator(target, item, seed, position, modalTitle)
    → focusItemInPropertiesPanel(item, { ..., newEventModalTitle: modalTitle })
      → setPropertiesPanelIntent({ ..., newEventModalTitle })
        → DiagramCanvas → PropertiesPanel
          → <EventModal modalTitle={newEventModalTitle} />
```

For **Family events** the path is different — `openFamilyPropertyModal` carries `modalTitle` directly to `familyPropertyModal` state, then passed as `modalTitle` to the EventModal.

### Title format convention

```
"<ObjectType> Add <Category> <Subtype>"   e.g. "Person Add Symptom Emotional"
"<ObjectType> Add <Category>"             e.g. "Person Add Emotional Autonomy"
"<ObjectType> Add <MenuGroup> <Label>"    e.g. "Family Triangles Functioning"
```

When no title is supplied, EventModal defaults to `"Event"`.

### Where titles are set

- **Person context menu** — `useContextMenuHandlers.ts`: "Person Add Event", "Person Add Symptom {group}", "Person Add Emotional Autonomy", "Person Add FoO Extended FoO", "Person Add FoO FoO Triangle", "Person Add Coach Event"
- **Partnership context menu** — `useContextMenuHandlers.ts`: "Partnership Add Relationship Event"
- **Emotional Pattern context menu** — `useSelectionHandlers.ts`: "Emotional Pattern Add Event"
- **Family context menu** — `DiagramEditor.tsx` `makeFamilyItem`: "Family {menuGroup} {label}"

**When adding new context menu items that open EventModal, ALWAYS pass a descriptive `modalTitle`.**

---

## File Operations — New / Save / Save As

All file operations live in `useFileOperations.ts`. The key entry point for naming/saving is `triggerSaveAs`, defined in `DiagramEditor.tsx` and passed down as a dep.

### Save flow

```
handleSave(forcePrompt?)
  → if unnamed (fileName === FALLBACK_FILE_NAME) OR forcePrompt:
      await triggerSaveAs(suggestedName)   ← asks for a name first
  → else:
      saveDiagramToCurrentTarget(...)      ← silently overwrites
```

### triggerSaveAs — two-tier strategy

```
triggerSaveAs(suggestedName)
  → Chrome/Edge: window.showSaveFilePicker  ← native OS dialog (user picks folder + name)
  → Firefox/Safari fallback: openSaveAsDialog  ← in-app name dialog (<SaveAsDialog>)
  → AbortError (user cancelled): no-op
```

`SaveAsDialog` is rendered by `DiagramModals` and lives at `components/modals/SaveAsDialog.tsx`.

### File > New — stale-closure fix

`handleNewFile` resets state then awaits `triggerSaveAs`. Without a ref, the async callback would close over pre-reset state (saving the OLD diagram). The fix:

```typescript
// DiagramEditor.tsx — updated every render
const saveDiagramToCurrentTargetRef = useRef(saveDiagramToCurrentTarget);
saveDiagramToCurrentTargetRef.current = saveDiagramToCurrentTarget;

// triggerSaveAs reads the ref at call-time, never a stale closure
void saveDiagramToCurrentTargetRef.current({ ... });
```

### FALLBACK_FILE_NAME = `'newDiagram'`

Sentinel value in `defaultDiagramState.ts` meaning the diagram has never been saved. Any save of an unnamed diagram routes through `triggerSaveAs`.

---

## Architecture: DiagramEditor.tsx

**Refactoring complete.** Started at ~10,695 lines, now ~3,881 lines. Remaining bulk is legitimate coordinator code (state declarations, lifecycle effects, complex multi-step orchestration) that belongs in the top-level component.

**Pattern used:** Domain logic in `src/frontend/src/hooks/`, JSX sub-components in `src/frontend/src/components/`.

**Data flow:** Unidirectional. State lives in DiagramEditor → flows down via props → mutations bubble up through callbacks → DiagramEditor updates state → re-render.

---

## What Was Extracted

### Hooks (`src/frontend/src/hooks/`):
- `useAutosave` — diagram autosave logic
- `useIndicatorHandlers` — functional indicator/symptom category CRUD
- `useSessionNoteHandlers` — session note file management + event draft handlers
- `usePersonOperations` — addPerson, addCoach, addAIAgent, addParentsForPerson, createChildrenForPartnership, createAdoptedChildForPartnership, removePartnership, removePerson, removeChildFromPartnership, createFamilyFromDraft (bulk-creates two parents + a married Partnership + N children from `AddFamilyDraft`, all sized to 45)
- `useContextMenuHandlers` — handlePersonContextMenu, handleChildLineContextMenu, handlePartnershipContextMenu, handleStageContextMenu
- `useSelectionHandlers` — page note handlers, handleChildLineSelect, handleEmotionalLineSelect, handleTriangleAreaSelect, handleSelect, handlePartnershipSelect
- `useCanvasDragHandlers` — handlePersonDragStart/Drag, handleHorizontalConnectorDragEnd, note drag/resize handlers, addGeneralNote
- `useFileOperations` — file open/save/export, import flow orchestration
- `useVoiceHandlers` — reviewVoiceCommands, applyVoiceCommands, toggleVoiceListening
- `useEmotionalLineOperations` — emotional line + triangle CRUD
- `useUpdateHandlers` — handleUpdatePerson/Partnership/EmotionalLine, focusItemInPropertiesPanel, openContextualEventCreator, client profile + coach thinking modals
- `usePredictionHandlers` — Prediction Set CRUD: addSet, renameSet, deleteSet, plus set-scoped prediction/condition/outcome/evidence CRUD

### Pure utilities (`src/frontend/src/utils/`):
- `emotionalLineNormalization.ts` — normalizeEmotionalLine, normalizeEmotionalLines, buildDefaultTpl, normalizeTriangles
- `emotionalPatternOptions.ts` — intensity labels, line style lookups
- `personGeometry.ts` — node dimension calculations
- `personEventBundle.ts` — event export bundle structures; `PersonEventBundle` and `TimelineJson` types + type guards
- `partnershipUtils.ts` — family name derivation
- `saveButtonState.ts` — save button visual state machine
- `noteVisibility.ts` — note layer visibility predicates
- `siblingPosition.ts` — Toman sibling position analysis (`deriveSiblingPositionResult`, `getSiblingPositionLabel`, `getPositionOptionsForSex`, `parentMatchForRole`, `partnerForPerson`)
- `dataCleanup.ts` — orphaned data removal
- `dataNormalization.ts` — full diagram data migration
- `dataImport.ts` — file parsing and import
- `storage.ts` — localStorage/IndexedDB wrappers
- `dateFormatting.ts` — `expandPartialDate` (expands partial YYYY, YYYY-MM to full ISO date) + date display helpers
- `demoTour.ts` — generates guided demo tour steps from the current diagram state
- `voiceCommands.ts` — parses voice/text input into `VoiceCommandOperation[]` for review and apply

### Components (`src/frontend/src/components/`):
- `AppRibbon.tsx` — full toolbar/ribbon
- `DiagramCanvas.tsx` — Stage + Layer with all Konva nodes, properties panel sidebar
- `DiagramModals.tsx` — all modal/panel components (see full modal list below)
- `EventCard.tsx` — event display card
- `EventsSection.tsx` — events list/filter UI
- `PropertiesPanel.tsx` — per-entity properties editor (person/partnership/EPL/family/papero tabs)
- `EventModal.tsx` — standalone event create/edit dialog
- `SessionNotesPanel.tsx` — session notes workspace (coach/client names, note capture)
- `MultiPersonPropertiesPanel.tsx` — multi-select panel shown when multiple people are selected
- `PredictionsPanel.tsx` — Prediction Sets: two-view UI (Set List + Active Set), If→Then prediction cards with SIR/Papero/Custom conditions, outcomes, and evidence tracking
- `IdeasPanel.tsx` — freeform "Idea Log" scratchpad; text saved with the diagram via `ideasText` state
- `DatePickerField.tsx` — reusable date input; accepts partial dates (YYYY, YYYY-MM) via `expandPartialDate`; has calendar-picker toggle button
- `EventCreator.tsx` — **standalone** timeline JSON editor (rendered at `/creator` route, NOT part of the main diagram flow); loads/saves `TimelineJson` files, supports person lanes + inline event editing
- `ContextMenu.tsx` — viewport-clamped right-click menu with sub-menu support

**Canvas nodes (Konva):**
- `PersonNode.tsx` — circle/square/triangle/hexagon (AI Agent) shapes
- `PartnershipNode.tsx` — horizontal connector + marriage/relationship line
- `EmotionalLineNode.tsx` — emotional pattern lines (fusion, distance, conflict, cutoff, projection, open-connection variants)
- `TriangleNode.tsx` — triangle outline (clickable)
- `TriangleFillNode.tsx` — triangle fill layer (separate Konva node for fill vs stroke)
- `ChildConnection.tsx` — vertical/horizontal child connection lines
- `FamilyCutoffArc.tsx` — renders cutoff arcs on a child connection line; arc count driven by the EPE event intensity (1–4 arcs)
- `NoteNode.tsx` — draggable/resizable note overlay on the canvas
- `SiblingConflictOverlay.tsx` — highlights sibling position conflicts between partners

**Properties panel sections (`sections/`):**
- `PersonNameSection.tsx` — first/last/maiden names; AI Agent shows "Agent Name" + hides maiden name
- `PersonDatesSection.tsx` — birth/death/adoption/gender dates, birth sex dropdown (incl. AI Agent)
- `PersonFormatSection.tsx` — person size (+/- controls) and foreground/border/background color pickers
- `PersonSiblingSection.tsx` — Toman sibling position (three sub-tabs: Override, Position, Compatibility); uses `siblingPosition.ts` utils and `MATURITY_SCALE` from eventConstants
- `PersonPaperoSection.tsx` — Papero Assessment: 5 categories, 16 topics, Level dropdowns with ? help
- `PersonSIRSection.tsx` — Self in Relationship: entry cards, inline add/edit form, HWDID help dialog
- `PersonFOOSection.tsx` — FOO scales: emotional cutoff, family stability, family intactness
- `PartnershipPropertiesSection.tsx` — relationship type, status, dates, notes for PRL
- `EPLPropertiesSection.tsx` — emotional pattern line properties (type, dates, intensity, notes, triangle notes)

**Modals (`modals/`):**
- `SessionCaptureDialog.tsx` — imports processed transcript data (SessionCaptureImportData)
- `SessionEventModal.tsx` — event create/edit within session note context
- `ClientProfileModal.tsx` — presenting issues and desired outcomes for client profile
- `CoachThinkingModal.tsx` — coach's internal notes and conceptualization
- `EmotionalPatternModal.tsx` — create/edit emotional pattern lines (type, persons, dates)
- `AddFamilyModal.tsx` — bulk-create a family unit (Parent 1, Parent 2, family surname, dynamic child rows) from a single form; horizontal field layout per person with M/F sex toggle and partial-date support
- `TimelineBoardModal.tsx` — visual timeline board of events across persons
- `SIRSettingsModal.tsx` — SIR category management: Create/Edit/Delete with 5-level HWDID scales
- `FunctionalFactSettingsModal.tsx` — FF category management: Create/Edit/Delete (name only)
- `NodalCategorySettingsModal.tsx` — Nodal Event category management: Create/Edit/Delete custom Nodal categories that appear alongside the built-in defaults (Birth, Death, Marriage, etc.) in person right-click "Add > Nodal Event" submenus
- `IndicatorSettingsModal.tsx` — configure functional indicator definitions (icon, label, scale)
- `SettingsListModal.tsx` — generic settings list manager (reused for various list settings)
- `ImportModeDialog.tsx` — presents import strategy choices when loading a diagram file
- `SaveAsDialog.tsx` — filename input for "Save As"; strips/re-adds `.json` extension automatically
- `BackupRestoreDialog.tsx` — restore diagram from in-memory backup versions
- `FileBackupListDialog.tsx` — browse and restore file-based backups
- `DemoTourModal.tsx` — guided walkthrough overlay; step index driven by `demoTourStepIndex` state
- `BuildDemoModal.tsx` — interactive tutorial for building a diagram step-by-step
- `TrainingVideosModal.tsx` — embedded YouTube training video viewer
- `HelpModal.tsx` — contextual help content viewer
- `RibbonHelpModal.tsx` — context-sensitive help keyed by `ribbonHelpKey`
- `ReadmeViewerModal.tsx` — renders the application README in-app
- `VoiceInputModal.tsx` — voice command UI: mic toggle, command text, operations preview, apply/clear

### Static data (`src/frontend/src/data/`):
- `defaultDiagramState.ts` — blank diagram starting state
- Demo diagram JSON, help content, training video metadata, functional indicator definitions
