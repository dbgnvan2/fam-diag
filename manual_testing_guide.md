# Manual Testing Guide - Family Diagram App

Due to the canvas-based nature of the application, manual verification is essential for ensuring visual and interaction integrity.

## 1. Core Interactions
*   **Add & Move**: Add people via context menu; drag to move. Verify all connected PRLs and EPLs update in real-time.
*   **Selection**: Click objects (Person, PRL, EPL) and verify only the clicked object is highlighted.
*   **Context Menus**: Right-click each object type and verify the options are context-appropriate.
*   **Multi-Select**: Shift-click multiple people. Verify "Shared Properties" panel appears for batch styling.
*   **Panning/Zooming**: Hold Space and drag to pan; use slider to zoom. Verify objects remain selectable and interactive after view changes.

## 2. Advanced Relationships
*   **Child Linking**: Click a PRL, then click a non-partner person. Verify the person is linked as a child.
*   **Shortcuts**:
    *   Right-click Person → "Add Parents": Verify two nodes + PRL appear above.
    *   Right-click PRL → "Add Adopted Child": Verify birth-parent nodes + connection appear.
*   **AI Agent**: Right-click Stage → "Add AI Agent". Verify lavender hexagon appears. Check properties tab and confirm "AI Agent" labels.

## 3. Clinical Assessment Tabs (Person Properties)
*   **Symptoms Tab**: Add/Edit Functional Indicators. Verify badges appear next to node. Check that rating changes log an event in the Events tab.
*   **Papero Tab**: Select topics, click "?" for help, and choose a level. Verify the score and category average update immediately.
*   **Self in Rel. Tab**: Add a new entry. Pick an "Other Person" and a category. Rate Intensity/Stress/HWDID. Verify the entry card appears with color-coded badges.
*   **Patterns Tab**: Verify all emotional lines connected to the person are listed. Click one to navigate to its properties.

## 4. Emotional Pattern Lines (EPL)
*   **Styling**: Change "Relationship Type" and verify line style defaults. Cycle "Intensity Level" (1-5) and confirm visual changes (e.g., sawmill density for Conflict).
*   **Archiving**: Set Status to "Ended", enter an End Date, and Save. Verify the line disappears from the canvas but remains in the Events tab. Set back to "Ongoing" to confirm it reappears.

## 5. Timeline & Predictions
*   **Global Timeline**: Drag the slider year-by-year. Confirm objects only appear if their `startDate` is <= the current year. Hit "Play" to watch chronological growth.
*   **Predictions (Options → Predictions)**:
    *   Create a Prediction Set.
    *   Add an If→Then prediction.
    *   Link a Condition to a SIR entry or Papero score.
    *   Add Evidence and verify the "Supports/Contradicts" indicators.

## 6. Workspace & Persistence
*   **Session Notes**: Open floating panel. Type notes, highlight a line, and click "Make Event". Verify the anchored event is created in the target object's Events tab.
*   **File Operations**: Test "Save As" (JSON export) and "Open". Verify the diagram name in the header updates.
*   **Auto-Save**: Make a change and wait for the configured interval. Refresh the page and verify the state is restored.
