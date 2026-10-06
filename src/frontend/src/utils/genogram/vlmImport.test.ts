/**
 * Tests for parseVLMResponse — the robust JSON parser that turns Claude Vision's
 * raw text reply into FactsImportData. Covers the formatting quirks the model
 * actually produces (markdown fences) and malformed-input handling.
 *
 * callClaudeVision's streaming, idle timeout and retry logic are tested with a
 * stubbed fetch that returns server-sent-event bodies. The image
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
  readVisionStream,
  formatVisionUsage,
  sanitizeVLMFacts,
  type VisionRetryOptions,
  type VisionStreamStatus,
  type VisionUsage,
} from './vlmImport';
import { applyDataRules } from './genogramRules';

// ---------------------------------------------------------------------------
// Server-sent-event fixtures, in the Messages API's streaming event shapes.
// ---------------------------------------------------------------------------

type SseEvent = { type: string } & Record<string, unknown>;

const toSse = (events: SseEvent[]) =>
  events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');

/** A full message: a thinking block, then `text` split over two deltas. */
const messageEvents = (
  text: string,
  stopReason = 'end_turn',
  stopDetails: Record<string, unknown> | null = null
): SseEvent[] => {
  const half = Math.floor(text.length / 2);
  return [
    {
      type: 'message_start',
      message: {
        id: 'msg_1',
        content: [],
        stop_reason: null,
        usage: { input_tokens: 4812, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      },
    },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'not the answer' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    { type: 'ping' },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: text.slice(0, half) } },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: text.slice(half) } },
    { type: 'content_block_stop', index: 1 },
    { type: 'message_delta', delta: { stop_reason: stopReason, stop_details: stopDetails }, usage: { output_tokens: 31207 } },
    { type: 'message_stop' },
  ];
};

/**
 * A 200 response whose body sends `chunks` one per `delayMs`, then closes —
 * or, with `stall`, stays open. Like a real fetch body, it errors with an
 * AbortError when `signal` aborts.
 */
const streamResponse = (
  chunks: string[],
  { signal, delayMs = 0, stall = false }: { signal?: AbortSignal | null; delayMs?: number; stall?: boolean } = {}
) => {
  const encoder = new TextEncoder();
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')), { once: true });
    },
    pull(controller) {
      if (i >= chunks.length) {
        if (!stall) controller.close();
        return stall ? new Promise<void>(() => undefined) : undefined;
      }
      const chunk = chunks[i++];
      // No delay: enqueue at once (a 0 ms timer would never fire under fake timers).
      if (delayMs === 0) {
        controller.enqueue(encoder.encode(chunk));
        return undefined;
      }
      return new Promise<void>((resolve) =>
        setTimeout(() => {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            // already errored by an abort
          }
          resolve();
        }, delayMs)
      );
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
};

/** Split a string into pieces of `size` characters (chunk boundaries fall mid-event). */
const splitEvery = (text: string, size: number) => {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
};

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
  const okStream = () => streamResponse([toSse(messageEvents('{"people":[]}'))]);
  const response = (status: number, body: string, headers: Record<string, string> = {}) =>
    new Response(body, { status, headers });
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
      .mockResolvedValueOnce(okStream());
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
      .mockResolvedValueOnce(okStream());
    const pending = call();
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBe('{"people":[]}');
  });

  it('retries a network failure', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(okStream());
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

describe('readVisionStream', () => {
  it('joins text deltas split at arbitrary chunk boundaries, ignoring thinking', async () => {
    const json = '{"people":[{"name":"Willem","sex":"male"}]}';
    const res = streamResponse(splitEvery(toSse(messageEvents(json)), 7));
    const onBytes = vi.fn();
    const result = await readVisionStream(res, onBytes);
    expect(result).toEqual({
      kind: 'message',
      message: { content: [{ type: 'text', text: json }], stop_reason: 'end_turn', stop_details: null },
    });
    expect(onBytes.mock.calls.length).toBeGreaterThan(10); // once per chunk: restarts the idle timer
  });

  it('handles CRLF line endings', async () => {
    const res = streamResponse([toSse(messageEvents('{}')).replace(/\n/g, '\r\n')]);
    const result = await readVisionStream(res, () => undefined);
    expect(result.kind === 'message' && result.message.content[0].text).toBe('{}');
  });

  it('reports the thinking phase, then writing progress', async () => {
    const statuses: VisionStreamStatus[] = [];
    await readVisionStream(streamResponse([toSse(messageEvents('abcdef'))]), () => undefined, (s) => statuses.push(s));
    expect(statuses).toEqual([
      { phase: 'thinking', textChars: 0 },
      { phase: 'writing', textChars: 3 },
      { phase: 'writing', textChars: 6 },
    ]);
  });

  it('returns a mid-stream error event', async () => {
    const events: SseEvent[] = [
      messageEvents('{}')[0],
      { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } },
    ];
    await expect(readVisionStream(streamResponse([toSse(events)]), () => undefined)).resolves.toEqual({
      kind: 'error',
      errorType: 'overloaded_error',
      errorMessage: 'Overloaded',
    });
  });

  it('a stream that ends without message_stop is a network failure (TypeError)', async () => {
    const truncated = messageEvents('{"people":[]}').slice(0, 7);
    await expect(readVisionStream(streamResponse([toSse(truncated)]), () => undefined)).rejects.toThrow(TypeError);
  });
});

