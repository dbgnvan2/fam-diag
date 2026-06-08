/**
 * Image analysis utility — extracts family diagram structure from images via Claude Vision API.
 */

import { nanoid } from 'nanoid';
import type { ExtractedDiagramData } from '../types/imageAnalysis';
import { isExtractedDiagramData } from '../types/imageAnalysis';
import { ImportLog, maskSecret } from './importLog';

const VISION_PROMPT = `You are analyzing a hand-drawn genogram (family tree) photographed at an angle. Your job is to extract every person, every relationship between them, and every annotation written near them.

==========================================
STRICT SHAPE KEY — apply mechanically.
==========================================

- Square-ish shape (with or without an X through it) = MALE. A box with an X is a DECEASED male, still a person.
- Circle-ish shape (with or without an X through it) = FEMALE. A circle with an X is a DECEASED female, still a person.
- A plain X with NO surrounding box or circle = UNKNOWN-SEX person. Still a person. Set gender = "unknown".
- Triangle = pregnancy (NOT a person). Do not emit a person for a triangle.
- Small circle containing the letter "c" = pregnancy. Treat as a female-ish person per shape rule.
- Star or asterisk = miscarriage / loss. NOT a person. Note its presence in the partnership's notes ("N miscarriages") rather than emitting a person.

==========================================
SCAN DISCIPLINE — region by region.
==========================================

Before you write any output, mentally scan the image in this order:
1. Top-left quadrant
2. Top-right quadrant
3. Middle band
4. Bottom-left quadrant
5. Bottom-right quadrant

In each region, list every symbol you see (shape, has-X, label, confidence). Only AFTER you have completed the full enumeration may you start producing the JSON. Do not let any region come out empty unless you have looked at it carefully — it is far more common to undercount than to overcount.

==========================================
OUTPUT FORMAT — strict JSON, nothing else.
==========================================

Your entire response must be a single JSON object. Do NOT wrap the JSON in markdown code fences (no triple backticks, no "\`\`\`json"). Do NOT include any prose before or after the JSON. The first character of your response must be { and the last character must be }.

{
  "persons": [
    {
      "id": "unique-id",
      "extractedName": "Person Name OR auto-name (see naming rules below)",
      "gender": "male" | "female" | "unknown",
      "confidence": 0-1,
      "notes": "every descriptor written near this person",
      "symbols": ["X" for deceased, "?" for plain-X with no shape, etc.]
    }
  ],
  "relationships": [
    {
      "id": "unique-id",
      "person1Id": "id-of-person1",
      "person2Id": "id-of-person2",
      "type": "married" | "affair" | "dating" | "unknown",
      "children": ["child-id1", "child-id2"],
      "confidence": 0-1,
      "notes": "any text written near this relationship line, plus miscarriage counts if any",
      "speculative": true | false
    }
  ],
  "annotations": [
    {
      "personId": "optional-person-id",
      "text": "annotation text",
      "confidence": 0-1
    }
  ]
}

==========================================
NAMING RULES.
==========================================

1. If a shape has a written name or initial inside or directly beside it (e.g. "Ned", "M", "K", "D", "E", "Jennie"), use that as extractedName.
2. If a shape has NO name, auto-name it:
   - Squares: "Male 1", "Male 2", ... in reading order (top-to-bottom, left-to-right).
   - Circles: "Female 1", "Female 2", ... in reading order.
   - Plain X (unknown sex): "Unknown 1", "Unknown 2", ...
3. NEVER return an empty extractedName.

Birth/death/marriage annotations like "b.1968", "d.2014", "m.1969", "m.2nd div.2021" are DATA, not names. Put them in the person's notes ("born 1968", "died 2014") or in the relationship's notes if they describe a union date.

==========================================
LINE SEMANTICS.
==========================================

- Solid horizontal line between two adults = married.
- Wavy / zig-zag line = affair.
- Dashed line = dating.
- Vertical line dropping from a couple's horizontal connector to a shape below = parent → child.

==========================================
NOTES CONTENT.
==========================================

Person notes must capture EACH of these categories when present:
- occupation (e.g. "farmer", "blacksmith", "fisherman", "history professor")
- character traits (e.g. "silent", "talkative", "religious", "superstitious")
- health (e.g. "tuberculosis", "OCD", "insomnia", "malnourished", "pleurisy")
- life events (e.g. "died at 7 years old", "pregnant", "sexually abused")
- deceased status — when the person is drawn with an X, the symbols array MUST include "X"
- speculative lineage — when a sibling group is annotated as uncertain, set the partnership.speculative = true

Relationship notes capture any descriptive text written near the union line (e.g. "Ned (farmer) and Lucy (religious)"), plus a miscarriage tally if any stars/asterisks appear along the sibling line ("2 miscarriages").

==========================================
CONFIDENCE GUIDANCE.
==========================================

- 1.0 = clearly drawn shape, name fully legible.
- 0.7 = partially visible or ambiguous.
- Subtract 0.2 if the gender symbol is unclear.
- Subtract 0.15 if a line type is unclear.

Be conservative with confidence scores. Be EXHAUSTIVE with extraction — under-counting is the dominant failure mode. If you are uncertain about a shape's gender, emit it with gender="unknown" and lower confidence rather than dropping it.`;

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const DEFAULT_VISION_MODEL = 'claude-sonnet-4-6';

