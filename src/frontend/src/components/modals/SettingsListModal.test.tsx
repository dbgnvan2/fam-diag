import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsListModal from './SettingsListModal';

const baseProps = {
  open: true,
  onClose: vi.fn(),
  title: 'Test Categories',
  description: 'desc',
  zIndex: 2000,
  draft: '',
  draftPlaceholder: 'add',
  onDraftChange: vi.fn(),
  onAdd: vi.fn(),
};

describe('SettingsListModal — reordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows up/down arrows when onReorder is provided', () => {
    render(
      <SettingsListModal {...baseProps} items={['a', 'b', 'c']} onReorder={vi.fn()} />,
    );
    expect(screen.getByLabelText('Move a down')).toBeInTheDocument();
    expect(screen.getByLabelText('Move b up')).toBeInTheDocument();
    expect(screen.getByLabelText('Move b down')).toBeInTheDocument();
    expect(screen.getByLabelText('Move c up')).toBeInTheDocument();
  });

  it('hides up/down arrows when onReorder is not provided', () => {
    render(<SettingsListModal {...baseProps} items={['a', 'b']} />);
    expect(screen.queryByLabelText('Move a down')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Move b up')).not.toBeInTheDocument();
  });

  it('calls onReorder with swapped items when up arrow is clicked', () => {
    const onReorder = vi.fn();
    render(
      <SettingsListModal {...baseProps} items={['a', 'b', 'c']} onReorder={onReorder} />,
    );
    fireEvent.click(screen.getByLabelText('Move b up'));
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('calls onReorder with swapped items when down arrow is clicked', () => {
    const onReorder = vi.fn();
    render(
      <SettingsListModal {...baseProps} items={['a', 'b', 'c']} onReorder={onReorder} />,
    );
    fireEvent.click(screen.getByLabelText('Move b down'));
    expect(onReorder).toHaveBeenCalledWith(['a', 'c', 'b']);
  });

  it('disables up arrow on first item and down arrow on last item', () => {
    render(
      <SettingsListModal {...baseProps} items={['a', 'b', 'c']} onReorder={vi.fn()} />,
    );
    expect(screen.getByLabelText('Move a up')).toBeDisabled();
    expect(screen.getByLabelText('Move c down')).toBeDisabled();
    expect(screen.getByLabelText('Move b up')).not.toBeDisabled();
    expect(screen.getByLabelText('Move b down')).not.toBeDisabled();
  });
});
