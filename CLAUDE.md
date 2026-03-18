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
