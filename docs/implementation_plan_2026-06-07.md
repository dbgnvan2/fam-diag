# Implementation Plan: AI Settings (API key + model + connection test)

**Date:** 2026-06-07
**Goal:** Replace the developer-only `localStorage.setItem('anthropic_api_key', …)` workaround with a real Settings UI for the Anthropic API key and the model the app should use for image extraction, plus an in-modal "Test Connection" button.

This addresses one of the adjacent issues called out in `docs/implementation_plan_2026-06-06.md` ("API key is read from localStorage … No UI for setting it"). The same modal lets the user pick which Vision-capable model to use.

---

## Scope

### In scope
- New `AISettingsModal` with: API key input (masked), model dropdown, **Test Connection** button, save, cancel.
- Settings dropdown entry "AI Settings" in `AppRibbon.tsx`.
- Persist to `localStorage` keys: `anthropic_api_key` (existing) and `anthropic_model` (new).
- `imageAnalysis.ts` reads the chosen model instead of hard-coding `claude-3-5-sonnet-20241022`.
- DiagramEditor's `handleImageDiagramAnalyze` passes the chosen model through.
- Test Connection sends a minimal `/v1/messages` request (`max_tokens: 1`, "ping" prompt) and reports success / specific error.

### Out of scope
- Auto-fetching a model list from Anthropic — we ship a hard-coded allow-list (easy to grow later).
- Server-side proxying of the API key. The key stays in `localStorage`; this matches the existing design.
- Encryption at rest in localStorage.

---

## Acceptance criteria

Every criterion is verifiable by an automated test or a file-existence check.

### M1 — Settings modal

**M1.A.1** — New file `src/frontend/src/components/modals/AISettingsModal.tsx` exports a default `AISettingsModal` component.
- Props: `{ open: boolean; initialApiKey: string; initialModel: string; onSave: (apiKey: string, model: string) => void; onClose: () => void; onTestConnection: (apiKey: string, model: string) => Promise<{ ok: boolean; message: string }>; }`
- Test: `AISettingsModal.test.tsx::test_m1a1_modal_renders_when_open` — render with `open=true`, assert API key input + model dropdown + Save/Cancel/Test buttons all exist.

**M1.A.2** — API key input is `type="password"` with an inline 👁 toggle that flips to `type="text"` so the user can verify what they typed.
- Test: `AISettingsModal.test.tsx::test_m1a2_password_visibility_toggle`.

**M1.A.3** — Model dropdown options come from a constant `AI_MODELS` (defined in the modal or a sibling file) and at minimum include `claude-3-5-sonnet-20241022`, `claude-sonnet-4-6`, `claude-opus-4-7`, `claude-haiku-4-5-20251001`. The currently-saved model is preselected.
- Test: `AISettingsModal.test.tsx::test_m1a3_model_dropdown_options`.

**M1.A.4** — Clicking **Save** invokes `onSave(apiKey, model)` with the current values; clicking **Cancel** invokes `onClose` and does not call `onSave`.
- Test: `AISettingsModal.test.tsx::test_m1a4_save_and_cancel_callbacks`.

### M2 — Settings menu wiring

**M2.A.1** — `AppRibbon.tsx` Settings menu has a new entry "AI Settings" that calls `setAiSettingsOpen(true)`.
- Test: `AppRibbon.test.tsx` may not exist; instead, source-shape check inside `AISettingsModal.test.tsx::test_m2a1_appribbon_has_entry` that reads `AppRibbon.tsx` and asserts an entry with label `'AI Settings'` and an action calling `setAiSettingsOpen`. (Same source-check pattern as `test_m5a1_only_one_image_modal_at_a_time`.)

**M2.A.2** — `DiagramModals.tsx` renders `AISettingsModal` with `open={aiSettingsOpen}` and passes through `onSave`, `onClose`, `onTestConnection`.
- Test: source-shape check in the same file as above asserts `<AISettingsModal` block exists.

**M2.A.3** — `DiagramEditor.tsx` owns the new state `aiSettingsOpen` and the handler `handleAiSettingsSave(apiKey, model)` that writes both `localStorage.setItem('anthropic_api_key', apiKey)` and `localStorage.setItem('anthropic_model', model)`.
- Test: behavior covered by manual verification; source-shape check confirms `aiSettingsOpen` state exists.

