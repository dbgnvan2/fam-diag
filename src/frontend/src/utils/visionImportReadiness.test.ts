/**
 * Tests for checkVisionImportReadiness — each failure condition yields a
 * distinct reason and message.
 */
import { describe, it, expect } from 'vitest';
import { checkVisionImportReadiness } from './visionImportReadiness';
import type { AIModelOption } from '../data/aiModels';

const claude: AIModelOption = { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', provider: 'anthropic', supportsVision: true };
const deepseek: AIModelOption = { id: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek', supportsVision: false };
const textOnlyClaude: AIModelOption = { id: 'my-claude', label: 'Mine', provider: 'anthropic', supportsVision: false };

describe('checkVisionImportReadiness', () => {
  it('passes with a key and a vision-capable Anthropic model', () => {
    const r = checkVisionImportReadiness('sk-ant-x', claude.id, claude);
    expect(r.ok).toBe(true);
  });

  it('reports a missing API key first', () => {
    const r = checkVisionImportReadiness('', claude.id, claude);
    expect(r).toMatchObject({ ok: false, reason: 'missing_api_key' });
  });

  it('treats a whitespace-only key as missing', () => {
    const r = checkVisionImportReadiness('   ', claude.id, claude);
    expect(r).toMatchObject({ ok: false, reason: 'missing_api_key' });
  });

  it('reports an unknown model id and names it', () => {
    const r = checkVisionImportReadiness('sk-ant-x', 'claude-bogus', undefined);
    expect(r).toMatchObject({ ok: false, reason: 'unknown_model' });
    if (!r.ok) expect(r.message).toContain('claude-bogus');
  });

  it('reports a non-Anthropic provider', () => {
    const r = checkVisionImportReadiness('sk-ant-x', deepseek.id, deepseek);
    expect(r).toMatchObject({ ok: false, reason: 'wrong_provider' });
    if (!r.ok) expect(r.message).toContain('deepseek');
  });

  it('reports an Anthropic model marked text-only', () => {
    const r = checkVisionImportReadiness('sk-ant-x', textOnlyClaude.id, textOnlyClaude);
    expect(r).toMatchObject({ ok: false, reason: 'no_vision' });
  });
});
