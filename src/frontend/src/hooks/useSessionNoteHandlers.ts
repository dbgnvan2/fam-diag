import { useMemo, useCallback } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import { nanoid } from 'nanoid';
import type { Person, Partnership, EmotionalLine, EmotionalProcessEvent, EventClass } from '../types';
import type { SessionNoteFileRecord } from '../types/diagramEditor';

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
  eventCategories: string[];
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
  sessionSaveDirectoryHandleRef: MutableRefObject<any>;
  composeSessionNotePayload: () => SessionNoteFileRecord;
  getSessionNotesLibrary: () => SessionNoteFileRecord[];
  setSessionNotesLibrary: (records: SessionNoteFileRecord[]) => void;
  buildSessionNoteFileName: (coach: string, client: string, startedAt: number | null) => string;
  parseSessionTargetValue: (
    value: string | null
  ) => { type: 'person' | 'partnership' | 'emotional'; id: string } | null;
  getEventClassForTargetType: (type: 'person' | 'partnership' | 'emotional') => EventClass;
  handleUpdatePerson: (id: string, updates: Partial<Person>) => void;
  handleUpdatePartnership: (id: string, updates: Partial<Partnership>) => void;
  handleUpdateEmotionalLine: (id: string, updates: Partial<EmotionalLine>) => void;
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
  eventCategories,
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
  getEventClassForTargetType,
  handleUpdatePerson,
  handleUpdatePartnership,
  handleUpdateEmotionalLine,
}: SessionNoteHandlerDeps) {
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
    const library = getSessionNotesLibrary();
    const record = library.find((entry) => entry.id === sessionOpenCandidateId);
    if (!record) return;
    setSessionNoteRecordId(record.id);
    setSessionNoteCoachName(record.coachName || '');
    setSessionNoteClientName(record.clientName || '');
    setSessionNoteIssue(record.presentingIssue || '');
    setSessionNoteContent(record.noteContent || '');
    setSessionNoteStartedAt(record.startedAt || Date.now());
    setSessionNoteFileName(record.noteFileName || 'session-note.json');
  };

  const handleSessionChooseLocation = async () => {
    const picker = (window as any).showDirectoryPicker;
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

  const inferSessionEventDefaults = useCallback(
    (snippet: string): EmotionalProcessEvent => {
      const trimmed = snippet.trim();
      const yearMatch = trimmed.match(/\b(19|20)\d{2}\b/);
      const matchedPerson = people.find((person) =>
        person.name ? trimmed.toLowerCase().includes(person.name.toLowerCase()) : false
      );
      return {
        id: nanoid(),
        date: yearMatch ? `${yearMatch[0]}-01-01` : '',
        category: eventCategories[0] || 'Session Note',
        intensity: 5,
        howWell: 5,
        otherPersonName: matchedPerson?.name || '',
        primaryPersonName: '',
        wwwwh: trimmed,
        observations: trimmed,
        isNodalEvent: false,
        createdAt: Date.now(),
        statusLabel: '',
        eventClass: 'individual',
      };
    },
    [people, eventCategories]
  );

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
    const defaults = inferSessionEventDefaults(trimmed);
    defaults.eventClass = getEventClassForTargetType(target.type);
    if (target.type === 'person') {
      const targetPerson = people.find((p) => p.id === target.id);
      defaults.primaryPersonName = targetPerson?.name || defaults.primaryPersonName || '';
    } else if (target.type === 'partnership') {
      const partnership = partnerships.find((p) => p.id === target.id);
      const partner1 = people.find((p) => p.id === partnership?.partner1_id)?.name;
      defaults.primaryPersonName = partner1 || defaults.primaryPersonName || '';
    } else if (target.type === 'emotional') {
      const line = emotionalLines.find((el) => el.id === target.id);
      const person1 = people.find((p) => p.id === line?.person1_id)?.name;
      defaults.primaryPersonName = person1 || defaults.primaryPersonName || '';
    }
    setSessionEventTarget(target);
    setSessionEventDraft(defaults);
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
    setSessionEventDraft((prev) => {
      if (!prev) return prev;
      if (
        field === 'intensity' ||
        field === 'howWell' ||
        field === 'frequency' ||
        field === 'impact'
      ) {
        const numeric = Number(value);
        return { ...prev, [field]: Number.isNaN(numeric) ? 0 : numeric };
      }
      if (field === 'isNodalEvent') {
        return { ...prev, isNodalEvent: value === 'true' };
      }
      return { ...prev, [field]: value };
    });
  };

  const appendEventToTarget = (
    target: { type: 'person' | 'partnership' | 'emotional'; id: string },
    event: EmotionalProcessEvent
  ) => {
    const fallbackClass = getEventClassForTargetType(target.type);
    const eventWithTimestamp: EmotionalProcessEvent = {
      ...event,
      createdAt: event.createdAt ?? Date.now(),
      statusLabel: event.statusLabel ?? '',
      eventClass: event.eventClass || fallbackClass,
    };
    if (target.type === 'person') {
      const person = people.find((p) => p.id === target.id);
      const nextEvents = [...(person?.events ?? []), eventWithTimestamp];
      handleUpdatePerson(target.id, { events: nextEvents });
      return;
    }
    if (target.type === 'partnership') {
      const partnership = partnerships.find((p) => p.id === target.id);
      const nextEvents = [...(partnership?.events ?? []), eventWithTimestamp];
      handleUpdatePartnership(target.id, { events: nextEvents });
      return;
    }
    const line = emotionalLines.find((el) => el.id === target.id);
    const nextEvents = [...(line?.events ?? []), eventWithTimestamp];
    handleUpdateEmotionalLine(target.id, { events: nextEvents });
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
