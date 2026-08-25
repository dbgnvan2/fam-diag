import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import RightClickHintModal, { HINT_Z_INDEX } from './RightClickHintModal';
import { RIGHT_CLICK_HINT } from '../../data/helpContent';

/** Harness supplying the checkbox state the modal no longer owns. */
const Harness = ({ onClose }: { onClose: () => void }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  return (
    <RightClickHintModal
      open
      dontShowAgain={dontShowAgain}
      onDontShowAgainChange={setDontShowAgain}
      onClose={onClose}
    />
  );
};

describe('RightClickHintModal', () => {
  it('renders nothing when closed', () => {
    render(
      <RightClickHintModal
        open={false}
        dontShowAgain={false}
        onDontShowAgainChange={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.queryByRole('dialog', { name: 'Right click hint' })).toBeNull();
  });

  it('shows the title and every hint paragraph when open', () => {
    render(<Harness onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Right click hint' });
    expect(dialog).toHaveTextContent(RIGHT_CLICK_HINT.title);
    // Exact count, not a floor: an emptied array would otherwise assert nothing.
    expect(RIGHT_CLICK_HINT.paragraphs).toHaveLength(3);
    RIGHT_CLICK_HINT.paragraphs.forEach((paragraph) => {
      expect(dialog).toHaveTextContent(paragraph);
    });
  });

  it('carries the exact wording of the right-click reminder', () => {
    render(<Harness onClose={() => {}} />);
    expect(
      screen.getByText(
        'Right Click anywhere on the white background - the "canvas" to see options to add individuals or a family.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Once you have individuals and or relationships showing you can Right-Click on those to see options related to that item.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Just remember - Right Click is "right".')).toBeInTheDocument();
  });

  it('closes from the × control and the Got it button', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close right click hint'));
    fireEvent.click(screen.getByText('Got it'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('starts with the checkbox unticked and reports ticks to the parent', () => {
    const onDontShowAgainChange = vi.fn();
    render(
      <RightClickHintModal
        open
        dontShowAgain={false}
        onDontShowAgainChange={onDontShowAgainChange}
        onClose={() => {}}
      />
    );
    expect(screen.getByLabelText("Don't show this again")).not.toBeChecked();
    fireEvent.click(screen.getByLabelText("Don't show this again"));
    expect(onDontShowAgainChange).toHaveBeenCalledWith(true);
  });

  it('renders the checkbox from the parent-owned value', () => {
    render(
      <RightClickHintModal
        open
        dontShowAgain
        onDontShowAgainChange={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByLabelText("Don't show this again")).toBeChecked();
  });

  it('positions the dialog itself with position: fixed (modal viewport safety)', () => {
    render(<Harness onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Right click hint' });
    expect(dialog.style.position).toBe('fixed');
  });

  it('sits below the app overlay band and paints no backdrop over it', () => {
    const { container } = render(<Harness onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Right click hint' });
    // Context menus and ribbon dropdowns live at 1000, dialogs at 2400+. A hint
    // above those would cover the very menu it tells the user to open.
    expect(HINT_Z_INDEX).toBeLessThan(1000);
    expect(dialog.style.zIndex).toBe(String(HINT_Z_INDEX));
    // The dialog is the only element rendered — no full-viewport scrim.
    expect(container.childElementCount).toBe(1);
    expect(dialog.getAttribute('aria-modal')).toBeNull();
  });
});
