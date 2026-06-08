/**
 * Modal for uploading a diagram image and analyzing it with Claude Vision.
 */

import React, { useState, useRef } from 'react';

export type ImageImportHints = {
  /** Number of generations the user expects (0 = unknown). */
  generationCount: number;
  /** Approximate number of people (0 = unknown). */
  expectedPersonCount: number;
  /** Whether the diagram was hand-drawn (vs printed/digital). */
  handDrawn: boolean;
  /** Whether there are descriptive notes/text alongside symbols. */
  hasNotes: boolean;
};

interface ImageDiagramModalProps {
  open: boolean;
  onClose: () => void;
  onAnalyze: (imageBlob: Blob, hints: ImageImportHints) => Promise<void>;
  isLoading?: boolean;
  /** Live progress message rendered while isLoading is true. */
  progressMessage?: string;
  /** Called when user clicks Cancel during analysis (to abort the API call). */
  onCancel?: () => void;
}

export default function ImageDiagramModal({
  open,
  onClose,
  onAnalyze,
  isLoading = false,
  progressMessage = '',
  onCancel,
}: ImageDiagramModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [generationCount, setGenerationCount] = useState<number>(0);
  const [expectedPersonCount, setExpectedPersonCount] = useState<number>(0);
  const [handDrawn, setHandDrawn] = useState<boolean>(true);
  const [hasNotes, setHasNotes] = useState<boolean>(true);

  if (!open) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setError('Please upload a PNG or JPG image');
      setSelectedFile(null);
      return;
    }

    // Validate file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      setError('File size must be less than 20MB');
      setSelectedFile(null);
      return;
    }

    setError(null);
    setSelectedFile(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    try {
      setError(null);
      await onAnalyze(selectedFile, {
        generationCount,
        expectedPersonCount,
        handDrawn,
        hasNotes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze image');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Upload diagram image"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2460,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: '20px 24px',
          width: 'min(90vw, 500px)',
          maxHeight: 'calc(100vh - 40px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Extract Diagram from Image</h2>
          <button
            onClick={isLoading ? (onCancel || onClose) : onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 24,
              cursor: 'pointer',
              lineHeight: 1,
            }}
            aria-label="Close upload dialog"
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: 16, color: '#666', fontSize: 14 }}>
          Upload a photo or scan of a hand-drawn family diagram. We'll use AI to extract the family members and
          relationships.
        </div>

        <div
          style={{
            border: '2px dashed #ccc',
            borderRadius: 8,
            padding: 20,
            textAlign: 'center',
            marginBottom: 16,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            background: selectedFile ? '#f0f7ff' : '#fafafa',
          }}
          onClick={() => !isLoading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={isLoading}
          />
          {selectedFile ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#1976d2' }}>{selectedFile.name}</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Click to upload or drag and drop</div>
              <div style={{ fontSize: 12, color: '#999' }}>PNG or JPG, up to 20MB</div>
            </>
          )}
        </div>

        {/* About-the-diagram hint form. All optional — the pipeline runs
            with defaults if the user leaves everything blank. */}
        <div
          style={{
            border: '1px solid #e0e0e0',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            background: '#fafafa',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 10 }}>
            About this diagram <span style={{ fontWeight: 400, color: '#666' }}>(optional, helps accuracy)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 12px', alignItems: 'center', fontSize: 13 }}>
            <label htmlFor="hint-gens">Generations:</label>
            <input
              id="hint-gens"
              type="number"
              min={0}
              max={10}
              value={generationCount || ''}
              placeholder="auto-detect"
              onChange={(e) => setGenerationCount(parseInt(e.target.value, 10) || 0)}
              disabled={isLoading}
              style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, width: 120 }}
            />
            <label htmlFor="hint-people">Approx. people:</label>
            <input
              id="hint-people"
              type="number"
              min={0}
              max={100}
              value={expectedPersonCount || ''}
              placeholder="auto-detect"
              onChange={(e) => setExpectedPersonCount(parseInt(e.target.value, 10) || 0)}
              disabled={isLoading}
              style={{ padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, width: 120 }}
            />
            <label htmlFor="hint-drawn">Type:</label>
            <div>
              <label style={{ marginRight: 12 }}>
                <input
                  id="hint-drawn"
                  type="radio"
                  checked={handDrawn}
                  onChange={() => setHandDrawn(true)}
                  disabled={isLoading}
                />{' '}
                Hand-drawn
              </label>
              <label>
                <input
                  type="radio"
                  checked={!handDrawn}
                  onChange={() => setHandDrawn(false)}
                  disabled={isLoading}
                />{' '}
                Printed / digital
              </label>
            </div>
            <label htmlFor="hint-notes">Notes present:</label>
            <label>
              <input
                id="hint-notes"
                type="checkbox"
                checked={hasNotes}
                onChange={(e) => setHasNotes(e.target.checked)}
                disabled={isLoading}
              />{' '}
              Text labels or notes alongside symbols
            </label>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: '#ffebee',
              color: '#c62828',
              padding: '10px 12px',
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            style={{
              background: '#e3f2fd',
              color: '#0d47a1',
              padding: '10px 12px',
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Spinner />
            <span>{progressMessage || 'Working…'}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={isLoading ? (onCancel || onClose) : onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: 6,
              background: isLoading ? '#ffebee' : '#fff',
              color: isLoading ? '#c62828' : '#000',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {isLoading ? 'Stop' : 'Cancel'}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!selectedFile || isLoading}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              background: selectedFile && !isLoading ? '#1976d2' : '#ccc',
              color: '#fff',
              cursor: selectedFile && !isLoading ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {isLoading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 16,
        height: 16,
        border: '2px solid #bbdefb',
        borderTopColor: '#1976d2',
        borderRadius: '50%',
        animation: 'image-import-spin 0.8s linear infinite',
      }}
    >
      <style>{`@keyframes image-import-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
