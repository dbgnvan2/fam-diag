# Event System

Everything that happens in the app is captured as an `EmotionalProcessEvent`. The event log is the audit trail.

## Domain model — 10 entity types

| Entity | Panel | Event Group (eventType) | eventClass | category pattern |
|--------|-------|------------------------|------------|-----------------|
| Person | Individual Functional Facts | NODAL, SYMPTOM, SIR, FF | `'individual'` | `'Individual'` |
| AI Agent | Same as Person (hexagon shape) | NODAL, SYMPTOM, PAPERO, SIR, FF | `'individual'` | `'Individual'` |
| Partner Relationship | PRL | NODAL | `'relationship'` | `toTitleCase(relationshipType)` |
| Emotional Pattern | EPL | EPE | `'emotional-pattern'` | `'Emotional Pattern'` |
| Family | Family view | FAMILY | `'family'` | from event |
| Triangle | Triangle view | TRIANGLE | `'triangle'` | from event |
| Family of Origin | FoO view | FOO | `'foo'` | from event |
| Emotional Autonomy | EA view | EA | `'ea'` | from event |
| Symptom | Symptoms tab (Person) | SYMPTOM | `'symptom'` | physical/emotional/social |
| Papero Assessment | Papero tab (Person) | PAPERO | `'individual'` | Resourceful/Connectedness/Tension/Systems/Goals |
| Self in Relationship | Self in Rel. tab (Person) | SIR | `'individual'` | Configurable via SIR Settings |
| Functional Fact | Events tab (Person) | FF | `'individual'` | Configurable via FF Settings |

## Where entities store events

- `Person.events[]` — individual events, symptoms, and cloned partnership events (id suffix `-p1` / `-p2`)
- `Partnership.events[]` — relationship events (cloned to both partners)
- `Partnership.familyEvents[]` — family-level events
- `EmotionalLine.events[]` — emotional pattern events
- Triangle events flow through Family events

## Event hierarchy lookups (`constants/eventConstants.ts`)

```
EventType → EVENT_CATEGORIES[type] → string[] of valid categories
EventType → EVENT_SUBTYPES[type]?.[category] → string[] of valid subtypes (only FAMILY, TRIANGLE)
EventType → EVENT_TYPE_HAS_PERSONS[type] → boolean (show person fields?)
EventType → EVENT_TYPE_HAS_SUBTYPE[type] → boolean (show subtype dropdown?)
EventType → getIntensityScale(type, category?, subtype?) → correct scale
```

The 10 event types: SYMPTOM, EPE, NODAL, EA, FAMILY, FOO, TRIANGLE, PAPERO, SIR, FF.

When touching event code: read `eventConstants.ts` first, use the lookup maps, auto-correct invalid category/subtype combos on mount, test every event-type variant.

## Save = Create Event (every Save button creates an event)

Rules:
1. Every property change creates an event — date changes, type changes, status changes, metric changes, all of them.
2. Set both `date` AND `startDate`. EventCard uses `startDate || date || ''` — missing `startDate` causes a blank date column.
3. Set `anchorType` and `anchorId` to link back to the source entity.
4. Set `eventClass` to identify the source entity type.
5. Set `createdAt: Date.now()` for sort stability.
6. Partnership events get cloned to both partners via `appendEventsToPerson()` + `cloneEventForPerson()`.

### Builder template (follow exactly)

```typescript
const buildSomeEvent = (...): EmotionalProcessEvent => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: createEventId(),
    date: dateValue || today,
    startDate: dateValue || today,        // ALWAYS set both
    category: '...',
    eventType: '...' as const,
    anchorType: '...' as const,           // ALWAYS link back
    anchorId: entity.id,                  // ALWAYS link back
    status: 'discrete' as const,
    subtype: '...',                       // ALWAYS provide meaningful subtype
    intensity: 0,
    frequency: 0,
    impact: 0,
    howWell: DEFAULT_HOW_WELL,
    otherPersonName: '...',
    primaryPersonName: '...',
    wwwwh: DEFAULT_OBSERVATION,
    observations: DEFAULT_OBSERVATION,
    eventClass: '...' as const,           // ALWAYS set
    createdAt: Date.now(),                // ALWAYS set
  };
};
```

### Existing builders in `PropertiesPanel.tsx`

