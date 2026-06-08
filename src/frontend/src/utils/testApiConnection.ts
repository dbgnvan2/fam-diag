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

export type ConnectionTestResult = {
  ok: boolean;
  message: string;
};

export async function testApiConnection(
  provider: AIProvider,
  apiKey: string,
  model: string
): Promise<ConnectionTestResult> {
  if (!apiKey || apiKey.trim() === '') {
    return { ok: false, message: 'API key is empty' };
  }
  if (!model || model.trim() === '') {
    return { ok: false, message: 'Model is empty' };
  }

  if (provider === 'anthropic') {
    return pingAnthropic(apiKey, model);
  }
  if (provider === 'deepseek') {
    return pingDeepseek(apiKey, model);
  }
  return { ok: false, message: `Provider '${provider}' has no built-in connection test` };
}

async function pingAnthropic(apiKey: string, model: string): Promise<ConnectionTestResult> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
    });
    return readResponse(response);
  } catch (err) {
    return networkError(err);
  }
}

async function pingDeepseek(apiKey: string, model: string): Promise<ConnectionTestResult> {
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
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
    });
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
