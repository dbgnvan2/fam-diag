/**
 * Provider-aware connection test for AI providers.
 *
 * Spec: docs/implementation_plan_2026-06-07b.md — M2.A.1
 *
 * Each provider has its own endpoint, auth header, and minimal-payload shape.
 * Both Anthropic and DeepSeek accept a `max_tokens: 1` request with a `ping`
 * prompt, which is enough to verify that the API key + model pair is valid
 * without burning meaningful tokens.
 */

import type { AIProvider } from '../data/aiModels';
import { RETRYABLE_STATUSES } from './httpRetry';

/**
 * Timeout and retry for the ping (gap review F-20). Without a timeout a
 * stalled provider left Settings on "Testing…" until the modal was closed.
 */
export type ConnectionTestOptions = {
  /** Per-attempt timeout. Default 15 s. */
  timeoutMs?: number;
  /** Retries after a network error, a timeout, or a retryable status. Default 1. */
  maxRetries?: number;
  /** Wait before the first retry; doubles each retry. Default 1 s. */
  retryBaseDelayMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One fetch with a timeout; retried on network errors, timeouts and retryable statuses. */
async function fetchWithRetry(url: string, init: RequestInit, options: ConnectionTestOptions): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? 1;
  const baseDelay = options.retryBaseDelayMs ?? 1000;
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!RETRYABLE_STATUSES.has(response.status) || attempt >= maxRetries) return response;
    } catch (err) {
      const timedOut = controller.signal.aborted;
      if (attempt >= maxRetries) {
        throw timedOut ? new Error(`Connection test timed out after ${Number((timeoutMs / 1000).toFixed(2))}s`) : err;
      }
    } finally {
      clearTimeout(timer);
    }
    await wait(baseDelay * 2 ** attempt);
  }
}

export type ConnectionTestResult = {
  ok: boolean;
  message: string;
};

export async function testApiConnection(
  provider: AIProvider,
  apiKey: string,
  model: string,
  options: ConnectionTestOptions = {}
): Promise<ConnectionTestResult> {
  if (!apiKey || apiKey.trim() === '') {
    return { ok: false, message: 'API key is empty' };
  }
  if (!model || model.trim() === '') {
    return { ok: false, message: 'Model is empty' };
  }

  if (provider === 'anthropic') {
    return pingAnthropic(apiKey, model, options);
  }
  if (provider === 'deepseek') {
    return pingDeepseek(apiKey, model, options);
  }
  return { ok: false, message: `Provider '${provider}' has no built-in connection test` };
}

async function pingAnthropic(apiKey: string, model: string, options: ConnectionTestOptions): Promise<ConnectionTestResult> {
  try {
    const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        // Anthropic blocks browser-origin requests unless this opt-in header is set.
        // Required for the in-app Test Connection button to work from the dev server.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    }, options);
    return readResponse(response);
  } catch (err) {
    return networkError(err);
  }
}

async function pingDeepseek(apiKey: string, model: string, options: ConnectionTestOptions): Promise<ConnectionTestResult> {
  try {
    const response = await fetchWithRetry('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    }, options);
    return readResponse(response);
  } catch (err) {
    return networkError(err);
  }
}

async function readResponse(response: Response): Promise<ConnectionTestResult> {
  if (response.ok) {
    return { ok: true, message: 'OK' };
  }
  let detail = `HTTP ${response.status}`;
  try {
    const errBody = await response.json();
    const apiMessage = errBody?.error?.message;
    if (apiMessage) detail = apiMessage;
  } catch {
    // Body wasn't JSON — fall back to the status code already set.
  }
  return { ok: false, message: detail };
}

function networkError(err: unknown): ConnectionTestResult {
  return {
    ok: false,
    message: err instanceof Error ? err.message : 'Network error',
  };
}
