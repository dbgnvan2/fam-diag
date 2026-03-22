import type { CSSProperties } from 'react';
import type { CoachThinkingDraft } from '../../types/diagramEditor';

interface CoachThinkingModalProps {
  draft: CoachThinkingDraft | null;
  onFieldChange: (field: keyof Omit<CoachThinkingDraft, 'personId' | 'personName'>, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

const modalRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-end',
  gap: 12,
  marginTop: 8,
};
const modalLabelStyle: CSSProperties = {
  width: 180,
  textAlign: 'right',
  fontWeight: 600,
  marginTop: 6,
};
const modalControlStyle: CSSProperties = { width: '66%' };

const CoachThinkingModal = ({ draft, onFieldChange, onCancel, onSave }: CoachThinkingModalProps) => {
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
        zIndex: 2072,
        pointerEvents: 'none',
      }}
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
          pointerEvents: 'auto',
        }}
      >
        <h4 style={{ marginTop: 0, marginBottom: 10 }}>
          Coach Thinking · {draft.personName || 'Coach'}
        </h4>
        <div style={modalRowStyle}>
          <label htmlFor="coachThinkingText" style={modalLabelStyle}>Thinking:</label>
          <textarea
            id="coachThinkingText"
            value={draft.thinking}
            onChange={(event) => onFieldChange('thinking', event.target.value)}
            rows={4}
            style={{ ...modalControlStyle, resize: 'vertical' }}
          />
        </div>
        <div style={modalRowStyle}>
          <label htmlFor="coachThinkingNotes" style={modalLabelStyle}>Notes:</label>
          <textarea
            id="coachThinkingNotes"
            value={draft.notes}
            onChange={(event) => onFieldChange('notes', event.target.value)}
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

export default CoachThinkingModal;
