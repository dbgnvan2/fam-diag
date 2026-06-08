/**
 * Tests for lookupModel.ts
 *
 * Spec: docs/implementation_plan_2026-06-07b.md — M6.A.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { lookupModel } from './lookupModel';
import { saveCustomModels } from './customModels';

describe('lookupModel', () => {
  beforeEach(() => {
    localStorage.removeItem('custom_ai_models');
  });

  it('test_m6a1_returns_builtin', () => {
    const m = lookupModel('claude-sonnet-4-6');
    expect(m).toBeDefined();
    expect(m?.provider).toBe('anthropic');
    expect(m?.supportsVision).toBe(true);
  });

  it('test_m6a1_returns_custom', () => {
    saveCustomModels([
      { id: 'my-fancy-model', label: 'Fancy', provider: 'deepseek', supportsVision: false },
    ]);
    const m = lookupModel('my-fancy-model');
    expect(m).toBeDefined();
    expect(m?.provider).toBe('deepseek');
    expect(m?.supportsVision).toBe(false);
  });

  it('test_m6a1_returns_undefined_if_missing', () => {
    expect(lookupModel('nope-not-real')).toBeUndefined();
    expect(lookupModel('')).toBeUndefined();
  });

  it('returns a built-in even when a custom model shares the id', () => {
    saveCustomModels([
      { id: 'claude-sonnet-4-6', label: 'Shadow', provider: 'custom', supportsVision: false },
    ]);
    const m = lookupModel('claude-sonnet-4-6');
    // Built-ins win — we don't let a user-added entry shadow a known good model.
    expect(m?.label).toContain('Claude');
    expect(m?.provider).toBe('anthropic');
  });
});
