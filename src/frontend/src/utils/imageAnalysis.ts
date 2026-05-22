/**
 * Image analysis utility — extracts family diagram structure from images via Claude Vision API.
 */

import { nanoid } from 'nanoid';
import type { ExtractedDiagramData } from '../types/imageAnalysis';
import { isExtractedDiagramData } from '../types/imageAnalysis';

const VISION_PROMPT = `You are analyzing a handwritten or drawn family diagram. Extract all family members, relationships, and annotations.

Return ONLY valid JSON (no markdown, no extra text) with this structure:
{
  "persons": [
    {
      "id": "unique-id",
      "extractedName": "Person Name",
      "gender": "male" | "female" | "unknown",
      "confidence": 0-1,
      "notes": "any additional info",
      "symbols": ["X" for deceased, "?" for unknown, etc]
    }
  ],
  "relationships": [
    {
      "id": "unique-id",
      "person1Id": "id-of-person1",
      "person2Id": "id-of-person2",
      "type": "married" | "affair" | "dating" | "unknown",
      "children": ["child-id1", "child-id2"],
      "confidence": 0-1
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

Scoring rules:
- Confidence: 1.0 = clear name and gender, 0.7 = partially visible/ambiguous, penalize -0.2 for unclear gender symbol, -0.15 for unclear relationship
- Gender: male=square/box, female=circle/oval, unknown=unclear
- Symbols: X=deceased, ?=unknown, shaded=special notation
- Relationships: Connected by lines (married=horizontal, affair=wavy, dating=dashed, parent-child=vertical)
- Children: List all person IDs connected downward from a relationship

Be conservative with confidence scores. If unsure about a name, mark confidence lower.`;

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

export async function analyzeImageToDiagramData(
  imageBlob: Blob,
  apiKey: string
): Promise<ExtractedDiagramData> {
  const base64Image = await blobToBase64(imageBlob);
  const mimeType = imageBlob.type || 'image/jpeg';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
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

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Claude Vision API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const rawAnalysis = data.content[0]?.text || '';

  // Parse the JSON response
  let parsed: ExtractedDiagramData;
  try {
    parsed = JSON.parse(rawAnalysis);
  } catch {
    throw new Error(`Failed to parse Claude Vision response as JSON: ${rawAnalysis.slice(0, 200)}`);
  }

  // Validate structure
  if (!isExtractedDiagramData(parsed)) {
    throw new Error('Extracted data does not match ExtractedDiagramData schema');
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