### M3 — Connection test

**M3.A.1** — New utility `src/frontend/src/utils/testAnthropicConnection.ts` exports `async function testAnthropicConnection(apiKey: string, model: string): Promise<{ ok: boolean; message: string }>`. Implementation: POST to `https://api.anthropic.com/v1/messages` with the chosen model, `max_tokens: 1`, and `messages: [{ role: 'user', content: 'ping' }]`.
- Returns `{ ok: true, message: 'OK' }` on HTTP 200.
- Returns `{ ok: false, message: <api error message or HTTP status> }` on non-200.
- Returns `{ ok: false, message: <network error message> }` on fetch failure.
- Test: `testAnthropicConnection.test.ts::test_m3a1_returns_ok_on_200` — mock `fetch` to return 200, assert `ok: true`.
- Test: `testAnthropicConnection.test.ts::test_m3a2_returns_error_on_401` — mock `fetch` to return 401 with `{"error":{"message":"invalid x-api-key"}}`, assert `ok: false` and message contains "invalid".
- Test: `testAnthropicConnection.test.ts::test_m3a3_returns_error_on_fetch_failure` — mock `fetch` to reject, assert `ok: false`.

**M3.A.2** — Modal's **Test Connection** button is disabled while a test is in flight. The result is displayed inline in the modal (green check on ok, red ✗ with message on failure).
- Test: `AISettingsModal.test.tsx::test_m3a2_test_button_shows_result` — pass a stub `onTestConnection` returning `{ ok: false, message: 'invalid x-api-key' }`, click the button, assert the message renders.

### M4 — Use chosen model in extraction

**M4.A.1** — `imageAnalysis.ts` `analyzeImageToDiagramData(blob, apiKey, model?)` accepts an optional `model` parameter (default `'claude-3-5-sonnet-20241022'`). The body uses that model.
- Test: `imageAnalysis.test.ts::test_m4a1_uses_supplied_model` — mock `fetch`, assert the body JSON contains the supplied model when one is passed.

**M4.A.2** — `DiagramEditor.tsx` reads `localStorage.getItem('anthropic_model')` (fallback `'claude-3-5-sonnet-20241022'`) and passes it to `analyzeImageToDiagramData`.
- Test: covered by source-shape check + manual UI verification.

---

## Implementation order

1. M3.A.1 — `testAnthropicConnection.ts` + its tests (no deps).
2. M4.A.1 — extend `analyzeImageToDiagramData` signature + its test (no UI deps).
3. M1.A.1–4 — `AISettingsModal.tsx` + its tests.
4. M2.A.1–3 — wire through `DiagramModals`, `AppRibbon`, `DiagramEditor`.
5. M4.A.2 — Use the saved model in `handleImageDiagramAnalyze`.
6. Pre-completion checklist, version bump, status report.

---

## Files to create

- `src/frontend/src/utils/testAnthropicConnection.ts`
- `src/frontend/src/utils/testAnthropicConnection.test.ts`
- `src/frontend/src/components/modals/AISettingsModal.tsx`
- `src/frontend/src/components/modals/AISettingsModal.test.tsx`

## Files to modify

- `src/frontend/src/utils/imageAnalysis.ts` — accept optional `model` param
- `src/frontend/src/utils/imageAnalysis.test.ts` — test for `test_m4a1_uses_supplied_model`
- `src/frontend/src/components/AppRibbon.tsx` — Settings menu entry + new prop
- `src/frontend/src/components/DiagramModals.tsx` — render AISettingsModal + new props
- `src/frontend/src/components/DiagramEditor.tsx` — state + handler + use saved model
- `src/frontend/src/data/version.ts` — bump

---

## Adjacent issues found, not fixed

- The `anthropic_api_key` localStorage key is shared with any other feature on the same origin. Not encrypted. If we later support team-shared keys or a "remember me" toggle, revisit.
- `AI_MODELS` is hard-coded. As new models ship, this list needs manual updates. A follow-up could call `/v1/models` on save and cache the list.
- No UI for clearing the saved key. Could add a "Clear" button next to the API key input. Deferred to keep scope tight.

---

## Spec coverage (status report — 2026-06-07)

