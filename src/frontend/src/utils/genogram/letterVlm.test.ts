/**
 * Tests for letterVlm.ts — the per-symbol Claude Vision fallback.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M6.A.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ocrViaClaudeVision } from './letterVlm';

const SAMPLE_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

describe('ocrViaClaudeVision', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('test_m6a2_returns_letter_from_mock_vision_response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ content: [{ text: 'M' }] }), { status: 200 })
    );
    const result = await ocrViaClaudeVision(SAMPLE_DATA_URL, 'sk-x', 'claude-sonnet-4-6');
    expect(result.letter).toBe('M');
    expect(result.source).toBe('vlm');
  });

  it('returns null on the literal "null" response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ content: [{ text: 'null' }] }), { status: 200 })
    );
    const result = await ocrViaClaudeVision(SAMPLE_DATA_URL, 'sk-x', 'claude-sonnet-4-6');
    expect(result.letter).toBeNull();
    expect(result.source).toBe('vlm');
  });

  it('returns none on HTTP error', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('{}', { status: 500 })
    );
    const result = await ocrViaClaudeVision(SAMPLE_DATA_URL, 'sk-x', 'claude-sonnet-4-6');
    expect(result.letter).toBeNull();
    expect(result.source).toBe('none');
  });

  it('returns none on malformed data URL', async () => {
    const result = await ocrViaClaudeVision('not-a-data-url', 'sk-x', 'm');
    expect(result.source).toBe('none');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
