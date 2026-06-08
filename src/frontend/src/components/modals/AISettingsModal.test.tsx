/**
 * Tests for AISettingsModal.
 *
 * Spec: docs/implementation_plan_2026-06-07b.md — M1 (via aiModels.test.ts),
 *       M3.A.1, M3.A.2, M4.A.1, M5.A.1, M5.A.2 (UI side), M5.A.3, plus
 *       backward checks from implementation_plan_2026-06-07.md (M1.A.1–4, M3.A.2 modal).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import AISettingsModal from './AISettingsModal';

function defaultProps(overrides: Partial<React.ComponentProps<typeof AISettingsModal>> = {}) {
  return {
    open: true,
    initialAnthropicApiKey: '',
    initialDeepseekApiKey: '',
    initialModelId: 'claude-sonnet-4-6',
    onSave: vi.fn(),
    onClose: vi.fn(),
    onTestConnection: vi.fn().mockResolvedValue({ ok: true, message: 'OK' }),
    ...overrides,
  };
}

describe('AISettingsModal', () => {
  beforeEach(() => {
    localStorage.removeItem('custom_ai_models');
  });

  it('renders core elements when open', () => {
    render(<AISettingsModal {...defaultProps()} />);
    expect(screen.getByLabelText('Anthropic API Key')).toBeInTheDocument();
    expect(screen.getByLabelText('DeepSeek API Key')).toBeInTheDocument();
    expect(screen.getByLabelText('Active model')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('renders nothing when open=false', () => {
    const { container } = render(<AISettingsModal {...defaultProps({ open: false })} />);
    expect(container.firstChild).toBeNull();
  });

  it('test_m3a1_per_provider_key_inputs', () => {
    render(<AISettingsModal {...defaultProps()} />);
    const anthropic = screen.getByLabelText('Anthropic API Key') as HTMLInputElement;
    const deepseek = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement;
    expect(anthropic.type).toBe('password');
    expect(deepseek.type).toBe('password');
  });

  it('password toggle works independently per provider', () => {
    render(<AISettingsModal {...defaultProps({ initialAnthropicApiKey: 'a', initialDeepseekApiKey: 'd' })} />);
    const anthropic = screen.getByLabelText('Anthropic API Key') as HTMLInputElement;
    const deepseek = screen.getByLabelText('DeepSeek API Key') as HTMLInputElement;

    fireEvent.click(screen.getByRole('button', { name: /show anthropic api key/i }));
    expect(anthropic.type).toBe('text');
    expect(deepseek.type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: /show deepseek api key/i }));
    expect(deepseek.type).toBe('text');
  });

  it('dropdown lists built-in Claude and DeepSeek models', () => {
    render(<AISettingsModal {...defaultProps()} />);
    const select = screen.getByLabelText('Active model') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('claude-sonnet-4-6');
    expect(values).toContain('claude-opus-4-7');
    expect(values).toContain('deepseek-chat');
    expect(values).toContain('deepseek-reasoner');
  });

  it('test_m3a2_onSave_passes_all_three_values', () => {
    const onSave = vi.fn();
    render(
      <AISettingsModal
        {...defaultProps({
          initialAnthropicApiKey: 'sk-ant-x',
          initialDeepseekApiKey: 'sk-deep-y',
          initialModelId: 'deepseek-chat',
          onSave,
        })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSave).toHaveBeenCalledWith({
      anthropicApiKey: 'sk-ant-x',
      deepseekApiKey: 'sk-deep-y',
      modelId: 'deepseek-chat',
    });
  });

  it('test_m4a1_test_uses_correct_key_per_provider', async () => {
    const onTestConnection = vi.fn().mockResolvedValue({ ok: true, message: 'OK' });
    const { rerender } = render(
      <AISettingsModal
        {...defaultProps({
          initialAnthropicApiKey: 'sk-ant-x',
          initialDeepseekApiKey: 'sk-deep-y',
          initialModelId: 'claude-sonnet-4-6',
          onTestConnection,
        })}
      />
    );

    // Click Test with an Anthropic model selected
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    await waitFor(() => expect(onTestConnection).toHaveBeenCalledTimes(1));
    expect(onTestConnection).toHaveBeenLastCalledWith('anthropic', 'sk-ant-x', 'claude-sonnet-4-6');

    // Switch to a DeepSeek model and Test again
    const select = screen.getByLabelText('Active model') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'deepseek-chat' } });
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    await waitFor(() => expect(onTestConnection).toHaveBeenCalledTimes(2));
    expect(onTestConnection).toHaveBeenLastCalledWith('deepseek', 'sk-deep-y', 'deepseek-chat');

    rerender(<></>);
  });

  it('test_button_shows_result_inline', async () => {
    const onTestConnection = vi.fn().mockResolvedValue({ ok: false, message: 'invalid x-api-key' });
    render(<AISettingsModal {...defaultProps({ initialAnthropicApiKey: 'sk-bad', onTestConnection })} />);
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('invalid x-api-key');
    });
    expect(screen.getByRole('status').textContent).toContain('✗');
  });

  it('test_m5a1_add_model_form_renders', () => {
    render(<AISettingsModal {...defaultProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /\+ add model/i }));
    expect(screen.getByLabelText('Label')).toBeInTheDocument();
    expect(screen.getByLabelText('Model ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Provider')).toBeInTheDocument();
    expect(screen.getByLabelText(/supports vision/i)).toBeInTheDocument();
  });

  it('test_m5a2_add_model_appends_to_dropdown', () => {
    render(<AISettingsModal {...defaultProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /\+ add model/i }));
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'My Variant' } });
    fireEvent.change(screen.getByLabelText('Model ID'), { target: { value: 'my-variant-1' } });
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'deepseek' } });
    fireEvent.click(screen.getByLabelText(/supports vision/i)); // toggle off
    fireEvent.click(screen.getByRole('button', { name: /save model/i }));

    const select = screen.getByLabelText('Active model') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('my-variant-1');

    // Persists to localStorage
    const stored = JSON.parse(localStorage.getItem('custom_ai_models') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('my-variant-1');
    expect(stored[0].supportsVision).toBe(false);
  });

  it('add-model form rejects duplicate ids', () => {
    render(<AISettingsModal {...defaultProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /\+ add model/i }));
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'dupe' } });
    fireEvent.change(screen.getByLabelText('Model ID'), { target: { value: 'claude-opus-4-7' } });
    fireEvent.click(screen.getByRole('button', { name: /save model/i }));
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });

  it('test_m5a3_delete_custom_model_removes_from_list', () => {
    localStorage.setItem(
      'custom_ai_models',
      JSON.stringify([
        { id: 'my-variant-1', label: 'My Variant', provider: 'deepseek', supportsVision: false },
      ])
    );
    render(<AISettingsModal {...defaultProps()} />);
    expect(screen.getByText('My Variant')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /delete custom model my variant/i }));
    expect(screen.queryByText('My Variant')).toBeNull();
    expect(JSON.parse(localStorage.getItem('custom_ai_models') || '[]')).toEqual([]);
  });
});

describe('test_m2a1_appribbon_has_entry', () => {
  it('Settings menu in AppRibbon includes an "AI Settings" entry that calls setAiSettingsOpen', () => {
    const appRibbonSource = readFileSync(
      join(__dirname, '..', 'AppRibbon.tsx'),
      'utf8'
    );
    expect(appRibbonSource).toMatch(/label:\s*['"]AI Settings['"]/);
    expect(appRibbonSource).toMatch(/setAiSettingsOpen\(true\)/);
  });
});
