# Implementation Plan: DeepSeek support + custom "Add Model"

**Date:** 2026-06-07 (second plan of the day, follows `implementation_plan_2026-06-07.md`)
**Goal:** Let users pick DeepSeek models alongside the built-in Claude models in AI Settings, and add custom models of their own. Connection-testing routes to the correct provider API.

---

## Important caveat about DeepSeek + image extraction

Image-to-diagram extraction (the one feature in the app that actually uses the LLM today) requires vision support. As of the latest published DeepSeek API:

- `deepseek-chat`, `deepseek-reasoner` — **no vision support**
- DeepSeek-VL exists as a research model but is not exposed on the public OpenAI-compatible API

So a DeepSeek model can be configured, tested for connection, and stored, but if it's the active model when the user starts the Jennie's-Boy-style image import, the call will either return an error or silently ignore the image. This plan surfaces that by:

1. Each model has a `supportsVision: boolean` flag.
2. The image-extraction handler alerts and aborts when the active model has `supportsVision === false`.
3. The dropdown shows a tag (e.g. "[vision]" / "[text-only]") so the user can tell at a glance.

If the user later wants DeepSeek for a different (non-image) feature, the wiring is already in place.

---

## Scope

### In scope
- Provider abstraction in the model type (`'anthropic' | 'deepseek' | 'custom'`).
- Built-in DeepSeek models (`deepseek-chat`, `deepseek-reasoner`).
- Per-provider API key storage (`anthropic_api_key`, `deepseek_api_key`).
- `testApiConnection(provider, apiKey, model)` that routes to the right endpoint + headers + body shape.
- "+ Add Model" form in the modal: label, model ID, provider, supportsVision flag.
- Custom models persisted to `localStorage` under `custom_ai_models` (JSON array).
- Delete button on custom-model rows.
- Image-extraction handler refuses to call a non-vision model and tells the user why.

### Out of scope
- A "Use this model for image extraction" / "Use this model for chat" split — there is no chat feature today.
- Encryption of API keys in localStorage.
- Auto-discovering models by hitting `/v1/models` per provider.
- Streaming or any other LLM features beyond image extraction + connection ping.

---

## Acceptance criteria

### M1 — Provider abstraction

**M1.A.1** — `AIModelOption` type gains `provider: 'anthropic' | 'deepseek' | 'custom'` and `supportsVision: boolean`. Built-in `AI_MODELS` array is updated so every existing entry has `provider: 'anthropic'` and `supportsVision: true`.
- File: `src/frontend/src/components/modals/AISettingsModal.tsx`
- Test: `AISettingsModal.test.tsx::test_m1a1_models_have_provider_and_vision` — every AI_MODELS entry has both fields set.

**M1.A.2** — DeepSeek built-ins are added to `AI_MODELS`: `deepseek-chat` and `deepseek-reasoner`, each with `provider: 'deepseek'` and `supportsVision: false`.
- Test: `AISettingsModal.test.tsx::test_m1a2_deepseek_models_present` — both DeepSeek model ids appear in the AI_MODELS list with provider='deepseek' and supportsVision=false.

### M2 — Provider-aware connection test

**M2.A.1** — `testAnthropicConnection.ts` is renamed semantically to `testApiConnection.ts` (keep the file path for git history if reasonable; can co-locate the new export). The new function `testApiConnection(provider, apiKey, model)`:
- For `'anthropic'`: POSTs to `https://api.anthropic.com/v1/messages` with `x-api-key` header, body `{ model, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }`.
- For `'deepseek'`: POSTs to `https://api.deepseek.com/chat/completions` with `Authorization: Bearer <key>` header, body `{ model, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }`.
- For `'custom'`: requires the model entry to specify its own provider routing — for now a custom model carries an effective `provider` ('anthropic' or 'deepseek') chosen at add-time; if neither, return an error.

- File: same path or new file `testApiConnection.ts` (decision: keep `testAnthropicConnection.ts` as a thin wrapper that calls the new generic for backward compat in tests, OR rename and update imports). Going with **rename to `testApiConnection.ts`** for clarity. The old test file becomes `testApiConnection.test.ts`.
- Tests:
  - `testApiConnection.test.ts::test_m2a1_anthropic_routes_to_messages_endpoint` — mock fetch, assert URL + headers + body shape for provider='anthropic'.
  - `testApiConnection.test.ts::test_m2a1_deepseek_routes_to_chat_completions_endpoint` — same for 'deepseek'.
  - `testApiConnection.test.ts::test_m2a1_returns_error_on_401_either_provider` — table-driven for both providers.
  - `testApiConnection.test.ts::test_m2a1_returns_error_on_fetch_failure` — both providers.

