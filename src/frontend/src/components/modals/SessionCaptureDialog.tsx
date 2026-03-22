import type { SessionCaptureImportData } from '../../types/diagramEditor';

interface SessionCaptureDialogProps {
  open: boolean;
  data: SessionCaptureImportData | null;
  fileName: string;
  selections: Record<string, boolean>;
  onSelectAll: () => void;
  onClearAll: () => void;
  onToggleSelection: (id: string, checked: boolean) => void;
  onApply: () => void;
  onCancel: () => void;
}

const SessionCaptureDialog = ({
  open,
  data,
  fileName,
  selections,
  onSelectAll,
  onClearAll,
  onToggleSelection,
  onApply,
  onCancel,
}: SessionCaptureDialogProps) => {
  if (!open || !data) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2105,
        pointerEvents: 'none',
      }}
    >
      <div style={{ background: 'white', padding: 16, borderRadius: 10, width: 760, maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 24px)', overflow: 'auto', pointerEvents: 'auto' }}>
        <h4 style={{ marginTop: 0 }}>Session Capture Import Review</h4>
        <p style={{ marginTop: 6, color: '#333', fontSize: 13 }}>
          Source: <strong>{fileName || 'Session capture JSON'}</strong>
          <br />
          Review each extracted operation before applying to this family. Low-confidence or ambiguous items default to off.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button onClick={onSelectAll}>Select All</button>
          <button onClick={onClearAll}>Clear All</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.operations.map((operation) => {
            const confidence = operation.confidence ?? 0.5;
            const payloadPreview = JSON.stringify(operation.payload || {}, null, 2);
            return (
              <label
                key={operation.id}
                style={{
                  border: '1px solid #d6dbe8',
                  borderRadius: 8,
                  padding: 10,
                  background: selections[operation.id] ? '#f7fbff' : '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!selections[operation.id]}
                    onChange={(event) => onToggleSelection(operation.id, event.target.checked)}
                  />
                  <strong>{operation.type}</strong>
                  <span style={{ fontSize: 12, color: '#555' }}>
                    confidence {Math.round(confidence * 100)}%
                  </span>
                  {operation.recommendedAction && (
                    <span style={{ fontSize: 12, color: '#37527a' }}>
                      recommended: {operation.recommendedAction}
                    </span>
                  )}
                </div>
                {operation.ambiguity && (
                  <div style={{ color: '#8a4b00', fontSize: 12 }}>
                    Ambiguity: {operation.ambiguity}
                  </div>
                )}
                {operation.source?.quote && (
                  <div style={{ fontSize: 12, color: '#444' }}>
                    Source: "{operation.source.quote}"
                  </div>
                )}
                <pre
                  style={{
                    margin: 0,
                    fontSize: 11,
                    background: '#f6f7fb',
                    border: '1px solid #e2e7f2',
                    borderRadius: 6,
                    padding: 8,
                    maxHeight: 120,
                    overflow: 'auto',
                  }}
                >
                  {payloadPreview}
                </pre>
              </label>
            );
          })}
        </div>
        {(data.ambiguityNotes || []).length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#8a4b00' }}>
            Global ambiguities:
            <ul style={{ margin: '6px 0 0 20px' }}>
              {data.ambiguityNotes!.map((note, index) => (
                <li key={`${note}-${index}`}>{note}</li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={onApply}>Apply Selected</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default SessionCaptureDialog;
