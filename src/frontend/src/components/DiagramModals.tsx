import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  Person,
  Partnership,
  EmotionalLine,
  FunctionalIndicatorDefinition,
  EmotionalProcessEvent,
  EventClass,
} from '../types';
import type {
  EmotionalPatternDraft,
  ClientProfileDraft,
  CoachThinkingDraft,
  DiagramImportData,
  SessionCaptureImportData,
  DemoTourStep,
  BuildDemoStep,
} from '../types/diagramEditor';
import type { RibbonHelpKey } from '../data/helpContent';
import ImportModeDialog from './modals/ImportModeDialog';
import SessionCaptureDialog from './modals/SessionCaptureDialog';
import ClientProfileModal from './modals/ClientProfileModal';
import CoachThinkingModal from './modals/CoachThinkingModal';
import EmotionalPatternModal from './modals/EmotionalPatternModal';
import SettingsListModal from './modals/SettingsListModal';
import IndicatorSettingsModal from './modals/IndicatorSettingsModal';
import TimelineBoardModal from './modals/TimelineBoardModal';
import SessionNotesPanel from './SessionNotesPanel';
import RibbonHelpModal from './modals/RibbonHelpModal';
import HelpModal from './modals/HelpModal';
import TrainingVideosModal from './modals/TrainingVideosModal';
import DemoTourModal from './modals/DemoTourModal';
import BuildDemoModal from './modals/BuildDemoModal';
import ReadmeViewerModal from './modals/ReadmeViewerModal';
import SessionEventModal from './modals/SessionEventModal';
import IdeasPanel from './IdeasPanel';
import { sortLabelsAZ } from '../utils/storage';
import readmeContent from '../../../../README.md?raw';

type TrainingVideo = { id: string; title: string; duration: string; topic: string; embedUrl: string; url: string };

interface DiagramModalsProps {
  // ImportModeDialog
  importModeDialogOpen: boolean;
  pendingImportData: DiagramImportData | null;
  pendingImportSource: 'import' | 'transcript' | 'facts';
  pendingImportFileName: string;
  completePendingImport: (mode: 'replace' | 'merge') => void;
  setImportModeDialogOpen: Dispatch<SetStateAction<boolean>>;
  setPendingImportData: Dispatch<SetStateAction<DiagramImportData | null>>;
  setPendingImportFileName: Dispatch<SetStateAction<string>>;

  // SessionCaptureDialog
  sessionCaptureDialogOpen: boolean;
  pendingSessionCaptureData: SessionCaptureImportData | null;
  pendingSessionCaptureFileName: string;
  sessionCaptureSelections: Record<string, boolean>;
  setSessionCaptureSelections: Dispatch<SetStateAction<Record<string, boolean>>>;
  completeSessionCaptureImport: () => void;
  setSessionCaptureDialogOpen: Dispatch<SetStateAction<boolean>>;
  setPendingSessionCaptureData: Dispatch<SetStateAction<SessionCaptureImportData | null>>;
  setPendingSessionCaptureFileName: Dispatch<SetStateAction<string>>;

  // ClientProfileModal
  clientProfileDraft: ClientProfileDraft | null;
  updateClientProfileDraftField: (field: keyof Omit<ClientProfileDraft, 'personId' | 'personName'>, value: string) => void;
  saveClientProfileDraft: () => void;
  setClientProfileDraft: Dispatch<SetStateAction<ClientProfileDraft | null>>;

  // CoachThinkingModal
  coachThinkingDraft: CoachThinkingDraft | null;
  updateCoachThinkingField: (field: 'thinking' | 'notes', value: string) => void;
  saveCoachThinkingDraft: () => void;
  setCoachThinkingDraft: Dispatch<SetStateAction<CoachThinkingDraft | null>>;

  // EmotionalPatternModal
  emotionalPatternModalOpen: boolean;
  emotionalPatternDraft: EmotionalPatternDraft | null;
  updateEmotionalPatternDraft: (updates: Partial<EmotionalPatternDraft>) => void;
  saveAddEmotionalPattern: () => void;
  setEmotionalPatternModalOpen: Dispatch<SetStateAction<boolean>>;
  setEmotionalPatternDraft: Dispatch<SetStateAction<EmotionalPatternDraft | null>>;

