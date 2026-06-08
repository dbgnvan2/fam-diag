/**
 * Look up an AI model by id across built-ins and user-added custom models.
 *
 * Spec: docs/implementation_plan_2026-06-07b.md — M6.A.1
 */

import { AI_MODELS, type AIModelOption } from '../data/aiModels';
import { loadCustomModels } from './customModels';

export function lookupModel(modelId: string): AIModelOption | undefined {
  if (!modelId) return undefined;
  const builtIn = AI_MODELS.find((m) => m.id === modelId);
  if (builtIn) return builtIn;
  const custom = loadCustomModels().find((m) => m.id === modelId);
  return custom;
}
