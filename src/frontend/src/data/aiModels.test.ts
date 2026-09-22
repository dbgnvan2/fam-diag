/**
 * Tests for aiModels.ts
 *
 * Spec: docs/implementation_plan_2026-06-07b.md — M1.A.1, M1.A.2
 */

import { describe, it, expect } from 'vitest';
import { AI_MODELS } from './aiModels';

describe('AI_MODELS', () => {
  it('test_m1a1_models_have_provider_and_vision', () => {
    expect(AI_MODELS.length).toBeGreaterThan(0);
    AI_MODELS.forEach((m) => {
      expect(['anthropic', 'deepseek', 'custom']).toContain(m.provider);
      expect(typeof m.supportsVision).toBe('boolean');
      expect(typeof m.id).toBe('string');
      expect(typeof m.label).toBe('string');
    });
  });

  it('test_m1a2_deepseek_models_present', () => {
    const deepseekModels = AI_MODELS.filter((m) => m.provider === 'deepseek');
    const ids = deepseekModels.map((m) => m.id);
    expect(ids).toContain('deepseek-chat');
    expect(ids).toContain('deepseek-reasoner');
    deepseekModels.forEach((m) => {
      expect(m.supportsVision).toBe(false);
    });
  });

  it('all Anthropic Claude models support vision', () => {
    const anthropicModels = AI_MODELS.filter((m) => m.provider === 'anthropic');
    expect(anthropicModels.length).toBeGreaterThanOrEqual(3);
    anthropicModels.forEach((m) => {
      expect(m.supportsVision).toBe(true);
    });
  });

  it('includes current Claude models alongside earlier ones', () => {
    const ids = AI_MODELS.filter((m) => m.provider === 'anthropic').map((m) => m.id);
    [
      'claude-fable-5-1',
      'claude-opus-5-5',
      'claude-opus-5',
      'claude-opus-4-8',
      'claude-opus-4-7',
      'claude-sonnet-5',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ].forEach((id) => expect(ids).toContain(id));
  });

  it('has no duplicate model ids', () => {
    const ids = AI_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
