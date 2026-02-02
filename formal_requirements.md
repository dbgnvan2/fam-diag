# Formal Requirements for Genogram Application

This document specifies the functional requirements for the genogram drawing application. It serves as the single source of truth for the project.

## 1. Universal Interaction Model

The following interaction model applies to all selectable objects in the application (People, Partnerships, Child Lines, Emotional Process Lines):

1. **Click:** Selects the object and highlights it. Any other selected object is deselected.
2. **Right-Click:** Brings up a context-sensitive menu with options for the selected object.
3. **Right-Click on the canvas brings up option menu - Add Person
4. **Click Hold Drag - creates a "selected" rectangle to select multiple objects when then can be moved all at once. 

## 2. People

### 2.1. Creation and Manipulation
- Users can add new person objects to the canvas.
- Users can drag and move person objects on the canvas.

### 2.2. Properties
- The following properties can be edited in a properties panel:
    - Name (string)
    - Birth Date (string)
    - Death Date (string)
    - Gender (string: 'male', 'female', etc.)
    - Adoption Status (enum: 'biological', 'adopted')

## 3. Partnerships

### 3.1. Creation and Manipulation
- Users can create a partnership between two selected people.
- The horizontal connector line of a partnership is selectable.
- The horizontal connector line is vertically draggable.

### 3.2. Properties
- The following properties can be edited in a properties panel:
    - Relationship Type (enum: 'married', 'common-law', 'living-together', 'dating')
    - Relationship Status (enum: 'married', 'separated', 'divorced')
    - Relationship Start Date (string)
    - Married Start Date (string)
    - Separation Date (string)
    - Divorce Date (string)

## 4. Child Connections

### 4.1. Creation and Manipulation
- Users can add a person as a child to a partnership.
- The line connecting a child to a partnership is a selectable object.

### 4.2. Context Menu
- Right-clicking on a child connection line brings up a context menu with the following option:
    - "Remove as Child"

## 5. Emotional Process Lines (EPLs)

### 5.1. Creation and Manipulation
- Users can create an EPL between two selected people.
- The EPL is a selectable object.

### 5.2. Context Menu
- Right-clicking on an EPL brings up a context menu with the following options:
    - "Properties"
    - "Delete"

### 5.3. EPL Types and Styles

#### 5.3.1. Fusion
- **Relationship Type:** `fusion`
- **Line Styles:**
    - `single`: A single solid line.
    - `double`: Two parallel solid lines.
    - `triple`: Three parallel solid lines.

#### 5.3.2. Distance
- **Relationship Type:** `distance`
- **Line Styles:**
    - `dotted`: A dotted line.
    - `dashed`: A dashed line.
    - `cutoff`: A solid line with two vertical bars in the middle.

#### 5.3.3. Conflict
- **Relationship Type:** `conflict`
- **Line Styles:**
    - `solid-saw-tooth`: A solid saw-tooth (/\/\/\/\/\) pattern.
    - `dotted-saw-tooth`: A dotted saw-tooth (/\/\/\/\/\) pattern.
    - `double-saw-tooth`: A double solid saw-tooth (/\/\/\/\/\) pattern.

### 5.4. Line Endings
- The following line endings can be applied to any EPL:
    - `none`: No line ending.
    - `arrow-p1-to-p2`, `arrow-p2-to-p1`, `arrow-bidirectional`: An arrowhead on the corresponding end(s).
    - `perpendicular-p1`, `perpendicular-p2`: A single perpendicular line on the corresponding end.
    - `double-perpendicular-p1`, `double-perpendicular-p2`: Two perpendicular lines on the corresponding end.

### 5.5. Defaulting Behavior
- When a user changes the `relationshipType` of an EPL in the properties panel, the `lineStyle` should automatically default to the first valid option for that new type.
