# Family Diagram Drawing Application

This is a web-based application for drawing family diagrams. A family diagram is a visual representation of a family tree that includes information about relationships, medical history, and other significant life events.

## Implemented Features

*   **Create, modify, and delete people and partnerships:** Users can create, modify, and delete people and partnerships to build a family diagram.
*   **Separated relationship type and status:** The application separates the concept of relationship type (e.g., married, dating) from relationship status (e.g., married, separated, divorced).
*   **Date fields with pickers:** Every timeline field (birth/death, partnership milestones, EPL start dates, event rows, session-note captures) includes a text box plus an inline calendar picker, so you can free-type `YYYY-MM-DD` or pop open the native date selector without switching components.
*   **Adoption:** The application supports adoption, and adopted children are visually represented with a dashed line.
*   **Deceased individuals:** Deceased individuals are visually represented with an "X" through their node.
*   **Save and load:** Users can save their family diagram to a JSON file and load it back into the application.
*   **Auto-save:** The application automatically saves the family diagram data to `localStorage`.
*   **Export:** Users can export the family diagram as a PNG or SVG image.
*   **Emotional Pattern Lines (EPLs):** Users can create and style emotional pattern lines between individuals to represent different types of emotional bonds (e.g., fusion, conflict, distance, cutoff). Fusion intensities render as double dotted, double solid, or triple solid parallel lines (Low/Medium/High), distance intensities map to short vs. longer dashes, and conflict keeps its single/double sawtooth variants. Every EPL supports custom colors for triangle highlighting plus configurable endings (arrows, perpendicular), and now tracks a Status (Ongoing/Ended) with optional End Date so you can archive resolved triangles—only ongoing lines stay on the canvas while ended ones remain in the data/timeline.
*   **Contextual creation tools:** Right-clicking a Partner Relationship Line (PRL) offers quick actions to add single children, twin/triplet sets, miscarriages (triangle with X), and stillbirth markers (mini person icon with X) so charts can represent perinatal events without manual drawing, while the canvas menu focuses on adding standalone people.
*   **Floating notes:** Person notes inherit soft male/female shading (or a neutral tone) and connect back to their owner with heavier dashed leader lines for quick visual association, while PRL/EPL notes keep a neutral white card.
*   **Notes Layer + overrides:** A global `Notes Layer` toolbar toggle can hide/show all notes. Right-click any person/PRL/EPL to `Show Note` (pin that note on), and person-note hover still reveals the note temporarily even when the global layer is off. Object-level note pins override the global layer state.
*   **Data cleanup for orphan miscarriages:** When previously saved data is loaded, any miscarriage markers that were placed directly on the canvas (and never attached to a PRL) are automatically removed so broken symbols do not linger in the diagram.
*   **Canvas navigation:** Drag on an empty canvas area to pan the entire family diagram and use the zoom slider (25–300%) to focus on dense regions; panning translates every node so Partner Descending Lines (PDLs) and Partner Relationship Lines (PRLs) stay perfectly aligned.
*   **Multi-select styling:** Shift-click to select multiple Person Nodes and use the multi-edit panel to batch-adjust size, border color, and shaded background (square backplates render 10px larger than each person for emphasis).
*   **On-node age badges:** Whenever a person has a birth date, the diagram automatically calculates and renders “Age NN” centered beneath the node (using the death date when present, otherwise today’s date), so you can gauge generations without opening the properties panel.
*   **Global timeline controls:** The widened Timeline slider (left of the Zoom control) now scans year-by-year from the earliest recorded event, includes ±1 year nudge buttons plus a Play/Pause toggle (1 year/second), and only shows people/PRLs/EPLs whose start dates fall on or before the selected year so you can “grow” the diagram chronologically.
*   **Timeline block editing flow:** In the Timeline Board, clicking any event block now opens the related object in the right-side Properties panel on the Events tab so events can be edited immediately.
*   **Canvas add-event shortcut:** Right-clicking empty canvas now includes `Add Event`, letting you append a person event without opening an existing object first.
*   **Separate Event Creator web mode:** Use `File -> Export Person Events` to generate a standalone `name - timeline.json`, open `File -> Open Event Creator` (or `?mode=event-creator`) to bulk add/edit/delete events in a two-panel list+properties editor, then import with `File -> Import Person Events` (or toolbar button). Merge is event-ID based and supports updates/deletions from the exported baseline.
*   **Functional indicators:** Define reusable functional indicator labels (Affair, Substance Use, etc.), optionally upload icon images, and track each indicator per person with Past/Current status plus 0–5 ratings for Frequency, Intensity, and Functional Impact. Indicators render beside the person node so high-impact situations stand out instantly.
*   **Indicator-driven timelines:** Whenever you change an indicator’s Frequency/Intensity/Impact, the app logs or updates an Emotional Process Event for that indicator (capped at one entry per indicator per 60 minutes), so the Events tab reflects the most recent ratings without filling the timeline with duplicates.
*   **Functional Facts panel:** The right-hand inspector now adapts its title based on context—Individual Functional Facts for a Person, Relationship Functional Facts for a PRL, and Emotional Pattern Functional Facts for an EPL—while exposing the same Person/Indicators/Events tabs so you can focus on biographical data, functional indicators, or timeline entries without scrolling miles of form fields. Every event is tagged with an **Event Class** (Individual, Relationship, or Emotional Pattern) plus a separate **Status** label, so entries read like “Job – Promotion” or “Marriage – Ended”. Editing PRL date fields automatically logs nodal events for the couple, EPL start/end saves emit Emotional Pattern events, and person birth/death saves create Individual events—nothing hits the timeline until you click the new Save buttons on each Properties tab, which lets you stage multiple edits before committing and keeps accidental keystrokes from flooding the history. Events render as compact two-line tiles (Category/Status + Date on top, ratings/participants/actions below) and the modal editor mirrors the new layout with Frequency/Impact selectors, Prior Events, Reflections, and Nodal Event toggles.
*   **Session Notes workspace:** Launch a floating Session Notes window from the toolbar to capture coach/client details, presenting issues, and running notes. Notes auto-save to a primary/backup rotation every five minutes, can be saved as JSON or Markdown with standardized filenames, and let you highlight a line (or use the last line) to pre-populate an Emotional Process Event for any person, partnership, or EPL—complete with inferred names/years and a dedicated event editor.
*   **Quick Start help:** Tap the Help button any time to launch a modal with curated tips plus an embedded, scrollable copy of `README.md`, so new counselors can orient themselves without leaving the canvas.
*   **File-aware toolbar:** The drawing surface now shows a “Family Diagram Maker” heading with the active file name, provides a File dropdown (New, Open, Save, Save As, Export PNG/SVG, Quit), exposes an Auto-Save minutes control, and highlights the Save button red whenever there are unsaved edits (blinking red if changes are more than ten minutes old).
*   **Vocabulary:** Person Nodes represent individuals; Partner Descending Lines (PDLs) drop vertically from each partner into the shared Partner Relationship Line (PRL); PRLs connect couples; Parent-Child Lines (PCLs) link children to PRLs; Emotional Pattern Lines (EPLs) visualize emotional dynamics. These terms appear in the Properties panel to keep language consistent.

