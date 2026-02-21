import React, { useEffect, useMemo, useRef } from 'react';

interface SessionNotesPanelProps {
  isOpen: boolean;
  coachName: string;
  clientName: string;
  noteFileName: string;
  presentingIssue: string;
  noteContent: string;
  startedAt: number | null;
  autosaveInfo: { primary?: string | null; backup?: string | null };
  targetOptions: { value: string; label: string }[];
  selectedTarget: string | null;
  onClose: () => void;
  onFieldChange: (field: 'coach' | 'client' | 'fileName' | 'issue' | 'content', value: string) => void;
  onTargetChange: (value: string) => void;
  onSaveJson: () => void;
  onSaveMarkdown: () => void;
  onMakeEvent: (selectedText: string) => void;
}

const SessionNotesPanel = ({
  isOpen,
  coachName,
  clientName,
  noteFileName,
  presentingIssue,
  noteContent,
  startedAt,
  autosaveInfo,
  targetOptions,
  selectedTarget,
  onClose,
  onFieldChange,
  onTargetChange,
  onSaveJson,
  onSaveMarkdown,
  onMakeEvent,
}: SessionNotesPanelProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastLine = useMemo(() => {
    const trimmed = noteContent.trim();
    const segments = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return segments[segments.length - 1] || '';
  }, [noteContent]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatTimestamp = (value?: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  };

  const captureSelectedText = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start !== end) {
        return textarea.value.slice(start, end).trim();
      }
    }
    return lastLine;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2200,
      }}
    >
      <div
        style={{
          width: 480,
          maxHeight: '90vh',
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 18px 45px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Session Notes</div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {startedAt ? new Date(startedAt).toLocaleString() : 'Not started'}
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize: 20, border: 'none', background: 'none', cursor: 'pointer' }}>
            ×
          </button>
        </div>
        <div style={{ padding: '14px 18px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b4b4b' }}>Coach Name</span>
              <input
                type="text"
                value={coachName}
                onChange={(e) => onFieldChange('coach', e.target.value)}
                style={{ width: '100%' }}
              />
            </label>
            <label style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b4b4b' }}>Client Name</span>
              <input
                type="text"
                value={clientName}
                onChange={(e) => onFieldChange('client', e.target.value)}
                style={{ width: '100%' }}
              />
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <label>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4b4b4b' }}>Note File Name</span>
              <input
                type="text"
                value={noteFileName}
                readOnly
                style={{ width: '100%', background: '#f5f5f5', cursor: 'not-allowed' }}
              />
            </label>
          </div>
          <hr style={{ margin: '14px 0' }} />
          <div>
            <label>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333' }}>
                Presenting Issue · Client Focus
              </span>
              <textarea
                value={presentingIssue}
                onChange={(e) => onFieldChange('issue', e.target.value)}
                rows={3}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </label>
          </div>
          <hr style={{ margin: '14px 0' }} />
          <div>
            <label>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333' }}>Session Notes</span>
              <textarea
                ref={textareaRef}
                value={noteContent}
                onChange={(e) => onFieldChange('content', e.target.value)}
                rows={12}
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </label>
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4b4b4b' }}>
              Event Target
              <select
                value={selectedTarget ?? ''}
                onChange={(e) => onTargetChange(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              >
                {targetOptions.length === 0 && <option value="">No diagram items</option>}
                {targetOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => onMakeEvent(captureSelectedText())}
              disabled={!selectedTarget || !noteContent.trim()}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: 'none',
                background: selectedTarget ? '#1976d2' : '#b0bec5',
                color: 'white',
                fontWeight: 600,
                cursor: selectedTarget ? 'pointer' : 'not-allowed',
              }}
            >
              Make Event from Selection/Last Line
            </button>
            <button
              onClick={onSaveJson}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #9e9e9e',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              Save Session Note
            </button>
            <button
              onClick={onSaveMarkdown}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #9e9e9e',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              Save as Markdown
            </button>
          </div>
          <div style={{ marginTop: 16, fontSize: 12, color: '#555' }}>
            <div>Primary save: {formatTimestamp(autosaveInfo.primary)}</div>
            <div>Backup save: {formatTimestamp(autosaveInfo.backup)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionNotesPanel;
