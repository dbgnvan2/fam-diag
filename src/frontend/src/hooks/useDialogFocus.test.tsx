import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import RightClickHintModal from '../components/modals/RightClickHintModal';
import RibbonHelpModal from '../components/modals/RibbonHelpModal';
import HelpModal from '../components/modals/HelpModal';
import ReadmeViewerModal from '../components/modals/ReadmeViewerModal';
import SaveAsDialog from '../components/modals/SaveAsDialog';
import ImportModeDialog from '../components/modals/ImportModeDialog';
import SettingsListModal from '../components/modals/SettingsListModal';
import IdeasPanel from '../components/IdeasPanel';
import { useDialogFocus } from './useDialogFocus';

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

// ── Gap review F-10: every dialog, and Escape closes only the top one ─────────

const dialogs: Array<[string, (open: boolean, onClose: () => void) => React.ReactElement]> = [
  ['README viewer', (open, onClose) => <ReadmeViewerModal open={open} onClose={onClose} content="# Hi" />],
  ['Save As', (open, onClose) => <SaveAsDialog open={open} currentFileName="a.json" onSave={() => {}} onClose={onClose} />],
  [
    'Import mode',
    (open, onClose) => (
      <ImportModeDialog open={open} source="import" fileName="f.json" onReplace={() => {}} onMerge={() => {}} onCancel={onClose} />
    ),
  ],
  [
    'Settings list',
    (open, onClose) => (
      <SettingsListModal
        open={open}
        onClose={onClose}
        title="Event Categories"
        description=""
        zIndex={1}
        items={['A']}
        draft=""
        draftPlaceholder=""
        onDraftChange={() => {}}
        onAdd={() => {}}
      />
    ),
  ],
  ['Ideas', (open, onClose) => <IdeasPanel isOpen={open} ideasText="" onChange={() => {}} onClose={onClose} />],
];

describe.each(dialogs)('dialog focus: %s (regression F-10: Escape did nothing)', (_name, renderDialog) => {
  it('focus moves into it and Escape closes it', () => {
    const onClose = vi.fn();
    const { getByRole } = render(renderDialog(true, onClose));
    expect(getByRole('dialog').contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

const Stacked = ({ onOuter, onInner, innerOpen }: { onOuter: () => void; onInner: () => void; innerOpen: boolean }) => {
  const outerRef = useDialogFocus(true, onOuter);
  const innerRef = useDialogFocus(innerOpen, onInner);
  return (
    <div ref={outerRef} tabIndex={-1} role="dialog" aria-label="outer">
      {innerOpen && <div ref={innerRef} tabIndex={-1} role="dialog" aria-label="inner" />}
    </div>
  );
};

describe('dialog focus: stacked dialogs', () => {
  it('Escape closes only the topmost dialog (an event dialog over the Timeline)', () => {
    const onOuter = vi.fn();
    const onInner = vi.fn();
    const { rerender } = render(<Stacked onOuter={onOuter} onInner={onInner} innerOpen={false} />);
    rerender(<Stacked onOuter={onOuter} onInner={onInner} innerOpen />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onInner).toHaveBeenCalledTimes(1);
    expect(onOuter).not.toHaveBeenCalled();
    rerender(<Stacked onOuter={onOuter} onInner={onInner} innerOpen={false} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onOuter).toHaveBeenCalledTimes(1);
  });
});
