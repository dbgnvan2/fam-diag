interface RibbonHelpModalProps {
  open: boolean;
  title: string;
  body: string;
  onClose: () => void;
}

const RibbonHelpModal = ({ open, title, body, onClose }: RibbonHelpModalProps) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ribbon help"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2420,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: '18px 20px',
          width: 'min(460px, 92vw)',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close ribbon help"
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
        <textarea
          value={body}
          readOnly
          style={{
            marginTop: 10,
            width: '100%',
            minHeight: 120,
            borderRadius: 8,
            border: '1px solid #c8d3e4',
            padding: 10,
            resize: 'vertical',
            fontFamily: 'inherit',
            fontSize: 14,
            lineHeight: 1.4,
          }}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: '#596b86' }}>
          To edit this text, update <code>src/frontend/src/data/helpContent.ts</code>.
        </div>
      </div>
    </div>
  );
};

export default RibbonHelpModal;
