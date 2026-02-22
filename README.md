# Family Diagram Drawing Application

This is a web-based application for drawing family diagrams. A family diagram is a visual representation of a family tree that includes information about relationships, medical history, and other significant life events.

## Implemented Features

*   **Create, modify, and delete people and partnerships:** Users can create, modify, and delete people and partnerships to build a family diagram.
*   **Separated relationship type and status:** The application separates the concept of relationship type (e.g., married, dating) from relationship status (e.g., married, separated, divorced).
*   **Date fields:** The application supports date fields for relationship start, marriage, separation, and divorce.
*   **Adoption:** The application supports adoption, and adopted children are visually represented with a dashed line.
*   **Deceased individuals:** Deceased individuals are visually represented with an "X" through their node.
*   **Save and load:** Users can save their family diagram to a JSON file and load it back into the application.
*   **Auto-save:** The application automatically saves the family diagram data to `localStorage`.
*   **Export:** Users can export the family diagram as a PNG or SVG image.
*   **Emotional Process Lines:** Users can create and style emotional process lines between individuals to represent different types of emotional bonds (e.g., fusion, conflict, distance, cutoff). Fusion, distance, and conflict lines all use intensity levels (Low/Medium/High) with context-specific rendering (dotted/dashed or sawtooth) and each EPL supports user-defined colors for triangle highlighting, along with configurable endings (arrows, perpendicular).
*   **Contextual creation tools:** Right-clicking a Partner Relationship Line (PRL) offers quick actions to add single children, twin/triplet sets, miscarriages (triangle with X), and stillbirth markers (mini person icon with X) so charts can represent perinatal events without manual drawing, while the canvas menu focuses on adding standalone people.
*   **Floating notes:** Person notes inherit soft male/female shading (or a neutral tone) and connect back to their owner with heavier dashed leader lines for quick visual association, while PRL/EPL notes keep a neutral white card.
*   **Data cleanup for orphan miscarriages:** When previously saved data is loaded, any miscarriage markers that were placed directly on the canvas (and never attached to a PRL) are automatically removed so broken symbols do not linger in the diagram.
*   **Canvas navigation:** Drag on an empty canvas area to pan the entire family diagram and use the zoom slider (25–300%) to focus on dense regions; panning translates every node so Partner Descending Lines (PDLs) and Partner Relationship Lines (PRLs) stay perfectly aligned.
*   **Multi-select styling:** Shift-click to select multiple Person Nodes and use the multi-edit panel to batch-adjust size, border color, and shaded background (square backplates render 10px larger than each person for emphasis).
*   **Functional indicators:** Define reusable functional indicator labels (Affair, Substance Use, etc.), optionally upload icon images, and track each indicator per person with Past/Current status plus a 0–9 impact score. Indicators render beside the person node so high-impact situations stand out instantly.
*   **Functional Facts panel:** The right-hand inspector is labeled “Functional Facts” and exposes three tabs—Person, Indicators, and Events—so you can focus on biographical data, functional indicators, or timeline entries without scrolling miles of form fields.
*   **Session Notes workspace:** Launch a floating Session Notes window from the toolbar to capture coach/client details, presenting issues, and running notes. Notes auto-save to a primary/backup rotation every five minutes, can be saved as JSON or Markdown with standardized filenames, and let you highlight a line (or use the last line) to pre-populate an Emotional Process Event for any person, partnership, or EPL—complete with inferred names/years and a dedicated event editor.
*   **Quick Start help:** Tap the Help button any time to launch a modal with curated tips plus an embedded, scrollable copy of `README.md`, so new counselors can orient themselves without leaving the canvas.
*   **File-aware toolbar:** The drawing surface now shows a “Family Diagram Maker” heading with the active file name, provides a File dropdown (New, Open, Save, Save As, Export PNG/SVG, Quit), exposes an Auto-Save minutes control, and highlights the Save button red whenever there are unsaved edits (blinking red if changes are more than ten minutes old).
*   **Vocabulary:** Person Nodes represent individuals; Partner Descending Lines (PDLs) drop vertically from each partner into the shared Partner Relationship Line (PRL); PRLs connect couples; Parent-Child Lines (PCLs) link children to PRLs; Emotional Process Lines (EPLs) visualize emotional dynamics. These terms appear in the Properties panel to keep language consistent.

## How to Run the Application

1.  Navigate to the `src/frontend` directory.
2.  Install the dependencies: `npm install`
3.  Run the application in development mode: `npm run dev`
4.  Open a web browser and navigate to `http://localhost:5173/`.

## Default Dataset

The editor now ships with the full *Myfamily1* sample diagram stored at `src/frontend/src/data/defaultDiagramData.json`. When the app boots (and there is no prior `localStorage` state) the UI hydrates from that JSON file—people, partnerships, emotional process lines, functional indicator definitions, and event categories all come from this data. If the file is removed or empty, the app gracefully falls back to the simple three-person demo that used to ship with the tool. To customize the out-of-the-box view for other beta testers, adjust that JSON file and commit the new data.