  // Event categories SettingsListModal
  settingsOpen: boolean;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  eventCategories: string[];
  settingsDraft: string;
  setSettingsDraft: Dispatch<SetStateAction<string>>;
  setEventCategories: Dispatch<SetStateAction<string[]>>;

  // Relationship types SettingsListModal
  relationshipTypeSettingsOpen: boolean;
  setRelationshipTypeSettingsOpen: Dispatch<SetStateAction<boolean>>;
  sortedRelationshipTypes: string[];
  relationshipTypeDraft: string;
  setRelationshipTypeDraft: Dispatch<SetStateAction<string>>;
  setRelationshipTypes: Dispatch<SetStateAction<string[]>>;
  relationshipTypes: string[];

  // Relationship statuses SettingsListModal
  relationshipStatusSettingsOpen: boolean;
  setRelationshipStatusSettingsOpen: Dispatch<SetStateAction<boolean>>;
  sortedRelationshipStatuses: string[];
  relationshipStatusDraft: string;
  setRelationshipStatusDraft: Dispatch<SetStateAction<string>>;
  setRelationshipStatuses: Dispatch<SetStateAction<string[]>>;
  relationshipStatuses: string[];

  // IndicatorSettingsModal
  indicatorSettingsOpen: boolean;
  setIndicatorSettingsOpen: Dispatch<SetStateAction<boolean>>;
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
  indicatorDraftLabel: string;
  setIndicatorDraftLabel: Dispatch<SetStateAction<string>>;
  addFunctionalIndicatorDefinition: () => void;
  addFunctionalIndicatorDefinitionForGroup: (group: 'physical' | 'emotional' | 'social') => void;
  onSaveIndicatorsAsDefault: (definitions: FunctionalIndicatorDefinition[]) => void;
  updateFunctionalIndicatorLabel: (id: string, label: string) => void;
  updateFunctionalIndicatorGroup: (id: string, group: 'physical' | 'emotional' | 'social') => void;
  updateFunctionalIndicatorColor: (id: string, color: string) => void;
  updateFunctionalIndicatorIcon: (id: string, file: File | null) => void;
  updateFunctionalIndicatorUseLetter: (id: string, useLetter: boolean) => void;
  clearFunctionalIndicatorIcon: (id: string) => void;
  removeFunctionalIndicatorDefinition: (id: string) => void;

  // TimelineBoardModal
  people: Person[];
  partnerships: Partnership[];
  allEmotionalLines: EmotionalLine[];
  timelineSelectionIds: string[];
  handleUpdatePerson: (personId: string, updatedProps: Partial<Person>) => void;
  handleUpdatePartnership: (partnershipId: string, updatedProps: Partial<Partnership>) => void;
  handleUpdateEmotionalLine: (emotionalLineId: string, updatedProps: Partial<EmotionalLine>) => void;
  setTimelineSelectionIds: Dispatch<SetStateAction<string[]>>;

  // SessionNotesPanel
  sessionNotesOpen: boolean;
  setSessionNotesOpen: Dispatch<SetStateAction<boolean>>;
  sessionNoteCoachName: string;
  sessionNoteClientName: string;
  sessionNoteFileName: string;
  sessionNoteIssue: string;
  sessionNoteContent: string;
  sessionNoteStartedAt: number | null;
  sessionAutosaveInfo: { primary?: string | null; backup?: string | null };
  sessionTargetOptions: { value: string; label: string }[];
  sessionNotesTarget: string | null;
  fileName: string;
  sessionFocusPersonName: string;
  sessionSaveLocationLabel: string;
  sessionOpenCandidates: { id: string; label: string }[];
  sessionOpenCandidateId: string | null;
  handleSessionFieldChange: (field: 'coach' | 'client' | 'fileName' | 'issue' | 'content', value: string) => void;
  handleSessionNotesTargetChange: (value: string) => void;
  handleSessionNotesNew: () => void;
  handleSessionOpenCandidateChange: (id: string) => void;
  handleSessionOpenNote: () => void;
  handleSessionSave: () => void;
  handleSessionSaveAs: () => void;
  handleSessionChooseLocation: () => void;
  handleSaveSessionNoteJson: () => void;
  handleSaveSessionNoteMarkdown: () => void;
  handleSessionNotesMakeEvent: () => void;

