/**
 * VLM-based genogram extraction.
 *
 * Sends a whole genogram image to Claude Vision, which extracts people,
 * relationships, and metadata in a single pass. Returns FactsImportData
 * for conversion to DiagramImportData.
 *
 * This replaces the brittle classical CV pipeline (contour detection,
 * shape classification, OCR) with a robust vision-language approach
 * that handles ambiguity naturally.
 *
 * Cost: ~$0.01-0.03 per image (Claude Sonnet 4 vision)
 */

import type { FactsImportData } from '../../types/diagramEditor';

export type VLMImportOptions = {
  apiKey: string;
  model: string;
  maxImageDimension?: number; // Default: 1600
  imageQuality?: number; // 0-1, default: 0.85
  maxTokens?: number; // Default: 4000
  timeoutMs?: number; // Default: 60000
  onProgress?: (message: string) => void;
};

/**
 * Cost estimate for image processing.
 *
 * Based on Claude Sonnet 4 pricing (as of 2026-06-08):
 * - Input: $3 / 1M tokens
 * - Output: $15 / 1M tokens
 *
 * A typical 1600×1200 image at 85% JPEG quality:
 * - ~50KB encoded size
 * - ~75 tokens for image encoding
 * - ~1500 tokens for prompt text
 * - ~2000-3000 tokens for JSON response
 * - Total: ~3600 tokens
 * - Cost: ~$0.012 per image
 */
export const GENOGRAM_IMPORT_COST_ESTIMATE = {
  estimatedTokensPerImage: 3600,
  inputTokenCostPerMillion: 3,
  outputTokenCostPerMillion: 15,
  estimatedCostPerImage: 0.012, // in USD
  estimatedCostRange: { min: 0.01, max: 0.03 },
};

/**
 * Extract genogram structure from an image using Claude Vision.
 *
 * Sends the image to Anthropic and returns structured facts (people,
 * relationships, metadata) as FactsImportData.
 *
 * Spec: docs/Image Import VLM specification.md
 */
export async function vlmImport(
  imageBlob: Blob,
  options: VLMImportOptions
): Promise<FactsImportData> {
  const {
    apiKey,
    model,
    maxImageDimension = 1600,
    imageQuality = 0.85,
    maxTokens = 4000,
    timeoutMs = 60000,
    onProgress,
  } = options;

  // Step 1: Downscale image if needed
  onProgress?.('[vlmImport] Preparing image...');
  const scaledImageBase64 = await downscaleAndEncode(
    imageBlob,
    maxImageDimension,
    imageQuality
  );

  // Step 2: Call Anthropic Vision API
  onProgress?.('[vlmImport] Sending to Claude Vision...');
  const response = await callClaudeVision(
    scaledImageBase64,
    apiKey,
    model,
    maxTokens,
    timeoutMs
  );

  // Step 3: Parse and validate response
  onProgress?.('[vlmImport] Parsing response...');
  const facts = parseVLMResponse(response);

  // Log extracted data for debugging (to console AND to page)
  const debugData = {
    peopleCount: facts.people?.length ?? 0,
    people: facts.people?.map(p => ({
      name: p.name,
      x: p.x,
      y: p.y,
      sex: p.sex,
      birthYear: p.birthYear,
      deathYear: p.deathYear,
    })),
    relationshipCount: facts.relationships?.length ?? 0,
  };
  console.log('[vlmImport] Extracted facts:', debugData);

  // Also display on page so we can see it in screenshots
  const debugDiv = document.createElement('div');
  debugDiv.style.cssText = 'position:fixed;top:10px;right:10px;background:white;border:2px solid red;padding:10px;max-height:300px;overflow-y:auto;z-index:9999;font-size:11px;font-family:monospace;';
  debugDiv.innerHTML = `<strong style="color:red">[VLM Debug]</strong><pre>${JSON.stringify(debugData, null, 2)}</pre>`;
  document.body.appendChild(debugDiv);

  // Step 4: Deduplicate people by name
  deduplicatePeopleByName(facts);

  onProgress?.('[vlmImport] Complete');
  return facts;
}

/**
 * Downscale image to fit within maxDimension and encode as base64 JPEG.
 * Preserves aspect ratio.
 */
async function downscaleAndEncode(
  blob: Blob,
  maxDimension: number,
  quality: number
): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;

  // Calculate scale factor to fit within maxDimension
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  // Draw onto canvas at new size
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');
  ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);

  // Encode as JPEG base64
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Failed to create blob'));
        else {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }
      },
      'image/jpeg',
      quality
    );
  });
}

/**
 * Call Anthropic Claude Vision API directly from browser.
 */