describe('callClaudeVision — streaming', () => {
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

  const signalOf = (init: RequestInit) => init.signal;
  const call = (opts: Partial<VisionRetryOptions> = {}, signal?: AbortSignal) =>
    callClaudeVision('img', 'key', 'model', 64000, 60_000, signal, { maxRetries: 2, baseDelayMs: 1000, ...opts });
  const requestBody = (n = 0) =>
    JSON.parse((fetchMock.mock.calls[n] as [string, RequestInit])[1].body as string);

  it('asks for a streamed reply with the given max_tokens and effort', async () => {
    fetchMock.mockImplementation(async () => streamResponse([toSse(messageEvents('{}'))]));
    await call({ effort: 'low' });
    const body = requestBody();
    expect(body.stream).toBe(true);
    expect(body.max_tokens).toBe(64000);
    expect(body.output_config).toEqual({ effort: 'low' });
  });

  it('sends no output_config when no effort is given (models that reject it)', async () => {
    fetchMock.mockImplementation(async () => streamResponse([toSse(messageEvents('{}'))]));
    await call();
    expect(requestBody()).not.toHaveProperty('output_config');
  });

  it('a long reply that keeps arriving does not time out', async () => {
    // 6 chunks, 50 s apart: 300 s in total, but never 60 s of silence.
    const sse = toSse(messageEvents('{"people":[]}'));
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) =>
      streamResponse(splitEvery(sse, Math.ceil(sse.length / 6)), { signal: signalOf(init), delayMs: 50_000 })
    );
    const pending = call();
    await vi.advanceTimersByTimeAsync(6 * 50_000);
    await expect(pending).resolves.toBe('{"people":[]}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a stream that goes quiet fails after the idle timeout, without retrying', async () => {
    const firstEvents = toSse(messageEvents('{"people":[]}').slice(0, 5));
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) =>
      streamResponse([firstEvents], { signal: signalOf(init), stall: true })
    );
    const pending = call();
    const assertion = expect(pending).rejects.toThrow('Claude Vision stopped sending data for 60s');
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cancelling mid-stream reports a cancel, not a timeout', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) =>
      streamResponse([toSse(messageEvents('{}').slice(0, 3))], { signal: signalOf(init), stall: true })
    );
    const controller = new AbortController();
    const pending = call({}, controller.signal);
    const assertion = expect(pending).rejects.toThrow('Cancelled by user');
    await vi.advanceTimersByTimeAsync(10);
    controller.abort();
    await assertion;
  });

  it('a streamed max_tokens stop names the limit', async () => {
    fetchMock.mockImplementation(async () => streamResponse([toSse(messageEvents('{"people":[', 'max_tokens'))]));
    await expect(call()).rejects.toThrow('cut off at the max_tokens limit (64000)');
  });

  it('a streamed refusal names the category', async () => {
    fetchMock.mockImplementation(async () =>
      streamResponse([toSse(messageEvents('', 'refusal', { category: 'cyber', explanation: null }))])
    );
    await expect(call()).rejects.toThrow('Claude declined to process this image (category: cyber).');
  });

  it('retries a mid-stream overloaded_error and returns the later success', async () => {
    const overloaded = toSse([
      messageEvents('{}')[0],
      { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } },
    ]);
    fetchMock
      .mockImplementationOnce(async () => streamResponse([overloaded]))
      .mockImplementationOnce(async () => streamResponse([toSse(messageEvents('{"people":[]}'))]));
    const onRetry = vi.fn();
    const pending = call({ onRetry });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toBe('{"people":[]}');
    expect(onRetry).toHaveBeenCalledWith(1, 'Claude Vision stream error (overloaded_error)', 1000);
  });

  it('does not retry a mid-stream invalid_request_error', async () => {
    const bad = toSse([{ type: 'error', error: { type: 'invalid_request_error', message: 'bad image' } }]);
    fetchMock.mockImplementation(async () => streamResponse([bad]));
    await expect(call()).rejects.toThrow('Claude Vision stream error (invalid_request_error): bad image');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a stream that drops before message_stop', async () => {
    fetchMock
      .mockImplementationOnce(async () => streamResponse([toSse(messageEvents('{"people":[]}').slice(0, 7))]))
      .mockImplementationOnce(async () => streamResponse([toSse(messageEvents('{"people":[]}'))]));
    const pending = call();
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toBe('{"people":[]}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('token usage (replaces the fixed cost estimate)', () => {
  const read = async (events: SseEvent[]) => {
    const usages: VisionUsage[] = [];
    const result = await readVisionStream(streamResponse([toSse(events)]), () => undefined, undefined, (u) => usages.push(u));
    return { result, usages };
  };

  it('reports input from message_start and the final output count, once', async () => {
    const { usages } = await read(messageEvents('{}'));
    expect(usages).toEqual([
      { inputTokens: 4812, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, outputTokens: 31207, complete: true },
    ]);
  });

  it('output counts are cumulative: the last message_delta wins, not the sum', async () => {
    const events = messageEvents('{}');
    const final = events.length - 2; // the message_delta
    events.splice(final, 0, { type: 'message_delta', delta: {}, usage: { output_tokens: 500 } });
    const { usages } = await read(events);
    expect(usages[0].outputTokens).toBe(31207);
  });

  it('takes input counts from message_delta when the API sends them there', async () => {
    const events = messageEvents('{}');
    events[events.length - 2] = {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { input_tokens: 5000, cache_read_input_tokens: 1200, output_tokens: 900 },
    };
    const { usages } = await read(events);
    expect(usages[0]).toMatchObject({ inputTokens: 5000, cacheReadInputTokens: 1200, outputTokens: 900 });
  });

  it('a mid-stream error still reports what was billed, marked incomplete', async () => {
    const events = [...messageEvents('{"people":[]}').slice(0, 7), { type: 'error', error: { type: 'overloaded_error', message: 'x' } }];
    const { result, usages } = await read(events);
    expect(result.kind).toBe('error');
    expect(usages).toEqual([
      { inputTokens: 4812, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, outputTokens: 1, complete: false },
    ]);
  });

  it('a dropped stream still reports usage before it throws', async () => {
    const usages: VisionUsage[] = [];
    const res = streamResponse([toSse(messageEvents('{"people":[]}').slice(0, 7))]);
    await expect(readVisionStream(res, () => undefined, undefined, (u) => usages.push(u))).rejects.toThrow(TypeError);
    expect(usages).toHaveLength(1);
    expect(usages[0].complete).toBe(false);
  });

  it('reports nothing when the stream never reached message_start', async () => {
    const { usages } = await read([{ type: 'error', error: { type: 'invalid_request_error', message: 'bad' } }]);
    expect(usages).toEqual([]);
  });

  describe('callClaudeVision', () => {
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

    it('reports every billed attempt, including the one that failed and was retried', async () => {
      const overloaded = toSse([...messageEvents('{}').slice(0, 1), { type: 'error', error: { type: 'overloaded_error', message: 'x' } }]);
      fetchMock
        .mockImplementationOnce(async () => streamResponse([overloaded]))
        .mockImplementationOnce(async () => streamResponse([toSse(messageEvents('{"people":[]}'))]));
      const onUsage = vi.fn();
      const pending = callClaudeVision('img', 'key', 'model', 64000, 60_000, undefined, {
        maxRetries: 2,
        baseDelayMs: 1000,
        onUsage,
      });
      await vi.advanceTimersByTimeAsync(1000);
      await pending;
      expect(onUsage).toHaveBeenCalledTimes(2);
      expect(onUsage.mock.calls[0][0]).toMatchObject({ complete: false });
      expect(onUsage.mock.calls[1][0]).toMatchObject({ outputTokens: 31207, complete: true });
    });

    it('reports usage for a reply cut off at max_tokens (it was still billed)', async () => {
      fetchMock.mockImplementation(async () => streamResponse([toSse(messageEvents('{"people":[', 'max_tokens'))]));
      const onUsage = vi.fn();
      await expect(
        callClaudeVision('img', 'key', 'model', 64000, 60_000, undefined, { maxRetries: 0, baseDelayMs: 0, onUsage })
      ).rejects.toThrow('max_tokens');
      expect(onUsage).toHaveBeenCalledWith(expect.objectContaining({ outputTokens: 31207, complete: true }));
    });
  });

  describe('formatVisionUsage', () => {
    const base: VisionUsage = {
      inputTokens: 4812,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      outputTokens: 31207,
      complete: true,
    };

    it('gives counts, not a price', () => {
      const line = formatVisionUsage('Claude Opus 5.5', base);
      expect(line).toBe('Claude Vision token usage (Claude Opus 5.5): 4,812 input, 31,207 output (includes thinking)');
      expect(line).not.toMatch(/\$/);
    });

    it('lists cache tokens only when there are some', () => {
      expect(formatVisionUsage('M', { ...base, cacheReadInputTokens: 1200, cacheCreationInputTokens: 300 })).toBe(
        'Claude Vision token usage (M): 4,812 input, 1,200 cache-read input, 300 cache-write input, 31,207 output (includes thinking)'
      );
    });

    it('says when the output count is not final', () => {
      expect(formatVisionUsage('M', { ...base, complete: false })).toContain('stream ended early');
    });
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
    const fetchSpy = vi.fn(async () => streamResponse([toSse(messageEvents('{}'))]));
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
