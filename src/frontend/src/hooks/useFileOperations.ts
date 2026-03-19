import { useCallback } from 'react';
import type { Dispatch, SetStateAction, MutableRefObject } from 'react';
import type {
  Person,
  Partnership,
  EmotionalLine,
  Triangle,
  FunctionalIndicatorDefinition,
  PageNote,
} from '../types';
import type {
  DiagramImportData,
  PersonSectionPopupState,
  PropertiesPanelIntent,
} from '../types/diagramEditor';
import {
  FALLBACK_FILE_NAME,
  DEFAULT_DIAGRAM_STATE,
} from '../data/defaultDiagramState';
import {
  isDiagramImportData,
  isFactsImportData,
  isSessionCaptureImportData,
  parseTranscriptToDraftDiagram,
  factsToDiagramImportData,
} from '../utils/dataImport';
import {
  loadDiagramBackups,
} from '../utils/storage';
import {
  DEMO_DIAGRAM_DATA,
  DEFAULT_DEMO_FILE_NAME,
  isDemoDiagramFileName,
} from '../utils/demoTour';
import {
  mergePersonEventsFromBundle,
  isPersonEventBundle,
  isTimelineJson,
  timelineJsonToBundle,
} from '../utils/personEventBundle';

interface UseFileOperationsDeps {
  // State data
  fileName: string;
  isDirty: boolean;
  people: Person[];
  partnerships: Partnership[];
  emotionalLines: EmotionalLine[];
  pageNotes: PageNote[];
  triangles: Triangle[];
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
  eventCategories: string[];
  relationshipTypes: string[];
  relationshipStatuses: string[];
  backupRestoreVersions: { v1?: string | null; v2?: string | null; v3?: string | null } | null;
  buildDemoSnapshots: any[];
  buildDemoSteps: any[];
  // Refs
  diagramFileHandleRef: MutableRefObject<any>;
  loadInputRef: MutableRefObject<HTMLInputElement | null>;
  importInputRef: MutableRefObject<HTMLInputElement | null>;
  importPersonEventsInputRef: MutableRefObject<HTMLInputElement | null>;
  transcriptInputRef: MutableRefObject<HTMLInputElement | null>;
  // State setters
  setPeople: Dispatch<SetStateAction<Person[]>>;
  setPartnerships: Dispatch<SetStateAction<Partnership[]>>;
  setEmotionalLines: Dispatch<SetStateAction<EmotionalLine[]>>;
  setPageNotes: Dispatch<SetStateAction<PageNote[]>>;
  setTriangles: Dispatch<SetStateAction<Triangle[]>>;
  setFileName: Dispatch<SetStateAction<string>>;
  setSelectedPeopleIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPartnershipId: Dispatch<SetStateAction<string | null>>;
  setSelectedEmotionalLineId: Dispatch<SetStateAction<string | null>>;
  setSelectedChildId: Dispatch<SetStateAction<string | null>>;
  setSelectedPageNoteId: Dispatch<SetStateAction<string | null>>;
  setPageNoteDraft: Dispatch<SetStateAction<{ title: string; text: string; fillColor: string } | null>>;
  setPropertiesPanelItem: Dispatch<SetStateAction<Person | Partnership | EmotionalLine | null>>;
  setPropertiesPanelIntent: Dispatch<SetStateAction<PropertiesPanelIntent>>;
  setPersonSectionPopup: Dispatch<SetStateAction<PersonSectionPopupState>>;
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number; items: any[] } | null>>;
  setTimelineSelectionIds: Dispatch<SetStateAction<string[]>>;
  setIdeasText: Dispatch<SetStateAction<string>>;
  setLastSavedAt: Dispatch<SetStateAction<number | null>>;
  setBackupRestoreOpen: Dispatch<SetStateAction<boolean>>;
  setBackupRestoreVersions: Dispatch<SetStateAction<{ v1?: string | null; v2?: string | null; v3?: string | null } | null>>;
  setHelpOpen: Dispatch<SetStateAction<boolean>>;
  setTrainingVideosOpen: Dispatch<SetStateAction<boolean>>;
  setBuildDemoOpen: Dispatch<SetStateAction<boolean>>;
  setBuildDemoStepIndex: Dispatch<SetStateAction<number>>;
  setDemoTourStepIndex: Dispatch<SetStateAction<number>>;
  setDemoTourOpen: Dispatch<SetStateAction<boolean>>;
  // Functions
  saveDiagramToCurrentTarget: (opts?: { requestedFileName?: string; forceChooseLocation?: boolean; allowPicker?: boolean }) => Promise<boolean>;
  replaceDiagramState: (data: any, sourceFileName?: string, options?: { normalizeLayout?: boolean }) => void;
  beginImportFlow: (data: DiagramImportData, sourceFileName: string, source: 'import' | 'transcript' | 'facts') => void;
  beginSessionCaptureFlow: (data: any, sourceFileName: string) => void;
  setDiagramFileHandle: (handle: any | null) => void;
  markSnapshotClean: (...args: any[]) => void;
}

