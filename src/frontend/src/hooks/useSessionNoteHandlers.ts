import { useMemo } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { nanoid } from 'nanoid';
import type { Person, Partnership, EmotionalLine, EmotionalProcessEvent } from '../types';
import type { SessionNoteDirectoryHandle, SessionNoteFileRecord } from '../types/diagramEditor';
import { confirmDiscardUnsavedChanges } from '../utils/unsavedChanges';
import { buildSessionEventDraft, isSessionNoteDirty } from '../utils/sessionNoteEvents';
import {
  anchorTypeForOwner,
  applyEventDraftFieldChange,
  eventClassForOwner,
  normalizeEventForSave,
  saveEventOnOwner,
} from '../utils/eventDraft';

interface SessionNoteHandlerDeps {
  sessionNoteRecordId: string | null;
  sessionFocusPersonName: string;
  fileName: string;
  sessionOpenCandidateId: string | null;
  sessionNotesTarget: string | null;
  sessionEventTarget: { type: 'person' | 'partnership' | 'emotional'; id: string } | null;
  sessionEventDraft: EmotionalProcessEvent | null;
  people: Person[];
  partnerships: Partnership[];
  emotionalLines: EmotionalLine[];
  setSessionNoteCoachName: Dispatch<SetStateAction<string>>;
  setSessionNoteClientName: Dispatch<SetStateAction<string>>;
  setSessionNoteFileName: Dispatch<SetStateAction<string>>;
  setSessionNoteIssue: Dispatch<SetStateAction<string>>;
  setSessionNoteContent: Dispatch<SetStateAction<string>>;
  setSessionNotesTarget: Dispatch<SetStateAction<string | null>>;
  setSessionNoteRecordId: Dispatch<SetStateAction<string | null>>;
  setSessionNoteStartedAt: Dispatch<SetStateAction<number | null>>;
  setSessionSaveLocationLabel: Dispatch<SetStateAction<string>>;
  setSessionOpenCandidateId: Dispatch<SetStateAction<string | null>>;
  setSessionEventTarget: Dispatch<
    SetStateAction<{ type: 'person' | 'partnership' | 'emotional'; id: string } | null>
  >;
  setSessionEventDraft: Dispatch<SetStateAction<EmotionalProcessEvent | null>>;
  sessionSaveDirectoryHandleRef: MutableRefObject<SessionNoteDirectoryHandle | null>;
  composeSessionNotePayload: () => SessionNoteFileRecord;
  /** The stored library, or null when it is there but cannot be read. */
  getSessionNotesLibrary: () => SessionNoteFileRecord[] | null;
  setSessionNotesLibrary: (records: SessionNoteFileRecord[]) => void;
  buildSessionNoteFileName: (coach: string, client: string, startedAt: number | null) => string;
  parseSessionTargetValue: (
    value: string | null
  ) => { type: 'person' | 'partnership' | 'emotional'; id: string } | null;
  handleUpdatePerson: (id: string, updates: Partial<Person>) => void;
  handleUpdatePartnership: (id: string, updates: Partial<Partnership>) => void;
  handleUpdateEmotionalLine: (id: string, updates: Partial<EmotionalLine>) => void;
  confirmFn?: (message: string) => boolean;
  alertFn?: (message: string) => void;
}

