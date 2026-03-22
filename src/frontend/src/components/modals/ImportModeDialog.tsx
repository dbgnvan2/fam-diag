interface ImportModeDialogProps {
  open: boolean;
  source: string;
  fileName: string;
  onReplace: () => void;
  onMerge: () => void;
  onCancel: () => void;
}

const ImportModeDialog = ({ open, source, fileName, onReplace, onMerge, onCancel }: ImportModeDialogProps) => {
  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
        pointerEvents: 'none',
      }}
    >
      <div style={{ background: 'white', padding: 18, borderRadius: 10, width: 460, maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', pointerEvents: 'auto' }}>
        <h4 style={{ marginTop: 0 }}>
          {source === 'transcript' ? 'Transcript Processed' : 'Import Data'}
        </h4>
        <p style={{ marginTop: 8, marginBottom: 14, color: '#333' }}>
          Source: <strong>{fileName || 'Imported data'}</strong>
          <br />
          Choose whether to replace the current family or merge this data into it.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onReplace}>Create New Family</button>
          <button onClick={onMerge}>Add To Existing Family</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default ImportModeDialog;
