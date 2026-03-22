import type { VoiceCommandOperation } from '../../utils/voiceCommands';

interface VoiceInputModalProps {
  open: boolean;
  onClose: () => void;
  commandText: string;
  onCommandTextChange: (text: string) => void;
  operations: VoiceCommandOperation[];
  errors: string[];
  statusMessage: string;
  isListening: boolean;
  isSupported: boolean;
  onReview: () => void;
  onToggleListening: () => void;
  onApply: () => void;
  onClear: () => void;
}

const buttonBase = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 14px',
  borderRadius: 6,
  border: '1px solid #c0ccd9',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
} as const;

const applyButtonStyle = {
  ...buttonBase,
  background: '#1976d2',
  color: '#fff',
  border: '1px solid #1976d2',
} as const;

const VoiceInputModal = ({
  open,
  onClose,
  commandText,
  onCommandTextChange,
  operations,
  errors,
  statusMessage,
  isListening,
  isSupported,
  onReview,
  onToggleListening,
  onApply,
  onClear,
}: VoiceInputModalProps) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-label="Voice input"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(24, 31, 43, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 'min(760px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 24px)',
          overflow: 'auto',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 20px 48px rgba(0,0,0,0.2)',
          padding: 20,
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22 }}>Voice to Diagram</h2>
            <div style={{ marginTop: 6, fontSize: 14, color: '#45556f' }}>
              Supported commands: people, partners, children, birth/death years, adoption, relationship status, and emotional lines.
            </div>
          </div>
          <button onClick={onClose} style={buttonBase}>
            Close
          </button>
        </div>
        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#44516a' }}>
            Example: <code>Add a male named Harry. Harry&apos;s partner is Betty. Harry and Betty are married in 1972. Harry and Betty&apos;s children are Tom, Dick and Jane. Tom is adopted. Harry and Betty have an emotional cutoff.</code>
          </div>
          <textarea
            aria-label="Voice command text"
            value={commandText}
            onChange={(e) => onCommandTextChange(e.target.value)}
            rows={8}
            style={{
              width: '100%',
              resize: 'vertical',
              borderRadius: 8,
              border: '1px solid #c9d2de',
              padding: 12,
              fontFamily: 'inherit',
              fontSize: 14,
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button onClick={onReview} style={buttonBase}>
              Review Commands
            </button>
            <button
              onClick={onToggleListening}
              style={{
                ...buttonBase,
                borderColor: isListening ? '#b3261e' : '#b0b0b0',
                color: isListening ? '#b3261e' : '#222',
              }}
              disabled={!isSupported}
            >
              {isListening ? 'Stop Listening' : 'Start Listening'}
            </button>
            <button onClick={onApply} style={applyButtonStyle}>
              Apply Commands
            </button>
            <button onClick={onClear} style={buttonBase}>
              Clear
            </button>
          </div>
          <div style={{ fontSize: 13, color: '#45556f' }}>
            {isSupported
              ? statusMessage || 'Browser speech recognition is available.'
              : 'Browser speech recognition is unavailable here. Text commands still work.'}
          </div>
          <div
            style={{
              border: '1px solid #d9e0ea',
              borderRadius: 10,
              padding: 14,
              background: '#f7f9fc',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Review</div>
            {operations.length === 0 && errors.length === 0 && (
              <div style={{ fontSize: 14, color: '#56657d' }}>No reviewed commands yet.</div>
            )}
            {operations.length > 0 && (
              <div style={{ display: 'grid', gap: 8 }}>
                {operations.map((operation, index) => (
                  <div
                    key={`${operation.type}-${index}`}
                    style={{
                      background: '#fff',
                      border: '1px solid #d9e0ea',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 14,
                    }}
                  >
                    {operation.type === 'add_person'
                      ? `Add person: ${operation.name}${operation.gender ? ` (${operation.gender})` : ''}`
                      : operation.type === 'add_partnership'
                      ? `Create partnership: ${operation.personName} + ${operation.partnerName}`
                      : operation.type === 'add_children'
                      ? `Add children to ${operation.parent1Name} + ${operation.parent2Name}: ${operation.childNames.join(', ')}`
                      : operation.type === 'set_person_birth_year'
                      ? `Set birth year: ${operation.name} -> ${operation.year}`
                      : operation.type === 'set_person_death_year'
                      ? `Set death year: ${operation.name} -> ${operation.year}`
                      : operation.type === 'set_person_adoption_status'
                      ? `Set adoption: ${operation.name} -> ${operation.adoptionStatus}`
                      : operation.type === 'set_partnership_status'
                      ? `Set relationship: ${operation.person1Name} + ${operation.person2Name} -> ${operation.relationshipStatus}${operation.year ? ` (${operation.year})` : ''}`
                      : `Add emotional line: ${operation.person1Name} + ${operation.person2Name} -> ${operation.relationshipType}`}
                  </div>
                ))}
              </div>
            )}
            {errors.length > 0 && (
              <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                {errors.map((error) => (
                  <div
                    key={error}
                    style={{
                      background: '#fff4f2',
                      border: '1px solid #f0b4aa',
                      color: '#8a1c12',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 14,
                    }}
                  >
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceInputModal;