- `buildPersonDateEvent` — person date field changes
- `buildPersonIdentityEvent` — birth sex / gender identity changes
- `buildPartnershipEvent` — partnership status date changes
- `buildEmotionalLineEvent` — emotional pattern date changes
- `buildEmotionalPatternMeasurementEvent` — emotional pattern metric changes

### Common bugs to avoid

- Missing `startDate` → blank date on EventCard
- Wrong `eventType` (e.g. emotional pattern events must use `'EPE'`, not `'NODAL'`)
- Missing `anchorType`/`anchorId` → breaks event filtering by entity
- Missing `subtype` → blank space on EventCard
- Only creating events for date changes — type/status changes need events too

## Intensity — two unrelated concepts

1. `event.intensity` on `EmotionalProcessEvent` — user-facing 1-5 Intensity Level (0 = unset → shows "—" in EventCard badge).
2. `intensityLevel` on emotional line drafts in `diagramEditor.ts` — controls graphic rendering of the line on canvas (thickness/style). Use `intensityValueForLineStyle()`.

Never conflate them.

## EventCard — 5 call sites (any change touches all)

1. **Events tab** — `EventsSection.tsx` via `PropertiesPanel.tsx`. Data: `EmotionalProcessEvent[]` from `getEvents()`. Props: `date` from `startDate||date`, `type` from `EVENT_TYPE_LABELS[inferEventType()]`, `category` from `normalizeCategory()`, `subtype` from `symptomType||subtype`.
2. **Symptoms tab** — `PropertiesPanel.tsx`. Data: `symptomRows[]`. Props: `type="Symptom"`, `category` via `toTitleCase()`, `leftBorderColor` per category (physical `#1f77b4`, emotional `#d81b60`, social `#2e7d32`).
3. **Patterns tab** — `PropertiesPanel.tsx`. Data: `allEmotionalLines[]` filtered by person. Props: `type="Emotional Pattern"`, `subtype="with ${otherName}"`, `leftBorderColor` from `el.color`.
4. **Family view** — `PropertiesPanel.tsx` via `renderFamilyEventCard()`. Data: `familyPartnership.familyEvents[]`.
5. **Session Events** — `modals/SessionEventModal.tsx`. Data from session capture import.

### Invariants

- Every EventCard MUST have both `onEdit` and `onDelete`. Even legacy indicator rows need a delete path (e.g. `deleteIndicatorOnly`).
- Every row MUST show a date. Use `startDate || date || ''` — fall back to today or "—", never blank.
- `intensity` display: number when > 0, "—" when 0 or null.

### Known inconsistencies to keep an eye on

- `date` field: some sites used `startDate`, some `date`, some `startDate||date`. Target: `startDate || date || ''`.
- `category` normalization: Events tab uses `normalizeCategory()`, Symptoms tab uses `toTitleCase()`, Family view uses raw `ev.category`. Should converge.
- `subtype` source varies by data shape.

## Date-field synthesis

Three sources of events the user expects to see:
1. Real records in `entity.events[]`
2. Cloned partnership events on `Person.events[]` (id suffix `-p1`/`-p2`)
3. Synthesized phantoms from raw date fields via `utils/syntheticDateEvents.ts` (id prefix `synth-`)

`PropertiesPanel.getDisplayEvents()` and `TimelineBoardModal` both call the synthesizers — they must stay in sync. To surface a new raw date field as an event, update `utils/syntheticDateEvents.ts` only.

## Context menu click-path titles (`modalTitle`)

Every "Add Event…" context menu item passes a breadcrumb to EventModal so the dialog header shows the full action path.

```
useContextMenuHandlers / useSelectionHandlers
  → openContextualEventCreator(target, item, seed, position, modalTitle)
    → focusItemInPropertiesPanel(item, { ..., newEventModalTitle: modalTitle })
      → setPropertiesPanelIntent({ ..., newEventModalTitle })
        → DiagramCanvas → PropertiesPanel
          → <EventModal modalTitle={newEventModalTitle} />
```

Family events go through `openFamilyPropertyModal` instead.

Title format:
```
"<ObjectType> Add <Category> <Subtype>"   e.g. "Person Add Symptom Emotional"
"<ObjectType> Add <Category>"             e.g. "Person Add Emotional Autonomy"
"<ObjectType> Add <MenuGroup> <Label>"    e.g. "Family Triangles Functioning"
```

When omitted, EventModal defaults to `"Event"`. Always pass a descriptive `modalTitle` when adding new context-menu entries that open EventModal.
