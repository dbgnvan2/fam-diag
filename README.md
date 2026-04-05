# Family Diagram Drawing Application

A specialized, web-based family diagramming application designed for clinical and research use. It models family systems across generations, tracking relationships, biological markers, and emotional patterns over time.

## Key Features

### 🎨 Core Diagramming
*   **Intelligent Nodes**: Square (Male), Circle (Female), and Lavender Hexagon (**AI Agent**) symbols. Nodes automatically render an **Age Badge** when birth dates are present.
*   **Dynamic Relationships**: U-shaped Partner Relationship Lines (PRLs) with vertical drop-lines. Dragging a person automatically updates all connected relationship lines.
*   **Shortcuts**: Right-click to "Add Parents", "Add Adopted Child", or "Make Client" (includes shaded background coloring).
*   **Contextual Editing**: Direct child-linking (Click PRL → Click Person) and on-canvas size/color overrides.

### 🎭 Emotional Pattern Lines (EPLs)
*   **Advanced Styling**: Visualize Fusion, Distance, Cutoff, Conflict, Projection, and Open Connections with multi-level graphic scales (sawtooth, dashes, parallel lines).
*   **Lifecycle Management**: Tracks "Ongoing" vs. "Ended" status with end dates—ended lines remain in the timeline/data but hide from the active canvas.

### 🧠 Clinical Assessment Frameworks
*   **Papero Assessment**: 16 topics across 5 categories (Resourceful, Connectedness, Tension, Systems, Goals) with detailed 1-5 HWDID help dialogs.
*   **Self in Relationship (SIR)**: Configurable behavioral categories for tracking how individuals manage themselves in relationship interactions.
*   **Functional Indicators**: track symptoms (Affair, Substance Use, etc.) with Past/Current status and 0–5 ratings for Frequency, Intensity, and Impact.

### 🔮 Hypothesis & Analysis
*   **Prediction Sets**: Diagram-level hypothesis tracking. Create If→Then predictions linked to SIR entries, Papero changes, or custom observations, and track supporting/contradicting evidence over time.
*   **Global Timeline**: A year-by-year slider to "play back" the growth of the diagram chronologically.
*   **Session Notes**: A floating, auto-saving workspace for coach notes that can be converted directly into timeline events.

### 💾 Data & Portability
*   **Save/Open**: Direct JSON file management.
*   **Export**: High-resolution PNG or SVG image export.
*   **Auto-Save**: Integrated `localStorage` protection with configurable intervals.

## How to Run the Application

1.  Navigate to the `src/frontend` directory.
2.  Install dependencies: `npm install`
3.  Run in development mode: `npm run dev`
4.  Open `http://localhost:5173/` in your browser.

## Project Structure
*   `src/frontend/src/types/`: Domain models and TypeScript interfaces.
*   `src/frontend/src/hooks/`: Business logic and state management.
*   `src/frontend/src/components/`: React UI components.
*   `src/frontend/src/data/`: Default states and static configuration.

## Documentation
*   [REQUIREMENTS.md](./REQUIREMENTS.md): Comprehensive functional and technical specifications.
*   [GEMINI.md](./GEMINI.md): Coding standards and assistant instructions.
