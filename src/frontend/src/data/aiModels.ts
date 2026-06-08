/**
 * AI model definitions used by AI Settings, the connection tester, and the
 * image-extraction flow.
 *
 * Spec: docs/implementation_plan_2026-06-07b.md — M1.A.1, M1.A.2
 */

export type AIProvider = 'anthropic' | 'deepseek' | 'custom';

export type AIModelOption = {
  id: string;
  label: string;
  provider: AIProvider;
  supportsVision: boolean;
};

// Hard-coded allow-list of built-in models. Extend here when new models ship.
// Custom user-added models are stored separately via `utils/customModels.ts`.
export const AI_MODELS: AIModelOption[] = [
  // Anthropic — all current Claude models are vision-capable.
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', provider: 'anthropic', supportsVision: true },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (default)', provider: 'anthropic', supportsVision: true },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', provider: 'anthropic', supportsVision: true },

  // DeepSeek — the public OpenAI-compatible API does not expose vision today.
  { id: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek', supportsVision: false },
  { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', provider: 'deepseek', supportsVision: false },
];

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6';