### M3 — Per-provider API key storage

**M3.A.1** — AISettingsModal renders two API key inputs: one for Anthropic (visible when an Anthropic-provider model is selected or always shown), one for DeepSeek. Each masked with its own 👁 toggle.
- File: `src/frontend/src/components/modals/AISettingsModal.tsx`
- Test: `AISettingsModal.test.tsx::test_m3a1_per_provider_key_inputs` — both inputs render with distinct accessible labels (`'Anthropic API Key'`, `'DeepSeek API Key'`).

**M3.A.2** — `onSave` receives `{ anthropicApiKey, deepseekApiKey, modelId }` (one object) so the parent persists three keys in one shot.
- File: `src/frontend/src/components/modals/AISettingsModal.tsx`
- Modal prop change: `onSave: (values: AISettingsValues) => void`.
- Test: `AISettingsModal.test.tsx::test_m3a2_onSave_passes_all_three_values`.

**M3.A.3** — `DiagramEditor.tsx` `handleAiSettingsSave` writes `anthropic_api_key`, `deepseek_api_key`, and `selected_model_id` to localStorage. Reads on init seed from these keys; back-compat: if `selected_model_id` is absent but `anthropic_model` exists, migrate it.
- Test: covered by behavior — manual + the source-shape verification.

### M4 — Test button picks the right key per model

**M4.A.1** — Inside the modal, clicking **Test Connection** for an Anthropic model uses the Anthropic key; for a DeepSeek model uses the DeepSeek key. Implementation: look up the active model's provider, pass the matching key.
- Test: `AISettingsModal.test.tsx::test_m4a1_test_uses_correct_key_per_provider` — set up two onTestConnection mocks (one provider each), select each model in turn, assert the right one is called.

### M5 — Add Model UI

**M5.A.1** — The modal has a "+ Add Model" disclosure that opens an inline form with fields: Label (text), Model ID (text), Provider (dropdown: anthropic, deepseek), Supports vision (checkbox). A "Save Model" button adds it to the list; a "Cancel" button discards.
- Test: `AISettingsModal.test.tsx::test_m5a1_add_model_form_renders`.
- Test: `AISettingsModal.test.tsx::test_m5a2_add_model_appends_to_dropdown` — open form, fill it, click Save Model, assert the new entry appears in the dropdown.

**M5.A.2** — Custom models persist to `localStorage.custom_ai_models` as a JSON array of `AIModelOption`. The modal reads them on mount and merges into the dropdown after the built-ins.
- File: `src/frontend/src/utils/customModels.ts` — helpers `loadCustomModels()` and `saveCustomModels(models)`.
- Tests:
  - `customModels.test.ts::test_m5a2_load_returns_empty_array_on_missing_key`.
  - `customModels.test.ts::test_m5a2_save_then_load_roundtrip`.
  - `customModels.test.ts::test_m5a2_load_ignores_invalid_json`.

**M5.A.3** — Each custom model row in the dropdown UI (not the `<select>`, but a separate "Custom Models" section below the dropdown) has a 🗑 delete button that removes it from localStorage and the dropdown.
- Test: `AISettingsModal.test.tsx::test_m5a3_delete_custom_model_removes_from_list`.

### M6 — Vision-aware image extraction

**M6.A.1** — `DiagramEditor.tsx` `handleImageDiagramAnalyze` looks up the active model's `supportsVision` flag (using both built-ins and custom models). If false: alert with a clear message ("Selected model does not support images. Pick a vision-capable model in Settings > AI Settings.") and abort the analyze flow.
- New utility: `src/frontend/src/utils/lookupModel.ts` — `lookupModel(modelId): AIModelOption | undefined` that consults built-ins + custom models.
- Tests:
  - `lookupModel.test.ts::test_m6a1_returns_builtin`.
  - `lookupModel.test.ts::test_m6a1_returns_custom`.
  - `lookupModel.test.ts::test_m6a1_returns_undefined_if_missing`.
