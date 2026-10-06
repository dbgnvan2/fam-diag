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
import { applyDataRules } from './genogramRules';

export type VLMImportOptions = {
  apiKey: string;
  model: string;
  maxImageDimension?: number; // Default: 2400
  imageQuality?: number; // 0-1, default: 0.85
  maxTokens?: number; // Default: 64000
  /**
   * Fail when the response stream sends nothing for this long. The reply is
   * streamed, so a long reply that keeps arriving never times out; a stalled
   * one does. Default: 90000
   */
  idleTimeoutMs?: number;
  /**
   * output_config.effort. Leave undefined for a model that does not accept
   * effort (Haiku 4.5, custom models) — see AIModelOption.supportsEffort.
   */
  effort?: VisionEffort;
  onProgress?: (message: string) => void;
  /** Optional abort signal — if aborted, the API call is cancelled. */
  signal?: AbortSignal;
  /** Retries after a retryable failure (429, 5xx, 529 overloaded, network). Default: 2 */
  maxRetries?: number;
  /** First retry delay; doubles each retry. A Retry-After header wins. Default: 2000 */
  retryBaseDelayMs?: number;
  /** What the user told the import dialog about the drawing. */
  hints?: ImageImportHints;
};

export type VisionEffort = 'low' | 'medium' | 'high';

/** The import dialog's hints. 0 means "not given". */
export type ImageImportHints = {
  generationCount: number;
  expectedPersonCount: number;
  handDrawn: boolean;
  hasNotes: boolean;
};

/**
 * The user turn sent with the image. The dialog's hints go in here; they
 * were collected and logged but never sent (review 2026-09-30 DE2-04). A
 * hint is context for the reader, not a quota: the model is told not to
 * invent people or generations to match it.
 */
export function buildVisionUserMessage(hints?: ImageImportHints): string {
  const lines = ['Extract all people and relationships from this genogram image.'];
  if (hints) {
    const known: string[] = [];
    if (hints.generationCount > 0) known.push(`it spans about ${hints.generationCount} generations`);
    if (hints.expectedPersonCount > 0) known.push(`it shows about ${hints.expectedPersonCount} people`);
    if (hints.handDrawn) known.push('it is hand-drawn');
    if (hints.hasNotes) known.push('it has handwritten notes beside the symbols, which are not people');
    if (known.length) {
      lines.push(
        `The person who drew it says ${known.join('; ')}.`,
        'Use this to check that nothing was missed, but extract only what is drawn: never add people or generations to match these numbers, and list any mismatch in uncertainties.'
      );
    }
  }
  return lines.join('\n');
}

import { RETRYABLE_STATUSES } from '../httpRetry';
/** Upper bound on any single wait, including a server-sent Retry-After. */
const MAX_RETRY_DELAY_MS = 60_000;
/** How often (in received characters) the import log hears about streaming progress. */
const STREAM_PROGRESS_STEP_CHARS = 2000;
/** Mid-stream `error` events that mean "try again", not "this request is wrong". */
const RETRYABLE_STREAM_ERRORS = new Set(['overloaded_error', 'api_error', 'rate_limit_error']);

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
    maxImageDimension = 2400,
    imageQuality = 0.85,
    maxTokens = 64000,
    idleTimeoutMs = 90000,
    effort,
    onProgress,
    signal,
    maxRetries = 2,
    retryBaseDelayMs = 2000,
    hints,
  } = options;

  // Step 1: Downscale image if needed
  onProgress?.('[vlmImport] Preparing image...');
  const scaledImageBase64 = await downscaleAndEncode(
    imageBlob,
    maxImageDimension,
    imageQuality
  );

  // Check for early abort
  if (signal?.aborted) throw new Error('Aborted by user');

  // Step 2: Call Anthropic Vision API
  onProgress?.('[vlmImport] Sending to Claude Vision...');
  let lastReported = { phase: '', textChars: -STREAM_PROGRESS_STEP_CHARS };
  const response = await callClaudeVision(scaledImageBase64, apiKey, model, maxTokens, idleTimeoutMs, signal, {
    maxRetries,
    baseDelayMs: retryBaseDelayMs,
    userMessage: buildVisionUserMessage(hints),
    effort,
    onStream: ({ phase, textChars }) => {
      // Report a phase change at once, then every STREAM_PROGRESS_STEP_CHARS.
      if (phase === lastReported.phase && textChars - lastReported.textChars < STREAM_PROGRESS_STEP_CHARS) return;
      lastReported = { phase, textChars };
      onProgress?.(
        phase === 'thinking'
          ? '[vlmImport] Claude is reading the diagram...'
          : `[vlmImport] Receiving response (${textChars.toLocaleString()} characters)...`
      );
    },
    onRetry: (attempt, reason, delayMs) =>
      onProgress?.(
        `[vlmImport] ${reason}; retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1} of ${maxRetries + 1})...`
      ),
  });

  // Step 3: Parse and validate response
  onProgress?.('[vlmImport] Parsing response...');
  const facts = parseVLMResponse(response);

  // Step 3.5: Apply PHASE 1 DATA RULES (fact-check + auto-fix)
  // See: genogramRules.ts for full rule documentation
  onProgress?.('[vlmImport] Applying genogram rules...');
  const ruleResult = applyDataRules(facts);
  if (ruleResult.warnings.length > 0 || ruleResult.fixes.length > 0) {
    facts.uncertainties = [
      ...(facts.uncertainties || []),
      ...ruleResult.fixes.map((f) => `[fix] ${f}`),
      ...ruleResult.warnings.map((w) => `[warn] ${w}`),
    ];
  }

  // Counts only: the names, dates and relationships are client data, and the
  // console keeps them where other tools and other users of the machine can
  // read them (gap review F-18). The full facts are in the import log.
  if (import.meta.env.DEV) {
    console.info('[vlmImport] Extracted facts:', {
      peopleCount: facts.people?.length ?? 0,
      relationshipCount: facts.relationships?.length ?? 0,
    });
  }

  // Step 4: (Deduplication is now handled by R3 in applyDataRules above)

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

