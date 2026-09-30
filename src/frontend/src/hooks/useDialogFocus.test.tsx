import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import RightClickHintModal from '../components/modals/RightClickHintModal';
import RibbonHelpModal from '../components/modals/RibbonHelpModal';
import HelpModal from '../components/modals/HelpModal';

const Harness = ({ open, onClose, which }: { open: boolean; onClose: () => void; which: 'hint' | 'ribbon' | 'help' }) => (
  <>
    <button>opener</button>
    {which === 'hint' && (
      <RightClickHintModal open={open} dontShowAgain={false} onDontShowAgainChange={() => {}} onClose={onClose} />
    )}
    {which === 'ribbon' && <RibbonHelpModal open={open} title="T" body="B" onClose={onClose} />}
    {which === 'help' && (
      <HelpModal
        open={open}
        onClose={onClose}
        onStartDemoTour={() => {}}
        onStartBuildDemo={() => {}}
        onOpenReadmeViewer={() => {}}
        onOpenTrainingVideos={() => {}}
      />
    )}
  </>
);

describe.each(['hint', 'ribbon', 'help'] as const)('dialog focus: %s', (which) => {
  it('takes focus on open, closes on Escape, and gives focus back on close (regression: none of the three)', () => {
    const onClose = vi.fn();
    const { getByText, getByRole, rerender } = render(<Harness open={false} onClose={onClose} which={which} />);
    const opener = getByText('opener');
    opener.focus();
    rerender(<Harness open onClose={onClose} which={which} />);
    expect(document.activeElement).toBe(getByRole('dialog'));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<Harness open={false} onClose={onClose} which={which} />);
    expect(document.activeElement).toBe(opener);
  });
});
