# Session Capture Extraction Template (User Prompt)

Use the attached schema and produce a `fam-diag-session-capture` JSON import object.

## Inputs
- Current diagram JSON (for duplicate prevention + identity matching):  
`{{CURRENT_DIAGRAM_JSON}}`
- Transcript text from this session:  
`{{SESSION_TRANSCRIPT_TEXT}}`
- Optional existing timeline/session IDs:  
`{{SESSION_ID_OR_DATE}}`

## Required behavior
1. Compare transcript facts against current diagram before emitting operations.
2. Prefer matching existing people (by id/name/alias/context) instead of creating new duplicates.
3. Emit only these operation types:
   - `upsert_person`
   - `add_person_event`
   - `upsert_partnership`
4. For each operation include:
   - `id`
   - `type`
   - `payload`
   - `matchHints`
   - `confidence`
   - `recommendedAction` (`apply`, `review`, `skip`)
   - `ambiguity` when needed
   - `source.quote` with short evidence
5. Place unresolved issues in top-level `ambiguityNotes`.
6. Output valid JSON only.

## Quality thresholds
- Confidence >= 0.85: use `apply` unless conflicting.
- Confidence 0.60–0.84: use `review`.
- Confidence < 0.60: use `skip` unless critical.

## Event payload expectations
- Include `date` if known, otherwise omit.
- Include `category` and `observations`.
- Optional: `intensity`, `frequency`, `impact`, `howWell`, `otherPersonName`.

## Return
One JSON object that validates against `session_capture_schema.json`.
