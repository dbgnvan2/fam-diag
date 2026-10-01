import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { NodalCategoryDefinition } from '../../types';
import { EVENT_CATEGORIES } from '../../constants/eventConstants';
import NodalCategorySettingsModal from './NodalCategorySettingsModal';

const categories: NodalCategoryDefinition[] = [
  { id: 'a', name: 'Job Change' },
  { id: 'b', name: 'Relocation' },
];
const unused = () => ({ ownerNames: [], eventCount: 0, predictionConditionCount: 0 });

const renderModal = (overrides: Partial<React.ComponentProps<typeof NodalCategorySettingsModal>> = {}) => {
  const props = { open: true, onClose: vi.fn(), categories, categoryUsage: unused, onSave: vi.fn(), ...overrides };
  return { props, ...render(<NodalCategorySettingsModal {...props} />) };
};

afterEach(() => vi.restoreAllMocks());

describe('NodalCategorySettingsModal — built-in reference list (struct-08)', () => {
  it('lists exactly the Nodal categories from eventConstants', () => {
    renderModal();
    fireEvent.click(screen.getByText('Reference: Default Nodal Events'));
    EVENT_CATEGORIES.NODAL.forEach((name) => expect(screen.getByText(`• ${name}`)).toBeTruthy());
  });
});

describe('NodalCategorySettingsModal — delete (settings-02)', () => {
  it('refuses to delete a used category and does not ask to confirm', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const usage = vi.fn(() => ({ ownerNames: ['Ann', 'Ann & Bob'], eventCount: 3, predictionConditionCount: 0 }));
    const { props } = renderModal({ categoryUsage: usage });
    fireEvent.click(screen.getByLabelText('Delete Job Change'));
    expect(usage).toHaveBeenCalledWith('Job Change');
    expect(alertSpy.mock.calls[0][0]).toContain('Ann & Bob');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('deletes an unused category after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { props } = renderModal();
    fireEvent.click(screen.getByLabelText('Delete Job Change'));
    expect(props.onSave).toHaveBeenCalledWith([categories[1]]);
  });
});

describe('NodalCategorySettingsModal — names (settings-07, settings-08)', () => {
  it('refuses an empty name entered with Enter', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('+ Add Category'));
    fireEvent.keyDown(screen.getByLabelText('Category name'), { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toBe('Enter a name.');
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('refuses a name another custom category has, in any letter case', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('+ Add Category'));
    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'RELOCATION' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toContain('already in the list');
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('refuses a name that is another event type\'s built-in category (regression: "Stress" became a Family event)', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByText('+ Add Category'));
    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'Stress' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toContain('Family');
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('the message clears when the name is edited', () => {
    renderModal();
    fireEvent.click(screen.getByText('+ Add Category'));
    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'Stress' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'Stress at work' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('NodalCategorySettingsModal — close (settings-05)', () => {
  it('drops an unfinished add when closed and reopened', () => {
    const { props, rerender } = renderModal();
    fireEvent.click(screen.getByText('+ Add Category'));
    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'half typed' } });
    rerender(<NodalCategorySettingsModal {...props} open={false} />);
    rerender(<NodalCategorySettingsModal {...props} open />);
    expect(screen.queryByLabelText('Category name')).toBeNull();
  });
});
