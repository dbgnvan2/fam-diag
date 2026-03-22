import type { CSSProperties } from 'react';

type BackupVersionKey = 'v1' | 'v2' | 'v3';

type BackupVersions = {
  v1?: string | null;
  v2?: string | null;
  v3?: string | null;
};

interface BackupRestoreDialogProps {
  open: boolean;
  versions: BackupVersions | null;
  onClose: () => void;
  onRestoreVersion: (key: BackupVersionKey) => void;
}

const buttonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 14px',
  borderRadius: 6,
  border: '1px solid #c0ccd9',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
};

const BackupRestoreDialog = ({ open, versions, onClose, onRestoreVersion }: BackupRestoreDialogProps) => {
  if (!open || !versions) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Restore backup"
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
          width: 'min(420px, 92vw)',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
          boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Restore Backup</h3>
          <button
            onClick={onClose}
            aria-label="Close restore backup"
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
        <div style={{ marginTop: 10, fontSize: 14, color: '#45556f' }}>
          Restore a previous saved version of this diagram.
        </div>
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          {(['v1', 'v2', 'v3'] as const).map((versionKey) => {
            const value = versions[versionKey];
            return (
              <button
                key={versionKey}
                onClick={() => onRestoreVersion(versionKey)}
                disabled={!value}
                style={{
                  ...buttonStyle,
                  width: '100%',
                  textAlign: 'left',
                  cursor: value ? 'pointer' : 'not-allowed',
                  opacity: value ? 1 : 0.5,
                }}
              >
                {versionKey.toUpperCase()}
                {versionKey === 'v1'
                  ? ' (most recent backup)'
                  : versionKey === 'v2'
                  ? ' (previous backup)'
                  : ' (oldest backup)'}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BackupRestoreDialog;
