# Project Requirements & Specifications

## 1. Executive Summary

This document outlines the functional and technical requirements for the Genogram Drawing Application. It serves as the source of truth for development and testing, specifically addressing the need for a robust interaction model and comprehensive support for Emotional Process Lines (EPLs).

## 2. User Interaction Model

To ensure consistency and usability, all interactive elements must adhere to the following "Universal Interaction" pattern.

### 2.1 Selection & Highlighting

- **Trigger:** Left-click on any interactive element (Person Node, Partnership Line, Emotional Process Line).
- **Feedback:** The selected element must immediately render a visual highlight state (e.g., distinct color, glow, or bounding box) to confirm selection to the user.
- **Deselection:** Clicking on the empty canvas background deselects the current element.

### 2.2 Context Actions

- **Trigger:** Right-click on a **selected** or **unselected** element.
- **Behavior:**
  1.  If the element was not selected, it becomes selected (and highlighted).
  2.  A context menu appears at the cursor location.
- **Menu Contents:** Options must be context-aware based on the element type (see Section 3).

## 3. Domain Entities & Features

### 3.1 People (Nodes)

- **Visuals:**
  - **Male:** Square shape.
  - **Female:** Circle shape.
  - **Deceased:** Overlay with an "X".
  - **Adopted:** Dashed outline (visualized based on parent partnership status).
- **Attributes:** Name, Gender, Birth Date, Death Date, ID, Coordinates (x, y).
- **Context Menu Options:** Edit Properties, Add Parent, Add Spouse, Add Child, Delete, Start Emotional Line.

### 3.2 Partnerships (Relationship Lines)

- **Visuals:**
  - Horizontal line connecting two Person nodes.
  - Vertical "drop lines" connecting to children.
- **Attributes:** Relationship Type (e.g., Married, Dating), Status (e.g., Separated, Divorced), Start/End Dates.
- **Context Menu Options:** Edit Partnership Details, Delete.

### 3.3 Emotional Process Lines (EPLs)

EPLs represent the emotional dynamic between two individuals.

- **Data Structure (based on `genogram2.json`):**
  - `person1_id` (Source)
  - `person2_id` (Target)
  - `relationshipType` (Enum: `fusion`, `cutoff`, `conflict`, `distance`)
  - `lineStyle` (Enum: `single`, `double`, `dashed`, `double-angular`)
  - `lineEnding` (Enum: `none`, `arrow-p1-to-p2`, `double-perpendicular-p1`, `double-perpendicular-p2`)
- **Interaction:**
  - Must be selectable via click (requires precise hit-testing with a buffer for thin lines).
  - **Selection Feedback:**
    - The line must be highlighted.
    - A notes/info box must appear displaying the names of the two individuals.
    - **Formatting:** The names must be stacked vertically (Name 2 under Name 1).
    - **Layout:** The notes box must automatically resize to fit the text content. The background rectangle dimensions must be calculated dynamically based on the measured width of the longest text line and the total height of all lines plus padding.
  - Must support Right-Click -> Delete/Edit.

## 4. Technical Architecture

### 4.1 Canvas Rendering

- The application uses an HTML5 Canvas for high-performance rendering.
- **Hit Testing:** Custom logic required to detect clicks on non-rectangular shapes.

## 5. Quality Assurance Strategy

Due to the canvas-based nature of the application, standard DOM testing is insufficient.

- **Framework:** Cypress.
- **Methodology:** End-to-End (E2E) Visual & Interaction Testing.
- **Key Goal:** Verify that clicking coordinates (x,y) results in the correct internal state change and visual update (highlighting).