export type VisionRetryOptions = {
  maxRetries: number;
  baseDelayMs: number;
  onRetry?: (attempt: number, reason: string, delayMs: number) => void;
  /** The user turn sent with the image (see buildVisionUserMessage). */
  userMessage?: string;
  /** output_config.effort; omitted from the request when undefined. */
  effort?: VisionEffort;
  /** Called as streamed content arrives. */
  onStream?: (status: VisionStreamStatus) => void;
};

export type VisionStreamStatus = { phase: 'thinking' | 'writing'; textChars: number };

/** Wait `ms`, rejecting early with AbortError-style cancellation if `signal` aborts. */
const waitUnlessAborted = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Cancelled by user'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Cancelled by user'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/** Retry-After (seconds or HTTP date) in ms, or null. */
const retryAfterMs = (res: Response): number | null => {
  const header = res.headers.get('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
};

/**
 * Call Anthropic Claude Vision API directly from browser.
 *
 * The reply is streamed (stream: true): a large diagram needs tens of
 * thousands of output tokens, which takes minutes, and a non-streamed request
 * that long risks a dropped connection. Each attempt fails if the stream goes
 * quiet for `idleTimeoutMs`. A retryable failure (see RETRYABLE_STATUSES, a
 * retryable mid-stream error event, or a network error) is retried with
 * exponential backoff; a stall, a user cancel, or any other status fails at once.
 *
 * Exported for unit testing.
 */
export async function callClaudeVision(
  imageBase64: string,
  apiKey: string,
  model: string,
  maxTokens: number,
  idleTimeoutMs: number,
  externalSignal?: AbortSignal,
  retry: VisionRetryOptions = { maxRetries: 2, baseDelayMs: 2000 }
): Promise<string> {
  const systemPrompt = `You are an expert at reading hand-drawn genograms (family-tree diagrams used in family-systems therapy), including ones that are photographed at an angle, faint, or drawn in pencil. You will be given ONE image of a genogram. Extract its content into a single JSON object and return ONLY that JSON — no prose, no markdown fences.

SYMBOL KEY (standard genogram notation — apply strictly, by shape):
- A square-ish shape = MALE. (sex: "male")
- A circle-ish shape = FEMALE. (sex: "female")
- An X drawn THROUGH a square or circle = that person is DECEASED. The shape still tells you the sex. (deceased: true)
- A plain X with NO enclosing square or circle, drawn at the end of a descending line from a couple = STILLBIRTH (unknown sex, born but did not survive). Use sex="unknown", deceased=true, and INCLUDE "stillbirth" in the notes field.
- A standalone plain X (not at end of descending line) = a person of UNKNOWN sex. (sex: "unknown")
- A triangle = a pregnancy. This is NOT a born person — do NOT add it to people[].
- A small star or asterisk (*) = a miscarriage / pregnancy loss. NOT a person — do NOT add it to people[].
- A small circle containing the letter "c" = a current pregnancy marker — BUT if this small "c" circle appears next to a person who is in a relationship and has a child below them, treat the "c" circle as a separate person (likely the partner/spouse). In that case, extract it as a person named "C (spouse of [partner name])".
- A horizontal line connecting two people = a couple/partnership.
- "m.YYYY" near a couple line = marriage year. "div. YYYY" or a double slash = divorce.
- Text like "b.1968" or "b.1940 d.2014" next to a symbol = birth / death years.

TWINS / MULTIPLE BIRTHS:
Two (or more) children are TWINS when their descent lines join, forming either:
  (a) an inverted "V" — two lines meeting at a single point ON the couple's horizontal line, or
  (b) an inverted "Y" — a single stem drops from the couple's line and then splits into two lines
      at its lower end.
When you see either pattern, give every child in that cluster the SAME "twinGroup" label (e.g.
"twinsA"), and still list each of them individually in people[] and in that couple's children[].
Children whose lines descend and meet at a single shared point are twins; children each hanging
from their OWN separate vertical line are ordinary (non-twin) siblings — do NOT give those a twinGroup.

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
    { "a": label, "b": label, "type": "married"|"engaged"|"dating"|..., "status": "married"|"divorce"|"widowed"|..., "evidence": "free text", "children": [label, label, ...] }
  ],
  "clinical": {
    "explicitSchizophreniaMentions": [],
    "explicitNoDiagnosisMentions": [],
    "events": []
  },
  "uncertainties": [string, ...],
  "people": [
    { "name": label, "sex": "male"|"female"|"unknown", "deceased": boolean, "birthYear": number|null, "deathYear": number|null, "confidence": "high"|"med"|"low", "notes": "adjacent text", "x": 0-100, "y": 0-100, "twinGroup": string|null }
  ]
}

RULES:
- Put EVERY square, circle, and plain-X person in people[]. STRICTLY EXCLUDE triangles and stars (they are NOT people).
- NEVER include the word "triangle" or "star" or "asterisk" in any person's name field — those are pregnancy/miscarriage markers, not people.
- Mark deceased: true for any symbol with an X through it.
- If a birth or death year is not written, use null — never guess a year.
- If unsure about a shape, X, letter, or relationship, list it in uncertainties and set confidence to "med" or "low".
- ALWAYS include x and y position (0-100 %) for every person, measured to the center of the symbol.
- CRITICAL: Do not skip people on the edges of the diagram (left, right, top, bottom edges). Extract ALL visible symbols.
- CRITICAL: For every couple/partnership with children, make sure BOTH partners exist as separate persons in people[] — even if one is labeled with just a "c" symbol or unclear letter. If a child exists, the parents must both exist as named people.
- CRITICAL: Children (sibship rows) connected to a parental couple by vertical lines — extract EVERY symbol in the sibship row, including isolated/labeled-only children that may not appear in any other relationship.
- CRITICAL: For every relationship/couple, you MUST list the children of that couple in the "children" array (using the same labels). Identify children by: vertical line descending from the couple's horizontal partnership line to the child(ren). This is how parent-child connections are preserved.
- CHILD LINES — follow the drawing exactly (do NOT guess):
  - If a line IS drawn from a child down to (or up to) a couple's horizontal relationship line, you MUST record that child in that couple's children[] — never leave a drawn connection out.
  - If NO line is drawn between a person and a couple's relationship line, do NOT invent a parent-child link, even if that person sits directly below the couple. A person with no connecting line is unattached — omit them from every children[] list.
- TWINS: when child descent lines join as an inverted V (meeting on the couple's line) or an inverted Y (a stem that splits), give every child in that cluster the SAME non-null "twinGroup" label. Otherwise leave "twinGroup" null.
- Return ONLY the JSON object. No commentary, no code fences.`;

  const userMessage = retry.userMessage ?? buildVisionUserMessage();

  const requestBody = JSON.stringify({
    model,
    max_tokens: maxTokens,
    stream: true,
    ...(retry.effort ? { output_config: { effort: retry.effort } } : {}),
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
  });

  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    // Idle timer: restarted whenever bytes arrive, so only a stall trips it.
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const armIdleTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, idleTimeoutMs);
    };
    armIdleTimer();
    // Forward the external abort signal to this attempt's controller.
    const forwardAbort = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    else externalSignal?.addEventListener('abort', forwardAbort, { once: true });
    const cleanup = () => {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', forwardAbort);
    };

    let retryReason: string;
    let serverDelayMs: number | null = null;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: requestBody,
        signal: controller.signal,
      });

      if (res.ok) {
        const streamed = await readVisionStream(res, armIdleTimer, retry.onStream);
        cleanup();
        if (streamed.kind === 'message') return extractVisionText(streamed.message, maxTokens);
        if (!RETRYABLE_STREAM_ERRORS.has(streamed.errorType) || attempt >= retry.maxRetries) {
          throw new Error(`Claude Vision stream error (${streamed.errorType}): ${streamed.errorMessage}`);
        }
        retryReason = `Claude Vision stream error (${streamed.errorType})`;
      } else {
        const errorText = await res.text();
        cleanup();
        if (!RETRYABLE_STATUSES.has(res.status) || attempt >= retry.maxRetries) {
          throw new Error(`Claude Vision API error (${res.status}): ${errorText}`);
        }
        retryReason = `Claude Vision returned ${res.status}`;
        serverDelayMs = retryAfterMs(res);
      }
    } catch (error) {
      cleanup();
      // Checked by name: an aborted body read rejects with a DOMException,
      // which is not an Error subclass in every runtime.
      if ((error as { name?: unknown } | null)?.name === 'AbortError') {
        // Distinguish between user cancellation and a stall. Neither is
        // retried: a stalled request has already spent its output tokens.
        if (externalSignal?.aborted && !timedOut) {
          throw new Error('Cancelled by user');
        }
        throw new Error(`Claude Vision stopped sending data for ${Math.round(idleTimeoutMs / 1000)}s`);
      }
      // fetch (or a stream read) rejects with a TypeError when the network fails.
      if (!(error instanceof TypeError) || attempt >= retry.maxRetries) {
        throw error;
      }
      retryReason = `Network error (${error.message})`;
    }

    const delayMs = Math.min(
      MAX_RETRY_DELAY_MS,
      serverDelayMs ?? retry.baseDelayMs * 2 ** attempt
    );
    retry.onRetry?.(attempt + 1, retryReason, delayMs);
    await waitUnlessAborted(delayMs, externalSignal);
  }
}

