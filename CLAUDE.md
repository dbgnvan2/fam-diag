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

## Domain Model — The 8 Entity Types

The app models family systems using 8 entity types. **Every entity type follows the same patterns for properties, events, and display.** When you implement something for one entity type, you MUST implement it the same way for ALL entity types that share that pattern.

### The 8 entities and their event groups:

| Entity | Panel | Event Group (eventType) | eventClass | category pattern |
|--------|-------|------------------------|------------|-----------------|
| **Person** | Individual Functional Facts | NODAL, SYMPTOM | `'individual'` | `'Individual'` |
| **Partner Relationship** | Partner Relationship Line (PRL) | NODAL | `'relationship'` | `toTitleCase(relationshipType)` |
| **Emotional Pattern** | Emotional Pattern Line (EPL) | EPE | `'emotional-pattern'` | `'Emotional Pattern'` |
| **Family** | Family view | FAMILY | `'family'` | from event |
| **Triangle** | Triangle view | TRIANGLE | `'triangle'` | from event |
| **Family of Origin** | FoO view | FOO | `'foo'` | from event |
| **Emotional Autonomy** | EA view | EA | `'ea'` | from event |
| **Symptom** | Symptoms tab (Person) | SYMPTOM | `'symptom'` | physical/emotional/social |

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

**The 7 event types:** SYMPTOM, EPE, NODAL, EA, FAMILY, FOO, TRIANGLE

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

- **Domain model:** `src/frontend/src/types/index.ts` — Person, Partnership, EmotionalLine, Triangle, EmotionalProcessEvent, EventType
- **UI/editor types:** `src/frontend/src/types/diagramEditor.ts` — PropertiesPanelIntent, SessionNoteFileRecord, drafts, import/export
- **Event constants:** `src/frontend/src/constants/eventConstants.ts` — all event hierarchy lookups
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
- `EventModal.test.tsx` — all 7 event types, subtype dropdown, category auto-correct, lockEventType, modalTitle (click-path breadcrumb)
- `EventCard.test.tsx` — event card rendering
- `PropertiesPanel.test.tsx` — person/partnership/emotional-line tabs, symptom bars, seeded event modals
- `MultiPersonPropertiesPanel.test.tsx` — multi-select panel
- `SessionNotesPanel.test.tsx` — session notes workspace
- `DiagramEditor.test.tsx` — top-level orchestration, file load, demo tour
- `DiagramCanvas.tsx` related: `PartnershipNode.test.tsx`, `PersonNode.test.tsx`, `TriangleNode.test.tsx`, `EmotionalLineNode.test.tsx`, `EmotionalLineNode.regression.test.tsx`, `ChildConnection.test.tsx`, `NoteNode.test.tsx`, `SiblingConflictOverlay.test.tsx`

**Utility tests (co-located in `utils/`):**
- `dataCleanup.test.ts`, `noteVisibility.test.ts`, `personEventBundle.test.ts`, `saveButtonState.test.ts`, `siblingPosition.test.ts`, `voiceCommands.test.ts`

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
- `usePersonOperations` — addPerson, addCoach, addParentsForPerson, createChildrenForPartnership, createAdoptedChildForPartnership, removePartnership, removePerson, removeChildFromPartnership
- `useContextMenuHandlers` — handlePersonContextMenu, handleChildLineContextMenu, handlePartnershipContextMenu, handleStageContextMenu
- `useSelectionHandlers` — page note handlers, handleChildLineSelect, handleEmotionalLineSelect, handleTriangleAreaSelect, handleSelect, handlePartnershipSelect
- `useCanvasDragHandlers` — handlePersonDragStart/Drag, handleHorizontalConnectorDragEnd, note drag/resize handlers, addGeneralNote
- `useFileOperations` — file open/save/export, import flow orchestration
- `useVoiceHandlers` — reviewVoiceCommands, applyVoiceCommands, toggleVoiceListening
- `useEmotionalLineOperations` — emotional line + triangle CRUD
- `useUpdateHandlers` — handleUpdatePerson/Partnership/EmotionalLine, focusItemInPropertiesPanel, openContextualEventCreator, client profile + coach thinking modals

### Pure utilities (`src/frontend/src/utils/`):
- `emotionalLineNormalization.ts` — normalizeEmotionalLine, normalizeEmotionalLines, buildDefaultTpl, normalizeTriangles
- `emotionalPatternOptions.ts` — intensity labels, line style lookups
- `personGeometry.ts` — node dimension calculations
- `personEventBundle.ts` — event export bundle structures
- `partnershipUtils.ts` — family name derivation
- `saveButtonState.ts` — save button visual state machine
- `noteVisibility.ts` — note layer visibility predicates
- `siblingPosition.ts` — Toman sibling position analysis
- `dataCleanup.ts` — orphaned data removal
- `dataNormalization.ts` — full diagram data migration
- `dataImport.ts` — file parsing and import
- `storage.ts` — localStorage/IndexedDB wrappers

### Components (`src/frontend/src/components/`):
- `AppRibbon.tsx` — full toolbar/ribbon
- `DiagramCanvas.tsx` — Stage + Layer with all Konva nodes, properties panel sidebar
- `DiagramModals.tsx` — all 19 modal/panel components
- `EventCard.tsx` — event display card
- `EventsSection.tsx` — events list/filter UI
- `PropertiesPanel.tsx` — per-entity properties editor (person/partnership/EPL/family tabs)
- Canvas nodes: `PersonNode.tsx`, `PartnershipNode.tsx`, `EmotionalLineNode.tsx`, `TriangleNode.tsx`, `ChildConnection.tsx`, `NoteNode.tsx`, `SiblingConflictOverlay.tsx`
- `EventModal.tsx` — standalone event create/edit dialog
- `modals/SessionCaptureDialog.tsx`
- `modals/ClientProfileModal.tsx`
- `modals/CoachThinkingModal.tsx`
- `modals/EmotionalPatternModal.tsx`
- `modals/SessionEventModal.tsx`
- `modals/TimelineBoardModal.tsx`

### Static data (`src/frontend/src/data/`):
- `defaultDiagramState.ts` — blank diagram starting state
- Demo diagram JSON, help content, training video metadata, functional indicator definitions
