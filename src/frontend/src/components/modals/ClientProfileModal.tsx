import type { CSSProperties } from 'react';
import type { ClientProfileDraft } from '../../types/diagramEditor';

interface ClientProfileModalProps {
  draft: ClientProfileDraft | null;
  onFieldChange: (field: keyof Omit<ClientProfileDraft, 'personId' | 'personName'>, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

const modalRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 12,
  marginTop: 8,
};
const modalLabelStyle: CSSProperties = {
  width: 230,
  textAlign: 'right',
  fontWeight: 600,
};
const modalControlStyle: CSSProperties = { width: '58%' };

const ClientProfileModal = ({ draft, onFieldChange, onCancel, onSave }: ClientProfileModalProps) => {
  if (!draft) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2070,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 10,
          padding: 16,
          width: 620,
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <h4 style={{ marginTop: 0, marginBottom: 10 }}>
          Client Properties · {draft.personName || 'Person'}
        </h4>
        <div style={modalRowStyle}>
          <label htmlFor="clientColor" style={modalLabelStyle}>Client Color:</label>
          <div style={{ ...modalControlStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              id="clientColor"
              type="color"
              value={draft.clientColor}
              onChange={(event) => onFieldChange('clientColor', event.target.value)}
              style={{ width: 64 }}
            />
          </div>
        </div>
        <div style={modalRowStyle}>
          <label htmlFor="clientIssue1" style={modalLabelStyle}>Presenting Issue 1:</label>
          <input
            id="clientIssue1"
            type="text"
            value={draft.presentingIssue1}
            onChange={(event) => onFieldChange('presentingIssue1', event.target.value)}
            style={modalControlStyle}
          />
        </div>
        <div style={modalRowStyle}>
          <label htmlFor="clientIssue2" style={modalLabelStyle}>Presenting Issue 2:</label>
          <input
            id="clientIssue2"
            type="text"
            value={draft.presentingIssue2}
            onChange={(event) => onFieldChange('presentingIssue2', event.target.value)}
            style={modalControlStyle}
          />
        </div>
        <div style={modalRowStyle}>
          <label htmlFor="clientIssue3" style={modalLabelStyle}>Presenting Issue 3:</label>
          <input
            id="clientIssue3"
            type="text"
            value={draft.presentingIssue3}
            onChange={(event) => onFieldChange('presentingIssue3', event.target.value)}
            style={modalControlStyle}
          />
        </div>
        <div style={modalRowStyle}>
          <label htmlFor="clientOutcome1" style={modalLabelStyle}>Desired Outcome 1:</label>
          <input
            id="clientOutcome1"
            type="text"
            value={draft.desiredOutcome1}
            onChange={(event) => onFieldChange('desiredOutcome1', event.target.value)}
            style={modalControlStyle}
          />
        </div>
        <div style={modalRowStyle}>
          <label htmlFor="clientOutcome2" style={modalLabelStyle}>Desired Outcome 2:</label>
          <input
            id="clientOutcome2"
            type="text"
            value={draft.desiredOutcome2}
            onChange={(event) => onFieldChange('desiredOutcome2', event.target.value)}
            style={modalControlStyle}
          />
        </div>
        <div style={modalRowStyle}>
          <label htmlFor="clientOutcome3" style={modalLabelStyle}>Desired Outcome 3:</label>
          <input
            id="clientOutcome3"
            type="text"
            value={draft.desiredOutcome3}
            onChange={(event) => onFieldChange('desiredOutcome3', event.target.value)}
            style={modalControlStyle}
          />
        </div>
        <div style={{ ...modalRowStyle, alignItems: 'flex-start' }}>
          <label htmlFor="clientConceptualization" style={{ ...modalLabelStyle, marginTop: 6 }}>
            Client&apos;s Conceptualization of the Situation:
          </label>
          <textarea
            id="clientConceptualization"
            value={draft.conceptualization}
            onChange={(event) => onFieldChange('conceptualization', event.target.value)}
            rows={5}
            style={{ ...modalControlStyle, resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={onCancel}>Cancel</button>
          <button onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default ClientProfileModal;