- DiagramEditor handler is covered by a source-shape check that the abort branch exists.

---

## Implementation order

1. M1.A.1 + M1.A.2 — extend `AIModelOption`, update built-ins, add DeepSeek entries.
2. M5.A.2 (utility only) — `customModels.ts` + tests. No UI yet.
3. M6.A.1 (utility only) — `lookupModel.ts` + tests.
4. M2.A.1 — rename `testAnthropicConnection.ts` → `testApiConnection.ts`, refactor to provider-aware, update tests.
5. M3 + M4 + M5 (UI) — modal rewrite with both keys, add-model form, custom-model delete.
6. M6 (wiring) — `DiagramEditor.handleImageDiagramAnalyze` consults `lookupModel` and aborts on non-vision.
7. Wire AppRibbon/DiagramModals/DiagramEditor for the new modal prop shape.
8. Pre-completion checks + version bump + status report.

---

## Files to create

- `src/frontend/src/utils/testApiConnection.ts` (replaces `testAnthropicConnection.ts`)
- `src/frontend/src/utils/testApiConnection.test.ts` (replaces `testAnthropicConnection.test.ts`)
- `src/frontend/src/utils/customModels.ts`
- `src/frontend/src/utils/customModels.test.ts`
- `src/frontend/src/utils/lookupModel.ts`
- `src/frontend/src/utils/lookupModel.test.ts`

## Files to modify

- `src/frontend/src/components/modals/AISettingsModal.tsx` — extended `AI_MODELS`, two key inputs, add-model form, custom-model section
- `src/frontend/src/components/modals/AISettingsModal.test.tsx` — add the new spec-tagged tests, update existing tests where the props shape changes
- `src/frontend/src/components/DiagramModals.tsx` — new prop shape (`aiSettingsAnthropicApiKey`, `aiSettingsDeepseekApiKey`, `onAiSettingsSave` takes object)
- `src/frontend/src/components/DiagramEditor.tsx` — new state for the second key, updated handlers, vision-check in analyze handler
- `src/frontend/src/data/version.ts` — bump

## Files to delete (after rename)

- `src/frontend/src/utils/testAnthropicConnection.ts`
- `src/frontend/src/utils/testAnthropicConnection.test.ts`

---

## Adjacent issues found, not fixed

- The `AI_MODELS` constant is hard-coded inside the modal file. After this change it has 6 entries with two providers — large enough that it should probably live in `src/frontend/src/data/aiModels.ts`. Deferred; flagging.
- DeepSeek's OpenAI-compatible endpoint accepts both `/chat/completions` and `/v1/chat/completions`. The plan uses the former because some self-hosted OpenAI-compat servers don't have the `/v1` prefix. Worth verifying live.
- Custom model entries with `provider: 'custom'` would need a custom base URL field; this plan does NOT include a custom base URL — every custom model must claim one of the two built-in providers. If a user wants a true third provider (e.g., Mistral, Cohere), that's a follow-up.

---

## Spec coverage (status report — 2026-06-07)

