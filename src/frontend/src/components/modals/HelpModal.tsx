import { HELP_SECTIONS } from '../../data/helpContent';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  onStartDemoTour: () => void;
  onStartBuildDemo: () => void;
  onOpenReadmeViewer: () => void;
  onOpenTrainingVideos: () => void;
}

const HelpModal = ({
  open,
  onClose,
  onStartDemoTour,
  onStartBuildDemo,
  onOpenReadmeViewer,
  onOpenTrainingVideos,
}: HelpModalProps) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick start help"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2400,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '24px 28px',
          width: 'min(50vw, 520px)',
          maxHeight: '70vh',
          overflowY: 'auto',
          boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                textTransform: 'uppercase',
                color: '#616161',
                letterSpacing: 1,
              }}
            >
              Quick Start
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: 22 }}>Family Diagram Maker</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={onStartDemoTour}
              style={{
                border: '1px solid #1976d2',
                color: '#1976d2',
                background: '#fff',
                borderRadius: 6,
                padding: '6px 12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Demo
            </button>
            <button
              onClick={onStartBuildDemo}
              style={{
                border: '1px solid #1976d2',
                color: '#1976d2',
                background: '#fff',
                borderRadius: 6,
                padding: '6px 12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Build Demo
            </button>
            <button
              onClick={onClose}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: 24,
                cursor: 'pointer',
                lineHeight: 1,
              }}
              aria-label="Close help"
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
          {HELP_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>{section.title}</h3>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.5 }}>
                {section.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={onOpenReadmeViewer}
              style={{
                border: '1px solid #1976d2',
                color: '#1976d2',
                background: '#fff',
                borderRadius: 6,
                padding: '8px 14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Open README Viewer
            </button>
            <button
              onClick={onOpenTrainingVideos}
              style={{
                border: '1px solid #1976d2',
                color: '#1976d2',
                background: '#fff',
                borderRadius: 6,
                padding: '8px 14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Open Training Videos
            </button>
          </div>
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
