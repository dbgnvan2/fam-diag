# Implementation Plan: Extract Family Diagrams from Images

**Date:** 2026-05-22  
**Task:** Add image-to-diagram functionality using Claude Vision API to parse handwritten/drawn family diagrams  
**Input:** Handwritten or drawn family diagram images (PNG, JPG)  
**Output:** Person and Partnership objects automatically created in the diagram

---

## Overview

This plan describes the implementation of image-based diagram extraction. Users will upload an image of a hand-drawn or printed family diagram, and the system will:
1. Use Claude Vision API to analyze the image
2. Extract names, family relationships, and symbols
3. Generate a structured "Person Inventory" for validation
4. Create Person and Partnership objects
5. Render the diagram on the canvas

**Key Design Decision:** The process includes a **review step** where users see the extracted person inventory before diagram creation, allowing them to correct extraction errors before data is committed.

---

## Acceptance Criteria

### Phase 1: Image Upload & Vision Analysis

**I1.A** — User can upload image file (PNG, JPG, JPEG)
- File: `src/frontend/src/components/modals/ImageDiagramModal.tsx`
- Test: `ImageDiagramModal.test.tsx` — "displays image upload input"
- Verification: File input visible with accept=".png,.jpg,.jpeg"

**I1.B** — App sends image to Claude Vision API with structured prompt
- File: `src/frontend/src/utils/imageAnalysis.ts`
- Function: `analyzeImageToDiagramData(imageBlob: Blob, apiKey: string): Promise<ExtractedDiagramData>`
- Test: `imageAnalysis.test.ts` — "calls Claude Vision with correct prompt and image encoding"
- Verification: Mock API receives multipart/form-data with image and prompt

**I1.C** — Vision response is parsed into `ExtractedDiagramData` structure
- File: `src/frontend/src/types/imageAnalysis.ts`
- Type: 
  ```typescript
  type ExtractedDiagramData = {
    persons: Array<{
      id: string;
      extractedName: string;
      gender: 'male' | 'female' | 'unknown';
      confidence: number; // 0-1
      notes?: string;
      symbols?: string[]; // e.g., ["X" (deceased), "?" (unknown), "¤" (shaded)]
    }>;
    relationships: Array<{
      id: string;
      person1Id: string;
      person2Id: string;
      type: 'married' | 'affair' | 'dating' | 'unknown';
      children: string[]; // child person IDs
      confidence: number;
    }>;
    annotations: Array<{
      personId?: string;
      text: string;
      confidence: number;
    }>;
    rawAnalysis: string; // Full Claude response for debugging
  };
  ```
- Test: `imageAnalysis.test.ts` — "parses valid Claude Vision response into ExtractedDiagramData"
- Verification: Type guard `isExtractedDiagramData()` passes

### Phase 2: Person Inventory & Review

**I2.A** — System generates Person Inventory from extracted data
- File: `src/frontend/src/utils/personInventory.ts`
- Function: `generatePersonInventory(extracted: ExtractedDiagramData): PersonInventoryItem[]`
- Type:
  ```typescript
  type PersonInventoryItem = {
    id: string;
    name: string;
    gender: string;
    symbol?: string;
    notes?: string;
    extractedConfidence: number;
    relationshipCount: number; // number of relationships
    childrenCount: number;
  };
  ```
- Test: `personInventory.test.ts` — "generates inventory with correct counts and confidence scores"
- Verification: Inventory length matches person count, childrenCount > 0 for parents

**I2.B** — Review modal displays Person Inventory in sortable table
- File: `src/frontend/src/components/modals/ImageDiagramReviewModal.tsx`
- Renders:
  - Table columns: Name, Gender, Relationships, Children, Confidence, Notes
  - Edit button per row (inline edit of name/gender/notes)
  - Delete button per row (marks person for removal)
  - "Create Diagram" button (disabled if any low-confidence items)
  - "Cancel" button
- Test: `ImageDiagramReviewModal.test.tsx`
  - "displays person inventory table with all extracted names"
  - "allows inline editing of person name"
  - "allows inline selection of gender (M/F)"
  - "highlights low-confidence entries in orange"
  - "disables Create Diagram button until confidence threshold met"
- Verification: Snapshot comparison of table layout; edit callbacks fire with correct data