type VisionStreamResult =
  | { kind: 'message'; message: ClaudeVisionResponse }
  | { kind: 'error'; errorType: string; errorMessage: string };

/**
 * Read a Messages API server-sent-event stream into the same shape as a
 * non-streamed response, keeping text blocks and the stop reason. Thinking
 * deltas are not kept; they only move the phase reported to `onStream`.
 * `onBytes` is called for every chunk received (it restarts the idle timer).
 *
 * A stream that ends without message_stop is a dropped connection: it is
 * thrown as a TypeError so the caller retries it like any network failure.
 *
 * Exported for unit testing.
 */
export async function readVisionStream(
  res: Response,
  onBytes: () => void,
  onStream?: (status: VisionStreamStatus) => void
): Promise<VisionStreamResult> {
  if (!res.body) throw new TypeError('Claude Vision response had no body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const texts: string[] = [];
  let stopReason: string | null = null;
  let stopDetails: ClaudeVisionResponse['stop_details'] = null;
  let textChars = 0;
  let buffer = '';

  const handleEvent = (data: string): VisionStreamResult | 'stop' | null => {
    let event: StreamEvent;
    try {
      event = JSON.parse(data) as StreamEvent;
    } catch {
      return null; // a non-JSON data line (none are sent today) is skipped
    }
    switch (event.type) {
      case 'content_block_start':
        if (event.content_block?.type === 'thinking') onStream?.({ phase: 'thinking', textChars });
        if (event.content_block?.type === 'text') texts[event.index ?? texts.length] = '';
        return null;
      case 'content_block_delta':
        if (event.delta?.type === 'text_delta' && typeof event.delta.text === 'string') {
          const i = event.index ?? 0;
          texts[i] = (texts[i] ?? '') + event.delta.text;
          textChars += event.delta.text.length;
          onStream?.({ phase: 'writing', textChars });
        }
        return null;
      case 'message_delta':
        if (event.delta?.stop_reason !== undefined) stopReason = event.delta.stop_reason ?? null;
        if (event.delta?.stop_details !== undefined) stopDetails = event.delta.stop_details ?? null;
        return null;
      case 'message_stop':
        return 'stop';
      case 'error':
        return {
          kind: 'error',
          errorType: event.error?.type ?? 'unknown_error',
          errorMessage: event.error?.message ?? '',
        };
      default:
        return null; // message_start, content_block_stop, ping
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    onBytes();
    buffer += decoder.decode(value, { stream: true });
    // Events are separated by a blank line; each carries one `data:` line.
    let sep: number;
    while ((sep = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep).replace(/^\r?\n\r?\n/, '');
      const data = rawEvent
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data) continue;
      const outcome = handleEvent(data);
      if (outcome === 'stop') {
        await reader.cancel().catch(() => undefined);
        return {
          kind: 'message',
          message: {
            content: texts.filter((t) => t !== undefined).map((text) => ({ type: 'text', text })),
            stop_reason: stopReason,
            stop_details: stopDetails,
          },
        };
      }
      if (outcome) return outcome;
    }
  }
  throw new TypeError('Claude Vision stream ended before the message was complete');
}

type StreamEvent = {
  type: string;
  index?: number;
  content_block?: { type?: string };
  delta?: {
    type?: string;
    text?: string;
    stop_reason?: string | null;
    stop_details?: ClaudeVisionResponse['stop_details'];
  };
  error?: { type?: string; message?: string };
};

export type ClaudeVisionResponse = {
  content: Array<{ type: string; text?: string }>;
  stop_reason?: string | null;
  stop_details?: { category?: string | null; explanation?: string | null } | null;
};

/**
 * Pull the text answer out of a Messages API response, turning the stop
 * reasons that leave no usable JSON into specific errors.
 *
 * Exported for unit testing.
 */
export function extractVisionText(data: ClaudeVisionResponse, maxTokens: number): string {
  if (data.stop_reason === 'refusal') {
    const category = data.stop_details?.category ? ` (category: ${data.stop_details.category})` : '';
    throw new Error(`Claude declined to process this image${category}.`);
  }
  if (data.stop_reason === 'max_tokens') {
    throw new Error(
      `Claude Vision response was cut off at the max_tokens limit (${maxTokens}). ` +
        'The diagram may be too large for one pass, or the model used the budget for thinking.'
    );
  }
  const text = (data.content ?? [])
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string)
    .join('');
  if (!text.trim()) {
    throw new Error(`No text response from Claude Vision (stop_reason: ${data.stop_reason ?? 'unknown'})`);
  }
  return text;
}

