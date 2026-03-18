import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components as MarkdownComponents } from 'react-markdown';

type MarkdownCodeProps = React.ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
};

const codeRenderer = ({ inline, children, ...props }: MarkdownCodeProps) =>
  inline ? (
    <code style={{ background: '#f1f3f7', padding: '2px 4px', borderRadius: 4 }} {...props}>
      {children}
    </code>
  ) : (
    <code {...props}>{children}</code>
  );

const markdownComponents: MarkdownComponents = {
  h1: ({ node: _node, ...props }) => (
    <h1 style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: 4 }} {...props} />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 style={{ marginTop: 24, borderBottom: '1px solid #e0e0e0', paddingBottom: 4 }} {...props} />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre
      style={{
        background: '#1a1d2d',
        color: '#fefefe',
        padding: 12,
        borderRadius: 8,
        overflowX: 'auto',
      }}
      {...props}
    />
  ),
  code: codeRenderer,
};

interface ReadmeViewerModalProps {
  open: boolean;
  onClose: () => void;
  content: string;
}

const ReadmeViewerModal = ({ open, onClose, content }: ReadmeViewerModalProps) => {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="README documentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2450,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: '20px 24px',
          width: 'min(70vw, 900px)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>README Documentation</h2>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}
            aria-label="Close README viewer"
          >
            ×
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 6 }}>
          <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default ReadmeViewerModal;
