# Family Diagram Drawing Application

A specialized, web-based family diagramming application designed for clinical and research use. It models family systems across generations, tracking relationships, biological markers, and emotional patterns over time.

## Key Features

### 🎨 Core Diagramming
*   **Intelligent Nodes**: Square (Male), Circle (Female), and Lavender Hexagon (**AI Agent**) symbols. Nodes automatically render an **Age Badge** when birth dates are present.
*   **Dynamic Relationships**: U-shaped Partner Relationship Lines (PRLs) with vertical drop-lines. Dragging a person automatically updates all connected relationship lines.
*   **Group Drag**: Select multiple people and drag them together while maintaining all relationship connections.
*   **Right-Click Shortcuts**: Quick access to "Add Parents", "Add Adopted Child", "Make Client", "Add AI Agent", "Add Family" (bulk-create two parents + a marriage + N children in one form), and contextual event creation.
*   **Contextual Editing**: Direct child-linking (Click PRL → Click Person), on-canvas size/color overrides, and draggable resizable notes on all objects.
*   **Notes System**: Add rich text notes to individuals, relationships, emotional patterns, triangles, and families. Notes are independently toggleable via right-click menu.

### 🎭 Emotional Pattern Lines (EPLs) & Triangles
*   **Advanced Styling**: Visualize Fusion, Distance, Cutoff, Conflict, Projection, and Open Connections with multi-level graphic scales (sawtooth, dashes, parallel lines).
*   **Lifecycle Management**: Tracks "Ongoing" vs. "Ended" status with end dates—ended lines remain in the timeline/data but hide from the active canvas.
*   **Triangle Analysis**: Create focused 3-person triangles with dedicated properties panel for analyzing emotional dynamics and tracking triangle-specific events and notes.

### 🧠 Clinical Assessment Frameworks
*   **Papero Assessment**: 16 topics across 5 categories (Resourceful, Connectedness, Tension, Systems, Goals) with detailed 1-5 level help dialogs.
*   **Self in Relationship (SIR)**: Configurable behavioral categories for tracking how individuals manage themselves in relationship interactions. Includes Intensity, Stress Level, and HWDID (How Well Did I Do) scoring.
*   **Family of Origin (FOO)**: Four assessment scales—Family Stability, Family Intactness, Triangle Flexibility, and Triangle Stress Response—to evaluate generational patterns.
*   **Emotional Autonomy (EA)**: Five-level assessment of individual differentiation and ability to think for self under stress.
*   **Functional Facts (FF)**: User-defined event categories for recording custom observations about a person's functioning. Categories are configurable via Settings.
*   **Functional Indicators**: Track symptoms (Affair, Substance Use, etc.) with Past/Current status and 0–5 ratings for Frequency, Intensity, and Impact.

### 🔮 Hypothesis & Analysis
*   **Prediction Sets**: Diagram-level hypothesis tracking. Create If→Then predictions linked to SIR entries, Papero changes, or custom observations, and track supporting/contradicting evidence over time.
*   **Timeline Board**: Select people and/or families on the canvas and open the Timeline Board to "play back" the growth of the system chronologically. Multi-select works with Ctrl/Cmd+click or marquee drag. View all event types (Person, Partnership, Family, Triangle, EA events) across all selected entities in parallel lanes. Add/edit events directly from the timeline.
*   **Session Notes**: A floating, auto-saving workspace for coach notes that can be converted directly into timeline events.
*   **Voice Commands**: Optional voice input for hands-free event recording and diagram navigation (when enabled in Settings).

### 💾 Data & Portability
*   **Save/Open**: Direct JSON file management.
*   **Export**: High-resolution PNG or SVG image export.
*   **Auto-Save**: Integrated `localStorage` protection with configurable intervals.
*   **File-Based Backups**: Automatic backup files created on save for data recovery.
*   **Demo Data**: Built-in guided tour with sample family diagram and help walkthroughs.

## Quick Start

### Prerequisites
- Node.js 16+ and npm

### Installation & Running

```bash
cd src/frontend
npm install
npm run dev
```

Then open `http://localhost:5173/` in your browser.

### Testing & Building

```bash
# Run TypeScript type check
npx tsc --noEmit

# Run test suite
npx vitest run

# Build for production
rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b
```

## Project Structure

```
src/frontend/src/
├── types/              # Domain models (Person, Partnership, EmotionalLine, Triangle, etc.)
├── hooks/              # Business logic (CRUD operations, event handling, file I/O)
├── components/         # React UI (panels, modals, canvas nodes)
├── sections/           # Form sections for properties panels
├── modals/             # Dialog/modal components
├── utils/              # Pure utility functions (transforms, calculations, data cleanup)
├── constants/          # Event hierarchy, scales, default settings
└── data/               # Default diagram state, demo data, help content
```

## Architecture Highlights

- **Single source of truth**: State lives in `DiagramEditor.tsx`, flows down via props
- **Immutable transforms**: All state updates create new objects; no direct mutations
- **Event-driven audit trail**: Every property change creates an event record for complete history tracking
- **Hooks for logic separation**: Domain operations are in `usePersonOperations`, `useEmotionalLineOperations`, etc., not in components
- **TypeScript strict mode**: `noUnusedLocals: true`, no `any` types

## Documentation

*   **[CLAUDE.md](./CLAUDE.md)**: Development guide with entity types, patterns, rules, and testing requirements.
*   **[REQUIREMENTS.md](./REQUIREMENTS.md)**: Functional and technical specifications (if available).
*   **In-app Help**: Every feature includes contextual help dialogs and a guided tour on first load.
