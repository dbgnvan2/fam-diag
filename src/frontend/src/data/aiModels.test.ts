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
});