/**
 * Strip ```json … ``` (or plain ``` … ```) code fences from a model response.
 * Returns the inner content trimmed, or the original string trimmed if no
 * fences are present.
 *
 * Spec: docs/implementation_plan_2026-06-06.md M4 — Vision prompt fidelity
 *       (defensive parser for models that fence the JSON despite the prompt).
 */
/**
 * Find the first balanced `{ … }` block in a string. Useful when the model
 * wraps its JSON in prose ("Here is the analysis: { … } Let me know …").
 * Respects strings and escapes so braces inside `"…"` don't unbalance.
 * Returns null if no balanced block is present.
 */
export function extractFirstJsonObject(raw: string): string | null {
  const text = raw || '';
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function stripCodeFences(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed.startsWith('```')) return trimmed;
  // Match an opening fence (optional language tag) and the closing fence.
  const match = trimmed.match(/^```(?:[a-zA-Z0-9_-]+)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (match) return match[1].trim();
  // Opened but never closed — drop the leading fence line and return the rest.
  const firstNewline = trimmed.indexOf('\n');
  return firstNewline >= 0 ? trimmed.slice(firstNewline + 1).trim() : trimmed;
}

export async function analyzeImageToDiagramData(
  imageBlob: Blob,
  apiKey: string,
  model: string = DEFAULT_VISION_MODEL,
  log: ImportLog = new ImportLog()
): Promise<ExtractedDiagramData> {
  log.info(`analyzeImageToDiagramData: model=${model}`);
  log.info(`API key: ${maskSecret(apiKey)}`);
  log.info(`Image blob: type=${imageBlob.type || '(none)'} size=${imageBlob.size} bytes`);

  const base64Image = await blobToBase64(imageBlob);
  const mimeType = imageBlob.type || 'image/jpeg';
  log.info(`Encoded image: mime=${mimeType} base64Length=${base64Image.length}`);

  log.info('POST https://api.anthropic.com/v1/messages');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      // Required for browser-origin requests. Without this Anthropic returns
      // a CORS error before the request even reaches the model.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: VISION_PROMPT,
            },
          ],
        },
      ],
    }),
  });

  log.info(`Response status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const error = await response.json();
      log.error(`API error body: ${JSON.stringify(error)}`);
      detail = error.error?.message || detail;
    } catch (err) {
      log.error(`Failed to read error response body: ${(err as Error).message}`);
    }
    throw new Error(`Claude Vision API error: ${detail}`);
  }

  const data = await response.json();
  const rawAnalysis = data.content[0]?.text || '';
  log.info(`Raw model response (length=${rawAnalysis.length}):\n${rawAnalysis}`);

  // Log every response so the browser console always has the raw text for
  // diagnostics, not just when our schema check fails.
  // eslint-disable-next-line no-console
  console.info('Claude Vision raw response:', rawAnalysis);

  // Parse the JSON response. Strip markdown fences first — the model
  // sometimes wraps its output in ```json … ``` even when told not to.
  // If that still fails, try to extract the first balanced { … } block
  // from any prose the model may have wrapped around it.
  let parsed: ExtractedDiagramData;
  const cleaned = stripCodeFences(rawAnalysis);
  log.info(`After stripCodeFences: length=${cleaned.length}`);
  try {
    parsed = JSON.parse(cleaned);
    log.info('JSON.parse succeeded on stripCodeFences output');
  } catch (firstErr) {
    log.warn(`Direct parse failed: ${(firstErr as Error).message}`);
    const extracted = extractFirstJsonObject(cleaned);
    if (extracted) {
      log.info(`extractFirstJsonObject found a balanced {…} block of length ${extracted.length}`);
      try {
        parsed = JSON.parse(extracted);
        log.info('JSON.parse succeeded on extracted block');
      } catch (secondErr) {
        log.error(`Parse failed on extracted block: ${(secondErr as Error).message}`);
        throw new Error(
          `Failed to parse Claude Vision response as JSON: ${rawAnalysis.slice(0, 200)}`
        );
      }
    } else {
      log.error('No balanced {…} block found in response');
      throw new Error(
        `Failed to parse Claude Vision response as JSON: ${rawAnalysis.slice(0, 200)}`
      );
    }
  }

  // Forgive common minor deviations from the requested schema before
  // hard-validating: lowercase the gender field and default the optional
  // annotations array.
  if (Array.isArray((parsed as { persons?: unknown }).persons)) {
    (parsed as { persons: { gender?: unknown }[] }).persons.forEach((p) => {
      if (typeof p?.gender === 'string') {
        p.gender = (p.gender as string).toLowerCase();
      }
    });
  }
  if (!Array.isArray((parsed as { annotations?: unknown }).annotations)) {
    (parsed as { annotations: unknown[] }).annotations = [];
  }

  // Validate structure with a verbose error list so any remaining
  // mismatch surfaces in the alert instead of a generic message.
  const validationErrors: string[] = [];
  if (!isExtractedDiagramData(parsed, validationErrors)) {
    validationErrors.forEach((e) => log.error(`schema: ${e}`));
    throw new Error(
      `Extracted data does not match ExtractedDiagramData schema:\n` +
        validationErrors.slice(0, 6).join('\n') +
        (validationErrors.length > 6 ? `\n…and ${validationErrors.length - 6} more` : '')
    );
  }

  log.info(
    `Parsed counts: persons=${parsed.persons.length} relationships=${parsed.relationships.length} annotations=${parsed.annotations.length}`
  );

  // The schema can be valid but empty — that happens when the model decides
  // the image is too hard to parse and returns an empty array. Surface this
  // explicitly with the raw response logged for triage.
  if (parsed.persons.length === 0) {
    log.error('Model returned 0 persons.');
    // eslint-disable-next-line no-console
    console.warn('Claude Vision returned 0 persons. Raw response:\n', rawAnalysis);
    throw new Error(
      'The model returned 0 people from this image. Try a more capable model (Opus 4.7), a higher-resolution photo, or remove glare/shadow. A diagnostic log has been downloaded.'
    );
  }

  // Ensure all persons have unique IDs
  const personIdMap = new Map<string, string>();
  parsed.persons.forEach((person) => {
    if (!personIdMap.has(person.id)) {
      personIdMap.set(person.id, person.id);
    }
  });

  // Map relationship person IDs to ensure they exist
  parsed.relationships = parsed.relationships.filter((rel) => {
    const p1Exists = parsed.persons.some((p) => p.id === rel.person1Id);
    const p2Exists = parsed.persons.some((p) => p.id === rel.person2Id);
    return p1Exists && p2Exists;
  });

  // Filter children to only include those that exist
  parsed.relationships.forEach((rel) => {
    rel.children = rel.children.filter((childId) => parsed.persons.some((p) => p.id === childId));
  });

  parsed.rawAnalysis = rawAnalysis;
  return parsed;
}

export function generatePersonId(): string {
  return nanoid(12);
}
