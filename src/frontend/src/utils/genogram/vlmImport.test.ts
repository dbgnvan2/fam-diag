/**
 * Tests for parseVLMResponse — the robust JSON parser that turns Claude Vision's
 * raw text reply into FactsImportData. Covers the formatting quirks the model
 * actually produces (markdown fences) and malformed-input handling.
 *
 * callClaudeVision's retry logic is tested with a stubbed fetch. The image
 * parts of vlmImport() (canvas, createImageBitmap) are browser-only and are
 * not exercised here; nor is the real Anthropic API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { factsToDiagramImportData } from '../dataImport';
import {
  parseVLMResponse,
  factCheckVLMFacts,
  extractVisionText,
  buildVisionUserMessage,
  callClaudeVision,
  sanitizeVLMFacts,
  type VisionRetryOptions,
} from './vlmImport';
import { applyDataRules } from './genogramRules';

describe('parseVLMResponse', () => {
  it('parses a bare JSON object', () => {
    const facts = parseVLMResponse('{"people":[{"name":"Wayne","sex":"male"}]}');
    expect(facts.people).toEqual([{ name: 'Wayne', sex: 'male' }]);
  });

  it('strips ```json fences', () => {
    const facts = parseVLMResponse('```json\n{"people":[{"name":"Jennie"}]}\n```');
    expect(facts.people).toEqual([{ name: 'Jennie' }]);
  });

  it('strips bare ``` fences', () => {
    const facts = parseVLMResponse('```\n{"relationships":[]}\n```');
    expect(facts.relationships).toEqual([]);
  });

  it('tolerates leading/trailing whitespace', () => {
    const facts = parseVLMResponse('   \n {"people":[]}  \n ');
    expect(facts.people).toEqual([]);
  });

  it('throws a descriptive error on malformed JSON', () => {
    expect(() => parseVLMResponse('not json at all')).toThrow(/Failed to parse VLM response as JSON/);
  });

  it('throws when the JSON is a primitive or null (not an object)', () => {
    expect(() => parseVLMResponse('42')).toThrow(/not a JSON object/);
    expect(() => parseVLMResponse('"just a string"')).toThrow(/not a JSON object/);
    expect(() => parseVLMResponse('null')).toThrow(/not a JSON object/);
  });

  it('coerces a non-array people field back to an empty array', () => {
    const facts = parseVLMResponse('{"people":{"oops":true}}');
    expect(facts.people).toEqual([]);
  });

  it('coerces a non-array relationships field back to an empty array', () => {
    const facts = parseVLMResponse('{"relationships":"nope"}');
    expect(facts.relationships).toEqual([]);
  });
});

describe('factCheckVLMFacts re-export', () => {
  it('is the same function as applyDataRules', () => {
    expect(factCheckVLMFacts).toBe(applyDataRules);
  });
});

describe('extractVisionText', () => {
  it('returns the text block, skipping thinking blocks', () => {
    const text = extractVisionText(
      { content: [{ type: 'thinking', text: '' }, { type: 'text', text: '{"people":[]}' }], stop_reason: 'end_turn' },
      16000
    );
    expect(text).toBe('{"people":[]}');
  });

  it('throws a specific error on max_tokens truncation', () => {
    expect(() =>
      extractVisionText({ content: [{ type: 'text', text: '{"people":[' }], stop_reason: 'max_tokens' }, 4000)
    ).toThrow(/max_tokens limit \(4000\)/);
  });

  it('throws a specific error on refusal, including the category', () => {
    expect(() =>
      extractVisionText({ content: [], stop_reason: 'refusal', stop_details: { category: 'cyber' } }, 16000)
    ).toThrow(/declined.*category: cyber/);
  });

  it('throws when there is no text, naming the stop reason', () => {
    expect(() => extractVisionText({ content: [], stop_reason: 'end_turn' }, 16000)).toThrow(
      /No text response.*end_turn/
    );
  });
});

describe('callClaudeVision — retries', () => {
  const okBody = { content: [{ type: 'text', text: '{"people":[]}' }], stop_reason: 'end_turn' };
  const response = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
  const retry = { maxRetries: 2, baseDelayMs: 1000 };

  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const call = (signal?: AbortSignal, onRetry?: VisionRetryOptions['onRetry']) =>
    callClaudeVision('img', 'key', 'model', 100, 60_000, signal, { ...retry, onRetry });

  it('retries a 529 (overloaded) and returns the later success', async () => {
    fetchMock
      .mockResolvedValueOnce(response(529, 'overloaded'))
      .mockResolvedValueOnce(response(200, okBody));
    const onRetry = vi.fn();
    const pending = call(undefined, onRetry);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toBe('{"people":[]}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, 'Claude Vision returned 529', 1000);
  });

  it('backs off exponentially and gives up after maxRetries', async () => {
    fetchMock.mockImplementation(async () => response(503, 'unavailable'));
    const pending = call();
    const assertion = expect(pending).rejects.toThrow('Claude Vision API error (503): unavailable');
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // first retry at 1000 ms
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000); // second retry 2000 ms later
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('honours a Retry-After header', async () => {
    fetchMock
      .mockResolvedValueOnce(response(429, 'slow down', { 'retry-after': '5' }))
      .mockResolvedValueOnce(response(200, okBody));
    const pending = call();
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe('{"people":[]}');
  });

  it('retries a network failure', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(response(200, okBody));
    const pending = call();
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toBe('{"people":[]}');
  });

  it('does not retry a 400 or 401', async () => {
    fetchMock.mockImplementation(async () => response(401, 'bad key'));
    await expect(call()).rejects.toThrow('Claude Vision API error (401): bad key');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops waiting when the user cancels during the backoff', async () => {
    fetchMock.mockImplementation(async () => response(529, 'overloaded'));
    const controller = new AbortController();
    const pending = call(controller.signal);
    const assertion = expect(pending).rejects.toThrow('Cancelled by user');
    await vi.advanceTimersByTimeAsync(10);
    controller.abort();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('sanitizeVLMFacts — malformed model output', () => {
  it('drops a position that is not on the image, and says so (gap review F-23)', () => {
    const facts = sanitizeVLMFacts({
      people: [
        { name: 'Far', x: 1e300, y: 50 },
        { name: 'Neg', x: 10, y: -5 },
        { name: 'Ok', x: 25, y: 75 },
        { name: 'None' },
      ],
    });
    const byName = new Map(facts.people!.map((p) => [p.name, p]));
    expect(byName.get('Far')).toMatchObject({ x: undefined, y: undefined });
    expect(byName.get('Neg')).toMatchObject({ x: undefined, y: undefined });
    expect(byName.get('Ok')).toMatchObject({ x: 25, y: 75 });
    expect(facts.uncertainties).toContain('[warn] VLM response: dropped 2 malformed positions (not 0-100 on the image).');
  });

  it('turns a string children field into a one-item list (regression: iterated per character)', () => {
    const facts = sanitizeVLMFacts({ relationships: [{ a: 'Pa', b: 'Ma', children: 'Paul' }] });
    expect(facts.relationships?.[0].children).toEqual(['Paul']);
  });

  it('drops people without a usable name and records the drop', () => {
    const facts = sanitizeVLMFacts({
      people: [{ name: 'Ann' }, { sex: 'male' }, 'not an object', { name: 42 }],
    });
    expect(facts.people?.map((p) => p.name)).toEqual(['Ann', '42']);
    expect(facts.uncertainties).toContain('[warn] VLM response: dropped 2 malformed people entries (no usable name).');
  });

  it('accepts numeric-string years and clears unusable values', () => {
    const facts = sanitizeVLMFacts({
      people: [{ name: 'Ann', birthYear: '1968', deathYear: 'unknown', sex: 'FEMALE', x: 'left' }],
    });
    const ann = facts.people![0];
    expect(ann.birthYear).toBe(1968);
    expect(ann.deathYear).toBeUndefined();
    expect(ann.sex).toBe('female');
    expect(ann.x).toBeUndefined();
  });

  it('keeps a year the model reported as null', () => {
    const facts = sanitizeVLMFacts({ people: [{ name: 'Ann', birthYear: null }] });
    expect(facts.people![0].birthYear).toBeNull();
  });

  it('drops non-string entries from name lists and records it', () => {
    const facts = sanitizeVLMFacts({
      family: { parents: ['Pa', { bad: true }, 'Ma'] },
      uncertainties: ['kept'],
    });
    expect(facts.family?.parents).toEqual(['Pa', 'Ma']);
    expect(facts.uncertainties).toEqual([
      'kept',
      '[warn] VLM response: dropped 1 malformed family.parents entries.',
    ]);
  });

  it('a string children field links the child (regression: 4 dangling ids, Paul unlinked)', () => {
    const facts = parseVLMResponse(
      JSON.stringify({
        people: [{ name: 'Pa', sex: 'male' }, { name: 'Ma', sex: 'female' }, { name: 'Paul', sex: 'male' }],
        relationships: [{ a: 'Pa', b: 'Ma', children: 'Paul' }],
      })
    );
    const { people, partnerships } = factsToDiagramImportData(facts);
    expect(people.map((p) => p.name).sort()).toEqual(['Ma', 'Pa', 'Paul']);
    const paul = people.find((p) => p.name === 'Paul')!;
    expect(partnerships).toHaveLength(1);
    expect(partnerships[0].children).toEqual([paul.id]);
    expect(paul.parentPartnership).toBe(partnerships[0].id);
  });
});

describe('buildVisionUserMessage (review 2026-09-30 DE2-04)', () => {
  it('sends the hints the user gave, as context not a quota', () => {
    const message = buildVisionUserMessage({ generationCount: 3, expectedPersonCount: 12, handDrawn: true, hasNotes: false });
    expect(message).toContain('about 3 generations');
    expect(message).toContain('about 12 people');
    expect(message).toContain('hand-drawn');
    expect(message).toContain('never add people or generations to match');
  });

  it('with no hints (or none given) the message is the plain request', () => {
    const plain = 'Extract all people and relationships from this genogram image.';
    expect(buildVisionUserMessage()).toBe(plain);
    expect(buildVisionUserMessage({ generationCount: 0, expectedPersonCount: 0, handDrawn: false, hasNotes: false })).toBe(plain);
  });

  it('the hints reach the request body', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: '{}' }] }), { status: 200 }));
    const original = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    try {
      await callClaudeVision('img', 'key', 'model', 100, 60_000, undefined, {
        maxRetries: 0,
        baseDelayMs: 0,
        userMessage: buildVisionUserMessage({ generationCount: 4, expectedPersonCount: 0, handDrawn: false, hasNotes: false }),
      });
      const body = JSON.parse((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
      expect(body.messages[0].content[1].text).toContain('about 4 generations');
    } finally {
      globalThis.fetch = original;
    }
  });
});