/**
 * Parse VLM JSON response and validate as FactsImportData.
 * Handles common formatting issues (markdown fences, etc).
 *
 * Exported for unit testing.
 */
export function parseVLMResponse(text: string): FactsImportData {
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

  return sanitizeVLMFacts(facts as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Field-level validation of the model's JSON. Everything downstream
// (applyDataRules, factsToDiagramImportData) assumes the FactsImportData
// types: a string `children` was iterated one character at a time and a
// numeric name crashed `.trim()`. Values that cannot be used are dropped or
// cleared, and each drop is recorded in `uncertainties` so the import log
// shows it.
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : undefined;

/** A year as a number: accepts 1968 or "1968"; anything else is undefined. */
const asYear = (value: unknown): number | undefined => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 && n < 3000 ? n : undefined;
};

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * A position as a percentage of the image (0-100). Outside that range it is
 * not a position on the image, so it is dropped rather than moved to the edge
 * (gap review F-23: x = 1e300 placed a person far off the canvas).
 */
const asImagePercent = (value: unknown): number | undefined => {
  const n = asNumber(value);
  return n !== undefined && n >= 0 && n <= 100 ? n : undefined;
};

/** An array of strings, dropping non-string entries; a lone string becomes [string]. */
const asStringList = (value: unknown, onDrop: (count: number) => void): string[] | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return [value];
  if (!Array.isArray(value)) {
    onDrop(1);
    return [];
  }
  const kept = value.map(asString).filter((entry): entry is string => entry !== undefined);
  if (kept.length !== value.length) onDrop(value.length - kept.length);
  return kept;
};

