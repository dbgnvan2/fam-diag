# Family Diagram Drawing Application - Comprehensive Requirements

## 1. Executive Summary
This document serves as the single source of truth for the functional and technical requirements of the Family Diagram Drawing Application. It covers the core diagramming engine, emotional process tracking, assessment frameworks, and hypothesis management.

## 2. Universal Interaction Model
All interactive elements (People, Partnerships, Emotional Process Lines, Notes) must follow this pattern:
1. **Selection**: Left-click to select and highlight an object. Selecting a new object deselects the previous one.
2. **Context Menu**: Right-click (on a selected or unselected object) to open a context-sensitive menu.
3. **Canvas Actions**: Right-click on empty canvas to "Add Person" or "Add Event".
4. **Multi-Select**: Shift-click or Click-Hold-Drag to select multiple objects for batch movement or styling.
5. **Panning**: Space + Left-drag (or Alt-drag / Middle-click) to pan the canvas.
6. **Zooming**: Slider or Ctrl+Scroll to zoom (25%–300%) centered on the viewport.

---

## 3. Core Entities

### 3.1 Person Object (Nodes)
*   **Visual Representation**: 
    *   **Male**: Square.
    *   **Female**: Circle.
    *   **AI Agent**: Lavender hexagon (`#C5B3E6`).
    *   **Deceased**: "X" overlay.
    *   **Adopted**: Dashed border.
    *   **Miscarriage**: Triangle with "X".
    *   **Stillbirth**: Small person icon with "X".
*   **Properties**: Name, First/Last/Maiden Name, Birth/Death/Gender Dates, Birth Sex (Female, Male, Intersex, AI Agent), Gender Identity, Adoption Status.
*   **Special Behaviors**:
    *   **Age Badge**: Automatically rendered centered beneath nodes with a birth date.
    *   **Shaded Background**: Optional backplate (110% size) for highlighting specific individuals.
    *   **AI Agent**: Hides irrelevant fields (maiden name, adoption) and defaults to non-binary identity.

### 3.2 Partnership Object (PRL)
*   **Visual Representation**: U-shaped line consisting of two vertical drops (PDLs) and one horizontal connector.
*   **Behaviors**:
    *   Horizontal connector is vertically draggable.
    *   Width adjusts automatically as partners move.
    *   Direct Child Linking: Clicking a PRL then a non-partner person attaches them as a child.
*   **Shortcuts**: "Add parents" (generates two nodes + PRL above) and "Add Adopted Child" (links to adopting PRL + creates birth-parent nodes).

### 3.3 Emotional Process Lines (EPL)
*   **Types**: Fusion, Distance, Cutoff, Conflict, Projection, Open Connection.
*   **Visual Styling**:
    *   **Fusion**: Single, Double, Triple solid lines.
    *   **Distance**: Dotted, Dashed, Long-dash (various intervals).
    *   **Cutoff**: Perpendicular double-bars.
    *   **Conflict**: Sawtooth patterns (Solid, Dotted, Double).
*   **Properties**: Status (Ongoing/Ended), End Date (Ended lines hide from canvas but remain in timeline), Color, Notes, and Line Endings (Arrows, Perpendicular).

---

## 4. Assessment Frameworks

### 4.1 Papero Assessment
Adapted from Dr. Dan Papero's "Family Unit Response to Challenge" framework.
*   **Location**: Dedicated "Papero" tab in Person Properties.
*   **Categories**: Resourceful, Connectedness, Tension Management, Systems Thinking, Goal Structure.
*   **Mechanism**: 16 topics rated 1-5 with detailed HWDID (How Well Did I Do) help dialogs for each level.

### 4.2 Self in Relationship (SIR)
*   **Location**: Dedicated "Self in Rel." tab in Person Properties.
*   **Mechanism**: Configurable categories (e.g., Defining Self, Detriangulating) for logging behavioral observations.
*   **Data**: Records Date, "With" (Person), Behavior text, Intensity (1-5), Stress (1-5), and HWDID (1-5).

### 4.3 Functional Indicators
*   **Mechanism**: User-defined labels (e.g., "Substance Use") and optional icons.
*   **Tracking**: Past/Current status with ratings for Frequency, Intensity, and Functional Impact (0-5 scale).
*   **Timeline Integration**: Changing ratings automatically logs an Emotional Process Event.

---

## 5. Hypothesis & Timeline Tools

### 5.1 Prediction Sets
*   **Purpose**: Diagram-level If→Then hypothesis tracking.
*   **Structure**: Named sets containing multiple Predictions.
*   **Prediction Model**:
    *   **Conditions**: Linked to SIR entries, Papero changes, or custom observations.
    *   **Outcomes**: Predicted behaviors/changes.
    *   **Evidence**: Observed data points linked as "Supports", "Contradicts", or "Neutral".

### 5.2 Timeline & Events
*   **Global Timeline**: Slider with Play/Pause to view diagram evolution year-by-year.
*   **Event Creator**: Standalone mode for bulk event editing.
*   **Session Notes**: Floating workspace for running notes, auto-saved every 5 minutes, with "Make Event" shortcut to convert highlights into timeline entries.
*   **Functional Facts (FF)**: User-configurable event categories for logging discrete observations.

---

## 6. Technical Specifications
*   **Stack**: React 18, TypeScript, Konva.js (Canvas), Vite.
*   **Persistence**: Local JSON files (Save/Open) and `localStorage` auto-save.
*   **Rendering**: 60fps target; custom hit-testing for non-rectangular shapes.
*   **Testing**: Vitest for unit/logic; Cypress for E2E visual interaction.
