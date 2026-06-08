/**
 * Tests for testApiConnection.ts
 *
 * Spec: docs/implementation_plan_2026-06-07b.md — M2.A.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testApiConnection } from './testApiConnection';

describe('testApiConnection', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('test_m2a1_anthropic_routes_to_messages_endpoint', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('{}', { status: 200 })
    );
    const result = await testApiConnection('anthropic', 'sk-ant-x', 'claude-opus-4-7');
    expect(result.ok).toBe(true);

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('sk-ant-x');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    // Required for browser-origin requests — Anthropic blocks fetches from
    // localhost / file:// origins without this opt-in.
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('claude-opus-4-7');
    expect(body.max_tokens).toBe(1);
    expect(body.messages[0].content).toBe('ping');
  });

  it('test_m2a1_deepseek_routes_to_chat_completions_endpoint', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('{}', { status: 200 })
    );
    const result = await testApiConnection('deepseek', 'sk-deep-x', 'deepseek-chat');
    expect(result.ok).toBe(true);

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-deep-x');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('deepseek-chat');
    expect(body.max_tokens).toBe(1);
  });

  it('test_m2a1_returns_error_on_401_either_provider', async () => {
    const cases: Array<{ provider: 'anthropic' | 'deepseek'; model: string }> = [
      { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      { provider: 'deepseek', model: 'deepseek-chat' },
    ];
    for (const { provider, model } of cases) {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'invalid api key' } }), { status: 401 })
      );
      const result = await testApiConnection(provider, 'sk-bad', model);
      expect(result.ok).toBe(false);
      expect(result.message.toLowerCase()).toContain('invalid');
    }
  });

  it('test_m2a1_returns_error_on_fetch_failure', async () => {
    for (const provider of ['anthropic', 'deepseek'] as const) {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network down'));
      const result = await testApiConnection(provider, 'sk-x', 'm');
      expect(result.ok).toBe(false);
      expect(result.message).toBe('network down');
    }
  });

  it('rejects empty inputs without calling fetch', async () => {
    const a = await testApiConnection('anthropic', '', 'm');
    const b = await testApiConnection('deepseek', 'sk-x', '');
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns error for custom provider when no built-in routing exists', async () => {
    const result = await testApiConnection('custom', 'sk-x', 'm');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('custom');
  });
});
