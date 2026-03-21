# Family Diagram App — Claude Code Instructions

## Running Without Approval Prompts

To run Claude Code CLI without stop/accept points:

```bash
# Option 1: single session flag
claude --dangerously-skip-permissions

# Option 2: set permanently in ~/.claude/settings.json
# { "defaultMode": "bypassPermissions" }
```

## Project Overview

React 18 + TypeScript + Konva.js + Vite frontend at `src/frontend/`.

```bash
# Check for TS errors
cd src/frontend && npx tsc --noEmit

# Run tests
cd src/frontend && npx vitest run

# Start dev server
cd src/frontend && npm run dev
```

**Critical rule:** `noUnusedLocals: true` is enforced — all moved variables/imports must be removed from the origin file.

**Build command for Vercel:** Use `rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` (not `tsc --noEmit`) — Vercel runs incremental build. Always do this before pushing.

---

## Testing Policy

**Write tests whenever you touch UI logic or data transformation.** Do not wait to be asked.

### When tests are required:
- Any new component with conditional rendering, filtering, or field visibility logic
- Any data normalization or migration function (`dataNormalization.ts`, etc.)
- Any modal/form: verify each field type renders correctly for every relevant input variant
- Any bug fix — add a regression test that would have caught the bug before it reached production

### What to test in forms/modals:
- Every event type shows the correct category options
- Every event type shows the correct subtype field (dropdown vs text input)
- Auto-correction fires on mount when stale/invalid data is present
- Field visibility toggles (e.g. person fields hidden for FAMILY, shown for NODAL)
- Save/Cancel callbacks fire correctly

### Test file conventions:
- Co-locate with the component: `Foo.tsx` → `Foo.test.tsx`
- Use `@testing-library/react` + `vitest`
- Run before every commit: `cd src/frontend && npx vitest run`

### Existing test files:
- `EventModal.test.tsx` — all 7 event types, subtype dropdown, category auto-correct, lockEventType
- `PropertiesPanel.test.tsx` — person/partnership/emotional-line tabs, symptom bars, seeded event modals
- `DiagramEditor.test.tsx` — top-level orchestration, file load, demo tour
- `PartnershipNode.test.tsx`, `PersonNode.test.tsx`, `TriangleNode.test.tsx` — canvas node rendering

---

## Architecture: DiagramEditor.tsx

**Refactoring complete.** Started at ~10,695 lines, now ~3,881 lines. Remaining bulk is legitimate coordinator code (state declarations, lifecycle effects, complex multi-step orchestration) that belongs in the top-level component.

**Pattern used:** Domain logic in `src/frontend/src/hooks/`, JSX sub-components in `src/frontend/src/components/`.

**Verification:**
```bash
cd src/frontend && npx tsc --noEmit && npx vitest run
```

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

### Components (`src/frontend/src/components/`):
- `AppRibbon.tsx` — full toolbar/ribbon
- `DiagramCanvas.tsx` — Stage + Layer with all Konva nodes, properties panel sidebar
- `DiagramModals.tsx` — all 19 modal/panel components
- `modals/SessionCaptureDialog.tsx`
- `modals/ClientProfileModal.tsx`
- `modals/CoachThinkingModal.tsx`
- `modals/EmotionalPatternModal.tsx`
- `modals/SessionEventModal.tsx`
- `modals/TimelineBoardModal.tsx`
