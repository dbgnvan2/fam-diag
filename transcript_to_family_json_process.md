# Transcript -> Family Diagram JSON Process

## Goal
Convert a transcript into a validated JSON file compatible with the family diagram app.

## 1) Preprocess Transcript
1. Extract text from source (`pdftotext` for PDF, plain text for `.txt`).
2. Keep original text intact as evidence.
3. Create a working notes file with line references.

## 2) Extract Facts in Two Buckets
1. **Structured/confirmed facts** (safe for direct JSON fields):
   - Person names, sex/gender if explicit
   - Parent-child links
   - Partnerships/marriages/divorces/breakups
   - Diagnoses explicitly stated
   - Concrete dates/years explicitly stated
2. **Uncertain/inferred facts** (keep in `notes`, not hard fields):
   - Inferences from context (e.g., probable diagnosis)
   - Ambiguous or contradictory dates
   - Missing spouse/child names

## 3) Build App-Compatible JSON
Use top-level keys:
- `fileMeta`
- `people`
- `partnerships`
- `emotionalLines`
- `functionalIndicatorDefinitions`
- `eventCategories`
- `autoSaveMinutes`
- `ideasText`

### Person minimum
- `id`, `name`, `x`, `y`, `partnerships`

### Partnership minimum
- `id`, `partner1_id`, `partner2_id`, `horizontalConnectorY`, `relationshipType`, `relationshipStatus`, `children`

## 4) Evidence and Confidence
For each critical item, preserve evidence in `notes`:
- Example: `"Transcript: diagnosed paranoid schizophrenia."`
- If contradictory: `"Transcript conflict: says 1975 in one section, 2003 in another."`

## 5) Validate Before Import
1. JSON parse check.
2. Confirm IDs referenced by partnerships/children exist.
3. Open in app and verify diagram loads.
4. Correct geometry (x/y) manually in app after import.

## 6) Recommended Human-in-the-Loop Pattern
1. AI extracts candidate facts.
2. Human reviews only uncertain notes.
3. AI regenerates a cleaned JSON (v2) with resolved uncertainties.
4. Save final as canonical import file.

## Optional Next Step (Automation)
Create a small extractor that outputs an intermediate `facts.json`:
- `people[]`, `relationships[]`, `events[]`, `uncertainties[]`
Then run a deterministic mapper from `facts.json` -> app JSON.