**I2.C** — User can correct/adjust extracted data before diagram creation
- Editable fields: name, gender, custom notes
- Users can delete persons (marks them as removed; re-layout)
- Confidence scores visible (e.g., "87% confident")
- Low-confidence items flagged with warning

### Phase 3: Diagram Creation

**I3.A** — Extracted & reviewed data is converted to Person/Partnership objects
- File: `src/frontend/src/utils/extractedDataToDiagram.ts`
- Function: `convertExtractedToDiagram(reviewed: ReviewedDiagramData): { people: Person[]; partnerships: Partnership[] }`
- Rules:
  - Each person → Person object with `name`, `birthSex`, `id`
  - Each married/affair relationship → Partnership with correct relationshipType
  - Children linked via partnership.childrenIds
  - Names normalized via `sentenceCaseName()`
  - IDs generated via `nanoid()`
- Test: `extractedDataToDiagram.test.ts`
  - "creates Person objects with correct birth sex from gender"
  - "creates Partnership objects with correct relationship type"
  - "links children via partnership.childrenIds"
  - "normalizes names to sentence case"
  - "assigns unique IDs"
- Verification: All Person.ids are unique; all partnerships reference existing personIds

**I3.B** — Diagram is added to canvas and layout is auto-arranged
- File: `src/frontend/src/utils/diagramLayout.ts`
- Function: `autoLayoutExtractedDiagram(people: Person[], partnerships: Partnership[]): LayoutPositions`
- Algorithm: Hierarchical layout (generations stacked, siblings aligned horizontally)
- Test: `diagramLayout.test.ts`
  - "arranges parents above children"
  - "aligns siblings horizontally"
  - "prevents node overlap"
- Verification: Snapshot of canvas with positioned nodes

**I3.C** — New diagram is loaded into DiagramEditor state
- File: `src/frontend/src/hooks/useFileOperations.ts`
- Function: `loadExtractedDiagram()` — sets people, partnerships, emotionalLines to extracted+laid-out data
- Test: `DiagramEditor.test.tsx` — "loads extracted diagram from image review modal"
- Verification: Canvas renders with all persons and partnerships visible

### Phase 4: Verification & Accuracy Checking

**I4.A** — Person Inventory can be exported as a CSV checklist for manual verification
- File: `src/frontend/src/utils/inventoryExport.ts`
- Function: `exportInventoryToCSV(inventory: PersonInventoryItem[]): string`
- CSV columns: Name, Gender, Relationships, Children, Confidence, Notes, Status (✓/✗)
- Test: `inventoryExport.test.ts` — "exports inventory as valid CSV"
- Verification: CSV parses correctly; row count = person count

**I4.B** — Test suite validates extraction accuracy on sample images
- File: `src/frontend/src/__tests__/imageAnalysis.integration.test.ts`
- Test data: Sample images (PNG files) with known expected outputs
- Sample 1 (user-provided "Jennie's Boy" image):
  - Expected persons: ~15 (Charlie, Ned, Lucy, Jennie, Wayne, Helen, Eileen, etc.)
  - Expected relationships: ~8 (marriages, affairs, parent-child)
  - Test: "extracts all named persons from Jennies Boy diagram"
  - Verification: Inventory includes all key people; relationship graph is connected
- Test: "correctly identifies deceased persons (X symbol)"
  - Verification: Deceased persons marked in inventory
- Test: "correctly identifies gender from circle/square symbols"
  - Verification: Gender accuracy >= 90%

**I4.C** — Confidence scoring penalizes unclear extractions
- Algorithm: 
  - Full name visible and clear → 100%
  - Name partially visible or ambiguous → 70%
  - Gender symbol unclear → penalize -20%
  - Relationship unclear → penalize -15%
- Test: `imageAnalysis.test.ts` — "applies correct confidence penalties"
- Verification: Sample extractions have expected confidence scores

---

## Implementation Order (With Dependencies)

