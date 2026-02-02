# Genogram Drawing Application - Functional Requirements

## 1. Overview

This document specifies the functional requirements for a web-based genogram drawing application. A genogram is a specialized family tree diagram that uses boxes to represent individuals and lines to show family relationships and generational structure.

## 1.1 Development Process

When a new requirement is given, the following process should be followed:

1.  **Add to Requirements:** The new requirement should be added to the appropriate section of this document.
2.  **Implement:** The requirement should be implemented.
3.  **Mark as Done:** Once the implementation is complete and approved, the requirement should be marked as "done" in this document.

## 2. Core Entities

### 2.1 Person Object

**Purpose:** Represents an individual in the genogram

**Visual Representation:** 
- Box/rectangle shape

**Properties:**
- Unique identifier (id)
- Position coordinates (x, y)
- Name
- Birth date
- Additional demographic data (gender, death date, etc.)
- List of partnerships this person participates in

**Behavior:**
- Draggable in both horizontal and vertical directions
- Can participate in multiple partnerships (for divorced/remarried individuals)

### 2.2 Partnership Object

**Purpose:** Represents a relationship between two people and serves as the connection point for their children

**Visual Representation:**
- U-shaped line consisting of three segments:
  1. Left vertical drop (from Partner 1)
  2. Horizontal connector (spans between partners)
  3. Right vertical drop (from Partner 2)

**Properties:**
- Unique identifier (id)
- References to two partner person objects (partner1_id, partner2_id)
- Vertical position of horizontal connector (horizontalConnectorY)
- Relationship metadata:
  - Relationship type (married, divorced, separated, etc.)
  - Start date
  - End date
- List of children connected to this partnership

**Behavior:**
- The horizontal connector can move up/down vertically as a unit
- Automatically adjusts width when partners move horizontally
- Serves as a "connection rail" for child connections

### 2.3 Child Connection

**Purpose:** Visual link from a child to their parents' partnership

**Visual Representation:**
- Line connecting from child's top edge to a point on the partnership's horizontal connector
- Can be vertical (perpendicular) or angled depending on child position

**Properties:**
- Attachment point on partnership horizontal connector
- Connection to child person object

**Behavior:**
- Dynamically updates as child or partnership moves
- Follows geometric constraint rules (see section 4.2)

## 3. Structural Relationships

### 3.1 Person-to-Partnership Connections

**Rules:**
- Each partnership connects exactly two people (the partners)
- Each person can participate in multiple partnerships
- Connection path: Person → vertical drop → horizontal connector

**Data Structure:**
- Bidirectional references:
  - Person stores list of partnership IDs
  - Partnership stores both partner IDs

### 3.2 Partnership-to-Child Connections

**Rules:**
- Multiple children can connect to a single partnership
- Each child connects to exactly one partnership (their biological/legal parents)
- Each child connects to a specific point along the partnership's horizontal connector

**Default Child Arrangement:**
- Children positioned left-to-right by birth order
- Oldest child leftmost, youngest rightmost
- Evenly distributed along horizontal connector

**Data Structure:**
- Bidirectional references:
  - Partnership stores list of child person IDs
  - Child person stores parent partnership ID

## 4. Movement Constraints and Behaviors

### 4.1 Person Movement

#### Horizontal Movement
- **Constraint:** None (free movement)
- **Range:** Unlimited
- **Effects:** 
  - Vertical drops to partnerships follow person's X position
  - Partnership horizontal connector span updates

#### Vertical Movement
- **Constraint:** None (free movement)
- **Range:** Unlimited
- **Effects:**
  - Vertical drops to partnerships adjust length

### 4.2 Partnership Horizontal Connector Movement

#### Vertical Movement
- **Constraint:** None (free movement)
- **Range:** Unlimited
- **Behavior:** Entire U-shape (both vertical drops + horizontal connector) moves as a unit
- **Effects:**
  - Adjusts generation spacing
  - All child connections adjust length
  - Maintains connections to both partners

#### Horizontal Positioning
- **Constraint:** Must span between the two partners
- **Automatic Adjustment:**
  - Left edge positioned at leftmost partner's X coordinate
  - Right edge positioned at rightmost partner's X coordinate
  - Updates automatically when either partner moves horizontally