  // RibbonHelpModal
  selectedRibbonHelp: { title: string; body: string } | null;
  selectedRibbonHelpBody: string;
  setRibbonHelpKey: Dispatch<SetStateAction<RibbonHelpKey | null>>;

  // HelpModal
  helpOpen: boolean;
  setHelpOpen: Dispatch<SetStateAction<boolean>>;
  handleStartDemoTour: () => void;
  handleStartBuildDemo: () => void;
  setReadmeViewerOpen: Dispatch<SetStateAction<boolean>>;
  setTrainingVideosOpen: Dispatch<SetStateAction<boolean>>;

  // TrainingVideosModal
  trainingVideosOpen: boolean;
  trainingVideos: TrainingVideo[];
  selectedTrainingVideoId: string;
  setSelectedTrainingVideoId: Dispatch<SetStateAction<string>>;

  // DemoTourModal
  demoTourOpen: boolean;
  demoTourSteps: DemoTourStep[];
  demoTourStepIndex: number;
  handleCloseDemoTour: () => void;
  setDemoTourStepIndex: Dispatch<SetStateAction<number>>;

  // BuildDemoModal
  buildDemoOpen: boolean;
  buildDemoSteps: BuildDemoStep[];
  buildDemoStepIndex: number;
  handleCloseBuildDemo: () => void;
  handleBuildDemoStepChange: (index: number) => void;

  // ReadmeViewerModal
  readmeViewerOpen: boolean;

  // SessionEventModal
  sessionEventDraft: EmotionalProcessEvent | null;
  sessionEventTarget: { type: 'person' | 'partnership' | 'emotional'; id: string } | null;
  getEventClassForTargetType: (type: 'person' | 'partnership' | 'emotional') => EventClass;
  sessionEventPrimaryOptions: string[];
  sessionEventOtherOptions: string[];
  handleSessionEventDraftChange: (field: keyof EmotionalProcessEvent, value: string) => void;
  closeSessionEventModal: () => void;
  commitSessionEventFromNotes: () => void;

  // IdeasPanel
  ideasOpen: boolean;
  ideasText: string;
  setIdeasText: Dispatch<SetStateAction<string>>;
  setIdeasOpen: Dispatch<SetStateAction<boolean>>;
}

