export type FileBackupEntry = {
  slot: number;
  fileName: string;
  lastModified: number;
};

interface FileBackupListDialogProps {
  open: boolean;
  entries: FileBackupEntry[];
  onSelect: (slot: number) => void;
  onClose: () => void;
}

const FileBackupListDialog = ({ open, entries, onSelect, onClose }: FileBackupListDialogProps) => {
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
        zIndex: 2420,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: '18px 20px',
          width: 'min(460px, 92vw)',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#1f2f45' }}>Restore Backup File</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: 13, color: '#45556f', marginBottom: 14 }}>
          Select a backup to restore:
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {entries.map((entry) => {
            const date = new Date(entry.lastModified).toLocaleString();
            const [baseName, ext] = entry.fileName.includes('.')
              ? [entry.fileName.slice(0, entry.fileName.lastIndexOf('.')), entry.fileName.slice(entry.fileName.lastIndexOf('.'))]
              : [entry.fileName, ''];
            return (
              <button
                key={entry.slot}
                onClick={() => onSelect(entry.slot)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #c0ccd9',
                  background: '#fafbfd',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: '#1f2f45', fontFamily: 'inherit' }}>
                  {baseName}
                  <span style={{ fontWeight: 400, color: '#2979FF' }}>{ext}</span>
                </span>
                <span style={{ fontSize: 12, color: '#7b8ba5' }}>{date}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FileBackupListDialog;
