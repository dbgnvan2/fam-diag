import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AddFamilyModal from './AddFamilyModal';
import type { AddFamilyDraft } from '../../types/diagramEditor';

const makeDraft = (overrides: Partial<AddFamilyDraft> = {}): AddFamilyDraft => ({
  parent1: { sex: 'male', firstName: '', birthDate: '' },
  parent2: { sex: 'female', firstName: '', birthDate: '' },
  familySurname: '',
  children: [
    { sex: 'male', firstName: '', birthDate: '' },
    { sex: 'female', firstName: '', birthDate: '' },
    { sex: 'male', firstName: '', birthDate: '' },
  ],
  ...overrides,
});

const baseProps = {
  open: true,
  draft: makeDraft(),
  onUpdate: vi.fn(),
  onCancel: vi.fn(),
  onSave: vi.fn(),
};

describe('AddFamilyModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<AddFamilyModal {...baseProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when draft is null', () => {
    const { container } = render(<AddFamilyModal {...baseProps} draft={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Parent 1, Parent 2, Family Surname, and Children sections when open', () => {
    render(<AddFamilyModal {...baseProps} />);
    expect(screen.getByText('Add Family')).toBeInTheDocument();
    expect(screen.getByText('Parent 1')).toBeInTheDocument();
    expect(screen.getByText('Parent 2')).toBeInTheDocument();
    expect(screen.getByText('Family Surname')).toBeInTheDocument();
    expect(screen.getByText('Children')).toBeInTheDocument();
  });

  it('starts with three children rows by default', () => {
    render(<AddFamilyModal {...baseProps} />);
    expect(screen.getAllByText('Remove')).toHaveLength(3);
  });

  it('disables Save when both parent first names are empty', () => {
    render(<AddFamilyModal {...baseProps} />);
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    expect(saveBtn).toBeDisabled();
  });

  it('disables Save when only Parent 1 has a name', () => {
    render(
      <AddFamilyModal
        {...baseProps}
        draft={makeDraft({ parent1: { sex: 'male', firstName: 'Alice', birthDate: '' } })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('enables Save when both parents have first names', () => {
    render(
      <AddFamilyModal
        {...baseProps}
        draft={makeDraft({
          parent1: { sex: 'male', firstName: 'Alice', birthDate: '' },
          parent2: { sex: 'female', firstName: 'Bob', birthDate: '' },
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('calls onUpdate with new firstName when parent input changes', () => {
    const onUpdate = vi.fn();
    render(<AddFamilyModal {...baseProps} onUpdate={onUpdate} />);
    const firstNameInputs = screen.getAllByPlaceholderText('First name');
    fireEvent.change(firstNameInputs[0], { target: { value: 'Alice' } });
    expect(onUpdate).toHaveBeenCalledWith({
      parent1: { sex: 'male', firstName: 'Alice', birthDate: '' },
    });
  });

  it('calls onUpdate with new familySurname when surname input changes', () => {
    const onUpdate = vi.fn();
    render(<AddFamilyModal {...baseProps} onUpdate={onUpdate} />);
    const surnameInput = screen.getByPlaceholderText('Family last name');
    fireEvent.change(surnameInput, { target: { value: 'Smith' } });
    expect(onUpdate).toHaveBeenCalledWith({ familySurname: 'Smith' });
  });

  it('calls onUpdate with toggled sex when M/F button clicked', () => {
    const onUpdate = vi.fn();
    render(<AddFamilyModal {...baseProps} onUpdate={onUpdate} />);
    // Parent1 starts as 'male', click F button for parent1
    const fButtons = screen.getAllByText('F');
    fireEvent.click(fButtons[0]);
    expect(onUpdate).toHaveBeenCalledWith({
      parent1: { sex: 'female', firstName: '', birthDate: '' },
    });
  });

  it('appends a new child row when "+ Add Child" clicked', () => {
    const onUpdate = vi.fn();
    render(<AddFamilyModal {...baseProps} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByText('+ Add Child'));
    expect(onUpdate).toHaveBeenCalledWith({
      children: [
        { sex: 'male', firstName: '', birthDate: '' },
        { sex: 'female', firstName: '', birthDate: '' },
        { sex: 'male', firstName: '', birthDate: '' },
        { sex: 'female', firstName: '', birthDate: '' },
      ],
    });
  });

  it('removes a child row when "Remove" clicked', () => {
    const onUpdate = vi.fn();
    render(<AddFamilyModal {...baseProps} onUpdate={onUpdate} />);
    const removeButtons = screen.getAllByText('Remove');
    fireEvent.click(removeButtons[1]);
    expect(onUpdate).toHaveBeenCalledWith({
      children: [
        { sex: 'male', firstName: '', birthDate: '' },
        { sex: 'male', firstName: '', birthDate: '' },
      ],
    });
  });

  it('calls onCancel when Cancel button clicked', () => {
    const onCancel = vi.fn();
    render(<AddFamilyModal {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onSave when Save clicked with valid draft', () => {
    const onSave = vi.fn();
    render(
      <AddFamilyModal
        {...baseProps}
        onSave={onSave}
        draft={makeDraft({
          parent1: { sex: 'male', firstName: 'Alice', birthDate: '' },
          parent2: { sex: 'female', firstName: 'Bob', birthDate: '' },
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalled();
  });

  it('renders First Name, Sex, and Birth Date for each child row', () => {
    render(<AddFamilyModal {...baseProps} />);
    // 1 surname input + 2 parents + 3 children = 6 first-name inputs
    expect(screen.getAllByPlaceholderText('First name')).toHaveLength(5);
    // 5 persons × 2 buttons (M, F) each = 10 sex buttons
    expect(screen.getAllByText('M')).toHaveLength(5);
    expect(screen.getAllByText('F')).toHaveLength(5);
  });
});
