import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import SessionNotesPanel from './SessionNotesPanel';

const baseProps = () => ({
  isOpen: true,
  coachName: 'Coach',
  clientName: 'Client',
  noteFileName: 'Session Note - Coach - Client - 2026-02-27.json',
  presentingIssue: 'Issue',
  noteContent: 'Line one\nLine two',
  startedAt: Date.now(),
  autosaveInfo: { primary: null, backup: null },
  targetOptions: [{ value: 'person:p1', label: 'Person · Alex' }],
  selectedTarget: 'person:p1',
  diagramFileName: 'myfamily.json',
  focusPersonName: 'Alex',
  locationLabel: 'Browser Downloads',
  openCandidates: [{ id: 'note-1', label: 'Existing Note' }],
  selectedOpenCandidateId: null as string | null,
  onClose: vi.fn(),
  onFieldChange: vi.fn(),
  onTargetChange: vi.fn(),
  onNewNote: vi.fn(),
  onOpenCandidateChange: vi.fn(),
  onOpenNote: vi.fn(),
  onSaveNote: vi.fn(),
  onSaveAsNote: vi.fn(),
  onChooseLocation: vi.fn(),
  onSaveJson: vi.fn(),
  onSaveMarkdown: vi.fn(),
  onMakeEvent: vi.fn(),
});

describe('SessionNotesPanel', () => {
  it('renders file-style controls and context labels', () => {
    const props = baseProps();
    render(<SessionNotesPanel {...props} />);

    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save As' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Location' })).toBeInTheDocument();
    expect(screen.getByText(/Diagram:/)).toBeInTheDocument();
    expect(screen.getByText('myfamily.json')).toBeInTheDocument();
    expect(screen.getByText(/Focus:/)).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText(/Location:/)).toBeInTheDocument();
    expect(screen.getByText('Browser Downloads')).toBeInTheDocument();
  });

  it('fires callbacks for open/save/location actions', () => {
    const props = baseProps();
    props.selectedOpenCandidateId = 'note-1';
    render(<SessionNotesPanel {...props} />);

    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'note-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save As' }));
    fireEvent.click(screen.getByRole('button', { name: 'Location' }));

    expect(props.onOpenCandidateChange).toHaveBeenCalledWith('note-1');
    expect(props.onOpenNote).toHaveBeenCalledTimes(1);
    expect(props.onSaveNote).toHaveBeenCalledTimes(1);
    expect(props.onSaveAsNote).toHaveBeenCalledTimes(1);
    expect(props.onChooseLocation).toHaveBeenCalledTimes(1);
  });
});
