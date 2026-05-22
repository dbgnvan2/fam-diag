/**
 * Modal for uploading a diagram image and analyzing it with Claude Vision.
 */

import React, { useState, useRef } from 'react';

interface ImageDiagramModalProps {
  open: boolean;
  onClose: () => void;
  onAnalyze: (imageBlob: Blob) => Promise<void>;
  isLoading?: boolean;
}

export default function ImageDiagramModal({
  open,
  onClose,
  onAnalyze,
  isLoading = false,
}: ImageDiagramModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      await onAnalyze(selectedFile);
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
            onClick={onClose}
            disabled={isLoading}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 24,
              cursor: isLoading ? 'not-allowed' : 'pointer',
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

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: 6,
              background: '#fff',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Cancel
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
