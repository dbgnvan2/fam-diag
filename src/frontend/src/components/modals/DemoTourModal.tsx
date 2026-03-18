import type { DemoTourStep } from '../../types/diagramEditor';

interface DemoTourModalProps {
  open: boolean;
  steps: DemoTourStep[];
  stepIndex: number;
  onClose: () => void;
  onStepChange: (updater: (idx: number) => number) => void;
}

const DemoTourModal = ({ open, steps, stepIndex, onClose, onStepChange }: DemoTourModalProps) => {
  if (!open) return null;
  const currentStep = steps[stepIndex] || steps[0];
  if (!currentStep) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Interactive demo"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 2480,
        width: 'min(420px, calc(100vw - 40px))',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #c8d3e4',
          borderRadius: 12,
          boxShadow: '0 16px 40px rgba(0,0,0,0.24)',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#4a5b73', fontWeight: 600 }}>
            Demo Step {stepIndex + 1} of {steps.length}
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 20,
              lineHeight: 1,
              cursor: 'pointer',
            }}
            aria-label="Close interactive demo"
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, color: '#1f2d3d' }}>
          {currentStep.title}
        </div>
        <div style={{ fontSize: 14, color: '#2a3950', lineHeight: 1.45 }}>
          {currentStep.body}
        </div>
        {currentStep.clickToSelectHint && (
          <div
            style={{
              fontSize: 13,
              color: '#1f4f8f',
              background: '#eef5ff',
              border: '1px solid #c6dbff',
              borderRadius: 8,
              padding: '8px 10px',
            }}
          >
            <strong>Click to Select:</strong> {currentStep.clickToSelectHint}
          </div>
        )}
        {currentStep.rightClickOptions && currentStep.rightClickOptions.length > 0 && (
          <div
            style={{
              border: '1px solid #d8dfe8',
              borderRadius: 8,
              padding: '8px 10px',
              background: '#fafcff',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#33475b', marginBottom: 4 }}>
              Right-click options shown
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#3c4f63', lineHeight: 1.4 }}>
              {currentStep.rightClickOptions.map((option) => (
                <li key={option}>{option}</li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <button
            onClick={() => onStepChange((idx) => Math.max(0, idx - 1))}
            disabled={stepIndex === 0}
          >
            Previous
          </button>
          {stepIndex < steps.length - 1 ? (
            <button onClick={() => onStepChange((idx) => Math.min(steps.length - 1, idx + 1))}>
              Next
            </button>
          ) : (
            <button onClick={onClose}>Finish</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DemoTourModal;
