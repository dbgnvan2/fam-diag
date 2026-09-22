/**
 * Pre-flight check for image import: confirms an Anthropic API key is saved
 * and the selected model is a vision-capable Anthropic model. Each failing
 * condition returns its own message so the import log names the actual cause.
 */

import type { AIModelOption } from '../data/aiModels';

export type VisionImportReadiness =
  | { ok: true; model: AIModelOption }
  | { ok: false; reason: 'missing_api_key' | 'unknown_model' | 'wrong_provider' | 'no_vision'; message: string };

export function checkVisionImportReadiness(
  apiKey: string,
  modelId: string,
  model: AIModelOption | undefined
): VisionImportReadiness {
  if (!apiKey.trim()) {
    return {
      ok: false,
      reason: 'missing_api_key',
      message:
        'No Anthropic API key is saved in this browser. Open AI Settings, enter your ' +
        'Anthropic API key, and click Save. (Keys are stored per browser and per site ' +
        'address, so a key saved in the desktop app or another browser is not visible here.)',
    };
  }
  if (!model) {
    return {
      ok: false,
      reason: 'unknown_model',
      message:
        `The selected model "${modelId}" is not in the built-in or custom model list. ` +
        'Open AI Settings, select a Claude model, and click Save.',
    };
  }
  if (model.provider !== 'anthropic') {
    return {
      ok: false,
      reason: 'wrong_provider',
      message:
        `The selected model "${model.label}" (${model.id}) uses provider "${model.provider}". ` +
        'Image import requires an Anthropic Claude model. Open AI Settings, select a Claude ' +
        'model, and click Save.',
    };
  }
  if (!model.supportsVision) {
    return {
      ok: false,
      reason: 'no_vision',
      message:
        `The selected model "${model.label}" (${model.id}) is marked as text-only. ` +
        'Image import requires a vision-capable model. Open AI Settings and select a ' +
        'vision model (or mark this custom model as vision-capable).',
    };
  }
  return { ok: true, model };
}