1. **I1.C** — Define `ExtractedDiagramData` type in `src/frontend/src/types/imageAnalysis.ts` (no deps)
2. **I1.A** — Build `ImageDiagramModal` component (file input only, no upload yet)
3. **I1.B** — Build `imageAnalysis.ts` utility with Claude Vision integration (needs API key from env)
4. **I2.A** — Build `personInventory.ts` utility (deps: I1.C)
5. **I2.B** — Build `ImageDiagramReviewModal` (deps: I2.A)
6. **I3.A** — Build `extractedDataToDiagram.ts` (deps: I1.C, I2.A)
7. **I3.B** — Build `diagramLayout.ts` (deps: I3.A)
8. **I3.C** — Wire review modal → diagram creation in `DiagramEditor` (deps: all above)
9. **I4.A** — Build `inventoryExport.ts` (deps: I2.A)
10. **I4.B** — Integration tests on sample images (deps: all above)
11. **I4.C** — Confidence scoring algorithm (deps: I1.B)

---

## File Locations

**New Files to Create:**
- `src/frontend/src/types/imageAnalysis.ts` — ExtractedDiagramData type
- `src/frontend/src/utils/imageAnalysis.ts` — Claude Vision integration
- `src/frontend/src/utils/personInventory.ts` — Inventory generation
- `src/frontend/src/utils/extractedDataToDiagram.ts` — Conversion to Person/Partnership
- `src/frontend/src/utils/diagramLayout.ts` — Auto-layout algorithm
- `src/frontend/src/utils/inventoryExport.ts` — CSV export
- `src/frontend/src/components/modals/ImageDiagramModal.tsx` — Upload UI
- `src/frontend/src/components/modals/ImageDiagramReviewModal.tsx` — Review UI
- `src/frontend/src/__tests__/imageAnalysis.integration.test.ts` — Integration tests with sample images

**Files to Modify:**
- `src/frontend/src/components/DiagramModals.tsx` — Add ImageDiagramModal + ImageDiagramReviewModal
- `src/frontend/src/components/AppRibbon.tsx` — Add "Image Diagram" menu item
- `src/frontend/src/components/DiagramEditor.tsx` — Wire image extraction flow
- `src/frontend/src/hooks/useFileOperations.ts` — Add image upload handler

---

## Testing Strategy

### Unit Tests
- `imageAnalysis.test.ts` — Mock Claude Vision API, test parsing
- `personInventory.test.ts` — Inventory generation with various input sizes
- `extractedDataToDiagram.test.ts` — Person/Partnership creation
- `diagramLayout.test.ts` — Node positioning logic
- `inventoryExport.test.ts` — CSV export format

### Component Tests
- `ImageDiagramModal.test.tsx` — File input, upload button, error states
- `ImageDiagramReviewModal.test.tsx` — Table display, inline editing, confidence display

### Integration Tests
- `imageAnalysis.integration.test.ts` — Real Claude Vision API calls on sample images

### Manual Verification Checklist
- [ ] Upload "Jennie's Boy" image → verify 15+ persons extracted
- [ ] Review modal shows all persons with correct gender
- [ ] Edit a person's name, verify change persists to diagram
- [ ] Create diagram → canvas displays all persons + relationships
- [ ] Export inventory as CSV → import into spreadsheet for human review

---

## Acceptance Criteria Status

- **I1.A** — File upload input
- **I1.B** — Vision API call
- **I1.C** — Data parsing
- **I2.A** — Inventory generation
- **I2.B** — Review modal UI
- **I2.C** — Inline editing
- **I3.A** — Data conversion
- **I3.B** — Auto-layout
- **I3.C** — Diagram loading
- **I4.A** — CSV export
- **I4.B** — Integration tests on sample images
- **I4.C** — Confidence scoring

All criteria are testable and code-verifiable. No "vague" criteria that require human judgment only.

---

## Notes

1. **API Key Management:** Claude Vision calls require ANTHROPIC_API_KEY env var. Frontend should not store key; instead, calls route through backend proxy or use file-based processing.

2. **Batch Processing:** If user uploads multiple images, process one at a time through the review flow.

3. **Error Handling:** Vision API failures (timeout, invalid image) → show user error with suggestion to try a clearer image.

4. **Privacy:** Images are sent to Claude API for analysis. User should be warned about this before upload.

5. **Future Enhancement:** Add confidence-based auto-correction suggestions (e.g., "Did you mean 'Jennifer'?" if OCR is 70% confident).

---

## Spec Traceability

N/A — This is the spec document itself.
