import type { AddFamilyDraft } from '../../types/diagramEditor';
import DatePickerField from '../DatePickerField';

interface AddFamilyModalProps {
  open: boolean;
  draft: AddFamilyDraft | null;
  onUpdate: (updates: Partial<AddFamilyDraft>) => void;
  onCancel: () => void;
  onSave: () => void;
}

const AddFamilyModal = ({ open, draft, onUpdate, onCancel, onSave }: AddFamilyModalProps) => {
  if (!open || !draft) return null;

  const handleParentChange = (parentKey: 'parent1' | 'parent2', field: string, value: string) => {
    const parent = draft[parentKey];
    onUpdate({
      [parentKey]: {
        ...parent,
        [field]: value,
      },
    });
  };

  const handleChildChange = (index: number, field: string, value: string) => {
    const newChildren = [...draft.children];
    newChildren[index] = {
      ...newChildren[index],
      [field]: value,
    };
    onUpdate({ children: newChildren });
  };

  const handleAddChild = () => {
    onUpdate({
      children: [
        ...draft.children,
        { sex: 'female' as const, firstName: '', birthDate: '' },
      ],
    });
  };

  const handleRemoveChild = (index: number) => {
    const newChildren = draft.children.filter((_, i) => i !== index);
    onUpdate({ children: newChildren });
  };

  const isSaveDisabled = !draft.parent1.firstName.trim() || !draft.parent2.firstName.trim();

  const sexButtonStyle = (selected: boolean): React.CSSProperties => ({
    padding: '4px 10px',
    border: selected ? '2px solid #0066cc' : '1px solid #ccc',
    background: selected ? '#e6f0ff' : '#fff',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: selected ? 600 : 400,
  });

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: '#38557a',
    marginBottom: 3,
    display: 'block',
  };

  const fieldInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    fontSize: 12,
    border: '1px solid #d0d0d0',
    borderRadius: 4,
    boxSizing: 'border-box' as const,
  };

  const rowContainerStyle: React.CSSProperties = {
    marginBottom: 12,
    padding: 10,
    border: '1px solid #e0e0e0',
    borderRadius: 6,
    background: '#fafafa',
  };

  const renderFieldsRow = (
    firstName: string,
    sex: 'male' | 'female',
    birthDate: string,
    onFirstNameChange: (val: string) => void,
    onSexChange: (val: 'male' | 'female') => void,
    onBirthDateChange: (val: string) => void,
    keyPrefix: string,
  ) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 160px', minWidth: 140 }}>
        <label style={fieldLabelStyle}>First Name</label>
        <input
          type="text"
          value={firstName}
          onChange={(e) => onFirstNameChange(e.target.value)}
          placeholder="First name"
          style={fieldInputStyle}
        />
      </div>
      <div>
        <label style={fieldLabelStyle}>Sex</label>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            style={sexButtonStyle(sex === 'male')}
            onClick={() => onSexChange('male')}
          >
            M
          </button>
          <button
            type="button"
            style={sexButtonStyle(sex === 'female')}
            onClick={() => onSexChange('female')}
          >
            F
          </button>
        </div>
      </div>
      <div>
        <label style={fieldLabelStyle}>Birth Date</label>
        <DatePickerField
          id={`${keyPrefix}-birthDate`}
          name={`${keyPrefix}-birthDate`}
          value={birthDate}
          onChange={(e) => onBirthDateChange(e.target.value)}
        />
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2075,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: 16,
          width: 640,
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
          pointerEvents: 'auto',
        }}
      >
        <h4 style={{ marginTop: 0, marginBottom: 14 }}>Add Family</h4>

        <div style={rowContainerStyle}>
          <h5 style={{ marginTop: 0, marginBottom: 10, fontSize: 13 }}>Parent 1</h5>
          {renderFieldsRow(
            draft.parent1.firstName,
            draft.parent1.sex,
            draft.parent1.birthDate,
            (val) => handleParentChange('parent1', 'firstName', val),
            (val) => handleParentChange('parent1', 'sex', val),
            (val) => handleParentChange('parent1', 'birthDate', val),
            'parent1',
          )}
        </div>

        <div style={rowContainerStyle}>
          <h5 style={{ marginTop: 0, marginBottom: 10, fontSize: 13 }}>Parent 2</h5>
          {renderFieldsRow(
            draft.parent2.firstName,
            draft.parent2.sex,
            draft.parent2.birthDate,
            (val) => handleParentChange('parent2', 'firstName', val),
            (val) => handleParentChange('parent2', 'sex', val),
            (val) => handleParentChange('parent2', 'birthDate', val),
            'parent2',
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={fieldLabelStyle}>Family Surname</label>
          <input
            type="text"
            value={draft.familySurname}
            onChange={(e) => onUpdate({ familySurname: e.target.value })}
            placeholder="Family last name"
            style={fieldInputStyle}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h5 style={{ margin: 0, fontSize: 13 }}>Children</h5>
            <button
              type="button"
              onClick={handleAddChild}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                border: '1px solid #0066cc',
                background: '#e6f0ff',
                color: '#0066cc',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              + Add Child
            </button>
          </div>

          {draft.children.map((child, index) => (
            <div key={index} style={rowContainerStyle}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {renderFieldsRow(
                    child.firstName,
                    child.sex,
                    child.birthDate,
                    (val) => handleChildChange(index, 'firstName', val),
                    (val) => handleChildChange(index, 'sex', val),
                    (val) => handleChildChange(index, 'birthDate', val),
                    `child-${index}`,
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveChild(index)}
                  style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    border: '1px solid #d0d0d0',
                    background: '#fff',
                    color: '#666',
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onSave} disabled={isSaveDisabled} style={{ opacity: isSaveDisabled ? 0.5 : 1, cursor: isSaveDisabled ? 'not-allowed' : 'pointer' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddFamilyModal;
