/**
 * PersonFOOSection — Family of Origin (FOO) scales: emotional cutoff, family stability, family intactness.
 * Rendered inside PropertiesPanel (full panel) or a PopupShell (canvas popup).
 */
import React from 'react';
import type { Person } from '../../types';

const FAMILY_STABILITY_LABELS = ['Excellent', 'Good', 'Average', 'Semi-stable', 'Unstable'];
const FAMILY_STABILITY_HELP = [
  'Excellent – very high percentage (90%) of members represent good functioning across their lifetimes.',
  'Good – high percentage of family members (75-80%) represent good functioning across their lifetimes, few problems and existing problems are well managed.',
  'Average – majority of family members display stable adequate functioning across their lifetimes, some problems in family functioning but generally problems are either episodic or do not represent serious drops in overall family functioning.',
  'Semi-stable – majority of family members stable over their lifetimes but prolonged periods of drops in overall family functioning, perhaps including the present time.',
  'Unstable – majority of members have serious symptoms and major impairment of life functioning.',
];
const FAMILY_INTACTNESS_LABELS = [
  'Excellent',
  'Good',
  'Average',
  'Semi-fragmented',
  'Fragmented',
];
const FAMILY_INTACTNESS_HELP = [
  'Excellent – very high percentage (90%) of family members across three generations are alive and available for contact.',
  'Good – a high percentage (75-80%) of family members across three generations are alive and available for contact.',
  'Average – a majority of family members across three generations are alive and available for contact.',
  'Semi-fragmented – relatively few members of the family across three generations are alive and available for contact.',
  'Fragmented – basic family unit is dissolved and whereabouts of living family members is unknown.',
];

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
  onSetPersonPristine: (pristine: boolean) => void;
  fooHelpOpen: 'familyStability' | 'familyIntactness' | null;
  onFooHelpOpenChange: (field: 'familyStability' | 'familyIntactness' | null) => void;
}

const PersonFOOSection = ({
  personDraft,
  selectedPerson,
  onChange,
  onUpdatePerson,
  updatePersonDraftState,
  onSetPersonPristine,
  fooHelpOpen,
  onFooHelpOpenChange,
}: PersonFOOSectionProps) => {
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
                    onSetPersonPristine(true);
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
        FAMILY_STABILITY_LABELS,
        'Family Stability Scale',
        FAMILY_STABILITY_HELP
      )}
      {renderScaleChooser(
        'familyIntactness',
        'Family Intactness',
        personDraft.familyIntactness,
        FAMILY_INTACTNESS_LABELS,
        'Family Intactness Scale',
        FAMILY_INTACTNESS_HELP
      )}
    </div>
  );
};

export default PersonFOOSection;
