/**
 * Tests for ImageDiagramModal (the image-import upload dialog).
 *
 * The M5.A.1 "one image modal at a time" check was removed with the review
 * modal (2026-09-27): only one image modal remains.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ImageDiagramModal from './ImageDiagramModal';

describe('ImageDiagramModal', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <ImageDiagramModal open={false} onClose={() => {}} onAnalyze={async () => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders content when open=true', () => {
    const { container } = render(
      <ImageDiagramModal open={true} onClose={() => {}} onAnalyze={async () => {}} />
    );
    expect(container.firstChild).not.toBeNull();
  });

  it('discloses that the image is sent to Anthropic before the user analyzes', () => {
    // Privacy consent point: the user must be told the image leaves the app
    // (browser-direct to Anthropic) before clicking Analyze.
    render(<ImageDiagramModal open={true} onClose={() => {}} onAnalyze={async () => {}} />);
    expect(screen.getByText(/sent to Anthropic/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacy/i)).toBeInTheDocument();
  });
});
