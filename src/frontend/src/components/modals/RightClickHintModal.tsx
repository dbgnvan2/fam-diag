import { RIGHT_CLICK_HINT } from '../../data/helpContent';
import { HINT_Z_INDEX } from '../../constants/zIndex';

// Non-blocking hint: it sits below every menu and dialog (see constants/zIndex)
// and paints no dimming backdrop, so it can never cover what it tells the user
// to open.

interface RightClickHintModalProps {
  open: boolean;
  dontShowAgain: boolean;
  onDontShowAgainChange: (dontShowAgain: boolean) => void;
  /**
   * Closes the hint, honouring the current dontShowAgain value. The state lives
   * in the parent so a close triggered from outside the dialog (a right-click
   * on the canvas) still respects a ticked checkbox.
   */
  onClose: () => void;
}

/**
 * Startup / File-New reminder that every option in the app hangs off a
 * right-click (Control-click on a one-button Mac mouse). Non-modal: the rest of
 * the app stays usable while it is up, so it carries no aria-modal and no
 * focus trap.
 */
const RightClickHintModal = ({
  open,
  dontShowAgain,
  onDontShowAgainChange,
  onClose,
}: RightClickHintModalProps) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
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
        border: '1px solid #d0d0d0',
        zIndex: HINT_Z_INDEX,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>{RIGHT_CLICK_HINT.title}</h3>
        <button
          onClick={onClose}
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
            onChange={(e) => onDontShowAgainChange(e.target.checked)}
          />
          {RIGHT_CLICK_HINT.dontShowAgainLabel}
        </label>
        <button
          onClick={onClose}
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
  );
};

export default RightClickHintModal;