### 4.3 Child Movement

#### Vertical Movement
- **Constraint:** None (free movement)
- **Range:** Unlimited
- **Effects:** Connector line adjusts length to maintain connection to partnership

#### Horizontal Movement
- **Constraint:** Connection point clamping (see below)
- **Range:** Unlimited for child position, limited for attachment point

**Attachment Point Behavior:**

**Case 1: Child within partnership bounds**
- Condition: `partnershipLine.startX <= child.x <= partnershipLine.endX`
- Attachment point X = child.x
- Connector is vertical (perpendicular to partnership line)

**Case 2: Child outside partnership bounds**
- Condition: `child.x < partnershipLine.startX` OR `child.x > partnershipLine.endX`
- Attachment point X = nearest edge (left or right corner)
- Connector becomes angled from child to clamped corner point

## 5. Geometric Calculations

### 5.1 Partnership Line Geometry

```
Given:
  - Partner1 position: (Partner1.x, Partner1.y)
  - Partner2 position: (Partner2.x, Partner2.y)
  - Horizontal connector Y position: horizontalConnector.y

Calculate:

Left vertical drop:
  Start: (Partner1.x, Partner1.y)
  End: (Partner1.x, horizontalConnector.y)

Right vertical drop:
  Start: (Partner2.x, Partner2.y)
  End: (Partner2.x, horizontalConnector.y)

Horizontal connector:
  Start: (min(Partner1.x, Partner2.x), horizontalConnector.y)
  End: (max(Partner1.x, Partner2.x), horizontalConnector.y)
  Length: abs(Partner2.x - Partner1.x)
```

### 5.2 Child Connection Calculation

```
Given:
  - Child position: (child.x, child.y)
  - Partnership horizontal connector: 
      startX, endX, y

Calculate:

Connection point on partnership line:
  connectionX = clamp(child.x, partnershipLine.startX, partnershipLine.endX)
  connectionY = partnershipLine.y

Where clamp function:
  clamp(value, min, max) = max(min, min(value, max))

Connector line:
  From: (child.x, child.y)
  To: (connectionX, connectionY)
```

### 5.3 Default Child Position Calculation

For initial placement or automatic arrangement:

```
Given:
  - Partnership horizontal connector: startX, endX
  - Total number of children: n
  - Child index (0-based): i

Calculate:
  partnershipWidth = endX - startX
  spacing = partnershipWidth / (n + 1)
  childConnectionX = startX + (i + 1) * spacing
```

## 6. Visual Rendering Requirements

### 6.1 Person Boxes

**Appearance:**
- Rectangular shapes with visible borders
- Fill color (can vary by gender or other attributes)
- Text displaying name and key information

**States:**
- Default state
- Selected state (highlighted border or different color)
- Hover state (visual feedback)

**Size:**
- Fixed width and height, or
- Dynamic sizing based on text content

### 6.2 Partnership Lines

**Appearance:**
- U-shaped continuous path
- Line styling based on relationship type:
  - Solid line: married/partnered
  - Dashed line: divorced/separated
  - Other variations as needed

**Rendering:**
- Three connected line segments (left drop, horizontal, right drop)
- Join points should be clean (no gaps or overlaps)

**Dynamic Updates:**
- Must re-render in real-time as connected persons move
- Smooth visual transitions during movement

### 6.3 Child Connectors

**Appearance:**
- Straight lines (vertical or angled)
- Consistent line width and style
- Color may indicate relationship type (biological, adopted, etc.)

**Rendering:**
- Update dynamically as child or partnership moves
- No visible lag between movement and line update

### 6.4 Visual Feedback

**During Drag Operations:**
- Element being dragged should have visual indication (e.g., shadow, opacity change)
- Connected lines update in real-time
- Cursor changes to indicate draggable state

**Selection:**
- Clear visual indication of selected element
- Deselection when clicking elsewhere

## 7. Interaction Requirements

### 7.1 Selection

**Behavior:**
- Click on person box, partnership line, or connector to select
- Only one element selected at a time
- Visual feedback for selected state
- Click on empty canvas area to deselect

### 7.2 Dragging