export function useSessionNoteHandlers({
  sessionNoteRecordId,
  sessionFocusPersonName,
  fileName,
  sessionOpenCandidateId,
  sessionNotesTarget,
  sessionEventTarget,
  sessionEventDraft,
  people,
  partnerships,
  emotionalLines,
  setSessionNoteCoachName,
  setSessionNoteClientName,
  setSessionNoteFileName,
  setSessionNoteIssue,
  setSessionNoteContent,
  setSessionNotesTarget,
  setSessionNoteRecordId,
  setSessionNoteStartedAt,
  setSessionSaveLocationLabel,
  setSessionOpenCandidateId,
  setSessionEventTarget,
  setSessionEventDraft,
  sessionSaveDirectoryHandleRef,
  composeSessionNotePayload,
  getSessionNotesLibrary,
  setSessionNotesLibrary,
  buildSessionNoteFileName,
  parseSessionTargetValue,
  handleUpdatePerson,
  handleUpdatePartnership,
  handleUpdateEmotionalLine,
  confirmFn = (message) => window.confirm(message),
  alertFn = (message) => window.alert(message),
}: SessionNoteHandlerDeps) {
  // Unsaved work in the note being edited, compared with its saved record.
  const sessionNoteHasUnsavedChanges = () => {
    const payload = composeSessionNotePayload();
    const saved = sessionNoteRecordId
      ? (getSessionNotesLibrary() || []).find((entry) => entry.id === sessionNoteRecordId)
      : null;
    return isSessionNoteDirty(payload, saved);
  };

  const handleSessionFieldChange = (
    field: 'coach' | 'client' | 'fileName' | 'issue' | 'content',
    value: string
  ) => {
    switch (field) {
      case 'coach':
        setSessionNoteCoachName(value);
        break;
      case 'client':
        setSessionNoteClientName(value);
        break;
      case 'fileName':
        setSessionNoteFileName(value);
        break;
      case 'issue':
        setSessionNoteIssue(value);
        break;
      case 'content':
        setSessionNoteContent(value);
        break;
    }
  };

  const handleSessionNotesTargetChange = (value: string) => {
    setSessionNotesTarget(value || null);
  };

  const writeSessionNoteToLocation = async (
    fileNameValue: string,
    content: string,
    mimeType: string
  ) => {
    const handle = sessionSaveDirectoryHandleRef.current;
    if (!handle) return false;
    try {
      const fileHandle = await handle.getFileHandle(fileNameValue, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(new Blob([content], { type: mimeType }));
      await writable.close();
      return true;
    } catch {
      return false;
    }
  };

  const persistSessionNoteRecord = async (saveAs = false) => {
    const payload = composeSessionNotePayload();
    let nextFileName = payload.noteFileName || 'session-note.json';
    if (saveAs) {
      const entered = prompt('Session note filename (.json):', nextFileName) || '';
      if (!entered.trim()) return null;
      nextFileName = entered.trim().toLowerCase().endsWith('.json')
        ? entered.trim()
        : `${entered.trim()}.json`;
      setSessionNoteFileName(nextFileName);
    }
    const record: SessionNoteFileRecord = {
      id: saveAs || !sessionNoteRecordId ? nanoid() : sessionNoteRecordId,
      noteFileName: nextFileName,
      diagramFileName: fileName,
      focusPersonName: sessionFocusPersonName || '',
      coachName: payload.coachName || '',
      clientName: payload.clientName || '',
      presentingIssue: payload.presentingIssue || '',
      noteContent: payload.noteContent || '',
      startedAt: payload.startedAt || Date.now(),
      updatedAt: Date.now(),
    };
    const library = getSessionNotesLibrary();
    if (!library) {
      // The stored library is there but cannot be read. Writing now would
      // replace every stored session note with this one.
      alertFn(
        'Stored session notes could not be read, so this note was not saved to the library (saving would overwrite the others). Use "Save JSON" to keep a copy.'
      );
      return null;
    }
    const withoutCurrent = library.filter((entry) => entry.id !== record.id);
    setSessionNotesLibrary([...withoutCurrent, record]);
    setSessionNoteRecordId(record.id);

    const serialized = JSON.stringify(record, null, 2);
    const savedToLocation = await writeSessionNoteToLocation(
      record.noteFileName,
      serialized,
      'application/json'
    );
    if (!savedToLocation) {
      // A folder was chosen but the write failed: say so, rather than let
      // the panel keep showing that folder as where the note went.
      if (sessionSaveDirectoryHandleRef.current) {
        alertFn('The note could not be written to the chosen folder, so it is being downloaded instead.');
      }
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = record.noteFileName;
      link.click();
      URL.revokeObjectURL(url);
    }
    return record;
  };

  const handleSessionNotesNew = () => {
    if (!confirmDiscardUnsavedChanges(sessionNoteHasUnsavedChanges(), 'Start a new session note', confirmFn)) return;
    const startedAt = Date.now();
    setSessionNoteRecordId(null);
    setSessionNoteCoachName('');
    setSessionNoteClientName('');
    setSessionNoteIssue('');
    setSessionNoteContent('');
    setSessionNoteStartedAt(startedAt);
    setSessionNoteFileName(buildSessionNoteFileName('', '', startedAt));
    setSessionOpenCandidateId(null);
  };

  const handleSessionOpenCandidateChange = (id: string) => {
    setSessionOpenCandidateId(id || null);
  };

  const handleSessionOpenNote = () => {
    if (!sessionOpenCandidateId) return;
    const library = getSessionNotesLibrary() || [];
    const record = library.find((entry) => entry.id === sessionOpenCandidateId);
    if (!record) return;
    if (!confirmDiscardUnsavedChanges(sessionNoteHasUnsavedChanges(), 'Open this session note', confirmFn)) return;
    setSessionNoteRecordId(record.id);
    setSessionNoteCoachName(record.coachName || '');
    setSessionNoteClientName(record.clientName || '');
    setSessionNoteIssue(record.presentingIssue || '');
    setSessionNoteContent(record.noteContent || '');
    setSessionNoteStartedAt(record.startedAt || Date.now());
    setSessionNoteFileName(record.noteFileName || 'session-note.json');
  };

  const handleSessionChooseLocation = async () => {
    const picker = (window as Window & { showDirectoryPicker?: () => Promise<SessionNoteDirectoryHandle> })
      .showDirectoryPicker;
    if (typeof picker !== 'function') {
      alert(
        'Directory picker is not supported in this browser. Files will download to your default location.'
      );
      return;
    }
    try {
      const handle = await picker();
      sessionSaveDirectoryHandleRef.current = handle;
      setSessionSaveLocationLabel(handle.name || 'Selected folder');
    } catch {
      // user cancelled
    }
  };

  const handleSessionSave = async () => {
    await persistSessionNoteRecord(false);
  };

  const handleSessionSaveAs = async () => {
    await persistSessionNoteRecord(true);
  };

  const handleSaveSessionNoteJson = () => {
    const payload = composeSessionNotePayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = payload.noteFileName || 'session-note.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveSessionNoteMarkdown = () => {
    const payload = composeSessionNotePayload();
    const started = payload.startedAt ? new Date(payload.startedAt).toLocaleString() : 'N/A';
    const mdLines = [
      '# Session Note',
      '',
      `- Coach: ${payload.coachName || 'Coach'}`,
      `- Client: ${payload.clientName || 'Client'}`,
      `- Started: ${started}`,
      '',
      '## Presenting Issue / Client Focus',
      payload.presentingIssue ? payload.presentingIssue : '_None recorded._',
      '',
      '## Session Notes',
      payload.noteContent ? payload.noteContent : '_No notes recorded._',
    ];
    const fileBase = payload.noteFileName?.replace(/\.json$/i, '') || 'session-note';
    const blob = new Blob([mdLines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileBase}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSessionNotesMakeEvent = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      alert('Highlight a sentence or add at least one line of notes before creating an event.');
      return;
    }
    const target = parseSessionTargetValue(sessionNotesTarget);
    if (!target) {
      alert('Select a target item for the event.');
      return;
    }
    setSessionEventTarget(target);
    setSessionEventDraft(
      buildSessionEventDraft({ snippet: trimmed, target, people, partnerships, emotionalLines })
    );
  };

  const sessionEventOtherOptions = useMemo(() => {
    if (!sessionEventTarget) return [] as string[];
    if (sessionEventTarget.type === 'person') {
      return people
        .filter((p) => p.id !== sessionEventTarget.id)
        .map((p) => p.name)
        .filter(Boolean) as string[];
    }
    if (sessionEventTarget.type === 'partnership') {
      const partnership = partnerships.find((p) => p.id === sessionEventTarget.id);
      if (!partnership) return [];
      const partner1 = people.find((p) => p.id === partnership.partner1_id)?.name;
      const partner2 = people.find((p) => p.id === partnership.partner2_id)?.name;
      return [partner1, partner2].filter(Boolean) as string[];
    }
    const line = emotionalLines.find((el) => el.id === sessionEventTarget.id);
    if (!line) return [];
    const person1 = people.find((p) => p.id === line.person1_id)?.name;
    const person2 = people.find((p) => p.id === line.person2_id)?.name;
    return [person1, person2].filter(Boolean) as string[];
  }, [sessionEventTarget, people, partnerships, emotionalLines]);

  const sessionEventPrimaryOptions = useMemo(() => {
    if (!sessionEventTarget) return [] as string[];
    if (sessionEventTarget.type === 'person') {
      const person = people.find((p) => p.id === sessionEventTarget.id)?.name;
      return [person || ''].filter(Boolean) as string[];
    }
    if (sessionEventTarget.type === 'partnership') {
      const partnership = partnerships.find((p) => p.id === sessionEventTarget.id);
      const partner1 = people.find((p) => p.id === partnership?.partner1_id)?.name;
      const partner2 = people.find((p) => p.id === partnership?.partner2_id)?.name;
      return [partner1 || '', partner2 || ''].filter(Boolean) as string[];
    }
    const line = emotionalLines.find((el) => el.id === sessionEventTarget.id);
    const person1 = people.find((p) => p.id === line?.person1_id)?.name;
    const person2 = people.find((p) => p.id === line?.person2_id)?.name;
    return [person1 || '', person2 || ''].filter(Boolean) as string[];
  }, [sessionEventTarget, people, partnerships, emotionalLines]);

  const handleSessionEventDraftChange = (field: keyof EmotionalProcessEvent, value: string) => {
    setSessionEventDraft((prev) => (prev ? applyEventDraftFieldChange(prev, field, value) : prev));
  };

  // Saved like every other event (utils/eventDraft.ts): date and startDate,
  // anchorType and anchorId, eventClass and createdAt all set.
  const appendEventToTarget = (
    target: { type: 'person' | 'partnership' | 'emotional'; id: string },
    event: EmotionalProcessEvent
  ) => {
    const entity =
      target.type === 'person'
        ? people.find((p) => p.id === target.id)
        : target.type === 'partnership'
          ? partnerships.find((p) => p.id === target.id)
          : emotionalLines.find((el) => el.id === target.id);
    if (!entity) return;
    const saved = normalizeEventForSave(event, {
      anchorType: anchorTypeForOwner(target.type),
      anchorId: target.id,
      eventClass: eventClassForOwner(target.type),
    });
    const updates = saveEventOnOwner({ kind: target.type, id: target.id }, entity, saved);
    if (target.type === 'person') handleUpdatePerson(target.id, updates as Partial<Person>);
    else if (target.type === 'partnership') handleUpdatePartnership(target.id, updates as Partial<Partnership>);
    else handleUpdateEmotionalLine(target.id, updates as Partial<EmotionalLine>);
  };

  const commitSessionEventFromNotes = () => {
    if (!sessionEventDraft || !sessionEventTarget) return;
    appendEventToTarget(sessionEventTarget, sessionEventDraft);
    setSessionEventDraft(null);
    setSessionEventTarget(null);
  };

  const closeSessionEventModal = () => {
    setSessionEventDraft(null);
    setSessionEventTarget(null);
  };

  return {
    handleSessionFieldChange,
    handleSessionNotesTargetChange,
    handleSessionNotesNew,
    handleSessionOpenCandidateChange,
    handleSessionOpenNote,
    handleSessionChooseLocation,
    handleSessionSave,
    handleSessionSaveAs,
    handleSaveSessionNoteJson,
    handleSaveSessionNoteMarkdown,
    handleSessionNotesMakeEvent,
    sessionEventOtherOptions,
    sessionEventPrimaryOptions,
    handleSessionEventDraftChange,
    commitSessionEventFromNotes,
    closeSessionEventModal,
  };
}
