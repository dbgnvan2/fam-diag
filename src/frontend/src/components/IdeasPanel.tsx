import { useEffect, useRef } from 'react';

interface IdeasPanelProps {
  isOpen: boolean;
  ideasText: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

const IdeasPanel = ({ isOpen, ideasText, onChange, onClose }: IdeasPanelProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2250,
      }}
    >
      <div
        style={{
          width: 420,
          maxHeight: '85vh',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 18px 45px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Idea Log</div>
            <div style={{ fontSize: 12, color: '#666' }}>Capture ideas to revisit later</div>
          </div>
          <button
            onClick={onClose}
            style={{ fontSize: 20, border: 'none', background: 'none', cursor: 'pointer' }}
            aria-label="Close ideas panel"
          >
            ×
          </button>
        </div>
        <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <p style={{ fontSize: 13, color: '#444', marginTop: 0 }}>
            Keep running ideas, future enhancements, or coaching prompts here. They stay with your diagram and can be refined anytime.
          </p>
          <textarea
            ref={textareaRef}
            value={ideasText}
            onChange={(e) => onChange(e.target.value)}
            rows={14}
            style={{
              flex: 1,
              width: '100%',
              resize: 'vertical',
              borderRadius: 8,
              border: '1px solid #c7c7c7',
              padding: 10,
              fontFamily: 'inherit',
            }}
            placeholder="Add one idea per line or paragraph..."
          />
          <div style={{ marginTop: 12, textAlign: 'right', fontSize: 12, color: '#777' }}>
            Ideas are saved automatically
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdeasPanel;