**Person Dragging:**
- Click and hold on person box to initiate drag
- Move mouse to drag person to new position
- Release mouse to complete drag
- All connected partnership lines update during drag

**Partnership Dragging:**
- Click and hold on partnership horizontal connector
- Drag vertically to adjust generation spacing
- Cannot drag horizontally (position determined by partners)
- All child connectors update during drag

**Child Dragging:**
- Click and hold on child person box
- Move mouse to drag child to new position
- Child connector updates according to constraint rules during drag
- Release mouse to complete drag

### 7.3 Real-Time Updates

**Requirements:**
- All position changes must trigger immediate recalculation of dependent elements
- Line rendering must update smoothly (60fps target)
- No visible "jumping" or discontinuities during movement

**Update Cascade:**
When a person moves:
1. Update person position
2. Recalculate all partnership lines connected to that person
3. If person is a child, recalculate child connector
4. Re-render all affected elements

### 7.4 Creating Relationships

**Adding a Partnership:**
- Select two person objects
- Create partnership between them
- System generates U-shaped connection line
- Default horizontal connector position calculated based on persons' Y positions

**Adding a Child:**
- Create or select person object (child)
- Link to specific partnership
- System calculates default connection point on partnership line
- Connector line created automatically

## 8. Data Structure Requirements

### 8.1 Person Object Data Model

```
Person {
  id: string (unique identifier)
  x: number (X coordinate)
  y: number (Y coordinate)
  name: string
  birthDate: date (optional)
  deathDate: date (optional)
  gender: string (optional)
  partnerships: array of partnership IDs
  parentPartnership: partnership ID (optional, null for root persons)
  additionalData: object (extensible for custom fields)
}
```

### 8.2 Partnership Object Data Model

```
Partnership {
  id: string (unique identifier)
  partner1_id: string (reference to Person)
  partner2_id: string (reference to Person)
  horizontalConnectorY: number (Y coordinate of horizontal line)
  relationshipType: string (married, divorced, separated, partnered, etc.)
  startDate: date (optional)
  endDate: date (optional)
  children: array of person IDs
  additionalData: object (extensible for custom fields)
}
```

### 8.3 Relationship Integrity

**Bidirectional References:**
- When partnership is created: both partners' partnership arrays updated
- When child is linked to partnership: partnership's children array updated AND child's parentPartnership updated
- When relationship is deleted: all references must be cleaned up

**Validation Rules:**
- Partnership must have exactly 2 partners
- Partnership cannot have duplicate partners (same person twice)
- Child can have at most one parentPartnership
- Person IDs in relationships must exist in person collection

## 9. Constraints and Validation

### 9.1 Structural Constraints

**Partnership Rules:**
- Exactly 2 partners per partnership
- Both partners must be valid person objects
- Partners must be different persons

**Parent-Child Rules:**
- Child connects to exactly 1 partnership (or 0 for root generation)
- Partnership can have 0 to N children

**Multi-Partnership Rules:**
- Person can participate in multiple partnerships (serial relationships)
- Partnerships involving same person should not overlap in time (validation warning)

### 9.2 Geometric Constraints

**Child Attachment:**
- Attachment point must satisfy clamping rule
- Attachment point must be on partnership horizontal connector line

**Partnership Span:**
- Horizontal connector must span from leftmost to rightmost partner
- Vertical drops must connect partners to horizontal connector

**Line Continuity:**
- All lines must be continuous (no breaks)
- Connection points must be precisely calculated (no gaps)

### 9.3 Movement Constraints

**Person Movement:**
- No restrictions on position
- Movement must trigger updates to all connected elements

**Partnership Connector Movement:**
- Can only move vertically
- Must maintain connections to both partners and all children

**Child Movement:**
- No restrictions on position
- Connector attachment must follow clamping rules

## 10. Birth Order and Sibling Management

### 10.1 Default Birth Order Representation

**Left-to-Right Convention:**
- Oldest child positioned leftmost
- Youngest child positioned rightmost
- Siblings arranged in birth order sequence

**Initial Spacing Calculation:**
```
For n children of a partnership:
  - Divide partnership horizontal connector into (n+1) segments
  - Place each child at segment boundary
  - Child i positioned at: startX + (i+1) * (width / (n+1))
```

### 10.2 Manual Override

