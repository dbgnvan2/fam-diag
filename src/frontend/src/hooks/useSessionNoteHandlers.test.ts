import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionNoteHandlers } from './useSessionNoteHandlers';
import type { SessionNoteFileRecord } from '../types/diagramEditor';

const record = (overrides: Partial<SessionNoteFileRecord> = {}): SessionNoteFileRecord => ({
  id: 'r1',
  noteFileName: 'n.json',
  diagramFileName: 'd.json',
  focusPersonName: '',
  coachName: '',
  clientName: '',
  presentingIssue: '',
  noteContent: 'saved text',
  startedAt: 1,
  updatedAt: 1,
  ...overrides,
});

const setup = (overrides: Record<string, unknown> = {}) => {
  const setters = {
    setSessionNoteCoachName: vi.fn(),
    setSessionNoteClientName: vi.fn(),
    setSessionNoteFileName: vi.fn(),
    setSessionNoteIssue: vi.fn(),
    setSessionNoteContent: vi.fn(),
    setSessionNotesTarget: vi.fn(),
    setSessionNoteRecordId: vi.fn(),
    setSessionNoteStartedAt: vi.fn(),
    setSessionSaveLocationLabel: vi.fn(),
    setSessionOpenCandidateId: vi.fn(),
    setSessionEventTarget: vi.fn(),
    setSessionEventDraft: vi.fn(),
  };
  const deps = {
    sessionNoteRecordId: 'r1',
    sessionFocusPersonName: '',
    fileName: 'd.json',
    sessionOpenCandidateId: 'r2',
    sessionNotesTarget: null,
    sessionEventTarget: null,
    sessionEventDraft: null,
    people: [],
    partnerships: [],
    emotionalLines: [],
    sessionSaveDirectoryHandleRef: { current: null },
    composeSessionNotePayload: () => record({ noteContent: 'edited, not saved' }),
    getSessionNotesLibrary: () => [record(), record({ id: 'r2', noteContent: 'other' })],
    setSessionNotesLibrary: vi.fn(),
    buildSessionNoteFileName: () => 'new.json',
    parseSessionTargetValue: () => null,
    handleUpdatePerson: vi.fn(),
    handleUpdatePartnership: vi.fn(),
    handleUpdateEmotionalLine: vi.fn(),
    confirmFn: vi.fn(() => false),
    alertFn: vi.fn(),
    ...setters,
    ...overrides,
  };
  const { result } = renderHook(() => useSessionNoteHandlers(deps as never));
  return { result, deps, setters };
};

describe('useSessionNoteHandlers — unsaved notes are not discarded', () => {
  it('New asks before discarding unsaved changes, and keeps them on Cancel (regression: cleared at once)', () => {
    const { result, deps, setters } = setup();
    act(() => result.current.handleSessionNotesNew());
    expect(deps.confirmFn).toHaveBeenCalledTimes(1);
    expect(setters.setSessionNoteContent).not.toHaveBeenCalled();
  });

  it('Open asks before replacing unsaved changes', () => {
    const { result, deps, setters } = setup();
    act(() => result.current.handleSessionOpenNote());
    expect(deps.confirmFn).toHaveBeenCalledTimes(1);
    expect(setters.setSessionNoteContent).not.toHaveBeenCalled();
  });

  it('a note with no unsaved changes opens without asking', () => {
    const { result, deps, setters } = setup({ composeSessionNotePayload: () => record() });
    act(() => result.current.handleSessionOpenNote());
    expect(deps.confirmFn).not.toHaveBeenCalled();
    expect(setters.setSessionNoteContent).toHaveBeenCalledWith('other');
  });

  it('an unreadable stored library is not overwritten on save (regression: replaced every stored note)', async () => {
    const { result, deps } = setup({ getSessionNotesLibrary: () => null });
    await act(async () => {
      await result.current.handleSessionSave();
    });
    expect(deps.setSessionNotesLibrary).not.toHaveBeenCalled();
    expect(deps.alertFn).toHaveBeenCalled();
  });
});
