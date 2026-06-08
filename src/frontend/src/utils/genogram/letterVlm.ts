/**
 * Per-symbol VLM fallback: ask the configured Anthropic model to read a
 * single character out of a cleaned crop. This is the small-token-budget
 * call that catches the cases Tesseract can't.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M6.A.2
 */

import type { LetterReadResult } from './letterOcr';

const FALLBACK_PROMPT =
  'You are reading a single hand-written character out of a small image. ' +
  'Respond with EXACTLY one character (the letter or digit you see) and ' +
  'nothing else. If the image contains no recognizable character, respond ' +
  'with the literal four-letter word "null" (no quotes).';

/**
 * Send a single cleaned crop (data URL) to Anthropic for one-character OCR.
 * Uses the same browser-direct call pattern as the other Anthropic helpers
 * in this codebase, including the dangerous-direct-browser-access opt-in.
 */
export async function ocrViaClaudeVision(
  cropDataUrl: string,
  apiKey: string,
  model: string
): Promise<LetterReadResult> {
  // The data URL is "data:image/png;base64,XYZ..." — extract the base64 body
  // and the mime type for the Anthropic request shape.
  const match = cropDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) {
    return { letter: null, confidence: 0, source: 'none' };
  }
  const [, mediaType, base64Body] = match;

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Body },
              },
              { type: 'text', text: FALLBACK_PROMPT },
            ],
          },
        ],
      }),
    });
  } catch {
    return { letter: null, confidence: 0, source: 'none' };
  }
  if (!response.ok) {
    return { letter: null, confidence: 0, source: 'none' };
  }
  const data = await response.json();
  const text = (data?.content?.[0]?.text || '').trim();
  if (!text || text.toLowerCase() === 'null') {
    return { letter: null, confidence: 0.6, source: 'vlm' };
  }
  const letter = text.replace(/\s/g, '').charAt(0) || null;
  return { letter, confidence: 0.9, source: 'vlm' };
}