export default function DiagramModals({
  importModeDialogOpen,
  pendingImportData,
  pendingImportSource,
  pendingImportFileName,
  completePendingImport,
  setImportModeDialogOpen,
  setPendingImportData,
  setPendingImportFileName,
  sessionCaptureDialogOpen,
  pendingSessionCaptureData,
  pendingSessionCaptureFileName,
  sessionCaptureSelections,
  setSessionCaptureSelections,
  completeSessionCaptureImport,
  setSessionCaptureDialogOpen,
  setPendingSessionCaptureData,
  setPendingSessionCaptureFileName,
  clientProfileDraft,
  updateClientProfileDraftField,
  saveClientProfileDraft,
  setClientProfileDraft,
  coachThinkingDraft,
  updateCoachThinkingField,
  saveCoachThinkingDraft,
  setCoachThinkingDraft,
  emotionalPatternModalOpen,
  emotionalPatternDraft,
  updateEmotionalPatternDraft,
  saveAddEmotionalPattern,
  setEmotionalPatternModalOpen,
  setEmotionalPatternDraft,
  settingsOpen,
  setSettingsOpen,
  eventCategories,
  settingsDraft,
  setSettingsDraft,
  setEventCategories,
  relationshipTypeSettingsOpen,
  setRelationshipTypeSettingsOpen,
  sortedRelationshipTypes,
  relationshipTypeDraft,
  setRelationshipTypeDraft,
  setRelationshipTypes,
  relationshipTypes,
  relationshipStatusSettingsOpen,
  setRelationshipStatusSettingsOpen,
  sortedRelationshipStatuses,
  relationshipStatusDraft,
  setRelationshipStatusDraft,
  setRelationshipStatuses,
  relationshipStatuses,
  indicatorSettingsOpen,
  setIndicatorSettingsOpen,
  functionalIndicatorDefinitions,
  indicatorDraftLabel,
  setIndicatorDraftLabel,
  addFunctionalIndicatorDefinition,
  addFunctionalIndicatorDefinitionForGroup,
  onSaveIndicatorsAsDefault,
  updateFunctionalIndicatorLabel,
  updateFunctionalIndicatorGroup,
  updateFunctionalIndicatorColor,
  updateFunctionalIndicatorIcon,
  updateFunctionalIndicatorUseLetter,
  clearFunctionalIndicatorIcon,
  removeFunctionalIndicatorDefinition,
  people,
  partnerships,
  allEmotionalLines,
  timelineSelectionIds,
  handleUpdatePerson,
  handleUpdatePartnership,
  handleUpdateEmotionalLine,
  setTimelineSelectionIds,
  sessionNotesOpen,
  setSessionNotesOpen,
  sessionNoteCoachName,
  sessionNoteClientName,
  sessionNoteFileName,
  sessionNoteIssue,
  sessionNoteContent,
  sessionNoteStartedAt,
  sessionAutosaveInfo,
  sessionTargetOptions,
  sessionNotesTarget,
  fileName,
  sessionFocusPersonName,
  sessionSaveLocationLabel,
  sessionOpenCandidates,
  sessionOpenCandidateId,
  handleSessionFieldChange,
  handleSessionNotesTargetChange,
  handleSessionNotesNew,
  handleSessionOpenCandidateChange,
  handleSessionOpenNote,
  handleSessionSave,
  handleSessionSaveAs,
  handleSessionChooseLocation,
  handleSaveSessionNoteJson,
  handleSaveSessionNoteMarkdown,
  handleSessionNotesMakeEvent,
  selectedRibbonHelp,
  selectedRibbonHelpBody,
  setRibbonHelpKey,
  helpOpen,
  setHelpOpen,
  handleStartDemoTour,
  handleStartBuildDemo,
  setReadmeViewerOpen,
  setTrainingVideosOpen,
  trainingVideosOpen,
  trainingVideos,
  selectedTrainingVideoId,
  setSelectedTrainingVideoId,
  demoTourOpen,
  demoTourSteps,
  demoTourStepIndex,
  handleCloseDemoTour,
  setDemoTourStepIndex,
  buildDemoOpen,
  buildDemoSteps,
  buildDemoStepIndex,
  handleCloseBuildDemo,
  handleBuildDemoStepChange,
  readmeViewerOpen,
  sessionEventDraft,
  sessionEventTarget,
  getEventClassForTargetType,
  sessionEventPrimaryOptions,
  sessionEventOtherOptions,
  handleSessionEventDraftChange,
  closeSessionEventModal,
  commitSessionEventFromNotes,
  ideasOpen,
  ideasText,
  setIdeasText,
  setIdeasOpen,
}: DiagramModalsProps) {
  return (
    <>
      <ImportModeDialog
        open={importModeDialogOpen && !!pendingImportData}
        source={pendingImportSource}
        fileName={pendingImportFileName}
        onReplace={() => completePendingImport('replace')}
        onMerge={() => completePendingImport('merge')}
        onCancel={() => { setImportModeDialogOpen(false); setPendingImportData(null); setPendingImportFileName(''); }}
      />
      <SessionCaptureDialog
        open={sessionCaptureDialogOpen && !!pendingSessionCaptureData}
        data={pendingSessionCaptureData}
        fileName={pendingSessionCaptureFileName}
        selections={sessionCaptureSelections}
        onSelectAll={() =>
          setSessionCaptureSelections(
            Object.fromEntries(
              (pendingSessionCaptureData?.operations ?? []).map((op) => [op.id, true])
            )
          )
        }
        onClearAll={() =>
          setSessionCaptureSelections(
            Object.fromEntries(
              (pendingSessionCaptureData?.operations ?? []).map((op) => [op.id, false])
            )
          )
        }
        onToggleSelection={(id, checked) =>
          setSessionCaptureSelections((prev) => ({ ...prev, [id]: checked }))
        }
        onApply={completeSessionCaptureImport}
        onCancel={() => {
          setSessionCaptureDialogOpen(false);
          setPendingSessionCaptureData(null);
          setPendingSessionCaptureFileName('');
          setSessionCaptureSelections({});
        }}
      />
      <ClientProfileModal
        draft={clientProfileDraft}
        onFieldChange={updateClientProfileDraftField}
        onCancel={() => setClientProfileDraft(null)}
        onSave={saveClientProfileDraft}
      />
      <CoachThinkingModal
        draft={coachThinkingDraft}
        onFieldChange={updateCoachThinkingField}
        onCancel={() => setCoachThinkingDraft(null)}
        onSave={saveCoachThinkingDraft}
      />
      <EmotionalPatternModal
        open={emotionalPatternModalOpen}
        draft={emotionalPatternDraft}
        onUpdate={updateEmotionalPatternDraft}
        onCancel={() => { setEmotionalPatternModalOpen(false); setEmotionalPatternDraft(null); }}
        onSave={saveAddEmotionalPattern}
      />
      <SettingsListModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Event Categories"
        description="Default categories are shipped with the app. You can add categories, but categories cannot be deleted."
        zIndex={2000}
        items={eventCategories}
        draft={settingsDraft}
        draftPlaceholder="Add category"
        onDraftChange={setSettingsDraft}
        onAdd={() => {
          const trimmed = settingsDraft.trim();
          if (!trimmed) return;
          if (!eventCategories.includes(trimmed)) {
            setEventCategories([...eventCategories, trimmed]);
          }
          setSettingsDraft('');
        }}
      />
      <SettingsListModal
        open={relationshipTypeSettingsOpen}
        onClose={() => setRelationshipTypeSettingsOpen(false)}
        title="Relationship Categories"
        description="Add partnership relationship categories used in the Properties panel. Existing categories cannot be deleted here."
        zIndex={2020}
        items={sortedRelationshipTypes}
        draft={relationshipTypeDraft}
        draftPlaceholder="Add relationship category"
        onDraftChange={setRelationshipTypeDraft}
        onAdd={() => {
          const trimmed = relationshipTypeDraft.trim();
          if (!trimmed) return;
          if (!relationshipTypes.includes(trimmed)) {
            setRelationshipTypes(sortLabelsAZ([...relationshipTypes, trimmed]));
          }
          setRelationshipTypeDraft('');
        }}
        onDelete={(item) => setRelationshipTypes((prev) => prev.filter((entry) => entry !== item))}
        formatItem={(item) => item.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}
      />
      <SettingsListModal
        open={relationshipStatusSettingsOpen}
        onClose={() => setRelationshipStatusSettingsOpen(false)}
        title="Relationship Statuses"
        description="Add partnership relationship statuses used in the Properties panel. Existing statuses cannot be deleted here."
        zIndex={2030}
        items={sortedRelationshipStatuses}
        draft={relationshipStatusDraft}
        draftPlaceholder="Add relationship status"
        onDraftChange={setRelationshipStatusDraft}
        onAdd={() => {
          const trimmed = relationshipStatusDraft.trim();
          if (!trimmed) return;
          if (!relationshipStatuses.includes(trimmed)) {
            setRelationshipStatuses(sortLabelsAZ([...relationshipStatuses, trimmed]));
          }
          setRelationshipStatusDraft('');
        }}
        onDelete={(item) => setRelationshipStatuses((prev) => prev.filter((entry) => entry !== item))}
        formatItem={(item) => item.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}
      />
      <IndicatorSettingsModal
        open={indicatorSettingsOpen}
        onClose={() => setIndicatorSettingsOpen(false)}
        definitions={functionalIndicatorDefinitions}
        draftLabel={indicatorDraftLabel}
        onDraftLabelChange={setIndicatorDraftLabel}
        onAdd={addFunctionalIndicatorDefinition}
        onAddForGroup={addFunctionalIndicatorDefinitionForGroup}
        onSaveAsDefault={onSaveIndicatorsAsDefault}
        onUpdateLabel={updateFunctionalIndicatorLabel}
        onUpdateGroup={updateFunctionalIndicatorGroup}
        onUpdateColor={updateFunctionalIndicatorColor}
        onUpdateIcon={updateFunctionalIndicatorIcon}
        onUpdateUseLetter={updateFunctionalIndicatorUseLetter}
        onClearIcon={clearFunctionalIndicatorIcon}
        onRemove={removeFunctionalIndicatorDefinition}
      />
      <TimelineBoardModal
        people={people}
        partnerships={partnerships}
        allEmotionalLines={allEmotionalLines}
        eventCategories={eventCategories}
        timelineSelectionIds={timelineSelectionIds}
        onUpdatePerson={handleUpdatePerson}
        onUpdatePartnership={handleUpdatePartnership}
        onUpdateEmotionalLine={handleUpdateEmotionalLine}
        onClose={() => setTimelineSelectionIds([])}
      />
      <SessionNotesPanel
        isOpen={sessionNotesOpen}
        coachName={sessionNoteCoachName}
        clientName={sessionNoteClientName}
        noteFileName={sessionNoteFileName}
        presentingIssue={sessionNoteIssue}
        noteContent={sessionNoteContent}
        startedAt={sessionNoteStartedAt}
        autosaveInfo={sessionAutosaveInfo}
        targetOptions={sessionTargetOptions}
        selectedTarget={sessionNotesTarget}
        diagramFileName={fileName}
        focusPersonName={sessionFocusPersonName}
        locationLabel={sessionSaveLocationLabel}
        openCandidates={sessionOpenCandidates}
        selectedOpenCandidateId={sessionOpenCandidateId}
        onClose={() => setSessionNotesOpen(false)}
        onFieldChange={handleSessionFieldChange}
        onTargetChange={handleSessionNotesTargetChange}
        onNewNote={handleSessionNotesNew}
        onOpenCandidateChange={handleSessionOpenCandidateChange}
        onOpenNote={handleSessionOpenNote}
        onSaveNote={handleSessionSave}
        onSaveAsNote={handleSessionSaveAs}
        onChooseLocation={handleSessionChooseLocation}
        onSaveJson={handleSaveSessionNoteJson}
        onSaveMarkdown={handleSaveSessionNoteMarkdown}
        onMakeEvent={handleSessionNotesMakeEvent}
      />
      <RibbonHelpModal
        open={!!selectedRibbonHelp}
        title={selectedRibbonHelp?.title ?? ''}
        body={selectedRibbonHelpBody}
        onClose={() => setRibbonHelpKey(null)}
      />
      <HelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onStartDemoTour={handleStartDemoTour}
        onStartBuildDemo={handleStartBuildDemo}
        onOpenReadmeViewer={() => setReadmeViewerOpen(true)}
        onOpenTrainingVideos={() => setTrainingVideosOpen(true)}
      />
      <TrainingVideosModal
        open={trainingVideosOpen}
        onClose={() => setTrainingVideosOpen(false)}
        videos={trainingVideos}
        selectedVideoId={selectedTrainingVideoId}
        onSelectVideo={setSelectedTrainingVideoId}
      />
      <DemoTourModal
        open={demoTourOpen}
        steps={demoTourSteps}
        stepIndex={demoTourStepIndex}
        onClose={handleCloseDemoTour}
        onStepChange={setDemoTourStepIndex}
      />
      <BuildDemoModal
        open={buildDemoOpen}
        steps={buildDemoSteps}
        stepIndex={buildDemoStepIndex}
        onClose={handleCloseBuildDemo}
        onStepChange={handleBuildDemoStepChange}
      />
      <ReadmeViewerModal
        open={readmeViewerOpen}
        onClose={() => setReadmeViewerOpen(false)}
        content={readmeContent}
      />
      <SessionEventModal
        open={!!sessionEventDraft && !!sessionEventTarget}
        draft={sessionEventDraft}
        eventClass={sessionEventTarget ? getEventClassForTargetType(sessionEventTarget.type) : 'person-event'}
        primaryOptions={sessionEventPrimaryOptions}
        otherOptions={sessionEventOtherOptions}
        eventCategories={eventCategories}
        onFieldChange={handleSessionEventDraftChange}
        onCancel={closeSessionEventModal}
        onSave={commitSessionEventFromNotes}
      />
      <IdeasPanel
        isOpen={ideasOpen}
        ideasText={ideasText}
        onChange={setIdeasText}
        onClose={() => setIdeasOpen(false)}
      />
    </>
  );
}
