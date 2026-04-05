/**
 * PersonPaperoSection — Papero Assessment: Family Unit Response to Challenge Framework.
 * Each category contains topics rated on a 1-5 continuum with "?" help dropdown.
 * Rendered inside PropertiesPanel as the "Papero" tab.
 */
import React, { useState } from 'react';
import type { Person, PaperoScores } from '../../types';
import { EVENT_SUBTYPES, PAPERO_SCALES, PAPERO_SUBTYPE_TO_KEY } from '../../constants/eventConstants';

const PAPERO_CATEGORIES = [
  'Resourceful',
  'Connectedness & Integration',
  'Tension Management',
  'Systems Thinking',
  'Goal Structure',
] as const;

const CATEGORY_LEFT_LABELS: Record<string, string> = {
  'Resourceful': 'Avoidance',
  'Connectedness & Integration': 'Cutoff',
  'Tension Management': 'Unmanaged',
  'Systems Thinking': 'Conventional',
  'Goal Structure': 'No Clear Goals',
};

const CATEGORY_RIGHT_LABELS: Record<string, string> = {
  'Resourceful': 'Engagement',
  'Connectedness & Integration': 'Many Open Relationships',
  'Tension Management': 'Well Regulated',
  'Systems Thinking': 'Systems',
  'Goal Structure': 'SMART Goals',
};

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

const categoryHeaderStyle: React.CSSProperties = {
  background: '#dce8f5',
  padding: '8px 12px',
  borderRadius: 6,
  marginTop: 14,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

interface PersonPaperoSectionProps {
  personDraft: Person;
  selectedPerson: Person;
  onUpdatePerson: (personId: string, updatedProps: Partial<Person>) => void;
  updatePersonDraftState: (updates: Partial<Person>) => void;
  onSetPersonPristine: (pristine: boolean) => void;
  onScoreChange: (subtypeKey: string, newValue: number, oldValue: number) => void;
}

const PersonPaperoSection = ({
  personDraft,
  selectedPerson,
  onUpdatePerson,
  updatePersonDraftState,
  onSetPersonPristine,
  onScoreChange,
}: PersonPaperoSectionProps) => {
  const [helpOpenKey, setHelpOpenKey] = useState<string | null>(null);

  const scores: PaperoScores = personDraft.paperoScores || {};

  const setScore = (subtypeKey: string, value: number) => {
    const scoreFieldKey = PAPERO_SUBTYPE_TO_KEY[subtypeKey];
    if (!scoreFieldKey) return;
    const oldValue = getScore(subtypeKey);
    const updated: PaperoScores = { ...scores, [scoreFieldKey]: value };
    onUpdatePerson(selectedPerson.id, { paperoScores: updated });
    updatePersonDraftState({ paperoScores: updated });
    onSetPersonPristine(true);
    if (value !== oldValue) {
      onScoreChange(subtypeKey, value, oldValue);
    }
  };

  const getScore = (subtypeKey: string): number => {
    const scoreFieldKey = PAPERO_SUBTYPE_TO_KEY[subtypeKey];
    if (!scoreFieldKey) return 0;
    return (scores as Record<string, number | undefined>)[scoreFieldKey] || 0;
  };

  const getCategoryAverage = (category: string): string => {
    const subtypes = EVENT_SUBTYPES.PAPERO?.[category] || [];
    const vals = subtypes.map((st) => getScore(st)).filter((v) => v > 0);
    if (vals.length === 0) return '—';
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  return (
    <div
      role="tabpanel"
      id="person-section-panel-papero"
      aria-labelledby="person-section-tab-papero"
      style={sectionCardStyle}
    >
      <div style={{ fontWeight: 700, color: '#23324a', fontSize: 14 }}>
        Papero Assessment
      </div>
      <div style={{ fontSize: 12, color: '#7a8aaa', marginTop: 2 }}>
        Family Unit Response to Challenge Framework
      </div>

      {PAPERO_CATEGORIES.map((category) => {
        const subtypes = EVENT_SUBTYPES.PAPERO?.[category] || [];
        const avg = getCategoryAverage(category);
        return (
          <div key={category}>
            <div style={categoryHeaderStyle}>
              <div>
                <span style={{ fontSize: 11, color: '#6a7a94' }}>{CATEGORY_LEFT_LABELS[category]}</span>
                <span style={{ fontWeight: 700, color: '#23324a', margin: '0 10px', fontSize: 13 }}>{category}</span>
                <span style={{ fontSize: 11, color: '#6a7a94' }}>{CATEGORY_RIGHT_LABELS[category]}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#4b68a6' }}>Avg: {avg}</span>
            </div>
            {subtypes.map((subtype) => {
              const scale = PAPERO_SCALES[subtype];
              if (!scale) return null;
              const currentValue = getScore(subtype);
              const isHelpOpen = helpOpenKey === subtype;
              return (
                <div key={subtype} style={{ marginTop: 8, paddingLeft: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ flex: 1, fontWeight: 600, fontSize: 13, color: '#23324a' }}>
                      {subtype}
                    </label>
                    <span style={{ fontSize: 12, color: '#7a8aaa', width: 36, textAlign: 'right' }}>Level:</span>
                    <select
                      value={currentValue}
                      onChange={(e) => setScore(subtype, Number(e.target.value))}
                      style={{ width: 50, textAlign: 'center' }}
                    >
                      <option value={0}>—</option>
                      {scale.labels.map((_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`${subtype} help`}
                      onClick={() => setHelpOpenKey(isHelpOpen ? null : subtype)}
                      style={helpBadgeStyle}
                    >
                      ?
                    </button>
                  </div>
                  {currentValue > 0 && (
                    <div style={{ fontSize: 11, color: '#4b68a6', marginTop: 2, paddingLeft: 4 }}>
                      {scale.labels[currentValue - 1]}
                    </div>
                  )}
                  {isHelpOpen && (
                    <div
                      role="dialog"
                      aria-label={`${subtype} Level Scale`}
                      style={{
                        marginTop: 6,
                        border: '1px solid #c6cfde',
                        borderRadius: 10,
                        background: '#fff',
                        padding: '10px 12px',
                        boxShadow: '0 10px 28px rgba(28, 41, 61, 0.16)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                        <strong style={{ fontSize: 13 }}>{subtype} — Level Scale</strong>
                        <button
                          type="button"
                          onClick={() => setHelpOpenKey(null)}
                          style={{ padding: '3px 8px', fontSize: 12 }}
                        >
                          Cancel
                        </button>
                      </div>
                      <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                        {scale.labels.map((label, index) => {
                          const level = index + 1;
                          const isActive = currentValue === level;
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => {
                                setScore(subtype, level);
                                setHelpOpenKey(null);
                              }}
                              style={{
                                textAlign: 'left',
                                border: `1px solid ${isActive ? '#4b68a6' : '#d4dae5'}`,
                                borderRadius: 8,
                                background: isActive ? '#eef3ff' : '#fff',
                                padding: '6px 10px',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ fontWeight: 700, color: '#23324a', fontSize: 13 }}>
                                {level}. {label}
                              </div>
                              <div style={{ marginTop: 2, fontSize: 12, lineHeight: 1.4, color: '#555' }}>
                                {scale.help[index]}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default PersonPaperoSection;