const SEXES = new Set(['male', 'female', 'unknown']);
const CONFIDENCES = new Set(['high', 'med', 'low']);

/**
 * Coerce parsed model output to FactsImportData, dropping what cannot be used.
 *
 * Exported for unit testing.
 */
export function sanitizeVLMFacts(raw: Record<string, unknown>): FactsImportData {
  const notes: string[] = [];
  const dropped = (what: string) => (count: number) => {
    if (count > 0) notes.push(`[warn] VLM response: dropped ${count} malformed ${what}.`);
  };

  const uncertainties =
    asStringList(raw.uncertainties, dropped('uncertainty entries')) ?? undefined;

  let people: FactsImportData['people'];
  if (raw.people !== undefined && raw.people !== null) {
    const list = Array.isArray(raw.people) ? raw.people : [];
    if (!Array.isArray(raw.people)) notes.push('[warn] VLM response: "people" was not a list; ignored.');
    people = [];
    let bad = 0;
    let offImage = 0;
    for (const entry of list) {
      const name = isRecord(entry) ? asString(entry.name) : undefined;
      if (!isRecord(entry) || name === undefined) {
        bad += 1;
        continue;
      }
      const sex = asString(entry.sex)?.toLowerCase();
      const confidence = asString(entry.confidence)?.toLowerCase();
      const twinGroup = asString(entry.twinGroup);
      // x and y are used together; a pair with either off the image is dropped.
      const x = asImagePercent(entry.x);
      const y = asImagePercent(entry.y);
      const hasPosition = x !== undefined && y !== undefined;
      if (!hasPosition && (entry.x !== undefined || entry.y !== undefined)) offImage += 1;
      people.push({
        name,
        sex: sex && SEXES.has(sex) ? (sex as 'male' | 'female' | 'unknown') : undefined,
        deceased: typeof entry.deceased === 'boolean' ? entry.deceased : undefined,
        // A year the model sent as null ("not written") stays null; junk is cleared.
        birthYear: asYear(entry.birthYear) ?? (entry.birthYear === null ? null : undefined),
        deathYear: asYear(entry.deathYear) ?? (entry.deathYear === null ? null : undefined),
        confidence: confidence && CONFIDENCES.has(confidence) ? (confidence as 'high' | 'med' | 'low') : undefined,
        notes: asString(entry.notes),
        x: hasPosition ? x : undefined,
        y: hasPosition ? y : undefined,
        twinGroup: twinGroup && twinGroup.trim() ? twinGroup : undefined,
      });
    }
    dropped('people entries (no usable name)')(bad);
    dropped('positions (not 0-100 on the image)')(offImage);
  }

  let relationships: FactsImportData['relationships'];
  if (raw.relationships !== undefined && raw.relationships !== null) {
    const list = Array.isArray(raw.relationships) ? raw.relationships : [];
    if (!Array.isArray(raw.relationships)) notes.push('[warn] VLM response: "relationships" was not a list; ignored.');
    relationships = [];
    let bad = 0;
    for (const entry of list) {
      if (!isRecord(entry)) {
        bad += 1;
        continue;
      }
      relationships.push({
        a: asString(entry.a),
        b: asString(entry.b),
        type: asString(entry.type),
        status: asString(entry.status),
        evidence: asString(entry.evidence),
        children: asStringList(entry.children, dropped('child references')),
      });
    }
    dropped('relationship entries')(bad);
  }

  let family: FactsImportData['family'];
  if (isRecord(raw.family)) {
    family = {
      parents: asStringList(raw.family.parents, dropped('family.parents entries')),
      marriageYear: asYear(raw.family.marriageYear),
      childrenCountMentioned: asNumber(raw.family.childrenCountMentioned),
      childrenMentionedByName: asStringList(
        raw.family.childrenMentionedByName,
        dropped('family.childrenMentionedByName entries')
      ),
    };
  }

  let clinical: FactsImportData['clinical'];
  if (isRecord(raw.clinical)) {
    const events = Array.isArray(raw.clinical.events)
      ? raw.clinical.events.filter(isRecord).map((evt) => ({
          person: asString(evt.person),
          type: asString(evt.type),
          year: asYear(evt.year),
        }))
      : undefined;
    clinical = {
      explicitSchizophreniaMentions: asStringList(
        raw.clinical.explicitSchizophreniaMentions,
        dropped('schizophrenia mentions')
      ),
      explicitNoDiagnosisMentions: asStringList(
        raw.clinical.explicitNoDiagnosisMentions,
        dropped('no-diagnosis mentions')
      ),
      events,
    };
  }

  const allUncertainties = [...(uncertainties ?? []), ...notes];
  return {
    sourceFile: asString(raw.sourceFile),
    processedAt: asString(raw.processedAt),
    family,
    relationships,
    clinical,
    uncertainties: allUncertainties.length ? allUncertainties : uncertainties,
    people,
  };
}

/**
 * Legacy fact-check function — superseded by applyDataRules() in genogramRules.ts.
 * Kept here only as a public re-export for backward compatibility.
 */
export { applyDataRules as factCheckVLMFacts } from './genogramRules';