async function callClaudeVision(
  imageBase64: string,
  apiKey: string,
  model: string,
  maxTokens: number,
  timeoutMs: number
): Promise<string> {
  const systemPrompt = `You are an expert at reading hand-drawn genograms (family-tree diagrams used in family-systems therapy), including ones that are photographed at an angle, faint, or drawn in pencil. You will be given ONE image of a genogram. Extract its content into a single JSON object and return ONLY that JSON — no prose, no markdown fences.

SYMBOL KEY (standard genogram notation — apply strictly, by shape):
- A square-ish shape = MALE. (sex: "male")
- A circle-ish shape = FEMALE. (sex: "female")
- An X drawn THROUGH a square or circle = that person is DECEASED. The shape still tells you the sex. (deceased: true)
- A plain X with NO enclosing square or circle = a person of UNKNOWN sex. (sex: "unknown")
- A triangle = a pregnancy. This is NOT a born person — do NOT add it to people[].
- A small star or asterisk (*) = a miscarriage / pregnancy loss. NOT a person — do NOT add it to people[].
- A small circle containing the letter "c" = a current pregnancy. Treat as a pregnancy marker (note it), not a fully born person.
- A horizontal line connecting two people = a couple/partnership.
- "m.YYYY" near a couple line = marriage year. "div. YYYY" or a double slash = divorce.
- Text like "b.1968" or "b.1940 d.2014" next to a symbol = birth / death years.

READING X-ED SYMBOLS: a heavy X often overlaps the letter inside. Do your best to read the letter UNDER the X. If you cannot, set name to "" and confidence "low".

UNIQUE-LABEL RULE (CRITICAL):
Many people are labelled with a single letter, and letters REPEAT across the page (e.g. three different people marked "M"). Every person you output MUST have a globally unique, stable "name". Disambiguate using the nearest birth year, then by role/position. Examples: "M (b.1968)", "M (b.1939)", "M (grandmother, top-right)". Use the EXACT SAME label everywhere you reference that person — in people[], in family.parents, in family.childrenMentionedByName, and in relationships a/b.

POSITION EXTRACTION (CRITICAL FOR LAYOUT):
For each person symbol in the diagram, estimate its position as a percentage of the image:
- x: 0-100 (0 = left edge, 100 = right edge) — measure to the CENTER of the symbol
- y: 0-100 (0 = top edge, 100 = bottom edge) — measure to the CENTER of the symbol
This preserves the spatial layout of the genogram so it can be reconstructed with correct positioning.

OUTPUT:
Return a single JSON object with these keys:
{
  "sourceFile": string,
  "processedAt": "YYYY-MM-DD",
  "family": {
    "parents": [label, label],
    "marriageYear": number,
    "childrenMentionedByName": [label, ...]
  },
  "relationships": [
    { "a": label, "b": label, "type": "married"|"engaged"|"dating"|..., "status": "married"|"divorce"|"widowed"|..., "evidence": "free text" }
  ],
  "clinical": {
    "explicitSchizophreniaMentions": [],
    "explicitNoDiagnosisMentions": [],
    "events": []
  },
  "uncertainties": [string, ...],
  "people": [
    { "name": label, "sex": "male"|"female"|"unknown", "deceased": boolean, "birthYear": number|null, "deathYear": number|null, "confidence": "high"|"med"|"low", "notes": "adjacent text", "x": 0-100, "y": 0-100 }
  ]
}

RULES:
- Put EVERY square, circle, and plain-X person in people[]. Exclude triangles and stars.
- Mark deceased: true for any symbol with an X through it.
- If a birth or death year is not written, use null — never guess a year.
- If unsure about a shape, X, letter, or relationship, list it in uncertainties and set confidence to "med" or "low".
- ALWAYS include x and y position (0-100 %) for every person, measured to the center of the symbol.
- Return ONLY the JSON object. No commentary, no code fences.`;

  const userMessage = 'Extract all people and relationships from this genogram image.';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
              },
              { type: 'text', text: userMessage },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Claude Vision API error (${res.status}): ${error}`);
    }

    const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
    const textContent = data.content.find((c) => c.type === 'text');
    if (!textContent) throw new Error('No text response from Claude Vision');

    return textContent.text;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Claude Vision request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Parse VLM JSON response and validate as FactsImportData.
 * Handles common formatting issues (markdown fences, etc).
 */
function parseVLMResponse(text: string): FactsImportData {
  // Strip markdown code fences if present
  let clean = text.trim();
  if (clean.startsWith('```json')) clean = clean.slice(7);
  if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  clean = clean.trim();

  let facts: FactsImportData;
  try {
    facts = JSON.parse(clean) as FactsImportData;
  } catch (error) {
    throw new Error(`Failed to parse VLM response as JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Validate basic structure
  if (typeof facts !== 'object' || facts === null) {
    throw new Error('VLM response is not a JSON object');
  }

  // Ensure arrays are arrays
  if (facts.people && !Array.isArray(facts.people)) facts.people = [];
  if (facts.relationships && !Array.isArray(facts.relationships)) facts.relationships = [];
  if (facts.uncertainties && !Array.isArray(facts.uncertainties)) facts.uncertainties = [];

  return facts;
}

/**
 * Defensive deduplication: if multiple people share a name, append a suffix.
 * This should not happen if the VLM prompt is followed, but enforce it anyway.
 */
function deduplicatePeopleByName(facts: FactsImportData): void {
  if (!facts.people || facts.people.length === 0) return;

  const seen = new Map<string, number>();
  const newUncertainties: string[] = [];

  for (const person of facts.people) {
    const name = person.name || '';
    const count = seen.get(name) || 0;

    if (count > 0) {
      const oldName = name;
      person.name = `${name} (dup ${count + 1})`;
      newUncertainties.push(`Duplicate person name "${oldName}" — appended suffix to disambiguate`);
    }

    seen.set(name, count + 1);
  }

  if (newUncertainties.length > 0) {
    facts.uncertainties = [...(facts.uncertainties || []), ...newUncertainties];
  }
}