| Spec ID | Description | Implementation | Test | Status |
|---|---|---|---|---|
| M1.A.1 | AISettingsModal renders | `src/frontend/src/components/modals/AISettingsModal.tsx` | `AISettingsModal.test.tsx::test_m1a1_modal_renders_when_open` | done |
| M1.A.2 | Password visibility toggle | `src/frontend/src/components/modals/AISettingsModal.tsx` (showKey state) | `AISettingsModal.test.tsx::test_m1a2_password_visibility_toggle` | done |
| M1.A.3 | Model dropdown options | `src/frontend/src/components/modals/AISettingsModal.tsx` (`AI_MODELS` constant) | `AISettingsModal.test.tsx::test_m1a3_model_dropdown_options` | done |
| M1.A.4 | Save / Cancel callbacks | `src/frontend/src/components/modals/AISettingsModal.tsx` (handleSave, onClose) | `AISettingsModal.test.tsx::test_m1a4_save_and_cancel_callbacks` | done |
| M2.A.1 | Settings menu entry | `src/frontend/src/components/AppRibbon.tsx` (settingsMenuItems append) | `AISettingsModal.test.tsx::test_m2a1_appribbon_has_entry` (source-shape check) | done |
| M2.A.2 | DiagramModals renders modal | `src/frontend/src/components/DiagramModals.tsx` (new `<AISettingsModal>` block) | covered by tsc + manual | done |
| M2.A.3 | DiagramEditor save handler | `src/frontend/src/components/DiagramEditor.tsx` (`handleAiSettingsSave` writes both localStorage keys) | covered by tsc + manual | done |
| M3.A.1 | Connection test returns ok on 200 | `src/frontend/src/utils/testAnthropicConnection.ts` | `testAnthropicConnection.test.ts::test_m3a1_returns_ok_on_200` | done |
| M3.A.2 | Connection test returns error on 401 | `src/frontend/src/utils/testAnthropicConnection.ts` | `testAnthropicConnection.test.ts::test_m3a2_returns_error_on_401` | done |
| M3.A.3 | Connection test returns error on fetch failure | `src/frontend/src/utils/testAnthropicConnection.ts` | `testAnthropicConnection.test.ts::test_m3a3_returns_error_on_fetch_failure` | done |
| M3.A.2 (modal) | Test button shows result | `src/frontend/src/components/modals/AISettingsModal.tsx` (handleTest sets testResult) | `AISettingsModal.test.tsx::test_m3a2_test_button_shows_result` | done |
| M4.A.1 | Model param in analyzeImageToDiagramData | `src/frontend/src/utils/imageAnalysis.ts` (`DEFAULT_VISION_MODEL`, optional `model` arg) | `imageAnalysis.test.ts::test_m4a1_uses_supplied_model` | done |
| M4.A.2 | DiagramEditor passes saved model | `src/frontend/src/components/DiagramEditor.tsx` (handleImageDiagramAnalyze reads `anthropic_model`) | covered by tsc + manual | done |

### Pre-completion gate (CLAUDE.md mandatory 3 steps)

| Step | Command | Result |
|---|---|---|
| 1 | `cd src/frontend && npx tsc --noEmit` | passed (no output, exit 0) |
| 2 | `cd src/frontend && npx vitest run` | 319 passed, 13 skipped, 0 failed (37/37 files) |
| 3 | `cd src/frontend && rm -f node_modules/.tmp/tsconfig.app.tsbuildinfo && npx tsc -b` | passed (no output, exit 0) |

### Version

Bumped `src/frontend/src/data/version.ts` from `v 1.98-0607-08-22` → `v 1.99-0607-10-18`.

### Manual verification checklist

- [ ] Open Settings → AI Settings → modal appears.
- [ ] Type a key, click 👁 → input flips to type=text and back.
- [ ] Pick a model → dropdown shows Opus 4.7, Sonnet 4.6, Haiku 4.5, Sonnet 3.5.
- [ ] Click Test Connection with a known-good key → green ✓ OK.
- [ ] Click Test Connection with a known-bad key → red ✗ + message from API.
- [ ] Click Save → values persist after a page reload.
- [ ] File → Image Diagram → analyze the Jennie's Boy fixture using the saved model.
