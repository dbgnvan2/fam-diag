import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { FunctionalFactCategoryDefinition } from '../../types';
import FunctionalFactSettingsModal from './FunctionalFactSettingsModal';

const categories: FunctionalFactCategoryDefinition[] = [
  { id: 'a', name: 'Work' },
  { id: 'b', name: 'School' },
];
const unused = () => ({ ownerNames: [], eventCount: 0, predictionConditionCount: 0 });

const renderModal = (overrides: Partial<React.ComponentProps<typeof FunctionalFactSettingsModal>> = {}) => {
  const props = { open: true, onClose: vi.fn(), categories, categoryUsage: unused, onSave: vi.fn(), ...overrides };
  return { props, ...render(<FunctionalFactSettingsModal {...props} />) };
};

afterEach(() => vi.restoreAllMocks());

describe('FunctionalFactSettingsModal — delete (settings-02)', () => {
  it('refuses to delete a used category', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const { props } = renderModal({
      categoryUsage: () => ({ ownerNames: ['Ann'], eventCount: 1, predictionConditionCount: 0 }),
    });
    fireEvent.click(screen.getByLabelText('Delete Work'));
    expect(alertSpy.mock.calls[0][0]).toContain('"Work" is still used by 1 event: Ann.');
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('keeps an unused category when the confirmation is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { props } = renderModal();
    fireEvent.click(screen.getByLabelText('Delete Work'));
    expect(props.onSave).not.toHaveBeenCalled();
  });
});

describe('FunctionalFactSettingsModal — names (settings-07)', () => {
  it('refuses a duplicate rename', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByLabelText('Edit Work'));
    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: ' school ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toContain('already in the list');
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('keeps its own name on an unchanged save', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByLabelText('Edit Work'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(props.onSave).toHaveBeenCalledWith(categories);
  });
});

describe('FunctionalFactSettingsModal — close (settings-05)', () => {
  it('drops an unfinished edit when closed and reopened', () => {
    const { props, rerender } = renderModal();
    fireEvent.click(screen.getByLabelText('Edit Work'));
    rerender(<FunctionalFactSettingsModal {...props} open={false} />);
    rerender(<FunctionalFactSettingsModal {...props} open />);
    expect(screen.queryByLabelText('Category name')).toBeNull();
    expect(screen.getByLabelText('Edit Work')).toBeTruthy();
  });
});
