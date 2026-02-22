# Family Diagram Emotional Process Lines - Functional Requirements

## 1. Overview

This document specifies the functional requirements for representing emotional process lines in the family diagram drawing application. Emotional process lines are used to visualize the quality and nature of emotional bonds between individuals.

## 1.1 Development Process

When a new requirement is given, the following process should be followed:

1.  **Add to Requirements:** The new requirement should be added to the appropriate section of this document.
2.  **Implement:** The requirement should be implemented.
3.  **Mark as Done:** Once the implementation is complete and approved, the requirement should be marked as "done" in this document.

## 2. Core Entities

### 2.1 Emotional Line Object

**Purpose:** Represents an emotional relationship between two people.

**Visual Representation:**
- A line connecting two person objects.
- The line's style, color, and thickness can vary to represent different types of emotional relationships.
- The line can have arrows to indicate the direction of the emotional energy.

**Properties:**
- Unique identifier (id)
- References to two person objects (person1_id, person2_id)
- Emotional relationship type (e.g., "fusion", "distance", "cutoff", "conflict")
- Line style
- Line ending

**Behavior:**
- The line should dynamically update as the connected person objects move.
- When the relationship type is changed, the line style should default to the first available style for that type.

## 3. Emotional Relationship Types and Symbols

The application should support the following emotional relationship types and their corresponding visual representations:

### 3.1 Fusion

- **Single:** A single solid line. (done)
- **Double:** Two parallel solid lines with a gap in between. (done)
- **Triple:** Three parallel solid lines with gaps in between. (done)

### 3.2 Distance

- **Long Dash:** A line with long dashes. (To be implemented)
- **Short Dash:** A line with short dashes. (To be implemented)
- **Dotted:** A dotted line. (done)

### 3.3 Cutoff

- **Line with Double Vertical:** A line with two vertical lines in the middle (similar to the divorce symbol). (done)

### 3.4 Conflict

- **Solid:** A solid saw-tooth (/\/\/\/\/\) pattern. (done)
- **Dotted:** A dotted saw-tooth (/\/\/\/\/\) pattern. (done)
- **Double:** A double solid saw-tooth (/\/\/\/\/\) pattern. (done)

### 3.5 Line Endings

- **None:** No line ending. (done)
- **Arrow:** An arrowhead at the end of the line to indicate the direction of the emotional process. Can be on one or both ends. (done)
- **Perpendicular:** A single perpendicular line at the end of the line. (done)
- **Double Perpendicular:** Two perpendicular lines at the end of the line. (done)

## 4. Interaction Requirements

### 4.1 Creating Emotional Lines

- Users should be able to select two person objects and create an emotional line between them.
- When creating an emotional line, users should be able to select the emotional relationship type, line style, and line endings.

### 4.2 Editing Emotional Lines

- Users should be able to select an emotional line and edit its properties.
- "Click - highlight - right click - options" is the universal functioning for the application.

### 4.3 Deleting Emotional Lines

- Users should be able to delete an emotional line.

## 5. Data Structure Requirements

### 5.1 Emotional Line Object Data Model

```
EmotionalLine {
  id: string (unique identifier)
  person1_id: string (reference to Person)
  person2_id: string (reference to Person)
  relationshipType: 'fusion' | 'distance' | 'cutoff' | 'conflict';
  lineStyle: 'single' | 'double' | 'triple' | 'long-dash' | 'short-dash' | 'dotted' | 'solid-saw-tooth' | 'dotted-saw-tooth' | 'double-saw-tooth';
  lineEnding: 'none' | 'arrow-p1-to-p2' | 'arrow-p2-to-p1' | 'arrow-bidirectional' | 'perpendicular-p1' | 'perpendicular-p2' | 'double-perpendicular-p1' | 'double-perpendicular-p2';
}
```

## 6. Visual Rendering Requirements

- The application should render the emotional lines according to the specifications in the "Emotional Relationship Types and Symbols" section.
- The lines should be visually distinct from the partnership and child connection lines.
- The application should provide a legend that explains the meaning of the different emotional line symbols.