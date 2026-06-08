/**
 * Tests for customModels.ts
 *
 * Spec: docs/implementation_plan_2026-06-07b.md — M5.A.2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { loadCustomModels, saveCustomModels } from './customModels';
import type { AIModelOption } from '../data/aiModels';

const STORAGE_KEY = 'custom_ai_models';

describe('customModels', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it('test_m5a2_load_returns_empty_array_on_missing_key', () => {
    expect(loadCustomModels()).toEqual([]);
  });

  it('test_m5a2_save_then_load_roundtrip', () => {
    const models: AIModelOption[] = [
      { id: 'my-model', label: 'My Model', provider: 'deepseek', supportsVision: false },
      { id: 'another', label: 'Another', provider: 'anthropic', supportsVision: true },
    ];
    saveCustomModels(models);
    expect(loadCustomModels()).toEqual(models);
  });

  it('test_m5a2_load_ignores_invalid_json', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{');
    expect(loadCustomModels()).toEqual([]);
  });

  it('filters out objects that do not match the AIModelOption shape', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'valid', label: 'Valid', provider: 'anthropic', supportsVision: true },
        { id: 'missing-fields' }, // invalid
        'not even an object', // invalid
        { id: 'bad-provider', label: 'Bad', provider: 'invalid-x', supportsVision: false }, // invalid
      ])
    );
    const loaded = loadCustomModels();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('valid');
  });
});
