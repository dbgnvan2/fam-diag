# Genogram Drawing Application

This is a web-based application for drawing genograms. A genogram is a visual representation of a family tree that includes information about relationships, medical history, and other significant life events.

## Implemented Features

*   **Create, modify, and delete people and partnerships:** Users can create, modify, and delete people and partnerships to build a genogram.
*   **Separated relationship type and status:** The application separates the concept of relationship type (e.g., married, dating) from relationship status (e.g., married, separated, divorced).
*   **Date fields:** The application supports date fields for relationship start, marriage, separation, and divorce.
*   **Adoption:** The application supports adoption, and adopted children are visually represented with a dashed line.
*   **Deceased individuals:** Deceased individuals are visually represented with an "X" through their node.
*   **Save and load:** Users can save their genogram to a JSON file and load it back into the application.
*   **Auto-save:** The application automatically saves the genogram data to `localStorage`.
*   **Export:** Users can export the genogram as a PNG or SVG image.
*   **Emotional Process Lines:** Users can create and style emotional process lines between individuals to represent different types of emotional bonds (e.g., fusion, conflict, distance, cutoff). Fusion, distance, and conflict lines all use intensity levels (Low/Medium/High) with context-specific rendering (dotted/dashed or sawtooth) and each EPL supports user-defined colors for triangle highlighting, along with configurable endings (arrows, perpendicular).
*   **Contextual creation tools:** Right-clicking a Partner Relationship Line (PRL) offers quick actions to add single children, twin/triplet sets, miscarriages (triangle with X), and stillbirth markers (mini person icon with X) so charts can represent perinatal events without manual drawing, while the canvas menu focuses on adding standalone people.
*   **Data cleanup for orphan miscarriages:** When previously saved data is loaded, any miscarriage markers that were placed directly on the canvas (and never attached to a PRL) are automatically removed so broken symbols do not linger in the diagram.
*   **Canvas navigation:** Drag on an empty canvas area to pan the entire genogram and use the zoom slider (25–300%) to focus on dense regions; panning translates every node so Partner Descending Lines (PDLs) and Partner Relationship Lines (PRLs) stay perfectly aligned.
*   **Multi-select styling:** Shift-click to select multiple Person Nodes and use the multi-edit panel to batch-adjust size, border color, and shaded background (square backplates render 10px larger than each person for emphasis).
*   **Vocabulary:** Person Nodes represent individuals; Partner Descending Lines (PDLs) drop vertically from each partner into the shared Partner Relationship Line (PRL); PRLs connect couples; Parent-Child Lines (PCLs) link children to PRLs; Emotional Process Lines (EPLs) visualize emotional dynamics. These terms appear in the Properties panel to keep language consistent.

## How to Run the Application

1.  Navigate to the `src/frontend` directory.
2.  Install the dependencies: `npm install`
3.  Run the application in development mode: `npm run dev`
4.  Open a web browser and navigate to `http://localhost:5173/`.
