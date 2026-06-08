/**
 * AISettingsModal — configure API keys per provider, pick a model
 * (built-in or custom), add custom models, test the connection.
 *
 * Spec: docs/implementation_plan_2026-06-07b.md — M1, M3, M4, M5; M2 modal-side.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AI_MODELS,
  DEFAULT_MODEL_ID,
  type AIModelOption,
  type AIProvider,
} from '../../data/aiModels';
import { loadCustomModels, saveCustomModels } from '../../utils/customModels';
import type { ConnectionTestResult } from '../../utils/testApiConnection';

export type AISettingsValues = {
  anthropicApiKey: string;
  deepseekApiKey: string;
  modelId: string;
};

interface AISettingsModalProps {
  open: boolean;
  initialAnthropicApiKey: string;
  initialDeepseekApiKey: string;
  initialModelId: string;
  onSave: (values: AISettingsValues) => void;
  onClose: () => void;
  onTestConnection: (
    provider: AIProvider,
    apiKey: string,
    model: string
  ) => Promise<ConnectionTestResult>;
}

const MODAL_MARGIN = 24;

export default function AISettingsModal({
  open,
  initialAnthropicApiKey,
  initialDeepseekApiKey,
  initialModelId,
  onSave,
  onClose,
  onTestConnection,
}: AISettingsModalProps) {
  const [anthropicApiKey, setAnthropicApiKey] = useState(initialAnthropicApiKey);
  const [deepseekApiKey, setDeepseekApiKey] = useState(initialDeepseekApiKey);
  const [modelId, setModelId] = useState(initialModelId || DEFAULT_MODEL_ID);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [customModels, setCustomModels] = useState<AIModelOption[]>(() => loadCustomModels());

  // Add Model form state
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftId, setDraftId] = useState('');
  const [draftProvider, setDraftProvider] = useState<AIProvider>('anthropic');
  const [draftVision, setDraftVision] = useState(true);
  const [addError, setAddError] = useState<string | null>(null);

  // Reset draft state when the modal re-opens with fresh initial values.
  useEffect(() => {
    if (!open) return;
    setAnthropicApiKey(initialAnthropicApiKey);
    setDeepseekApiKey(initialDeepseekApiKey);
    setModelId(initialModelId || DEFAULT_MODEL_ID);
    setShowAnthropicKey(false);
    setShowDeepseekKey(false);
    setTestResult(null);
    setTesting(false);
    setAddFormOpen(false);
    setAddError(null);
    setCustomModels(loadCustomModels());
  }, [open, initialAnthropicApiKey, initialDeepseekApiKey, initialModelId]);

  const allModels = useMemo<AIModelOption[]>(
    () => [...AI_MODELS, ...customModels],
    [customModels]
  );
  const activeModel = useMemo<AIModelOption | undefined>(
    () => allModels.find((m) => m.id === modelId),
    [allModels, modelId]
  );

  if (!open) return null;

  const handleTest = async () => {
    if (!activeModel) {
      setTestResult({ ok: false, message: 'No model selected' });
      return;
    }
    const apiKey =
      activeModel.provider === 'anthropic'
        ? anthropicApiKey
        : activeModel.provider === 'deepseek'
        ? deepseekApiKey
        : '';
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTestConnection(activeModel.provider, apiKey, activeModel.id);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSave({
      anthropicApiKey: anthropicApiKey.trim(),
      deepseekApiKey: deepseekApiKey.trim(),
      modelId,
    });
  };

  const handleAddModel = () => {
    setAddError(null);
    const id = draftId.trim();
    const label = draftLabel.trim();
    if (!id || !label) {
      setAddError('Both Label and Model ID are required.');
      return;
    }
    if (allModels.some((m) => m.id === id)) {
      setAddError(`A model with id "${id}" already exists.`);
      return;
    }
    const newModel: AIModelOption = {
      id,
      label,
      provider: draftProvider,
      supportsVision: draftVision,
    };
    const next = [...customModels, newModel];
    setCustomModels(next);
    saveCustomModels(next);
    setDraftLabel('');
    setDraftId('');
    setDraftProvider('anthropic');
    setDraftVision(true);
    setAddFormOpen(false);
  };

  const handleDeleteCustomModel = (id: string) => {
    const next = customModels.filter((m) => m.id !== id);
    setCustomModels(next);
    saveCustomModels(next);
    if (modelId === id) {
      setModelId(DEFAULT_MODEL_ID);
    }
  };

  const fieldLabel: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 6,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    fontFamily: 'monospace',
    boxSizing: 'border-box',
  };
  const buttonPrimary: React.CSSProperties = {
    padding: '8px 16px',
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  };
  const buttonSecondary: React.CSSProperties = {
    padding: '8px 16px',
    background: '#fff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
  };
  const sectionHeading: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: '#111827',
    margin: '20px 0 8px',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI Settings"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 12500,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#fff',
          borderRadius: 14,
          padding: '20px 24px',
          width: 'min(95vw, 600px)',
          maxHeight: `calc(100vh - ${MODAL_MARGIN * 2}px)`,
          overflowY: 'auto',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>AI Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close AI Settings"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 24,
              cursor: 'pointer',
              lineHeight: 1,
              color: '#6b7280',
            }}
          >
            ×
          </button>
        </div>

        <div style={sectionHeading}>API Keys</div>
        <ApiKeyInput
          id="ai-settings-anthropic-key"
          label="Anthropic API Key"
          value={anthropicApiKey}
          onChange={setAnthropicApiKey}
          show={showAnthropicKey}
          onToggleShow={() => setShowAnthropicKey((p) => !p)}
          placeholder="sk-ant-..."
          inputStyle={inputStyle}
          fieldLabel={fieldLabel}
          buttonSecondary={buttonSecondary}
        />
        <div style={{ height: 12 }} />
        <ApiKeyInput
          id="ai-settings-deepseek-key"
          label="DeepSeek API Key"
          value={deepseekApiKey}
          onChange={setDeepseekApiKey}
          show={showDeepseekKey}
          onToggleShow={() => setShowDeepseekKey((p) => !p)}
          placeholder="sk-..."
          inputStyle={inputStyle}
          fieldLabel={fieldLabel}
          buttonSecondary={buttonSecondary}
        />
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
          Stored in this browser's localStorage. Sent only to the matching provider API.
        </div>

        <div style={sectionHeading}>Model</div>
        <label htmlFor="ai-settings-model" style={fieldLabel}>
          Active model
        </label>
        <select
          id="ai-settings-model"
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          style={{ ...inputStyle, fontFamily: 'inherit' }}
        >
          {allModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} — {m.id} [{m.provider}, {m.supportsVision ? 'vision' : 'text-only'}]
            </option>
          ))}
        </select>

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !activeModel}
            style={{
              ...buttonSecondary,
              cursor: testing ? 'not-allowed' : 'pointer',
              opacity: testing ? 0.6 : 1,
            }}
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          {testResult && (
            <div
              role="status"
              style={{
                marginTop: 10,
                padding: '8px 10px',
                borderRadius: 6,
                fontSize: 13,
                background: testResult.ok ? '#e8f5e9' : '#fdecea',
                color: testResult.ok ? '#1b5e20' : '#b71c1c',
              }}
            >
              {testResult.ok ? '✓ ' : '✗ '}
              {testResult.message}
            </div>
          )}
        </div>

        <div style={sectionHeading}>Custom Models</div>
        {customModels.length === 0 && !addFormOpen && (
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
            No custom models yet.
          </div>
        )}
        {customModels.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
            {customModels.map((m) => (
              <li
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 8px',
                  background: '#f9fafb',
                  borderRadius: 6,
                  marginBottom: 4,
                  fontSize: 13,
                }}
              >
                <span>
                  <strong>{m.label}</strong>
                  <span style={{ color: '#6b7280', marginLeft: 6 }}>
                    ({m.id} — {m.provider}, {m.supportsVision ? 'vision' : 'text-only'})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteCustomModel(m.id)}
                  aria-label={`Delete custom model ${m.label}`}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                  }}
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}

        {!addFormOpen && (
          <button
            type="button"
            onClick={() => setAddFormOpen(true)}
            style={buttonSecondary}
          >
            + Add Model
          </button>
        )}

        {addFormOpen && (
          <div
            style={{
              border: '1px solid #d1d5db',
              borderRadius: 8,
              padding: 12,
              marginTop: 8,
              background: '#f9fafb',
            }}
          >
            <div style={{ marginBottom: 8 }}>
              <label htmlFor="add-model-label" style={fieldLabel}>
                Label
              </label>
              <input
                id="add-model-label"
                type="text"
                value={draftLabel}
                onChange={(e) => setDraftLabel(e.target.value)}
                placeholder="e.g. My DeepSeek Variant"
                style={{ ...inputStyle, fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label htmlFor="add-model-id" style={fieldLabel}>
                Model ID
              </label>
              <input
                id="add-model-id"
                type="text"
                value={draftId}
                onChange={(e) => setDraftId(e.target.value)}
                placeholder="e.g. deepseek-chat"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label htmlFor="add-model-provider" style={fieldLabel}>
                Provider
              </label>
              <select
                id="add-model-provider"
                value={draftProvider}
                onChange={(e) => setDraftProvider(e.target.value as AIProvider)}
                style={{ ...inputStyle, fontFamily: 'inherit' }}
              >
                <option value="anthropic">Anthropic</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ ...fieldLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={draftVision}
                  onChange={(e) => setDraftVision(e.target.checked)}
                />
                Supports vision (required for image-to-diagram import)
              </label>
            </div>
            {addError && (
              <div
                style={{
                  background: '#fdecea',
                  color: '#b71c1c',
                  padding: '8px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                {addError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setAddFormOpen(false);
                  setAddError(null);
                  setDraftLabel('');
                  setDraftId('');
                }}
                style={buttonSecondary}
              >
                Cancel
              </button>
              <button type="button" onClick={handleAddModel} style={buttonPrimary}>
                Save Model
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={buttonSecondary}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} style={buttonPrimary}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Internal: API key input row with show/hide toggle.
// ──────────────────────────────────────────────────────────────────────────

interface ApiKeyInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder: string;
  inputStyle: React.CSSProperties;
  fieldLabel: React.CSSProperties;
  buttonSecondary: React.CSSProperties;
}

function ApiKeyInput({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
  inputStyle,
  fieldLabel,
  buttonSecondary,
}: ApiKeyInputProps) {
  return (
    <div>
      <label htmlFor={id} style={fieldLabel}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={show ? `Hide ${label}` : `Show ${label}`}
          style={{ ...buttonSecondary, padding: '8px 10px' }}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  );
}
