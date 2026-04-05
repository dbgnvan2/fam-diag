/**
 * PersonSiblingSection — Toman sibling position: override controls, derived position display,
 * and compatibility (conflict) analysis.
 * Rendered inside PropertiesPanel (full panel) or a PopupShell (canvas popup).
 */
import React, { useState } from 'react';
import type { Person, Partnership } from '../../types';
import {
  deriveSiblingPositionResult,
  getSiblingPositionLabel,
  getPositionOptionsForSex,
  parentMatchForRole,
  partnerForPerson,
} from '../../utils/siblingPosition';
import { MATURITY_SCALE } from '../../constants/eventConstants';

const SIBLING_OVERRIDE_HELP = [
  'Siblings Complete: turn this on only when every relevant sibling is shown on the diagram. Leave it off when you know siblings are missing, because the derived position should stay provisional.',
  'Birth Order Override: use this when birth dates are missing or twins need to be distinguished. It gives the ranking engine an explicit place in the sibling order.',
  'Override Position: use this only when the computed Toman code is not the one you want to use. A manual override becomes the effective position and drives the conflict results.',
  'Maturity Level: rates how fully this person functions from their sibling position (1 = Role-Reactive, 5 = Highly Differentiated). Use the ? button on the Maturity Level field for detailed level descriptions.',
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
const sectionNavButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 10px',
  borderRadius: 6,
  border: `1px solid ${active ? '#4b68a6' : '#c6cfde'}`,
  background: active ? '#e7eefb' : '#fff',
  fontWeight: 600,
  cursor: 'pointer',
});
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

type SiblingSubtab = 'override' | 'position' | 'compatibility';

interface PersonSiblingSectionProps {
  personDraft: Person;
  people: Person[];
  partnerships: Partnership[];
  siblingPositionResult: ReturnType<typeof deriveSiblingPositionResult> | null;
  siblingPositionOptions: Array<{ value: string; label: string }>;
  onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
  onUpdateOtherPersonPosition: (personId: string, position: string | undefined) => void;
  compactMode: boolean;
  activeSiblingSubtab: SiblingSubtab;
  onSiblingSubtabChange: (tab: SiblingSubtab) => void;
  siblingHelpOpen: boolean;
  onSiblingHelpOpenChange: (open: boolean) => void;
}