## How to Run the Application

1.  Navigate to the `src/frontend` directory.
2.  Install the dependencies: `npm install`
3.  Run the application in development mode: `npm run dev`
4.  Open a web browser and navigate to `http://localhost:5173/`.

## Default Dataset

The editor now ships with the full *Myfamily1* sample diagram stored at `src/frontend/src/data/defaultDiagramData.json`. When the app boots (and there is no prior `localStorage` state) the UI hydrates from that JSON file—people, partnerships, emotional process lines, functional indicator definitions, and event categories all come from this data. If the file is removed or empty, the app gracefully falls back to the simple three-person demo that used to ship with the tool. To customize the out-of-the-box view for other beta testers, adjust that JSON file and commit the new data.

## Functional Indicator Rating Table

| Level    | Frequency                 | Intensity                 | Functional Impact                    |
|----------|---------------------------|---------------------------|--------------------------------------|
| Absent   | 0 — Absent                | 0 — Absent                | 0 — None                             |
| Minimum  | 1 — Rare                  | 1 — Faint                 | 1 — Not Limiting                     |
| Mild     | 2 — Occasional            | 2 — Noticeable            | 2 — Minor Interference               |
| Moderate | 3 — Regular               | 3 — Evident               | 3 — Manageable                       |
| Major    | 4 — Frequent              | 4 — Marked                | 4 — Significant-Daily                |
| Maximal  | 5 — Continuous            | 5 — Extreme               | 5 — Dictates Daily Choices           |
