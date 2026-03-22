/**
 * PersonNameSection — person name, maiden name, and notes fields.
 * Rendered inside PropertiesPanel (full panel) or a PopupShell (canvas popup).
 */
import React, { useState } from 'react';
import type { Person } from '../../types';

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

interface PersonNameSectionProps {
  personDraft: Person;
  nameFallbackParts: { first: string; last: string };
  onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
}

const PersonNameSection = ({ personDraft, nameFallbackParts, onChange }: PersonNameSectionProps) => {
  const isAIAgent = personDraft.birthSex === 'ai-agent' || personDraft.gender === 'ai-agent';
  const [agentNameHelpOpen, setAgentNameHelpOpen] = useState(false);

  return (
    <div
      role="tabpanel"
      id="person-section-panel-name"
      aria-labelledby="person-section-tab-name"
      style={sectionCardStyle}
    >
      <div style={{ fontWeight: 700, color: '#23324a' }}>{isAIAgent ? 'AI Agent' : 'Name'}</div>
      {isAIAgent && (
        <div style={rowStyle}>
          <label htmlFor="firstName" style={labelStyle}>Agent Name:</label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={personDraft.firstName ?? nameFallbackParts.first}
            onChange={onChange}
            style={{ width: '25ch', textAlign: 'left' }}
          />
          <button
            type="button"
            aria-label="Agent Name help"
            onClick={() => setAgentNameHelpOpen(!agentNameHelpOpen)}
            style={helpBadgeStyle}
          >
            ?
          </button>
        </div>
      )}
      {isAIAgent && agentNameHelpOpen && (
        <div
          role="dialog"
          aria-label="Agent Name help"
          style={{
            marginTop: 6,
            marginLeft: 150,
            border: '1px solid #c6cfde',
            borderRadius: 8,
            background: '#fff',
            padding: '8px 12px',
            boxShadow: '0 6px 20px rgba(28, 41, 61, 0.12)',
            fontSize: 13,
            lineHeight: 1.5,
            color: '#23324a',
          }}
        >
          Enter the name of the agent being used. e.g. Claude, MyHelpBot, etc.
          <div style={{ marginTop: 6, textAlign: 'right' }}>
            <button type="button" onClick={() => setAgentNameHelpOpen(false)} style={{ padding: '2px 8px', fontSize: 12 }}>
              Close
            </button>
          </div>
        </div>
      )}
      {!isAIAgent && (
        <div style={rowStyle}>
          <label htmlFor="firstName" style={labelStyle}>First Name:</label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={personDraft.firstName ?? nameFallbackParts.first}
            onChange={onChange}
            style={{ width: '25ch', textAlign: 'left' }}
          />
        </div>
      )}
      <div style={rowStyle}>
        <label htmlFor="lastName" style={labelStyle}>Last Name:</label>
        <input
          type="text"
          id="lastName"
          name="lastName"
          value={personDraft.lastName ?? nameFallbackParts.last}
          onChange={onChange}
          style={{ width: '25ch', textAlign: 'left' }}
        />
      </div>
      {!isAIAgent && (
        <div style={rowStyle}>
          <label htmlFor="maidenName" style={labelStyle}>Maiden Name:</label>
          <input
            type="text"
            id="maidenName"
            name="maidenName"
            value={personDraft.maidenName ?? ''}
            onChange={onChange}
            style={{ width: '25ch', textAlign: 'left' }}
          />
        </div>
      )}
      <div style={{ ...rowStyle, alignItems: 'flex-start' }}>
        <label htmlFor="notes" style={{ ...labelStyle, marginTop: 6 }}>Notes:</label>
        <textarea
          id="notes"
          name="notes"
          value={personDraft.notes || ''}
          onChange={onChange}
          rows={6}
          style={{ width: '100%', minHeight: '8rem', fontFamily: 'inherit', fontSize: '0.95rem' }}
        />
      </div>
      <div style={rowStyle}>
        <label htmlFor="notesEnabled" style={labelStyle}>Notes Enabled:</label>
        <input
          type="checkbox"
          id="notesEnabled"
          name="notesEnabled"
          checked={personDraft.notesEnabled ?? false}
          onChange={onChange}
        />
      </div>
    </div>
  );
};

export default PersonNameSection;
