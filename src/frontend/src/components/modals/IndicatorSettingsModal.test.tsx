import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { FunctionalIndicatorDefinition } from '../../types';
import IndicatorSettingsModal from './IndicatorSettingsModal';

const definitions: FunctionalIndicatorDefinition[] = [
  { id: 'cough', label: 'Cough', group: 'physical' },
  { id: 'worry', label: 'Worry', group: 'emotional' },
];

const renderModal = (onUpdateLabel: (id: string, label: string) => string | null) =>
  render(
    <IndicatorSettingsModal
      open
      onClose={vi.fn()}
      definitions={definitions}
      draftLabel=""
      onDraftLabelChange={vi.fn()}
      onAdd={vi.fn()}
      onAddForGroup={vi.fn()}
      onUpdateLabel={onUpdateLabel}
      onUpdateGroup={vi.fn()}
      onUpdateColor={vi.fn()}
      onUpdateIcon={vi.fn()}
      onUpdateUseLetter={vi.fn()}
      onClearIcon={vi.fn()}
      onRemove={vi.fn()}
      onReorder={vi.fn()}
      onSaveAsDefault={vi.fn()}
    />,
  );

describe('IndicatorSettingsModal — symptom type name (settings-07)', () => {
  it('saves the name once, when the field is left (regression: every keystroke was a rename)', () => {
    const onUpdateLabel = vi.fn(() => null);
    renderModal(onUpdateLabel);
    const input = screen.getByLabelText('Name of Cough');
    fireEvent.change(input, { target: { value: 'Co' } });
    fireEvent.change(input, { target: { value: 'Chronic cough' } });
    expect(onUpdateLabel).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onUpdateLabel).toHaveBeenCalledTimes(1);
    expect(onUpdateLabel).toHaveBeenCalledWith('cough', 'Chronic cough');
  });

  it('shows the reason a name was refused', () => {
    renderModal(() => '"Worry" is already in the list.');
    const input = screen.getByLabelText('Name of Cough');
    fireEvent.change(input, { target: { value: 'worry' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toContain('already in the list');
  });
});
