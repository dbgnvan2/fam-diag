/**
 * PersonFOOSection — Family of Origin (FOO) scales: emotional cutoff, family stability, family intactness.
 * Rendered inside PropertiesPanel (full panel) or a PopupShell (canvas popup).
 */
import React from 'react';
import type { Person } from '../../types';
import { FAMILY_INTACTNESS_SCALE, FAMILY_STABILITY_SCALE } from '../../constants/eventConstants';
import { useDialogFocus } from '../../hooks/useDialogFocus';

const labelStyle: React.CSSProperties = { width: 140, textAlign: 'right', fontWeight: 600 };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 };
const sectionCardStyle: React.CSSProperties = {
  marginTop: 12,
  border: '1px solid #d4dae5',
  borderRadius: 8,
  background: '#fff',
  padding: '10px 12px 12px',
};
const helpBadgeStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  border: '1px solid #8ba1bd',
  background: '#fff',
  color: '#38557a',
  fontWeight: 700,
  fontSize: 12,
  lineHeight: '18px',
  padding: 0,
  cursor: 'pointer',
};

interface PersonFOOSectionProps {
  personDraft: Person;
  selectedPerson: Person;
  onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
  onUpdatePerson: (personId: string, updatedProps: Partial<Person>) => void;
  updatePersonDraftState: (updates: Partial<Person>) => void;
  fooHelpOpen: 'familyStability' | 'familyIntactness' | null;
  onFooHelpOpenChange: (field: 'familyStability' | 'familyIntactness' | null) => void;
}

const PersonFOOSection = ({
  personDraft,
  selectedPerson,
  onChange,
  onUpdatePerson,
  updatePersonDraftState,
  fooHelpOpen,
  onFooHelpOpenChange,
}: PersonFOOSectionProps) => {
  // One scale help is open at a time, so one ref serves both.
  const helpRef = useDialogFocus(fooHelpOpen !== null, () => onFooHelpOpenChange(null));
  const renderScaleChooser = (
    field: 'familyStability' | 'familyIntactness',
    label: string,
    value: string | undefined,
    labels: string[],
    helpTitle: string,
    helpLines: string[]
  ) => (
    <>
      <div style={rowStyle}>
        <label htmlFor={field} style={labelStyle}>{label}:</label>
        <select
          id={field}
          name={field}
          value={value || ''}
          onChange={onChange}
          style={{ width: 220 }}
        >
          <option value="">Not set</option>
          {labels.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <button
          type="button"
          aria-label={`${label} help`}
          onClick={() => onFooHelpOpenChange(fooHelpOpen === field ? null : field)}
          style={helpBadgeStyle}
        >
          ?
        </button>
      </div>
      {fooHelpOpen === field && (
        <div
          ref={helpRef}
          tabIndex={-1}
          role="dialog"
          aria-label={helpTitle}
          style={{
            marginTop: 8,
            border: '1px solid #c6cfde',
            borderRadius: 10,
            background: '#fff',
            padding: '12px 14px',
            boxShadow: '0 10px 28px rgba(28, 41, 61, 0.16)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <strong>{helpTitle}</strong>
            <button
              type="button"
              onClick={() => onFooHelpOpenChange(null)}
              style={{ padding: '4px 10px' }}
            >
              Cancel
            </button>
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {helpLines.map((line, index) => {
              const option = labels[index];
              const isActive = value === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onUpdatePerson(selectedPerson.id, { [field]: option } as Partial<Person>);
                    updatePersonDraftState({ [field]: option } as Partial<Person>);
                    onFooHelpOpenChange(null);
                  }}
                  style={{
                    textAlign: 'left',
                    border: `1px solid ${isActive ? '#4b68a6' : '#d4dae5'}`,
                    borderRadius: 8,
                    background: isActive ? '#eef3ff' : '#fff',
                    padding: '8px 10px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#23324a' }}>{option}</div>
                  <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.4 }}>{line}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div
      role="tabpanel"
      id="person-section-panel-foo"
      aria-labelledby="person-section-tab-foo"
      style={sectionCardStyle}
    >
      <div style={{ fontWeight: 700, color: '#23324a' }}>FOO</div>
      <div style={rowStyle}>
        <label htmlFor="emotionalCutoffMeasure" style={labelStyle}>Emotional Cutoff:</label>
        <input
          type="text"
          id="emotionalCutoffMeasure"
          name="emotionalCutoffMeasure"
          value={personDraft.emotionalCutoffMeasure || ''}
          onChange={onChange}
          style={{ width: '28ch', textAlign: 'left' }}
        />
      </div>
      {renderScaleChooser(
        'familyStability',
        'Family Stability',
        personDraft.familyStability,
        FAMILY_STABILITY_SCALE.labels,
        'Family Stability Scale',
        FAMILY_STABILITY_SCALE.help
      )}
      {renderScaleChooser(
        'familyIntactness',
        'Family Intactness',
        personDraft.familyIntactness,
        FAMILY_INTACTNESS_SCALE.labels,
        'Family Intactness Scale',
        FAMILY_INTACTNESS_SCALE.help
      )}
    </div>
  );
};

export default PersonFOOSection;
