import React, { useState, useEffect, useRef } from 'react';

interface SaveAsDialogProps {
  open: boolean;
  currentFileName: string;
  onSave: (fileName: string) => void;
  onClose: () => void;
}

const SaveAsDialog = ({ open, currentFileName, onSave, onClose }: SaveAsDialogProps) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Strip .json for editing, add it back on save
      const base = currentFileName.replace(/\.json$/i, '');
      setInputValue(base);
      setTimeout(() => inputRef.current?.select(), 30);
    }
  }, [open, currentFileName]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const withExt = trimmed.toLowerCase().endsWith('.json') ? trimmed : `${trimmed}.json`;
    onSave(withExt);
  };

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
        role="dialog"
        aria-labelledby="save-as-dialog-title"
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: '20px 22px',
          width: 'min(400px, 92vw)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 id="save-as-dialog-title" style={{ margin: 0, fontSize: 16, color: '#1f2f45' }}>Save As</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: 13, color: '#45556f', display: 'block', marginBottom: 6 }}>
            File name
          </label>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #c0ccd9', borderRadius: 6, overflow: 'hidden' }}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 10px',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                fontFamily: 'inherit',
                color: '#1f2f45',
              }}
              placeholder="family-diagram"
              autoComplete="off"
            />
            <span style={{ padding: '8px 10px', background: '#f0f4fa', color: '#2979FF', fontSize: 14, fontWeight: 500, borderLeft: '1px solid #c0ccd9' }}>
              .json
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="button" onClick={onClose} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #c0ccd9', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!inputValue.trim()}
              style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#2979FF', color: '#fff', cursor: inputValue.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 500, opacity: inputValue.trim() ? 1 : 0.6 }}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveAsDialog;
