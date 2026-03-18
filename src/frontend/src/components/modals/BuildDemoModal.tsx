import type { BuildDemoStep } from '../../types/diagramEditor';

interface BuildDemoModalProps {
  open: boolean;
  steps: BuildDemoStep[];
  stepIndex: number;
  onClose: () => void;
  onStepChange: (nextIndex: number) => void;
}

const BuildDemoModal = ({ open, steps, stepIndex, onClose, onStepChange }: BuildDemoModalProps) => {
  if (!open) return null;
  const currentStep = steps[stepIndex] || steps[0];
  if (!currentStep) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Build demo walkthrough"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 2485,
        width: 'min(460px, calc(100vw - 40px))',
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
            Build Step {stepIndex + 1} of {steps.length}
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
            aria-label="Close build demo walkthrough"
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: 19, fontWeight: 700, color: '#1f2d3d' }}>
          {currentStep.title}
        </div>
        <div style={{ fontSize: 14, color: '#2a3950', lineHeight: 1.45 }}>
          {currentStep.instruction}
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#335177',
            background: '#eef5ff',
            border: '1px solid #c6dbff',
            borderRadius: 8,
            padding: '8px 10px',
          }}
        >
          Each step loads the expected result state. Use this to learn what action created it.
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <button
            onClick={() => onStepChange(stepIndex - 1)}
            disabled={stepIndex === 0}
          >
            Previous
          </button>
          {stepIndex < steps.length - 1 ? (
            <button onClick={() => onStepChange(stepIndex + 1)}>
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

export default BuildDemoModal;
