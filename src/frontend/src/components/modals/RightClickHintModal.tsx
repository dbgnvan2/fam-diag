import { useState } from 'react';
import { RIGHT_CLICK_HINT } from '../../data/helpContent';

interface RightClickHintModalProps {
  open: boolean;
  /** Receives the "don't show this again" checkbox state at the moment of closing. */
  onClose: (dontShowAgain: boolean) => void;
}

/**
 * Startup / File-New reminder that every option in the app hangs off a
 * right-click (Control-click on a one-button Mac mouse).
 */
const RightClickHintModal = ({ open, onClose }: RightClickHintModalProps) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  if (!open) return null;
  const handleClose = () => onClose(dontShowAgain);
  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 2450,
          pointerEvents: 'none',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Right click hint"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#fff',
          borderRadius: 12,
          padding: '20px 24px',
          width: 'min(460px, calc(100vw - 24px))',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
          zIndex: 2451,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{RIGHT_CLICK_HINT.title}</h3>
          <button
            onClick={handleClose}
            aria-label="Close right click hint"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '12px 0 18px' }}>
          {RIGHT_CLICK_HINT.paragraphs.map((paragraph) => (
            <p key={paragraph} style={{ margin: 0, lineHeight: 1.5 }}>
              {paragraph}
            </p>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            {RIGHT_CLICK_HINT.dontShowAgainLabel}
          </label>
          <button
            onClick={handleClose}
            style={{
              background: '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 18px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </>
  );
};

export default RightClickHintModal;