**User Repositioning:**
- User can drag any child to any position
- Manual positions override default birth order positions
- System maintains connection constraints regardless of manual positioning

**Reordering:**
- User can drag child horizontally to change visual order
- System does not automatically enforce birth order after manual changes
- Option to "reset to birth order" could restore default positions

### 10.3 Twin and Multiple Birth Indicators

**Future Consideration:**
- Visual indicators for twins, triplets (e.g., connected markers)
- Special connection point arrangements for multiples
- Data model should support birth order ties

## 11. Advanced Features and Future Extensibility

### 11.1 Relationship Type Indicators

**Visual Differentiation:**
- Marriage: solid horizontal line
- Divorce: solid line with diagonal slash
- Separation: dashed line
- Cohabitation: dotted line
- Other custom types

**Decorations:**
- Marriage date labels
- Divorce date labels
- Relationship duration

### 11.2 Complex Family Structures

**Adoption:**
- Visual indicator on child connector (e.g., dashed line)
- Data model flag for adoption status

**Step-Relationships:**
- Child may connect to multiple partnerships
- Visual distinction from biological relationships

**Foster/Guardianship:**
- Alternative connection styles
- Temporary relationship indicators

### 11.3 Person Attributes and Symbols

**Health Information:**
- Medical conditions (could be indicated by colors or symbols)
- Mental health indicators
- Substance use indicators

**Life Events:**
- Significant events (education, career, relocation)
- Timeline integration

**Death:**
- Visual indicator (e.g., X through box or different fill)
- Death date display

### 11.4 Data Management

**Save/Load:**
- Serialize genogram to JSON format
- Load genogram from saved file
- Auto-save functionality

**Export:**
- Export as image (PNG, SVG)
- Export as PDF
- Export data to standard formats

**Import:**
- Import from GEDCOM (genealogy standard)
- Import from other genogram software

### 11.5 Analysis Features

**Calculations:**
- Generation counting
- Relationship distance (degree of relatedness)
- Pattern identification (e.g., recurring health conditions)

**Reporting:**
- Generate family summaries
- Health history reports
- Relationship maps

### 11.6 Collaborative Features

**Multi-User:**
- Real-time collaboration
- Conflict resolution for simultaneous edits
- User permissions and access control

**Comments and Annotations:**
- Add notes to persons or relationships
- Attach documents or images
- Version history

## 12. Technical Specifications

### 12.1 Recommended Technology Stack

**Frontend:**
- **Konva.js** or **Fabric.js** for canvas-based drawing and interaction
- HTML5 Canvas for rendering
- JavaScript for interaction logic and constraint calculations

**Backend (Optional):**
- **FastAPI** (Python) for API endpoints
- RESTful API for data operations
- Database for persistent storage (SQLite, PostgreSQL)

**Alternative:**
- Pure client-side application with localStorage for persistence
- No backend required for simple use cases

### 12.2 Performance Requirements

**Rendering:**
- 60fps target for smooth interactions
- Support for genograms with 100+ persons without lag
- Efficient re-rendering (only update changed elements)

**Responsiveness:**
- Drag operations must feel immediate (<16ms response time)
- No visible delay between user action and visual update

### 12.3 Browser Compatibility

**Supported Browsers:**
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

**Mobile:**
- Touch support for drag operations
- Responsive layout for different screen sizes

### 12.4 Data Persistence

**Client-Side Storage:**
- localStorage for saving genograms locally
- IndexedDB for larger datasets

**Server-Side Storage:**
- RESTful API endpoints for CRUD operations
- Database schema matching data models in section 8

## 13. User Interface Requirements

### 13.1 Canvas Area

**Main Drawing Area:**
- Scrollable/pannable canvas
- Zoom in/out functionality
- Grid overlay (optional, togglable)

**Navigation:**
- Click and drag canvas to pan
- Mouse wheel or pinch to zoom
- Fit-to-screen option

### 13.2 Toolbars and Controls

**Object Creation:**
- "Add Person" button
- "Add Partnership" button
- Click-to-place or click-to-create workflow

**Editing:**
- Properties panel for selected object
- Edit name, dates, attributes
- Delete button

**View Controls:**
- Zoom level indicator and controls
- Pan/reset view
- Toggle grid, guidelines