| Spec ID | Description | Implementation | Test | Status |
|---|---|---|---|---|
| M1.A.1 | provider+supportsVision on AIModelOption | `src/frontend/src/data/aiModels.ts` (`AIModelOption`, `AI_MODELS`) | `aiModels.test.ts::test_m1a1_models_have_provider_and_vision` | done |
| M1.A.2 | DeepSeek built-ins | `src/frontend/src/data/aiModels.ts` (deepseek-chat, deepseek-reasoner) | `aiModels.test.ts::test_m1a2_deepseek_models_present` | done |
| M2.A.1 | provider-aware connection test | `src/frontend/src/utils/testApiConnection.ts` (pingAnthropic, pingDeepseek) | `testApiConnection.test.ts::test_m2a1_anthropic_routes_to_messages_endpoint`, `test_m2a1_deepseek_routes_to_chat_completions_endpoint`, `test_m2a1_returns_error_on_401_either_provider`, `test_m2a1_returns_error_on_fetch_failure` | done |
| M3.A.1 | per-provider key inputs | `src/frontend/src/components/modals/AISettingsModal.tsx` (`ApiKeyInput` × 2) | `AISettingsModal.test.tsx::test_m3a1_per_provider_key_inputs` | done |
| M3.A.2 | onSave passes object | `src/frontend/src/components/modals/AISettingsModal.tsx` (`handleSave`) | `AISettingsModal.test.tsx::test_m3a2_onSave_passes_all_three_values` | done |
| M3.A.3 | DiagramEditor persists both keys | `src/frontend/src/components/DiagramEditor.tsx` (`handleAiSettingsSave` writes anthropic_api_key + deepseek_api_key + selected_model_id) | tsc + manual | done |
| M4.A.1 | Test uses correct key per model | `src/frontend/src/components/modals/AISettingsModal.tsx` (`handleTest` picks `anthropicApiKey` vs `deepseekApiKey` by `activeModel.provider`) | `AISettingsModal.test.tsx::test_m4a1_test_uses_correct_key_per_provider` | done |
| M5.A.1 | Add Model form renders | `src/frontend/src/components/modals/AISettingsModal.tsx` (`addFormOpen` block) | `AISettingsModal.test.tsx::test_m5a1_add_model_form_renders` | done |
| M5.A.2 | Custom model persisted + appended | `src/frontend/src/utils/customModels.ts` + modal's `handleAddModel` | `customModels.test.ts::test_m5a2_load_returns_empty_array_on_missing_key`, `test_m5a2_save_then_load_roundtrip`, `test_m5a2_load_ignores_invalid_json` + `AISettingsModal.test.tsx::test_m5a2_add_model_appends_to_dropdown` | done |
| M5.A.3 | Custom model delete | `src/frontend/src/components/modals/AISettingsModal.tsx` (`handleDeleteCustomModel`) | `AISettingsModal.test.tsx::test_m5a3_delete_custom_model_removes_from_list` | done |
| M6.A.1 | Vision check before image analyze | `src/frontend/src/components/DiagramEditor.tsx` (`handleImageDiagramAnalyze` consults `lookupModel`) + `src/frontend/src/utils/lookupModel.ts` | `lookupModel.test.ts::test_m6a1_returns_builtin`, `test_m6a1_returns_custom`, `test_m6a1_returns_undefined_if_missing` | done |

### Pre-completion gate (CLAUDE.md mandatory 3 steps)

| Step | Command | Result |
|---|---|---|
| 1 | `cd src/frontend && npx tsc --noEmit` | passed (no output, exit 0) |
| 2 | `cd src/frontend && npx vitest run` | 335 passed, 13 skipped, 0 failed (40/40 files) |
| 3 | `cd src/frontend && rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | passed (no output, exit 0) |

### Version

Bumped `src/frontend/src/data/version.ts` from `v 1.99-0607-10-18` → `v 2.00-0607-10-31`.

### Files created

- `src/frontend/src/data/aiModels.ts` + `aiModels.test.ts`
- `src/frontend/src/utils/customModels.ts` + `customModels.test.ts`
- `src/frontend/src/utils/lookupModel.ts` + `lookupModel.test.ts`
- `src/frontend/src/utils/testApiConnection.ts` + `testApiConnection.test.ts` (replaces `testAnthropicConnection.ts`)

### Files deleted

- `src/frontend/src/utils/testAnthropicConnection.ts`
- `src/frontend/src/utils/testAnthropicConnection.test.ts`

### Manual verification checklist

- [ ] Open Settings → AI Settings → modal shows two key inputs and one model dropdown.
- [ ] Dropdown lists 4 Claude models (each tagged `[anthropic, vision]`) and 2 DeepSeek models (each tagged `[deepseek, text-only]`).
- [ ] Type the Anthropic key, pick a Claude model, Test Connection → ✓ OK.
- [ ] Switch to a DeepSeek model — Test Connection now uses the DeepSeek key.
- [ ] Click "+ Add Model" → fill Label/Model ID/Provider/supportsVision → Save Model → new entry shows under Custom Models and in the dropdown.
- [ ] Click 🗑 on a custom model → it disappears and localStorage no longer contains it.
- [ ] Reload page → all three values (both keys, model) restored.
- [ ] File → Image Diagram with a DeepSeek (or text-only custom) model selected → alert says the model doesn't support images; analysis aborts.
- [ ] Re-select an Anthropic vision model → image analysis runs normally.
