# Architecture

React 18 + TypeScript + Konva.js + Vite frontend at `src/frontend/`.

**Data flow:** Unidirectional. State lives in `DiagramEditor.tsx` → flows down via props → mutations bubble up through callbacks → DiagramEditor updates state → re-render.

**Pattern:** Domain logic in `src/frontend/src/hooks/`, JSX sub-components in `src/frontend/src/components/`, pure transforms in `src/frontend/src/utils/`.

## Hook pattern

```typescript
import type { Dispatch, SetStateAction } from 'react';
import type { Person, Partnership } from '../types';

interface UseMyHookDeps {
  // State data (read-only values)
  people: Person[];
  partnerships: Partnership[];
  // State setters
  setPeople: Dispatch<SetStateAction<Person[]>>;
  // Passed functions from parent or other hooks
  focusItem: (id: string) => void;
}

export function useMyHook({ people, partnerships, setPeople, focusItem }: UseMyHookDeps) {
  // Implementation — return object of handler functions
}
```

- Deps organized: State Data → State Setters → Passed Functions
- Named exports only (never default)
- Use `nanoid()` for all new entity IDs
- Standard setters use `Dispatch<SetStateAction<T>>`; batched setters use `(updater: (prev: T) => T) => void`

## Component / Modal pattern

```typescript
interface MyModalProps {
  draft: SomeType | null;
  open: boolean;
  onChange: (field: keyof SomeType, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function MyModal({ draft, open, onChange, onSave, onCancel }: MyModalProps) {
  if (!open || !draft) return null;
  const [tooltipOpen, setTooltipOpen] = useState(false); // local UI state only
}
```

- Components are READ-ONLY — mutations go through callbacks to parent
- Parent pre-computes options (e.g., `primaryPersonOptions` array)
- Inline styles with `React.CSSProperties` — no CSS files

## Utility pattern

- Pure functions — no side effects, no state
- Return new objects (immutable transforms)
- Co-locate tests: `foo.ts` → `foo.test.ts`

## Type locations

- **Domain model:** `src/frontend/src/types/index.ts` — Person, Partnership, EmotionalLine, Triangle, EmotionalProcessEvent, EventType, PaperoScores, BirthSex, GenderSymbol, Prediction*, FunctionalFactCategoryDefinition, SIRCategoryDefinition
- **UI/editor types:** `src/frontend/src/types/diagramEditor.ts` — PropertiesPanelIntent, drafts, DiagramImportData
- **Event constants:** `src/frontend/src/constants/eventConstants.ts` — event hierarchy lookups, PAPERO_SCALES, PAPERO_SUBTYPE_TO_KEY
- **Indicator scales:** `src/frontend/src/constants/functionalIndicatorScales.ts`

## File operations

`useFileOperations.ts` owns open/save/export. `triggerSaveAs` (defined in `DiagramEditor.tsx`) is the naming/saving entry point.

**Save flow:**
```
handleSave(forcePrompt?)
  → if unnamed (fileName === FALLBACK_FILE_NAME) OR forcePrompt:
      await triggerSaveAs(suggestedName)
  → else:
      saveDiagramToCurrentTarget(...)
```

**triggerSaveAs:** Chrome/Edge uses `window.showSaveFilePicker`; Firefox/Safari falls back to in-app `<SaveAsDialog>`.

**Stale-closure fix in handleNewFile:** uses `saveDiagramToCurrentTargetRef` so the async callback after state reset reads current state, not pre-reset state.

`FALLBACK_FILE_NAME = 'newDiagram'` (in `defaultDiagramState.ts`) is the sentinel for "never saved."

## Inventory (rough — verify by reading the code)

Top-level hooks: `useAutosave`, `useIndicatorHandlers`, `useSessionNoteHandlers`, `usePersonOperations`, `useContextMenuHandlers`, `useSelectionHandlers`, `useCanvasDragHandlers`, `useFileOperations`, `useVoiceHandlers`, `useEmotionalLineOperations`, `useUpdateHandlers`, `usePredictionHandlers`.

Top-level components: `AppRibbon`, `DiagramCanvas`, `DiagramModals`, `EventCard`, `EventsSection`, `PropertiesPanel`, `EventModal`, `SessionNotesPanel`, `MultiPersonPropertiesPanel`, `PredictionsPanel`, `IdeasPanel`, `DatePickerField`, `EventCreator` (standalone `/creator` route), `ContextMenu`.

Konva nodes: `PersonNode`, `PartnershipNode`, `EmotionalLineNode`, `TriangleNode`, `TriangleFillNode`, `ChildConnection`, `FamilyCutoffArc`, `NoteNode`, `SiblingConflictOverlay`.

Properties panel sections (`sections/`): `PersonNameSection`, `PersonDatesSection`, `PersonFormatSection`, `PersonSiblingSection`, `PersonPaperoSection`, `PersonSIRSection`, `PersonFOOSection`, `PartnershipPropertiesSection`, `EPLPropertiesSection`.
