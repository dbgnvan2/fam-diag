# Transcript Emotional Pattern Language (EPL Extraction)

## Purpose
Provide phrase patterns that the app can map into Emotional Pattern Lines (EPLs) during `Process Transcript`.

## Current Supported EPL Types
- `conflict` -> sawtooth line
- `fusion` -> parallel solid/dotted fusion line
- `cutoff` -> cutoff marker line
- `projection` -> new `>>>>` flow from `person1` (source/parent) to `person2` (target/child)

## Preferred Sentence Templates
Use explicit names whenever possible.

### Conflict
- "Jim and Mary would really go at it. They argued a lot."
- "Jim and Mary were in chronic conflict."
- "Jim fought with Mary constantly."

Expected extraction:
- `person1: Jim`, `person2: Mary`, `relationshipType: conflict`

### Cutoff
- "This son was very distant from his sister Mary." (works best if both names are present)
- "Jim had no contact with Mary."
- "Jim was cut off from Mary."
- "Jim and Mary were estranged."

Expected extraction:
- `person1: Jim`, `person2: Mary`, `relationshipType: cutoff`

### Fusion
- "Mary the daughter was very reactive around her mother Betty."
- "Mary was fused with Betty."
- "Mary and Betty were enmeshed."

Expected extraction:
- `person1: Mary`, `person2: Betty`, `relationshipType: fusion`

### Projection (new)
- "The parents Don and Mimi were very focused on Donald."
- "Don projected his anxiety onto Donald."
- "Mimi was overly focused on Donald."

Expected extraction:
- One or two directional lines:
- `Don -> Donald` (`projection-flow`)
- `Mimi -> Donald` (`projection-flow`)

## Notes on Reliability
- Extraction is strongest when statements include explicit proper names.
- Role-only references ("his sister", "the child", "this son") are ambiguous unless the transcript also names the person nearby.
- The parser currently creates a draft EPL and stores phrase evidence in EPL notes for human review.

## Recommended Authoring Rules for Better Extraction
- Keep one relationship claim per sentence.
- Prefer "Name + Name" instead of pronouns.
- Add temporal markers if known:
- Example: "From 2005 to 2012, Jim and Mary were in chronic conflict."

## Review Workflow
1. Run `Process Transcript`.
2. In import modal, choose `Create New Family` or `Add To Existing Family`.
3. Open each extracted EPL in Properties and verify type/direction.
4. Correct false positives and save.
