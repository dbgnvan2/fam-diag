import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { SIRCategoryDefinition } from '../../types';
import SIRSettingsModal from './SIRSettingsModal';

const levels: SIRCategoryDefinition['levels'] = ['1', '2', '3', '4', '5'];
const categories: SIRCategoryDefinition[] = [
  { id: 'a', name: 'Defining Self', levels },
  { id: 'b', name: 'Managing Reactivity', levels },
];
const unused = () => ({ ownerNames: [], eventCount: 0, predictionConditionCount: 0 });

const renderModal = (overrides: Partial<React.ComponentProps<typeof SIRSettingsModal>> = {}) => {
  const props = { open: true, onClose: vi.fn(), categories, categoryUsage: unused, onSave: vi.fn(), ...overrides };
  return { props, ...render(<SIRSettingsModal {...props} />) };
};

afterEach(() => vi.restoreAllMocks());

describe('SIRSettingsModal — delete (settings-02)', () => {
  it('refuses to delete a category events still use, naming who uses it', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { props } = renderModal({
      categoryUsage: () => ({ ownerNames: ['Ann'], eventCount: 2, predictionConditionCount: 0 }),
    });
    fireEvent.click(screen.getByLabelText('Delete Defining Self'));
    expect(alertSpy.mock.calls[0][0]).toContain('Ann');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('asks before deleting an unused category', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { props } = renderModal();
    fireEvent.click(screen.getByLabelText('Delete Defining Self'));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByLabelText('Delete Defining Self'));
    expect(props.onSave).toHaveBeenCalledWith([categories[1]]);
  });
});

describe('SIRSettingsModal — names (settings-07, settings-08)', () => {
  it('refuses a duplicate name with a message', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByLabelText('Edit Defining Self'));
    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'managing reactivity' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toContain('already in the list');
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('refuses another event type\'s built-in category name', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('+ Add Category'));
    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'Stress' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toContain('built-in');
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('saves a rename under the same id', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByLabelText('Edit Defining Self'));
    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'Self Definition' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(props.onSave).toHaveBeenCalledWith([{ ...categories[0], name: 'Self Definition' }, categories[1]]);
  });
});

describe('SIRSettingsModal — close (settings-05)', () => {
  it('drops an unfinished edit when closed and reopened', () => {
    const { props, rerender } = renderModal();
    fireEvent.click(screen.getByLabelText('Edit Defining Self'));
    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'half typed' } });
    rerender(<SIRSettingsModal {...props} open={false} />);
    rerender(<SIRSettingsModal {...props} open />);
    expect(screen.queryByLabelText('Category name')).toBeNull();
    expect(screen.getByText('+ Add Category')).toBeTruthy();
  });
});

describe('SIRSettingsModal — blank levels (settings-04)', () => {
  it('numbers each blank level by its own position (regression: every blank became "Level 1")', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('+ Add Category'));
    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'New SIR' } });
    fireEvent.change(screen.getByPlaceholderText('Level 3 description'), { target: { value: 'Middle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const saved = (props.onSave as ReturnType<typeof vi.fn>).mock.calls[0][0] as SIRCategoryDefinition[];
    expect(saved[saved.length - 1].levels).toEqual(['Level 1', 'Level 2', 'Middle', 'Level 4', 'Level 5']);
  });
});
