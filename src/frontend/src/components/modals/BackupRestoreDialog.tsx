import type { CSSProperties } from 'react';
import type { BackupVersions } from '../../utils/storage';

interface BackupRestoreDialogProps {
  open: boolean;
  versions: BackupVersions | null;
  onClose: () => void;
  onRestoreVersion: (key: string) => void;
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

const versionLabel = (key: string, index: number, total: number): string => {
  if (index === 0) return `${key.toUpperCase()} (most recent backup)`;
  if (index === total - 1) return `${key.toUpperCase()} (oldest backup)`;
  return `${key.toUpperCase()} (previous backup)`;
};

const BackupRestoreDialog = ({ open, versions, onClose, onRestoreVersion }: BackupRestoreDialogProps) => {
  if (!open || !versions) return null;

  // Collect all vN keys, sorted numerically
  const versionKeys = Object.keys(versions)
    .filter((k) => /^v\d+$/.test(k))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

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
          {versionKeys.map((versionKey, idx) => {
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
                {versionLabel(versionKey, idx, versionKeys.length)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BackupRestoreDialog;