export function useFileOperations({
  fileName,
  isDirty,
  people,
  functionalIndicatorDefinitions,
  eventCategories,
  relationshipTypes,
  relationshipStatuses,
  backupRestoreVersions,
  buildDemoSnapshots,
  buildDemoSteps,
  diagramFileHandleRef,
  loadInputRef,
  importInputRef,
  importPersonEventsInputRef,
  transcriptInputRef,
  setPeople,
  setPartnerships,
  setEmotionalLines,
  setPageNotes,
  setTriangles,
  setFileName,
  setSelectedPeopleIds,
  setSelectedPartnershipId,
  setSelectedEmotionalLineId,
  setSelectedChildId,
  setSelectedPageNoteId,
  setPageNoteDraft,
  setPropertiesPanelItem,
  setPropertiesPanelIntent,
  setPersonSectionPopup,
  setContextMenu,
  setTimelineSelectionIds,
  setIdeasText,
  setLastSavedAt,
  setBackupRestoreOpen,
  setBackupRestoreVersions,
  setHelpOpen,
  setTrainingVideosOpen,
  setBuildDemoOpen,
  setBuildDemoStepIndex,
  setDemoTourStepIndex,
  setDemoTourOpen,
  saveDiagramToCurrentTarget,
  replaceDiagramState,
  beginImportFlow,
  beginSessionCaptureFlow,
  setDiagramFileHandle,
  markSnapshotClean,
}: UseFileOperationsDeps) {
  const isCurrentDemoDiagram = isDemoDiagramFileName(fileName);

  const resetDiagramToBlankState = useCallback(() => {
    setDiagramFileHandle(null);
    setPeople([]);
    setPartnerships([]);
    setEmotionalLines([]);
    setPageNotes([]);
    setTriangles([]);
    setPropertiesPanelItem(null);
    setPersonSectionPopup(null);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    setContextMenu(null);
    setTimelineSelectionIds([]);
    setFileName(FALLBACK_FILE_NAME);
    markSnapshotClean(
      [],
      [],
      [],
      [],
      [],
      functionalIndicatorDefinitions,
      eventCategories,
      relationshipTypes,
      relationshipStatuses
    );
    setLastSavedAt(null);
    setIdeasText(DEFAULT_DIAGRAM_STATE.ideasText);
  }, [markSnapshotClean, setDiagramFileHandle]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (forcePrompt = false) => {
    let requestedFileName = fileName;
    if (!requestedFileName || requestedFileName === FALLBACK_FILE_NAME) {
      requestedFileName = 'family-diagram.json';
    }
    await saveDiagramToCurrentTarget({
      requestedFileName,
      forceChooseLocation: forcePrompt,
      allowPicker: true,
    });
  };

  const handleSaveAs = () => handleSave(true);

  const handleOpenBackupRestore = async () => {
    const backupKey = ((diagramFileHandleRef.current?.name || fileName || FALLBACK_FILE_NAME).trim() || FALLBACK_FILE_NAME)
      .toLowerCase();
    const backups = await loadDiagramBackups(backupKey);
    if (!backups || (!backups.v1 && !backups.v2 && !backups.v3)) {
      alert('No backups are available for this diagram yet.');
      return;
    }
    setBackupRestoreVersions(backups);
    setBackupRestoreOpen(true);
  };

  const handleRestoreBackupVersion = (versionKey: 'v1' | 'v2' | 'v3') => {
    const raw = backupRestoreVersions?.[versionKey];
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      replaceDiagramState(data, diagramFileHandleRef.current?.name || fileName);
      setBackupRestoreOpen(false);
      setBackupRestoreVersions(null);
    } catch {
      alert(`Could not restore backup ${versionKey.toUpperCase()}.`);
    }
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDiagramFileHandle(null);

    const reader = new FileReader();
    reader.onload = (event) => {
        const jsonString = event.target?.result as string;
        try {
            const data = JSON.parse(jsonString);
            replaceDiagramState(data, file.name);
        } catch (error) {
            alert('Error parsing file');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const jsonString = event.target?.result as string;
      try {
        const parsed = JSON.parse(jsonString);
        let data: DiagramImportData;
        if (isDiagramImportData(parsed)) {
          data = parsed;
          beginImportFlow(data, file.name, 'import');
          return;
        } else if (isSessionCaptureImportData(parsed)) {
          beginSessionCaptureFlow(parsed, file.name);
          return;
        } else if (isTimelineJson(parsed) || isPersonEventBundle(parsed)) {
          const bundle = isTimelineJson(parsed) ? timelineJsonToBundle(parsed) : parsed;
          const result = mergePersonEventsFromBundle(people, bundle);
          setPeople(result.people);
          const summary = result.summary;
          const unmatched =
            summary.unmatchedPeople.length > 0
              ? `\nUnmatched: ${summary.unmatchedPeople.join(', ')}`
              : '';
          alert(
            `Imported person events.\nMatched people: ${summary.matchedPeople}\nAdded: ${summary.addedEvents}\nUpdated: ${summary.updatedEvents}\nRemoved: ${summary.removedEvents}${unmatched}`
          );
          return;
        } else if (isFactsImportData(parsed)) {
          data = factsToDiagramImportData(parsed);
          beginImportFlow(data, file.name, 'facts');
          return;
        } else {
          throw new Error('Unsupported import format');
        }
      } catch (error) {
        alert('Error parsing import JSON. Expected diagram JSON, session-capture JSON, timeline/person-events JSON, or facts JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleProcessTranscriptLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.pdf')) {
      alert('Transcript processing currently supports text files (.txt, .md, .rtf). Convert PDF to text first.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const transcript = String(event.target?.result || '');
      try {
        const draft = parseTranscriptToDraftDiagram(transcript, file.name);
        beginImportFlow(draft, file.name, 'transcript');
      } catch (error) {
        alert('Error processing transcript');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleNewFile = () => {
    if (isDirty) {
      const confirmReset = window.confirm(
        'Start a new family diagram? Unsaved changes will be lost.'
      );
      if (!confirmReset) {
        return;
      }
    }
    resetDiagramToBlankState();
  };

  const handleOpenFilePicker = () => {
    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
      void (async () => {
        try {
          const DIAGRAM_FILE_PICKER_TYPES = [
            {
              description: 'Family Diagram JSON',
              accept: { 'application/json': ['.json'] },
            },
          ];
          const [handle] = await (window as any).showOpenFilePicker({
            multiple: false,
            types: DIAGRAM_FILE_PICKER_TYPES,
          });
          if (!handle) return;
          const file = await handle.getFile();
          const jsonString = await file.text();
          const data = JSON.parse(jsonString);
          setDiagramFileHandle(handle);
          replaceDiagramState(data, file.name);
        } catch (error) {
          if ((error as Error)?.name !== 'AbortError') {
            alert('Error opening file');
          }
        }
      })();
      return;
    }
    loadInputRef.current?.click();
  };

  const handleImportDataPicker = () => {
    importInputRef.current?.click();
  };

  const handleImportPersonEventsPicker = () => {
    importPersonEventsInputRef.current?.click();
  };

  const handleProcessTranscriptPicker = () => {
    transcriptInputRef.current?.click();
  };

  const handleLoadDemoDiagram = () => {
    if (isDirty && !isCurrentDemoDiagram) {
      const confirmReset = window.confirm(
        'Load Demo Diagram? Current unsaved diagram changes will be replaced.'
      );
      if (!confirmReset) return;
    }
    setDiagramFileHandle(null);
    replaceDiagramState(DEMO_DIAGRAM_DATA, DEFAULT_DEMO_FILE_NAME, { normalizeLayout: false });
  };

  const handleStartDemoTour = () => {
    if (isDirty && !isCurrentDemoDiagram) {
      const confirmReset = window.confirm(
        'Start the interactive demo? Current unsaved diagram changes will be replaced.'
      );
      if (!confirmReset) return;
    }
    if (!isCurrentDemoDiagram) {
      replaceDiagramState(DEMO_DIAGRAM_DATA, DEFAULT_DEMO_FILE_NAME);
    }
    setHelpOpen(false);
    setTrainingVideosOpen(false);
    setBuildDemoOpen(false);
    setBuildDemoStepIndex(0);
    setDemoTourStepIndex(0);
    setDemoTourOpen(true);
  };

  const applyBuildDemoStep = (stepIndex: number) => {
    const boundedIndex = Math.max(0, Math.min(stepIndex, buildDemoSnapshots.length - 1));
    const snapshot = buildDemoSnapshots[boundedIndex];
    if (!snapshot) return;
    replaceDiagramState(
      snapshot,
      snapshot.fileMeta?.fileName || `Build Demo Step ${boundedIndex + 1}`,
      { normalizeLayout: false }
    );
    const step = buildDemoSteps[boundedIndex];
    if (!step) return;
    const focus = step.focus;

    if (focus.kind === 'none') {
      setSelectedPeopleIds([]);
      setSelectedPartnershipId(null);
      setSelectedEmotionalLineId(null);
      setSelectedChildId(null);
      setPropertiesPanelItem(null);
      setPropertiesPanelIntent(null);
      return;
    }
    if (focus.kind === 'person') {
      const person = (snapshot.people || []).find((entry: any) => entry.id === focus.personId);
      if (!person) return;
      setSelectedPeopleIds([person.id]);
      setSelectedPartnershipId(null);
      setSelectedEmotionalLineId(null);
      setSelectedChildId(null);
      setPropertiesPanelItem(person);
      setPropertiesPanelIntent({
        targetId: person.id,
        tab: focus.tab,
      });
      return;
    }

    if (focus.kind === 'partnership') {
      const partnership = (snapshot.partnerships || []).find(
        (entry: any) => entry.id === focus.partnershipId
      );
      if (!partnership) return;
      setSelectedPeopleIds([]);
      setSelectedPartnershipId(partnership.id);
      setSelectedEmotionalLineId(null);
      setSelectedChildId(null);
      setPropertiesPanelItem(partnership);
      setPropertiesPanelIntent({
        targetId: partnership.id,
        tab: focus.tab,
      });
      return;
    }

    if (focus.kind === 'emotional') {
      const line = (snapshot.emotionalLines || []).find((entry: any) => entry.id === focus.lineId);
      if (!line) return;
      setSelectedPeopleIds([]);
      setSelectedPartnershipId(null);
      setSelectedEmotionalLineId(line.id);
      setSelectedChildId(null);
      setPropertiesPanelItem(line);
      setPropertiesPanelIntent({
        targetId: line.id,
        tab: focus.tab,
      });
    }
  };

  const handleStartBuildDemo = () => {
    if (isDirty) {
      const confirmReset = window.confirm(
        'Start the build demo? Current unsaved diagram changes will be replaced.'
      );
      if (!confirmReset) return;
    }
    setHelpOpen(false);
    setTrainingVideosOpen(false);
    setDemoTourOpen(false);
    setDemoTourStepIndex(0);
    setBuildDemoOpen(true);
    setBuildDemoStepIndex(0);
    applyBuildDemoStep(0);
  };

  const handleCloseBuildDemo = () => {
    setBuildDemoOpen(false);
    setBuildDemoStepIndex(0);
  };

  const handleBuildDemoStepChange = (nextIndex: number) => {
    const boundedIndex = Math.max(0, Math.min(nextIndex, buildDemoSteps.length - 1));
    setBuildDemoStepIndex(boundedIndex);
    applyBuildDemoStep(boundedIndex);
  };

  const handleCloseDemoTour = () => {
    setDemoTourOpen(false);
    setDemoTourStepIndex(0);
  };

  return {
    resetDiagramToBlankState,
    handleSave,
    handleSaveAs,
    handleOpenBackupRestore,
    handleRestoreBackupVersion,
    handleLoad,
    handleImportLoad,
    handleProcessTranscriptLoad,
    handleNewFile,
    handleOpenFilePicker,
    handleImportDataPicker,
    handleImportPersonEventsPicker,
    handleProcessTranscriptPicker,
    handleLoadDemoDiagram,
    handleStartDemoTour,
    applyBuildDemoStep,
    handleStartBuildDemo,
    handleCloseBuildDemo,
    handleBuildDemoStepChange,
    handleCloseDemoTour,
  };
}
