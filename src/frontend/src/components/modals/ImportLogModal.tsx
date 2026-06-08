/**
 * Modal that displays the import diagnostic log so the user can read it,
 * copy it to the clipboard, or save it to a file. Avoids the
 * lost-user-gesture problem that prevented auto-download after async work.
 */

import { useEffect, useRef, useState } from 'react';

interface ImportLogModalProps {
  open: boolean;
  filename: string;
  logText: string;
  onClose: () => void;
}

const MODAL_MARGIN = 24;

export default function ImportLogModal({ open, filename, logText, onClose }: ImportLogModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (open) setCopyState('idle');
  }, [open]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(logText);
      } else {
        // Fallback for older browsers — select the textarea + execCommand.
        textareaRef.current?.select();
        document.execCommand('copy');
      }
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  const handleDownload = () => {
    // This handler runs in direct response to a user click, so the
    // download is in user-gesture context and the browser won't block it.
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const buttonSecondary: React.CSSProperties = {
    padding: '8px 14px',
    background: '#fff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  };
  const buttonPrimary: React.CSSProperties = {
    padding: '8px 14px',
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import log"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 12600,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: '#fff',
          borderRadius: 14,
          padding: '20px 24px',
          width: 'min(95vw, 780px)',
          maxHeight: `calc(100vh - ${MODAL_MARGIN * 2}px)`,
          overflowY: 'auto',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>Image Import Log</h2>
          <button
            onClick={onClose}
            aria-label="Close import log"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 24,
              cursor: 'pointer',
              lineHeight: 1,
              color: '#6b7280',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
          Diagnostic log for the most recent image extraction attempt. Copy this and share it for debugging.
        </div>

        <textarea
          ref={textareaRef}
          value={logText}
          readOnly
          aria-label="Import log content"
          style={{
            width: '100%',
            minHeight: 300,
            maxHeight: '50vh',
            padding: 10,
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontFamily: 'monospace',
            fontSize: 12,
            resize: 'vertical',
            boxSizing: 'border-box',
            whiteSpace: 'pre',
            overflow: 'auto',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, gap: 8 }}>
          <div style={{ fontSize: 12, color: copyState === 'copied' ? '#1b5e20' : copyState === 'error' ? '#b71c1c' : '#6b7280' }}>
            {copyState === 'copied' && '✓ Copied to clipboard'}
            {copyState === 'error' && '✗ Copy failed — select and copy manually'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleCopy} style={buttonSecondary}>
              Copy to Clipboard
            </button>
            <button type="button" onClick={handleDownload} style={buttonSecondary}>
              Download .txt
            </button>
            <button type="button" onClick={onClose} style={buttonPrimary}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
