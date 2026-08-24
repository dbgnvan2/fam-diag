import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import RightClickHintModal from './RightClickHintModal';
import { RIGHT_CLICK_HINT } from '../../data/helpContent';

describe('RightClickHintModal', () => {
  it('renders nothing when closed', () => {
    render(<RightClickHintModal open={false} onClose={() => {}} />);
    expect(screen.queryByRole('dialog', { name: 'Right click hint' })).toBeNull();
  });

  it('shows the title and every hint paragraph when open', () => {
    render(<RightClickHintModal open onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Right click hint' });
    expect(dialog).toHaveTextContent(RIGHT_CLICK_HINT.title);
    RIGHT_CLICK_HINT.paragraphs.forEach((paragraph) => {
      expect(dialog).toHaveTextContent(paragraph);
    });
  });

  it('carries the exact wording of the right-click reminder', () => {
    render(<RightClickHintModal open onClose={() => {}} />);
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
    render(<RightClickHintModal open onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close right click hint'));
    fireEvent.click(screen.getByText('Got it'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('reports dontShowAgain=false when the checkbox is left unticked', () => {
    const onClose = vi.fn();
    render(<RightClickHintModal open onClose={onClose} />);
    expect(screen.getByLabelText("Don't show this again")).not.toBeChecked();
    fireEvent.click(screen.getByText('Got it'));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  it('reports dontShowAgain=true when the checkbox is ticked before closing', () => {
    const onClose = vi.fn();
    render(<RightClickHintModal open onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Don't show this again"));
    expect(screen.getByLabelText("Don't show this again")).toBeChecked();
    fireEvent.click(screen.getByText('Got it'));
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('reports the ticked checkbox through the × control too', () => {
    const onClose = vi.fn();
    render(<RightClickHintModal open onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Don't show this again"));
    fireEvent.click(screen.getByLabelText('Close right click hint'));
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('positions the dialog itself with position: fixed (modal viewport safety)', () => {
    render(<RightClickHintModal open onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Right click hint' });
    expect(dialog.style.position).toBe('fixed');
  });
});