### 13.3 Properties Panel

**Person Properties:**
- Name (text input)
- Birth date (date picker)
- Death date (date picker, optional)
- Gender (select)
- Additional custom fields

**Partnership Properties:**
- Relationship type (select)
- Start date (date picker)
- End date (date picker, optional)
- Notes (text area)

### 13.4 Keyboard Shortcuts

**Common Actions:**
- Delete: Remove selected object
- Ctrl+Z: Undo
- Ctrl+Y: Redo
- Ctrl+S: Save
- Arrow keys: Nudge selected object

### 13.5 Accessibility

**Requirements:**
- Keyboard-only navigation support
- Screen reader compatibility
- High contrast mode
- Adjustable text sizes

## 14. Testing Requirements

### 14.1 Unit Tests

**Constraint Calculations:**
- Test clamp function with various inputs
- Test partnership line geometry calculations
- Test child connection point calculations

**Data Model:**
- Test person creation and properties
- Test partnership creation and validation
- Test relationship integrity

### 14.2 Integration Tests

**Movement Interactions:**
- Test person drag updates partnership lines correctly
- Test child drag respects clamping constraints
- Test partnership connector drag updates child connectors

**Data Operations:**
- Test save and load functionality
- Test relationship creation and deletion
- Test data validation rules

### 14.3 User Acceptance Tests

**Workflows:**
- Create a multi-generation family tree
- Edit existing relationships
- Reorganize layout by dragging
- Export and re-import genogram

**Edge Cases:**
- Very large genograms (100+ persons)
- Complex family structures (multiple marriages, adoptions)
- Extreme positions (persons at canvas boundaries)

## 15. Documentation Requirements

### 15.1 User Documentation

**Getting Started Guide:**
- How to create persons
- How to create relationships
- How to navigate the canvas

**Feature Documentation:**
- Detailed explanation of all features
- Screenshots and examples
- Common workflows

### 15.2 Developer Documentation

**Code Documentation:**
- Inline comments for complex logic
- Function/method documentation
- Architecture overview

**API Documentation:**
- Endpoint specifications (if backend exists)
- Request/response formats
- Authentication and authorization

### 15.3 Data Format Documentation

**File Format Specification:**
- JSON schema for genogram files
- Import/export format details
- Version compatibility

## 16. Deployment and Distribution

### 16.1 Deployment Options

**Web Application:**
- Static hosting (GitHub Pages, Netlify, Vercel)
- Include backend if needed (Heroku, Railway, DigitalOcean)

**Desktop Application:**
- Electron wrapper for standalone app
- Platform-specific installers

**Progressive Web App (PWA):**
- Offline functionality
- Install to home screen
- Service worker for caching

### 16.2 Version Control

**Repository:**
- Git-based version control
- Clear commit messages
- Branching strategy (main, develop, feature branches)

**Release Management:**
- Semantic versioning (MAJOR.MINOR.PATCH)
- Release notes for each version
- Tagged releases

## 17. Security and Privacy

### 17.1 Data Security

**Client-Side:**
- No sensitive data stored in localStorage without encryption
- HTTPS for all network communications

**Server-Side:**
- Authentication for multi-user features
- Encryption at rest for stored genograms
- Regular security audits

### 17.2 Privacy

**Data Ownership:**
- Users own their genogram data
- Clear privacy policy
- Data export capability

**Compliance:**
- GDPR compliance for EU users
- HIPAA considerations if health data included
- Data retention policies

## 18. Glossary

**Genogram:** A visual representation of family relationships and patterns across generations, similar to a family tree but with additional relationship and attribute information.

**Partnership:** A relationship between two people (marriage, divorce, cohabitation, etc.) that serves as the structural connection point for their children.

**Connector:** A line connecting a child to their parents' partnership.

**U-shaped line:** The visual representation of a partnership consisting of two vertical drops (one from each partner) connected by a horizontal line.

**Clamping:** The constraint behavior where a child's connection point on the partnership line is restricted to the bounds of the horizontal connector.

**Birth order:** The sequence of children born to the same partnership, typically represented left-to-right from oldest to youngest.

**Generation:** A level in the family hierarchy (grandparents, parents, children, etc.).
