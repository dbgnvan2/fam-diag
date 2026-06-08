/**
 * Persist user-added AI models in localStorage.
 *
 * Spec: docs/implementation_plan_2026-06-07b.md — M5.A.2
 */

import type { AIModelOption, AIProvider } from '../data/aiModels';

const STORAGE_KEY = 'custom_ai_models';

function isValidModel(value: unknown): value is AIModelOption {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const validProviders: AIProvider[] = ['anthropic', 'deepseek', 'custom'];
  return (
    typeof v.id === 'string' &&
    typeof v.label === 'string' &&
    typeof v.supportsVision === 'boolean' &&
    typeof v.provider === 'string' &&
    validProviders.includes(v.provider as AIProvider)
  );
}

export function loadCustomModels(): AIModelOption[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidModel);
  } catch {
    return [];
  }
}

export function saveCustomModels(models: AIModelOption[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
}
