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
| Family of Origin | FoO view | FOO | `'individual'` | from event |
| Emotional Autonomy | EA view | EA | `'individual'` | from event |
| Symptom | Symptoms tab (Person) | SYMPTOM | `'individual'` | Physical/Emotional/Social |
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

`eventClass` records what the event is attached to — one of `individual`,
`relationship`, `emotional-pattern`, `family`, `triangle` (the `EventClass`
union in `types/index.ts`). It is set from the owner, not by menu items.

When touching event code: read `eventConstants.ts` first and use the lookup
maps. Every category the app writes itself is listed there. EventModal never
rewrites a category or subtype it does not list — it offers it as an option
(it used to reset it to the first option on open, so Save changed the event);
only a case-only difference is matched to the listed spelling.

## Save = Create Event (every Save button creates an event)

All event editing goes through **`utils/eventDraft.ts`** — the Properties
panel, the Timeline, the canvas triangle/family dialogs and session notes.
Do not write another copy of this logic; the copies drifted (review
2026-09-30, pattern S1).

- `applyEventDraftFieldChange` — one field change from EventModal. Ratings
  become numbers; a date change sets `date` and `startDate` together; a
  symptom's Type (`subtype`) is its name and `symptomType` follows it.
- `normalizeEventForSave` — the complete event: `date` AND `startDate`,
  `anchorType`, `anchorId`, `eventClass`, `createdAt`, numeric ratings.
- `saveEventOnOwner` / `deleteEventFromOwner` — the updates for the entity
  that OWNS the event (`EventOwner`), including date fields (below) and the
  symptom indicator (`syncSymptomIndicator`).
- `buildNewEventDraft` — a new event holds only what its seed gives: **no
  date, no category, no rating** (0 = unset), nothing copied from the
  previous event. Author decision 2026-09-30: a default of today is
  fabrication.

A person's Events tab lists events the person does not own (its
partnerships', family events, its patterns'). Each row carries its owner, and
Edit / Delete act on that owner.

### One event per date field

A date field (birth, death, adoption, gender date; relationship start,
marriage, separation, divorce, other status dates; pattern start/end) has
exactly one event, rendered by `utils/syntheticDateEvents.ts` (`DateSlot`).
Editing that event edits the field; anything else written on it is kept on a
companion event stored under the slot's `synth-…` id, and the date shown is
always the field's. Deleting it clears the date. A stored event whose category
names the slot (a "Death" event on a person's own record) is that slot's event
(author decision 2026-09-30).

### Builders still in `PropertiesPanel.tsx`

- `buildPersonIdentityEvent` — birth sex / gender identity. One per field:
  a change replaces it, "Unknown" removes it; dated from the birth / gender
  date, blank when there is none.
- `buildPaperoScoreEvent` — Papero score change (undated; `createdAt` records entry).
- `buildEmotionalPatternMeasurementEvent` — frequency / impact measurement
  (undated). Its intensity is the last measurement's, never the line style.

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

1. **Events tab rows** — `EventsSection.tsx` (own rows). Data: the Properties panel's `displayRows` (each with its owner). Props: `date` from `startDate||date`, `type` from `EVENT_TYPE_LABELS[inferEventType()]`, `category` from `normalizeCategory()`, `subtype` from `symptomType||subtype`.
2. **Events tab system events** — `EventsSection.tsx` (read-only relatives' events). `readOnly`; `onEdit` opens the event on its owner.
3. **Symptoms tab** — `PropertiesPanel.tsx`. Data: `symptomRows[]`. Props: `type="Symptom"`, `category` via `toTitleCase()`, `leftBorderColor` per category (physical `#1f77b4`, emotional `#d81b60`, social `#2e7d32`).
4. **Patterns tab** — `PropertiesPanel.tsx`. Data: `allEmotionalLines[]` filtered by person. Props: `type="Emotional Pattern"`, `subtype="with ${otherName}"`, `leftBorderColor` from `el.color`.
5. **Family view** — `PropertiesPanel.tsx` via `renderFamilyEventCard()`. Data: `familyPartnership.familyEvents[]`.

`SessionEventModal.tsx` renders no EventCard; it was listed here by mistake.

### Invariants

- Every EventCard MUST have both `onEdit` and `onDelete`. Even legacy indicator rows need a delete path (e.g. `deleteIndicatorOnly`).
- Every row shows its date as `startDate || date || ''`; an undated event shows "—". Never fall back to today.
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

The Properties panel's `displayRows` and `TimelineBoardModal` both call the same synthesizers (date fields and indicator-backed symptoms) and both hide the companions with `withoutDateSlotCompanions` — they must stay in sync. To surface a new raw date field as an event, update `utils/syntheticDateEvents.ts` only.

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
