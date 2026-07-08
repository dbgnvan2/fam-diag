/**
 * Tests for ImageDiagramModal and the upload-vs-review gating in DiagramModals.
 *
 * Spec: docs/implementation_plan_2026-06-06.md — M5.A.1
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
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

describe('test_m5a1_only_one_image_modal_at_a_time', () => {
  it('DiagramModals gates ImageDiagramModal on !imageDiagramReviewOpen', () => {
    // Static check: the upload modal in DiagramModals must be hidden once the
    // review modal is open. This protects against regressions where someone
    // changes the gate to a less safe form.
    const source = readFileSync(
      join(__dirname, '..', 'DiagramModals.tsx'),
      'utf8'
    );
    // Find the ImageDiagramModal element and inspect its open= prop.
    const match = source.match(/<ImageDiagramModal[\s\S]*?\/>/);
    expect(match).not.toBeNull();
    const element = match![0];
    expect(element).toMatch(/open=\{imageDiagramModalOpen\s*&&\s*!imageDiagramReviewOpen\}/);
  });
});