const PersonSiblingSection = ({
  personDraft,
  people,
  partnerships,
  siblingPositionResult,
  siblingPositionOptions,
  onChange,
  onUpdateOtherPersonPosition,
  compactMode,
  activeSiblingSubtab,
  onSiblingSubtabChange,
  siblingHelpOpen,
  onSiblingHelpOpenChange,
}: PersonSiblingSectionProps) => {
  const [expandedConflict, setExpandedConflict] = useState<'father' | 'mother' | 'partner' | null>(null);
  const [maturityHelpOpen, setMaturityHelpOpen] = useState(false);
  const renderOverrideControls = () => (
    <>
      <div style={rowStyle}>
        <label htmlFor="siblingsComplete" style={labelStyle}>Siblings Complete:</label>
        <input
          type="checkbox"
          id="siblingsComplete"
          name="siblingsComplete"
          checked={personDraft.siblingsComplete ?? false}
          onChange={onChange}
        />
      </div>
      <div style={rowStyle}>
        <label htmlFor="birthOrderOverride" style={labelStyle}>Birth Order Override:</label>
        <input
          type="number"
          id="birthOrderOverride"
          name="birthOrderOverride"
          min={1}
          value={personDraft.birthOrderOverride ?? ''}
          onChange={onChange}
          style={{ width: 120 }}
        />
      </div>
      <div style={rowStyle}>
        <label htmlFor="siblingPositionOverride" style={labelStyle}>Override Position:</label>
        <select
          id="siblingPositionOverride"
          name="siblingPositionOverride"
          value={personDraft.siblingPositionOverride ?? ''}
          onChange={onChange}
          style={{ width: '100%', maxWidth: 320 }}
        >
          <option value="">Use computed position</option>
          {siblingPositionOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div style={rowStyle}>
        <label htmlFor="siblingMaturityLevel" style={labelStyle}>Maturity Level:</label>
        <select
          id="siblingMaturityLevel"
          name="siblingMaturityLevel"
          value={personDraft.siblingMaturityLevel ?? ''}
          onChange={onChange}
          style={{ width: 60 }}
        >
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        {personDraft.siblingMaturityLevel && (
          <span style={{ fontSize: 11, color: '#4b68a6', flex: 1 }}>
            {MATURITY_SCALE.labels[(personDraft.siblingMaturityLevel as number) - 1]}
          </span>
        )}
        <button
          type="button"
          aria-label="Maturity level help"
          onClick={() => setMaturityHelpOpen(!maturityHelpOpen)}
          style={helpBadgeStyle}
        >
          ?
        </button>
      </div>
      {maturityHelpOpen && (
        <div
          role="dialog"
          aria-label="Maturity Level Scale"
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
            <strong style={{ fontSize: 13 }}>Maturity Level — Scale</strong>
            <button
              type="button"
              onClick={() => setMaturityHelpOpen(false)}
              style={{ padding: '3px 8px', fontSize: 12 }}
            >
              Cancel
            </button>
          </div>
          <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
            {MATURITY_SCALE.labels.map((label, index) => {
              const level = index + 1;
              const isActive = (personDraft.siblingMaturityLevel as number | undefined) === level;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    const syntheticEvent = {
                      target: { name: 'siblingMaturityLevel', value: String(level), type: 'select-one' },
                    } as React.ChangeEvent<HTMLSelectElement>;
                    onChange(syntheticEvent);
                    setMaturityHelpOpen(false);
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
                    {MATURITY_SCALE.help[index]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button
          type="button"
          aria-label="Sibling override help"
          onClick={() => onSiblingHelpOpenChange(!siblingHelpOpen)}
          style={helpBadgeStyle}
        >
          ?
        </button>
      </div>
      {siblingHelpOpen && (
        <div
          role="dialog"
          aria-label="Sibling override help"
          style={{
            marginTop: 8,
            border: '1px solid #b7c6df',
            borderRadius: 8,
            background: '#f8fbff',
            padding: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <strong>Sibling Override Help</strong>
            <button
              type="button"
              onClick={() => onSiblingHelpOpenChange(false)}
              aria-label="Close sibling override help"
              style={{ border: '1px solid #bdbdbd', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
          <div style={{ marginTop: 8, display: 'grid', gap: 8, fontSize: 13, lineHeight: 1.4 }}>
            <div><strong>Siblings Complete:</strong> {SIBLING_OVERRIDE_HELP[0]}</div>
            <div><strong>Birth Order Override:</strong> {SIBLING_OVERRIDE_HELP[1]}</div>
            <div><strong>Override Position:</strong> {SIBLING_OVERRIDE_HELP[2]}</div>
            <div><strong>Maturity Level:</strong> {SIBLING_OVERRIDE_HELP[3]}</div>
          </div>
        </div>
      )}
    </>
  );

  const fatherPerson = parentMatchForRole(personDraft, people, partnerships, 'father');
  const motherPerson = parentMatchForRole(personDraft, people, partnerships, 'mother');
  const partnerPerson = partnerForPerson(personDraft, people, partnerships);

  const overrideFieldFor = (role: 'father' | 'mother' | 'partner') =>
    role === 'father'
      ? 'fatherPositionOverride'
      : role === 'mother'
      ? 'motherPositionOverride'
      : 'partnerPositionOverride';

  const renderConflictBlock = (
    title: string,
    conflict: ReturnType<typeof deriveSiblingPositionResult>['conflict_with_father'],
    role: 'father' | 'mother' | 'partner'
  ) => {
    const diagramPerson = role === 'father' ? fatherPerson : role === 'mother' ? motherPerson : partnerPerson;
    const otherPerson = conflict
      ? (people.find((p) => p.id === conflict.other_person_id) ?? diagramPerson)
      : diagramPerson;
    const isOffDiagram = !otherPerson;
    const overrideField = overrideFieldFor(role);
    const currentOverrideValue = personDraft[overrideField as keyof typeof personDraft] as string | undefined;
    const canExpand = !!otherPerson || true; // always allow — off-diagram uses current person's fields
    const roleSex = role === 'father' ? 'b' : role === 'mother' ? 's' : null;
    const rolePositionOptions = getPositionOptionsForSex(roleSex);
    const isExpanded = expandedConflict === role;

    return (
      <div
        style={{
          border: '1px solid #d7deea',
          borderRadius: 8,
          padding: '10px 12px',
          background: '#fff',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() => canExpand && setExpandedConflict(isExpanded ? null : role)}
        >
          <div style={{ fontWeight: 700, color: '#23324a' }}>{title}</div>
          <span style={{ fontSize: 12, color: '#4b68a6', userSelect: 'none' }}>
            {isExpanded ? '▲ Close' : '▼ Set Position'}
          </span>
        </div>
        {!conflict ? (
          <div style={{ marginTop: 4, color: '#5e6d84' }}>
            {isOffDiagram ? 'Not on diagram — set position below' : 'Insufficient position data'}
          </div>
        ) : (
          <div style={{ marginTop: 6, display: 'grid', gap: 4, fontSize: 13 }}>
            <div><strong>Other Position:</strong> {conflict.other_effective_position}</div>
            <div><strong>Category:</strong> {conflict.category}</div>
            <div><strong>Rank Conflict:</strong> {conflict.rank_conflict ? 'Yes' : 'No'}</div>
            <div>
              <strong>Sex Conflict:</strong>{' '}
              {conflict.sex_conflict_uncertain
                ? 'Uncertain'
                : conflict.sex_conflict === null
                ? 'N/A'
                : conflict.sex_conflict
                ? 'Yes'
                : 'No'}
            </div>
            {conflict.confidence_note && (
              <div style={{ color: '#6a4b10' }}>
                <strong>Note:</strong> {conflict.confidence_note}
              </div>
            )}
          </div>
        )}
        {isExpanded && (
          <div
            style={{
              marginTop: 8,
              padding: '8px 10px',
              background: '#f3f6fb',
              borderRadius: 6,
              border: '1px solid #b8c2d3',
            }}
          >
            {otherPerson && !isOffDiagram ? (
              <>
                <label
                  htmlFor={`other-pos-${role}`}
                  style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}
                >
                  {otherPerson.name || 'Other person'} — Override Position:
                </label>
                <select
                  id={`other-pos-${role}`}
                  value={otherPerson.siblingPositionOverride ?? ''}
                  onChange={(e) =>
                    onUpdateOtherPersonPosition(otherPerson.id, e.target.value.trim() || undefined)
                  }
                  style={{ width: '100%' }}
                >
                  <option value="">Use computed position</option>
                  {rolePositionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label
                  htmlFor={`manual-pos-${role}`}
                  style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}
                >
                  {role === 'father' ? 'Father' : role === 'mother' ? 'Mother' : 'Partner'} Position (manual):
                </label>
                <select
                  id={`manual-pos-${role}`}
                  name={overrideField}
                  value={currentOverrideValue ?? ''}
                  onChange={onChange}
                  style={{ width: '100%' }}
                >
                  <option value="">— not set —</option>
                  {rolePositionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // Compact mode (popup) shows only the override controls
  if (compactMode) {
    return (
      <div
        role="tabpanel"
        id="person-section-panel-sibling"
        aria-labelledby="person-section-tab-sibling"
        style={sectionCardStyle}
      >
        <div style={{ fontWeight: 700, color: '#23324a' }}>Sibling Override</div>
        {renderOverrideControls()}
      </div>
    );
  }

  return (
    <div
      role="tabpanel"
      id="person-section-panel-sibling"
      aria-labelledby="person-section-tab-sibling"
      style={sectionCardStyle}
    >
      <div style={{ fontWeight: 700, color: '#23324a' }}>Sibling Position</div>
      {/* Subtab nav */}
      <div
        role="tablist"
        aria-label="Sibling property sections"
        style={{
          display: 'inline-flex',
          gap: 0,
          marginTop: 10,
          border: '1px solid #c6cfde',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        {(['override', 'position', 'compatibility'] as const).map((section) => (
          <button
            key={section}
            type="button"
            role="tab"
            aria-selected={activeSiblingSubtab === section}
            onClick={() => onSiblingSubtabChange(section)}
            style={{
              ...sectionNavButtonStyle(activeSiblingSubtab === section),
              borderRadius: 0,
              border: 'none',
              borderLeft: section === 'override' ? 'none' : '1px solid #c6cfde',
              minWidth: 110,
            }}
          >
            {section === 'override' ? 'Override' : section === 'position' ? 'Position' : 'Compatibility'}
          </button>
        ))}
      </div>

      {activeSiblingSubtab === 'override' ? (
        <div style={{ marginTop: 12 }}>{renderOverrideControls()}</div>
      ) : activeSiblingSubtab === 'position' ? (
        <div
          style={{
            marginTop: 12,
            border: '1px solid #d7deea',
            borderRadius: 8,
            padding: '10px 12px',
            background: '#fff',
            display: 'grid',
            gap: 4,
            fontSize: 13,
          }}
        >
          <div>
            <strong>Derived:</strong>{' '}
            {siblingPositionResult?.derived_position
              ? `${siblingPositionResult.derived_position} — ${getSiblingPositionLabel(siblingPositionResult.derived_position)}`
              : 'Not available'}
          </div>
          <div>
            <strong>Effective:</strong>{' '}
            {siblingPositionResult?.effective_position
              ? `${siblingPositionResult.effective_position} — ${getSiblingPositionLabel(siblingPositionResult.effective_position)}`
              : 'Not available'}
          </div>
          <div><strong>Confidence:</strong> {siblingPositionResult?.confidence || 'INDETERMINATE'}</div>
          <div><strong>Rank:</strong> {siblingPositionResult?.rank || 'Not available'}</div>
          <div><strong>Composition:</strong> {siblingPositionResult?.composition || 'Not available'}</div>
          <div>
            <strong>Half-Sibling Only:</strong>{' '}
            {siblingPositionResult?.half_sibling_only ? 'Yes' : 'No'}
          </div>
          {siblingPositionResult?.note && (
            <div style={{ color: '#6a4b10' }}>
              <strong>Note:</strong> {siblingPositionResult.note}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {renderConflictBlock('Person vs Father', siblingPositionResult?.conflict_with_father || null, 'father')}
          {renderConflictBlock('Person vs Mother', siblingPositionResult?.conflict_with_mother || null, 'mother')}
          {renderConflictBlock('Person vs Partner', siblingPositionResult?.conflict_with_partner || null, 'partner')}
        </div>
      )}
    </div>
  );
};

export default PersonSiblingSection;
