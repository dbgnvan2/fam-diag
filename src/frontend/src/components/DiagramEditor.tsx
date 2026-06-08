import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type {
  Person,
  Partnership,
  EmotionalLine,
  Triangle,
  FunctionalIndicatorDefinition,
  PredictionSet,
  SIRCategoryDefinition,
  FunctionalFactCategoryDefinition,
  NodalCategoryDefinition,
  EmotionalProcessEvent,
  EventType,
  BirthSex,
  GenderIdentity,
  SymptomGroup,
  PageNote,
} from '../types';
import type { ExtractedDiagramData } from '../types/imageAnalysis';
import type { PersonInventoryItem } from '../utils/personInventory';
import { nanoid } from 'nanoid';
import { EVENT_TYPE_LABELS } from '../constants/eventConstants';
import BackupRestoreDialog from './modals/BackupRestoreDialog';
import AppRibbon from './AppRibbon';
import VoiceInputModal from './modals/VoiceInputModal';
import { Stage as StageType } from 'konva/lib/Stage';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAutosave } from '../hooks/useAutosave';
import { useIndicatorHandlers } from '../hooks/useIndicatorHandlers';
import { useSessionNoteHandlers } from '../hooks/useSessionNoteHandlers';
import { usePersonOperations } from '../hooks/usePersonOperations';
import { useContextMenuHandlers } from '../hooks/useContextMenuHandlers';
import { useSelectionHandlers } from '../hooks/useSelectionHandlers';
import { useCanvasDragHandlers } from '../hooks/useCanvasDragHandlers';
import { useFileOperations } from '../hooks/useFileOperations';
import { useVoiceHandlers } from '../hooks/useVoiceHandlers';
import { useEmotionalLineOperations } from '../hooks/useEmotionalLineOperations';
import { useUpdateHandlers } from '../hooks/useUpdateHandlers';
import { usePredictionHandlers } from '../hooks/usePredictionHandlers';
import DiagramModals from './DiagramModals';
import PredictionsPanel from './PredictionsPanel';
import DiagramCanvas from './DiagramCanvas';
import EventModal from './EventModal';
import FileBackupListDialog from './modals/FileBackupListDialog';
import type { FileBackupEntry } from './modals/FileBackupListDialog';
import { removeOrphanedMiscarriages } from '../utils/dataCleanup';
import { testApiConnection } from '../utils/testApiConnection';
import { lookupModel } from '../utils/lookupModel';
import { ImportLog } from '../utils/importLog';
import { runGenogramPipeline } from '../utils/genogram/pipeline';
import {
  convertExtractedToDiagram,
  applyNotesPositions,
} from '../utils/extractedDataToDiagram';
import {
  autoLayoutExtractedDiagram,
  applyHorizontalConnectorY,
} from '../utils/diagramLayout';
import {
  DEFAULT_DIAGRAM_STATE,
  FALLBACK_FILE_NAME,
} from '../data/defaultDiagramState';
import {
  RIBBON_HELP,
  type RibbonHelpKey,
} from '../data/helpContent';
import {
  buildTimelineJson,
  isPersonEventBundle,
  isTimelineJson,
  mergePersonEventsFromBundle,
  timelineJsonToBundle,
} from '../utils/personEventBundle';
import {
  type VoiceCommandOperation,
} from '../utils/voiceCommands';
import {
  normalizeEmotionalLines,
  normalizeTriangles,
} from '../utils/emotionalLineNormalization';
import {
  getStoredValue,
  setStoredValue,
  parseStoredUserSettings,
  parseStoredArraySetting,
  parseStoredIndicatorDefinitions,
  persistDiagramFileHandle,
  restoreDiagramFileHandle,
  rotateDiagramBackups,
  persistBackupDirectoryHandle,
  restoreBackupDirectoryHandle,
  writeFileBackup,
  listFileBackups,
} from '../utils/storage';
import type { BackupVersions } from '../utils/storage';
import {
  sanitizePeopleIndicators,
  parseIsoDateToTimestamp,
  attachEventClassToEntities,
  attachFamilyEventsToPartnerships,
  inferGenderFromName,
  normalizeImportedChildLayout,
} from '../utils/dataNormalization';
import {
  DEMO_DIAGRAM_DATA,
  buildDemoTourStepsFromNotes,
  DEFAULT_DEMO_TOUR_STEPS,
  buildCreationDemoSnapshots,
  buildBuildDemoStepsFromNotes,
} from '../utils/demoTour';
import type {
  StoredUserSettings,
  SessionNoteFileRecord,
  TimelineEntry,
  PropertiesPanelIntent,
  PersonSectionPopupState,
  PartnershipSectionPopupState,
  EmotionalPatternDraft,
  ClientProfileDraft,
  CoachThinkingDraft,
  AddFamilyDraft,
  DemoTourStep,
  DiagramImportData,
  SessionCaptureImportData,
  SessionCaptureOperation,
} from '../types/diagramEditor';

const initialPeople: Person[] = DEFAULT_DIAGRAM_STATE.people;
const initialPartnerships: Partnership[] = attachFamilyEventsToPartnerships(DEFAULT_DIAGRAM_STATE.partnerships);
const initialEmotionalLines: EmotionalLine[] = DEFAULT_DIAGRAM_STATE.emotionalLines;
const initialPageNotes: PageNote[] = DEFAULT_DIAGRAM_STATE.pageNotes;
const initialTriangles: Triangle[] = DEFAULT_DIAGRAM_STATE.triangles;
const initialEventCategories: string[] = DEFAULT_DIAGRAM_STATE.eventCategories;
const initialRelationshipTypes: string[] = DEFAULT_DIAGRAM_STATE.relationshipTypes;
const initialRelationshipStatuses: string[] = DEFAULT_DIAGRAM_STATE.relationshipStatuses;
const initialIndicatorDefinitions: FunctionalIndicatorDefinition[] =
  DEFAULT_DIAGRAM_STATE.functionalIndicatorDefinitions;
const initialSirCategories: SIRCategoryDefinition[] =
  DEFAULT_DIAGRAM_STATE.sirCategories;
const initialFunctionalFactCategories: FunctionalFactCategoryDefinition[] =
  DEFAULT_DIAGRAM_STATE.functionalFactCategories;
const initialNodalCategories: NodalCategoryDefinition[] =
  DEFAULT_DIAGRAM_STATE.nodalCategories;
const initialAutoSaveMinutes = DEFAULT_DIAGRAM_STATE.autoSaveMinutes;
const initialFileName = DEFAULT_DIAGRAM_STATE.fileName;

/** Read diagram data from localStorage for initial mount — matches state initializer logic. */
const readLocalStorageDiagramSnapshot = () => {
  if (typeof window === 'undefined') {
    return { people: initialPeople, partnerships: initialPartnerships, emotionalLines: initialEmotionalLines, pageNotes: initialPageNotes, triangles: initialTriangles };
  }
  const tryParse = <T,>(key: Parameters<typeof getStoredValue>[0], fallback: T): T => {
    const raw = getStoredValue(key);
    if (!raw) return fallback;
    try { const p = JSON.parse(raw); return Array.isArray(p) ? (p as T) : fallback; } catch { return fallback; }
  };
  return {
    people: tryParse<Person[]>('people', initialPeople),
    partnerships: attachFamilyEventsToPartnerships(tryParse<Partnership[]>('partnerships', initialPartnerships)),
    emotionalLines: tryParse<EmotionalLine[]>('emotionalLines', initialEmotionalLines),
    pageNotes: tryParse<PageNote[]>('pageNotes', initialPageNotes),
    triangles: tryParse<Triangle[]>('triangles', initialTriangles),
  };
};
const DIAGRAM_FILE_PICKER_TYPES = [
  {
    description: 'Family Diagram JSON',
    accept: {
      'application/json': ['.json'],
    },
  },
];

// Replace these URLs with your own training library as videos are produced.
const TRAINING_VIDEOS = [
  {
    id: 'intro',
    title: 'Getting Started',
    duration: '6 min',
    topic: 'Canvas basics, file workflow, and object editing',
    embedUrl: 'https://www.youtube-nocookie.com/embed/xnS1R7d0poU',
    url: 'https://www.youtube.com/watch?v=xnS1R7d0poU',
  },
  {
    id: 'settings-events-timelines',
    title: 'Help on Settings, Events, and Timelines',
    duration: '10 min',
    topic: 'Configure settings, manage events, and work with timeline boards',
    embedUrl: 'https://www.youtube-nocookie.com/embed/tdJxqJF95YQ',
    url: 'https://youtu.be/tdJxqJF95YQ',
  },
  {
    id: 'family-systems-overview',
    title: 'Family Systems Overview',
    duration: 'Video',
    topic: 'Additional training video',
    embedUrl: 'https://www.youtube-nocookie.com/embed/T7EsqTwpukc',
    url: 'https://www.youtube.com/watch?v=T7EsqTwpukc',
  },
];


const DiagramEditor = () => {
  const defaultSymptomColorByGroup: Record<SymptomGroup, string> = {
    physical: '#1f77b4',
    emotional: '#d81b60',
    social: '#2e7d32',
  };
  const [people, setPeople] = useState<Person[]>(() => {
    if (typeof window === 'undefined') return initialPeople;
    const stored = getStoredValue('people');
    if (stored) {
      try { const parsed = JSON.parse(stored); if (Array.isArray(parsed) && parsed.length > 0) return parsed; } catch { /* ignore */ }
    }
    return initialPeople;
  });
  const [partnerships, setPartnerships] = useState<Partnership[]>(() => {
    if (typeof window === 'undefined') return initialPartnerships;
    const stored = getStoredValue('partnerships');
    if (stored) {
      try { const parsed = JSON.parse(stored); if (Array.isArray(parsed) && parsed.length > 0) return attachFamilyEventsToPartnerships(parsed); } catch { /* ignore */ }
    }
    return initialPartnerships;
  });
  const [emotionalLines, setEmotionalLines] = useState<EmotionalLine[]>(() => {
    if (typeof window === 'undefined') return initialEmotionalLines;
    const stored = getStoredValue('emotionalLines');
    if (stored) {
      try { const parsed = JSON.parse(stored); if (Array.isArray(parsed)) return parsed; } catch { /* ignore */ }
    }
    return initialEmotionalLines;
  });
  const [pageNotes, setPageNotes] = useState<PageNote[]>(() => {
    if (typeof window === 'undefined') return initialPageNotes;
    const stored = getStoredValue('pageNotes');
    if (stored) {
      try { const parsed = JSON.parse(stored); if (Array.isArray(parsed)) return parsed; } catch { /* ignore */ }
    }
    return initialPageNotes;
  });
  const [triangles, setTriangles] = useState<Triangle[]>(() => {
    if (typeof window === 'undefined') return initialTriangles;
    const stored = getStoredValue('triangles');
    if (stored) {
      try { const parsed = JSON.parse(stored); if (Array.isArray(parsed)) return parsed; } catch { /* ignore */ }
    }
    return initialTriangles;
  });
  const [fileName, setFileName] = useState(() => {
    if (typeof window === 'undefined') return initialFileName;
    const stored = getStoredValue('fileName');
    return stored && stored.trim().length > 0 ? stored.trim() : initialFileName;
  });
  const [autoSaveMinutes, setAutoSaveMinutes] = useState(() => {
    if (typeof window === 'undefined') return initialAutoSaveMinutes;
    const storedSettings = parseStoredUserSettings();
    if (
      typeof storedSettings?.autoSaveMinutes === 'number' &&
      Number.isFinite(storedSettings.autoSaveMinutes) &&
      storedSettings.autoSaveMinutes > 0
    ) {
      return storedSettings.autoSaveMinutes;
    }
    const stored = getStoredValue('autoSave');
    const parsed = stored ? Number(stored) : initialAutoSaveMinutes;
    return !Number.isFinite(parsed) || parsed <= 0 ? initialAutoSaveMinutes : parsed;
  });
  const [backupCount, setBackupCount] = useState(() => {
    if (typeof window === 'undefined') return 3;
    const storedSettings = parseStoredUserSettings();
    if (typeof storedSettings?.backupCount === 'number' && storedSettings.backupCount >= 1) {
      return Math.min(storedSettings.backupCount, 20);
    }
    return 3;
  });
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([]);
  const [selectedPartnershipId, setSelectedPartnershipId] = useState<string | null>(null);
  const [selectedEmotionalLineId, setSelectedEmotionalLineId] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: any[] } | null>(null);
  const [emotionalPatternModalOpen, setEmotionalPatternModalOpen] = useState(false);
  const [emotionalPatternDraft, setEmotionalPatternDraft] = useState<EmotionalPatternDraft | null>(null);
  const [clientProfileDraft, setClientProfileDraft] = useState<ClientProfileDraft | null>(null);
  const [coachThinkingDraft, setCoachThinkingDraft] = useState<CoachThinkingDraft | null>(null);
  const [propertiesPanelItem, setPropertiesPanelItem] = useState<Person | Partnership | EmotionalLine | null>(null);
  const [propertiesPanelIntent, setPropertiesPanelIntent] = useState<PropertiesPanelIntent>(null);
  const [personSectionPopup, setPersonSectionPopup] = useState<PersonSectionPopupState>(null);
  const [partnershipSectionPopup, setPartnershipSectionPopup] = useState<PartnershipSectionPopupState>(null);
  const [trianglePropertyModal, setTrianglePropertyModal] = useState<{
    triangleId: string;
    draft: EmotionalProcessEvent;
    position: { x: number; y: number };
    modalTitle?: string;
  } | null>(null);
  const [selectedFamilyIds, setSelectedFamilyIds] = useState<string[]>([]);
  // Convenience: the "active" single family (used by the Family Properties
  // panel which only shows a single family at a time). null when multi-select
  // or no selection.
  const selectedFamilyId = selectedFamilyIds.length === 1 ? selectedFamilyIds[0] : null;
  const setSelectedFamilyId = (
    next: string | null | ((prev: string | null) => string | null),
  ) =>
    setSelectedFamilyIds((prev) => {
      const prevSingle = prev.length === 1 ? prev[0] : null;
      const resolved = typeof next === 'function' ? next(prevSingle) : next;
      return resolved ? [resolved] : [];
    });
  const [familyPropertyModal, setFamilyPropertyModal] = useState<{
    partnershipId: string;
    draft: EmotionalProcessEvent;
    position: { x: number; y: number };
    editingEventId?: string;
    modalTitle?: string;
  } | null>(null);
  const [eventCategories, setEventCategories] = useState<string[]>(() => {
    if (typeof window === 'undefined') return initialEventCategories;
    const stored = parseStoredUserSettings();
    return Array.isArray(stored?.eventCategories) && stored.eventCategories.length
      ? stored.eventCategories
      : parseStoredArraySetting('eventCategories') || initialEventCategories;
  });
  const [relationshipTypes, setRelationshipTypes] = useState<string[]>(() => {
    if (typeof window === 'undefined') return initialRelationshipTypes;
    const stored = parseStoredUserSettings();
    return Array.isArray(stored?.relationshipTypes) && stored.relationshipTypes.length
      ? stored.relationshipTypes
      : parseStoredArraySetting('relationshipTypes') || initialRelationshipTypes;
  });
  const [relationshipStatuses, setRelationshipStatuses] = useState<string[]>(() => {
    if (typeof window === 'undefined') return initialRelationshipStatuses;
    const stored = parseStoredUserSettings();
    return Array.isArray(stored?.relationshipStatuses) && stored.relationshipStatuses.length
      ? stored.relationshipStatuses
      : parseStoredArraySetting('relationshipStatuses') || initialRelationshipStatuses;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState('');
  const [relationshipTypeSettingsOpen, setRelationshipTypeSettingsOpen] = useState(false);
  const [relationshipTypeDraft, setRelationshipTypeDraft] = useState('');
  const [relationshipStatusSettingsOpen, setRelationshipStatusSettingsOpen] = useState(false);
  const [relationshipStatusDraft, setRelationshipStatusDraft] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [predictionsOpen, setPredictionsOpen] = useState(false);
  const [imageDiagramModalOpen, setImageDiagramModalOpen] = useState(false);
  const [imageDiagramAnalyzing, setImageDiagramAnalyzing] = useState(false);
  const [imageDiagramProgress, setImageDiagramProgress] = useState<string>('');
  const [extractedDiagramData, setExtractedDiagramData] = useState<ExtractedDiagramData | null>(null);
  const [personInventory, setPersonInventory] = useState<PersonInventoryItem[]>([]);
  const [predictionSets, setPredictionSets] = useState<PredictionSet[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_DIAGRAM_STATE.predictionSets;
    const stored = getStoredValue('predictions');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Migrate old flat Prediction[] → PredictionSet[] (pre-refactor data)
          if (parsed.length > 0 && !('predictions' in parsed[0]) && 'conditions' in parsed[0]) {
            return [{ id: nanoid(), name: 'Migrated Predictions', createdDate: new Date().toISOString().slice(0, 10), predictions: parsed }];
          }
          return parsed;
        }
      } catch { /* ignore */ }
    }
    return DEFAULT_DIAGRAM_STATE.predictionSets;
  });
  const [ideasText, setIdeasText] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_DIAGRAM_STATE.ideasText;
    const stored = getStoredValue('ideas');
    return stored ?? DEFAULT_DIAGRAM_STATE.ideasText;
  });
  const [lastDirtyTimestamp, setLastDirtyTimestamp] = useState<number | null>(null);
  const [, setLastSavedAt] = useState<number | null>(null);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [functionalIndicatorDefinitions, setFunctionalIndicatorDefinitions] =
    useState<FunctionalIndicatorDefinition[]>(() => {
      if (typeof window === 'undefined') return initialIndicatorDefinitions;
      const stored = parseStoredUserSettings();
      return Array.isArray(stored?.functionalIndicatorDefinitions) &&
        stored.functionalIndicatorDefinitions.length
        ? stored.functionalIndicatorDefinitions
        : parseStoredIndicatorDefinitions() || initialIndicatorDefinitions;
    });
  const [sirCategories, setSirCategories] = useState<SIRCategoryDefinition[]>(() => {
    if (typeof window === 'undefined') return initialSirCategories;
    const stored = parseStoredUserSettings();
    return Array.isArray(stored?.sirCategories) && stored.sirCategories.length
      ? stored.sirCategories as SIRCategoryDefinition[]
      : initialSirCategories;
  });
  const [functionalFactCategories, setFunctionalFactCategories] = useState<FunctionalFactCategoryDefinition[]>(() => {
    if (typeof window === 'undefined') return initialFunctionalFactCategories;
    const stored = parseStoredUserSettings();
    return Array.isArray(stored?.functionalFactCategories)
      ? stored.functionalFactCategories as FunctionalFactCategoryDefinition[]
      : initialFunctionalFactCategories;
  });
  const [nodalCategories, setNodalCategories] = useState<NodalCategoryDefinition[]>(() => {
    if (typeof window === 'undefined') return initialNodalCategories;
    const stored = parseStoredUserSettings();
    return Array.isArray(stored?.nodalCategories)
      ? stored.nodalCategories as NodalCategoryDefinition[]
      : initialNodalCategories;
  });
  const [ffSettingsOpen, setFfSettingsOpen] = useState(false);
  const [nodalSettingsOpen, setNodalSettingsOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [aiSettingsAnthropicApiKey, setAiSettingsAnthropicApiKey] = useState<string>(
    () => localStorage.getItem('anthropic_api_key') || ''
  );
  const [aiSettingsDeepseekApiKey, setAiSettingsDeepseekApiKey] = useState<string>(
    () => localStorage.getItem('deepseek_api_key') || ''
  );
  const [aiSettingsModelId, setAiSettingsModelId] = useState<string>(
    () =>
      localStorage.getItem('selected_model_id') ||
      localStorage.getItem('anthropic_model') ||
      'claude-sonnet-4-6'
  );
  const [sirSettingsOpen, setSirSettingsOpen] = useState(false);
  const [indicatorSettingsOpen, setIndicatorSettingsOpen] = useState(false);
  const [indicatorDraftLabel, setIndicatorDraftLabel] = useState('');
  const [timelineYear, setTimelineYear] = useState<number | null>(new Date().getFullYear());
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [timelineSelectionIds, setTimelineSelectionIds] = useState<string[]>([]);
  // Partnership/Family ids to show as Family lanes on the timeline (separate
  // from person selection so user can choose person-only, family-only, or both).
  const [timelineFamilySelectionIds, setTimelineFamilySelectionIds] = useState<string[]>([]);

  const [notesLayerEnabled, setNotesLayerEnabled] = useState(true);
  const [showSiblingConflicts, setShowSiblingConflicts] = useState(false);
  const [hoveredPersonId, setHoveredPersonId] = useState<string | null>(null);
  const [sessionNotesOpen, setSessionNotesOpen] = useState(false);
  const [sessionNoteCoachName, setSessionNoteCoachName] = useState('');
  const [sessionNoteClientName, setSessionNoteClientName] = useState('');
  const [sessionNoteFileName, setSessionNoteFileName] = useState('session-note.json');
  const [sessionNoteIssue, setSessionNoteIssue] = useState('');
  const [sessionNoteContent, setSessionNoteContent] = useState('');
  const [sessionNoteStartedAt, setSessionNoteStartedAt] = useState<number | null>(null);
  const [sessionNoteRecordId, setSessionNoteRecordId] = useState<string | null>(null);
  const [sessionSaveLocationLabel, setSessionSaveLocationLabel] = useState('Browser Downloads');
  const [sessionOpenCandidateId, setSessionOpenCandidateId] = useState<string | null>(null);
  const [sessionAutosaveInfo, setSessionAutosaveInfo] = useState<{ primary?: string | null; backup?: string | null }>({ primary: null, backup: null });
  const [sessionNotesTarget, setSessionNotesTarget] = useState<string | null>(null);
  const [sessionEventDraft, setSessionEventDraft] = useState<EmotionalProcessEvent | null>(null);
  const [sessionEventTarget, setSessionEventTarget] = useState<{ type: 'person' | 'partnership' | 'emotional'; id: string } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [ribbonHelpKey, setRibbonHelpKey] = useState<RibbonHelpKey | null>(null);
  const [readmeViewerOpen, setReadmeViewerOpen] = useState(false);
  const [trainingVideosOpen, setTrainingVideosOpen] = useState(false);
  const [selectedTrainingVideoId, setSelectedTrainingVideoId] = useState(
    TRAINING_VIDEOS[0]?.id || ''
  );
  const [demoTourOpen, setDemoTourOpen] = useState(false);
  const [demoTourStepIndex, setDemoTourStepIndex] = useState(0);
  const [demoBlinkVisible, setDemoBlinkVisible] = useState(true);
  const [buildDemoOpen, setBuildDemoOpen] = useState(false);
  const [buildDemoStepIndex, setBuildDemoStepIndex] = useState(0);
  const [voiceInputOpen, setVoiceInputOpen] = useState(false);
  const [voiceCommandText, setVoiceCommandText] = useState('');
  const [voiceCommandOperations, setVoiceCommandOperations] = useState<VoiceCommandOperation[]>([]);
  const [voiceCommandErrors, setVoiceCommandErrors] = useState<string[]>([]);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceStatusMessage, setVoiceStatusMessage] = useState('');
  const [selectedPageNoteId, setSelectedPageNoteId] = useState<string | null>(null);
  const [selectedPageNoteIds, setSelectedPageNoteIds] = useState<string[]>([]);
  const [pageNoteDraft, setPageNoteDraft] = useState<{
    title: string;
    text: string;
    fillColor: string;
  } | null>(null);
  const [importModeDialogOpen, setImportModeDialogOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<DiagramImportData | null>(null);
  const [pendingImportFileName, setPendingImportFileName] = useState('');
  const [pendingImportSource, setPendingImportSource] = useState<'import' | 'transcript' | 'facts'>('import');
  const [backupRestoreOpen, setBackupRestoreOpen] = useState(false);
  const [backupRestoreVersions, setBackupRestoreVersions] = useState<BackupVersions | null>(null);
  const [fileBackupListOpen, setFileBackupListOpen] = useState(false);
  const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false);
  const [importLogOpen, setImportLogOpen] = useState(false);
  const [importLogText, setImportLogText] = useState('');
  const [importLogFilename, setImportLogFilename] = useState('image-import-log.txt');
  const saveAsOnConfirmRef = useRef<((name: string) => void) | null>(null);
  const [fileBackupEntries, setFileBackupEntries] = useState<FileBackupEntry[]>([]);
  const [pendingReopenHandle, setPendingReopenHandle] = useState<any>(null);
  const [pendingReopenName, setPendingReopenName] = useState<string>('');
  const fileBackupHandlesRef = useRef<Map<number, FileSystemFileHandle>>(new Map());
  const scrollHintShownRef = useRef(false);
  const [canvasScrollHintOpen, setCanvasScrollHintOpen] = useState(false);
  const [sessionCaptureDialogOpen, setSessionCaptureDialogOpen] = useState(false);
  const [pendingSessionCaptureData, setPendingSessionCaptureData] = useState<SessionCaptureImportData | null>(null);
  const [pendingSessionCaptureFileName, setPendingSessionCaptureFileName] = useState('');
  const [sessionCaptureSelections, setSessionCaptureSelections] = useState<Record<string, boolean>>({});
  const stageRef = useRef<StageType>(null);
  const ribbonRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const DEFAULT_PANEL_WIDTH = 425;
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [ribbonHeight, setRibbonHeight] = useState(180);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [spacePanActive, setSpacePanActive] = useState(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const [marqueeSelection, setMarqueeSelection] = useState<{
    active: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const marqueeDidDragRef = useRef(false);
  const suppressStageClickRef = useRef(false);
  const groupResizeStateRef = useRef<{
    selectionIds: string[];
    bounds: { x: number; y: number; width: number; height: number };
    people: Map<string, { x: number; y: number; notesPosition?: { x: number; y: number } }>;
    partnerships: Map<string, { horizontalConnectorY: number; notesPosition?: { x: number; y: number } }>;
    emotionalLines: Map<string, { notesPosition?: { x: number; y: number } }>;
  } | null>(null);
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const dragGroupRef = useRef<{
    personId: string;
    startX: number;
    startY: number;
    selectedIds: string[];
    people: Map<string, { x: number; y: number; notesPosition?: { x: number; y: number } }>;
    partnerships: Map<string, { horizontalConnectorY: number; notesPosition?: { x: number; y: number } }>;
    emotionalLines: Map<string, { notesPosition?: { x: number; y: number } }>;
    pageNotes: Map<string, { x: number; y: number }>;
  } | null>(null);
  const savedSnapshotRef = useRef((() => {
    const ls = readLocalStorageDiagramSnapshot();
    return JSON.stringify({
      people: ls.people,
      partnerships: ls.partnerships,
      emotionalLines: ls.emotionalLines,
      pageNotes: ls.pageNotes,
      triangles: ls.triangles,
      functionalIndicatorDefinitions: initialIndicatorDefinitions,
      eventCategories: initialEventCategories,
      relationshipTypes: initialRelationshipTypes,
      relationshipStatuses: initialRelationshipStatuses,
    });
  })());
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);
  const helpMenuRef = useRef<HTMLDivElement>(null);
  const loadInputRef = useRef<HTMLInputElement>(null);
  const diagramFileHandleRef = useRef<any>(null);
  const backupDirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const importPersonEventsInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const imageDiagramInputRef = useRef<HTMLInputElement>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const timelinePlayRef = useRef<NodeJS.Timeout | null>(null);
  const [, forceTimeRefresh] = useState(0);
  const [diagramFileHandleName, setDiagramFileHandleName] = useState<string | null>(null);
  const [addFamilyModalOpen, setAddFamilyModalOpen] = useState(false);
  const [addFamilyDraft, setAddFamilyDraft] = useState<AddFamilyDraft | null>(null);
  const [addFamilyPosition, setAddFamilyPosition] = useState<{ x: number; y: number } | null>(null);
  const multiSelectedPeople = useMemo(
    () => people.filter((person) => selectedPeopleIds.includes(person.id)),
    [people, selectedPeopleIds]
  );
  const browserSupportsFileSystemAccess =
    typeof window !== 'undefined' &&
    'showOpenFilePicker' in window &&
    'showSaveFilePicker' in window;
  const storageStatusLabel = diagramFileHandleName
    ? `Linked to disk: ${diagramFileHandleName}`
    : browserSupportsFileSystemAccess
    ? 'Safety: download-only until opened/saved to disk'
    : 'Safety: browser download mode only';
  const selectedPageNote = useMemo(
    () => pageNotes.find((note) => note.id === selectedPageNoteId) || null,
    [pageNotes, selectedPageNoteId]
  );
  const demoTourSteps = useMemo(
    () => {
      const generated = buildDemoTourStepsFromNotes({
        people,
        partnerships,
        emotionalLines,
        triangles,
        functionalIndicatorDefinitions,
        eventCategories,
        relationshipTypes,
        relationshipStatuses,
        autoSaveMinutes,
        fileMeta: { fileName },
      });
      const baseSteps = generated.length ? generated : DEFAULT_DEMO_TOUR_STEPS;
      const fallbackPersonStep = baseSteps.find((step) => step.focus.kind === 'person');
      const fallbackPartnershipStep = baseSteps.find((step) => step.focus.kind === 'partnership');
      const fallbackLineStep = baseSteps.find((step) => step.focus.kind === 'emotional');
      const representativePersonId =
        people[0]?.id ||
        (fallbackPersonStep && fallbackPersonStep.focus.kind === 'person'
          ? fallbackPersonStep.focus.personId
          : null);
      const representativePartnershipId =
        partnerships[0]?.id ||
        (fallbackPartnershipStep && fallbackPartnershipStep.focus.kind === 'partnership'
          ? fallbackPartnershipStep.focus.partnershipId
          : null) ||
        null;
      const representativeLineId =
        emotionalLines[0]?.id ||
        triangles.flatMap((triangle) => triangle.tpls || [])[0]?.id ||
        (fallbackLineStep && fallbackLineStep.focus.kind === 'emotional'
          ? fallbackLineStep.focus.lineId
          : null) ||
        null;

      const introSteps: DemoTourStep[] = [
        {
          itemNumber: 0,
          title: 'A) Canvas',
          body: 'This is the Canvas where you place and connect family diagram objects.',
          clickToSelectHint: 'Right-click on the canvas to add a person.',
          focus: { kind: 'canvas' },
        },
        {
          itemNumber: 0,
          title: 'B) Menu Ribbon',
          body: 'This is the Menu Ribbon with file, timeline, transcript, help, and editing controls.',
          focus: { kind: 'toolbar', target: 'menu-ribbon' },
        },
        {
          itemNumber: 0,
          title: 'C) Person Objects',
          body: 'This is a Person object. Click to select it; right-click for person options.',
          focus: representativePersonId
            ? { kind: 'person', personId: representativePersonId, tab: 'properties' }
            : { kind: 'none' },
        },
        {
          itemNumber: 0,
          title: 'D) Parent Relationship Lines (PRL)',
          body: 'This is a Partner Relationship Line (PRL). It connects partners and anchors children.',
          focus: representativePartnershipId
            ? { kind: 'partnership', partnershipId: representativePartnershipId, tab: 'properties' }
            : { kind: 'none' },
        },
        {
          itemNumber: 0,
          title: 'E) Emotional Process Lines (EPL)',
          body: 'This is an Emotional Process Line (EPL). It represents emotional process between two people.',
          focus: representativeLineId
            ? { kind: 'emotional', lineId: representativeLineId, tab: 'properties' }
            : { kind: 'none' },
        },
      ];

      return [...introSteps, ...baseSteps];
    },
    [
      people,
      partnerships,
      emotionalLines,
      triangles,
      functionalIndicatorDefinitions,
      eventCategories,
      relationshipTypes,
      relationshipStatuses,
      autoSaveMinutes,
      fileName,
    ]
  );
  const buildDemoSnapshots = useMemo(
    () => buildCreationDemoSnapshots(DEMO_DIAGRAM_DATA),
    []
  );
  const buildDemoSteps = useMemo(() => buildBuildDemoStepsFromNotes(DEMO_DIAGRAM_DATA), []);

  useEffect(() => {
    if (!propertiesPanelIntent || !propertiesPanelItem) return;
    if (propertiesPanelIntent.targetId !== propertiesPanelItem.id) return;
    if (propertiesPanelIntent.openNewEventRequestId) return;
    const timer = window.setTimeout(() => setPropertiesPanelIntent(null), 0);
    return () => window.clearTimeout(timer);
  }, [propertiesPanelIntent, propertiesPanelItem]);

  // Clear intent when the user navigates away from its target so it doesn't
  // re-apply (e.g. re-opening the Events tab) the next time the same item is selected.
  useEffect(() => {
    if (!propertiesPanelIntent) return;
    if (propertiesPanelItem && propertiesPanelItem.id === propertiesPanelIntent.targetId) return;
    setPropertiesPanelIntent(null);
  }, [propertiesPanelItem?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable =
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target?.isContentEditable;
      if (isEditable) return;
      event.preventDefault();
      setSpacePanActive(true);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      setSpacePanActive(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const buildSessionNoteFileName = useCallback(
    (coach: string, client: string, startedAtValue: number | null) => {
      const safeCoach = (coach?.trim() || 'Coach').replace(/\s+/g, ' ');
      const safeClient = (client?.trim() || 'Client').replace(/\s+/g, ' ');
      const baseDate = startedAtValue ?? Date.now();
      const formatted = new Date(baseDate).toISOString().split('T')[0];
      return `Session Note - ${safeCoach} - ${safeClient} - ${formatted}.json`;
    },
    []
  );
  const sessionTargetOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    people.forEach((person) => {
      options.push({
        value: `person:${person.id}`,
        label: `Person · ${person.name || 'Unnamed'}`,
      });
    });
    partnerships.forEach((partnership) => {
      const partner1 = people.find((p) => p.id === partnership.partner1_id);
      const partner2 = people.find((p) => p.id === partnership.partner2_id);
      options.push({
        value: `partnership:${partnership.id}`,
        label: `PRL · ${(partner1?.name || 'Partner 1')} + ${(partner2?.name || 'Partner 2')}`,
      });
    });
    emotionalLines.forEach((line) => {
      const p1 = people.find((p) => p.id === line.person1_id);
      const p2 = people.find((p) => p.id === line.person2_id);
      options.push({
        value: `emotional:${line.id}`,
        label: `EPL · ${(p1?.name || 'Person 1')} ↔ ${(p2?.name || 'Person 2')}`,
      });
    });
    return options;
  }, [people, partnerships, emotionalLines]);
  const timelineEntries = useMemo(() => {
    const entries: TimelineEntry[] = [];
    const addEntry = (date: string | undefined | null, label: string) => {
      if (!date) return;
      const timestamp = parseIsoDateToTimestamp(date);
      if (timestamp == null) return;
      entries.push({ timestamp, date, label });
    };
    const displayName = (person: Person) => {
      const first = person.firstName?.trim() || '';
      const last = person.lastName?.trim() || '';
      const combined = [first, last].filter(Boolean).join(' ').trim();
      return combined || person.name?.trim() || `Person ${person.id.slice(0, 4)}`;
    };
    const eventStart = (event: { startDate?: string; date?: string }): string | undefined =>
      event.startDate || event.date || undefined;
    const nameMap = new Map<string, string>();
    people.forEach((person) => {
      const label = displayName(person);
      nameMap.set(person.id, label);
      addEntry(person.birthDate, `Birth – ${label}`);
      addEntry(person.deathDate, `Death – ${label}`);
      (person.events || []).forEach((event) => addEntry(eventStart(event), `${event.category || 'Event'} – ${label}`));
    });
    partnerships.forEach((partnership) => {
      const partnerLabel = `${nameMap.get(partnership.partner1_id) || 'Partner 1'} + ${nameMap.get(partnership.partner2_id) || 'Partner 2'}`;
      const base = `${partnership.relationshipType} – ${partnerLabel}`;
      addEntry(partnership.relationshipStartDate, `${base} start`);
      addEntry(partnership.marriedStartDate, `${base} married`);
      addEntry(partnership.separationDate, `${base} separation`);
      addEntry(partnership.divorceDate, `${base} divorce`);
      (partnership.events || []).forEach((event) => addEntry(eventStart(event), `${event.category || 'Event'} – ${partnerLabel}`));
    });
    emotionalLines.forEach((line) => {
      const person1Name = nameMap.get(line.person1_id) || 'Person 1';
      const person2Name = nameMap.get(line.person2_id) || 'Person 2';
      const summary = `${person1Name} ↔ ${person2Name}`;
      addEntry(line.startDate, `EPL start – ${summary}`);
      addEntry(line.endDate, `EPL end – ${summary}`);
      (line.events || []).forEach((event) => addEntry(eventStart(event), `${event.category || 'Event'} – ${summary}`));
    });
    entries.sort((a, b) => a.timestamp - b.timestamp);
    return entries;
  }, [people, partnerships, emotionalLines]);

  const timelineYearBounds = useMemo(() => {
    if (!timelineEntries.length) {
      const currentYear = new Date().getFullYear();
      return { min: currentYear, max: currentYear };
    }
    const minYear = new Date(timelineEntries[0].timestamp).getFullYear();
    let maxYear = new Date(timelineEntries[timelineEntries.length - 1].timestamp).getFullYear();
    const currentYear = new Date().getFullYear();
    if (maxYear < currentYear) maxYear = currentYear;
    return { min: minYear, max: maxYear };
  }, [timelineEntries]);

  // Bootstrap from localStorage once on initial mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setTimelineYear((prev) => {
      if (prev == null) return timelineYearBounds.min;
      if (prev < timelineYearBounds.min || prev > timelineYearBounds.max) {
        return timelineYearBounds.min;
      }
      return prev;
    });
  }, [timelineYearBounds]);

  useEffect(() => {
    if (!timelinePlaying) {
      if (timelinePlayRef.current) {
        clearInterval(timelinePlayRef.current);
        timelinePlayRef.current = null;
      }
      return;
    }
    timelinePlayRef.current = setInterval(() => {
      setTimelineYear((prev) => {
        const current = prev ?? timelineYearBounds.min;
        if (current >= timelineYearBounds.max) {
          setTimelinePlaying(false);
          return timelineYearBounds.max;
        }
        return current + 1;
      });
    }, 1000);
    return () => {
      if (timelinePlayRef.current) {
        clearInterval(timelinePlayRef.current);
        timelinePlayRef.current = null;
      }
    };
  }, [timelinePlaying, timelineYearBounds]);

  const timelineCutoffTimestamp = useMemo(() => {
    if (timelineYear == null) return null;
    return Date.UTC(timelineYear, 11, 31, 23, 59, 59, 999);
  }, [timelineYear]);

  const timelineSliderDisabled = timelineYearBounds.min === timelineYearBounds.max;
  const displayTimelineYear = timelineYear ?? timelineYearBounds.min;

  useEffect(() => {
    if (timelineSliderDisabled && timelinePlaying) {
      setTimelinePlaying(false);
    }
  }, [timelineSliderDisabled, timelinePlaying]);

  const adjustTimelineYear = useCallback(
    (delta: number) => {
      if (timelineSliderDisabled) return;
      setTimelineYear((prev) => {
        const current = prev ?? timelineYearBounds.min;
        const next = Math.min(
          Math.max(current + delta, timelineYearBounds.min),
          timelineYearBounds.max
        );
        return next;
      });
    },
    [timelineSliderDisabled, timelineYearBounds]
  );

  const handleTimelinePlayToggle = () => {
    if (timelineSliderDisabled) return;
    if (timelineYear != null && timelineYear >= timelineYearBounds.max) {
      setTimelineYear(timelineYearBounds.min);
    }
    setTimelinePlaying((prev) => !prev);
  };


  const isVisibleAtTimeline = useCallback(
    (date?: string | null) => {
      if (!timelineCutoffTimestamp) return true;
      const ts = parseIsoDateToTimestamp(date);
      if (ts == null) return true;
      return ts <= timelineCutoffTimestamp;
    },
    [timelineCutoffTimestamp]
  );

  useEffect(() => {
    setSelectedPeopleIds((prev) =>
      prev.filter((id) => {
        const person = people.find((p) => p.id === id);
        return person ? isVisibleAtTimeline(person.birthDate) : false;
      })
    );
    setSelectedPartnershipId((prev) => {
      if (!prev) return prev;
      const partnership = partnerships.find((p) => p.id === prev);
      if (!partnership || !isVisibleAtTimeline(partnership.relationshipStartDate)) {
        return null;
      }
      return prev;
    });
    setSelectedChildId((prev) => {
      if (!prev) return prev;
      const child = people.find((p) => p.id === prev);
      if (!child || !isVisibleAtTimeline(child.birthDate)) {
        return null;
      }
      return prev;
    });
    setSelectedEmotionalLineId((prev) => {
      if (!prev) return prev;
      const line =
        emotionalLines.find((line) => line.id === prev) ||
        triangles.flatMap((triangle) => triangle.tpls || []).find((tpl) => tpl.id === prev);
      if (!line || !isVisibleAtTimeline(line.startDate)) {
        return null;
      }
      return prev;
    });
    setPropertiesPanelItem((prev) => {
      if (!prev) return prev;
      if ('name' in prev) {
        return isVisibleAtTimeline(prev.birthDate) ? prev : null;
      }
      if ('partner1_id' in prev) {
        return isVisibleAtTimeline(prev.relationshipStartDate) ? prev : null;
      }
      if ('lineStyle' in prev) {
        return isVisibleAtTimeline(prev.startDate) ? prev : null;
      }
      return prev;
    });
  }, [people, partnerships, emotionalLines, triangles, isVisibleAtTimeline]);

  const personVisibility = useMemo(() => {
    const map = new Map<string, boolean>();
    people.forEach((person) => {
      map.set(person.id, isVisibleAtTimeline(person.birthDate));
    });
    return map;
  }, [people, isVisibleAtTimeline]);

  const partnershipVisibility = useMemo(() => {
    const map = new Map<string, boolean>();
    partnerships.forEach((partnership) => {
      const visible =
        isVisibleAtTimeline(partnership.relationshipStartDate) &&
        (personVisibility.get(partnership.partner1_id) ?? true) &&
        (personVisibility.get(partnership.partner2_id) ?? true);
      map.set(partnership.id, visible);
    });
    return map;
  }, [partnerships, personVisibility, isVisibleAtTimeline]);

  const triangleTplLines = useMemo(
    () => triangles.flatMap((triangle) => triangle.tpls || []),
    [triangles]
  );

  const allEmotionalLines = useMemo(
    () => [...emotionalLines, ...triangleTplLines],
    [emotionalLines, triangleTplLines]
  );

  const triangleByTplLineId = useMemo(() => {
    const map = new Map<string, string>();
    triangles.forEach((triangle) => {
      (triangle.tpls || []).forEach((tpl) => {
        map.set(tpl.id, triangle.id);
      });
    });
    return map;
  }, [triangles]);
  const panelTriangleContext = useMemo(() => {
    if (!propertiesPanelItem || !('lineStyle' in propertiesPanelItem)) return null;
    const triangleId = triangleByTplLineId.get(propertiesPanelItem.id);
    if (!triangleId) return null;
    const triangle = triangles.find((item) => item.id === triangleId);
    if (!triangle) return null;
    return {
      id: triangle.id,
      color: triangle.color || '#8a5a00',
      intensity: triangle.intensity || 'medium',
      notes: triangle.notes || '',
    };
  }, [propertiesPanelItem, triangleByTplLineId, triangles]);

  const emotionalVisibility = useMemo(() => {
    const map = new Map<string, boolean>();
    allEmotionalLines.forEach((line) => {
      const visible =
        isVisibleAtTimeline(line.startDate) &&
        (personVisibility.get(line.person1_id) ?? true) &&
        (personVisibility.get(line.person2_id) ?? true);
      map.set(line.id, visible);
    });
    return map;
  }, [allEmotionalLines, personVisibility, isVisibleAtTimeline]);

  const emotionalSiblingMeta = useMemo(() => {
    const grouped = new Map<string, string[]>();
    allEmotionalLines.forEach((line) => {
      const key = [line.person1_id, line.person2_id].sort().join('::');
      const bucket = grouped.get(key);
      if (bucket) {
        bucket.push(line.id);
      } else {
        grouped.set(key, [line.id]);
      }
    });
    const meta = new Map<string, { index: number; count: number }>();
    grouped.forEach((ids) => {
      ids.forEach((id, index) => {
        meta.set(id, { index, count: ids.length });
      });
    });
    return meta;
  }, [allEmotionalLines]);
  function parseSessionTargetValue(value: string | null) {
    if (!value) return null;
    const [type, id] = value.split(':');
    if (!type || !id) return null;
    if (type === 'person' || type === 'partnership' || type === 'emotional') {
      return { type: type as 'person' | 'partnership' | 'emotional', id };
    }
    return null;
  }
  const sessionFocusPersonName = useMemo(() => {
    const target = sessionNotesTarget ? parseSessionTargetValue(sessionNotesTarget) : null;
    if (!target) return '';
    if (target.type === 'person') {
      return people.find((person) => person.id === target.id)?.name || '';
    }
    if (target.type === 'partnership') {
      const prl = partnerships.find((entry) => entry.id === target.id);
      const p1 = people.find((person) => person.id === prl?.partner1_id)?.name || '';
      const p2 = people.find((person) => person.id === prl?.partner2_id)?.name || '';
      return [p1, p2].filter(Boolean).join(' + ');
    }
    const line = emotionalLines.find((entry) => entry.id === target.id);
    const p1 = people.find((person) => person.id === line?.person1_id)?.name || '';
    const p2 = people.find((person) => person.id === line?.person2_id)?.name || '';
    return [p1, p2].filter(Boolean).join(' ↔ ');
  }, [sessionNotesTarget, people, partnerships, emotionalLines]);

  const getSessionNotesLibrary = useCallback((): SessionNoteFileRecord[] => {
    const raw = getStoredValue('sessionNotesLibrary');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as SessionNoteFileRecord[]) : [];
    } catch {
      return [];
    }
  }, []);

  const setSessionNotesLibrary = useCallback((records: SessionNoteFileRecord[]) => {
    setStoredValue('sessionNotesLibrary', JSON.stringify(records));
  }, []);
  const sessionOpenCandidates = (() => {
    const library = getSessionNotesLibrary();
    const focus = sessionFocusPersonName.trim().toLowerCase();
    const filtered = library.filter((entry) => {
      if ((entry.diagramFileName || '').trim() !== (fileName || '').trim()) return false;
      if (!focus) return true;
      return (entry.focusPersonName || '').trim().toLowerCase() === focus;
    });
    filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return filtered.map((entry) => ({
      id: entry.id,
      label: `${entry.noteFileName} · ${new Date(entry.updatedAt || Date.now()).toLocaleString()}`,
    }));
  })();

  const composeSessionNotePayload = useCallback(
    () => ({
      id: sessionNoteRecordId || nanoid(),
      coachName: sessionNoteCoachName,
      clientName: sessionNoteClientName,
      noteFileName: sessionNoteFileName,
      diagramFileName: fileName,
      focusPersonName: sessionFocusPersonName,
      presentingIssue: sessionNoteIssue,
      noteContent: sessionNoteContent,
      startedAt: sessionNoteStartedAt ?? Date.now(),
      updatedAt: Date.now(),
    }),
    [
      sessionNoteRecordId,
      sessionNoteCoachName,
      sessionNoteClientName,
      sessionNoteFileName,
      fileName,
      sessionFocusPersonName,
      sessionNoteIssue,
      sessionNoteContent,
      sessionNoteStartedAt,
    ]
  );
  const sessionAutosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionAutosavePhaseRef = useRef<'backup' | 'file'>('backup');
  const sessionSaveDirectoryHandleRef = useRef<any>(null);
  const showMultiPersonPanel = multiSelectedPeople.length > 1;
  const serializeDiagram = useCallback(
    (
      peopleData: Person[],
      partnershipData: Partnership[],
      emotionalData: EmotionalLine[],
      pageNoteData: PageNote[],
      triangleData: Triangle[],
      indicatorDefinitionData: FunctionalIndicatorDefinition[],
      eventCategoryData: string[],
      relationshipTypeData: string[],
      relationshipStatusData: string[]
    ) =>
      JSON.stringify({
        people: peopleData,
        partnerships: partnershipData,
        emotionalLines: emotionalData,
        pageNotes: pageNoteData,
        triangles: triangleData,
        functionalIndicatorDefinitions: indicatorDefinitionData,
        eventCategories: eventCategoryData,
        relationshipTypes: relationshipTypeData,
        relationshipStatuses: relationshipStatusData,
      }),
    []
  );
  const markSnapshotClean = useCallback(
    (
      peopleData: Person[],
      partnershipData: Partnership[],
      emotionalData: EmotionalLine[],
      pageNoteData: PageNote[],
      triangleData: Triangle[],
      indicatorDefinitionData: FunctionalIndicatorDefinition[],
      eventCategoryData: string[],
      relationshipTypeData: string[],
      relationshipStatusData: string[]
    ) => {
      savedSnapshotRef.current = serializeDiagram(
        peopleData,
        partnershipData,
        emotionalData,
        pageNoteData,
        triangleData,
        indicatorDefinitionData,
        eventCategoryData,
        relationshipTypeData,
        relationshipStatusData
      );
      setIsDirty(false);
      setLastDirtyTimestamp(null);
    },
    [serializeDiagram]
  );

  useEffect(() => {
    const snapshot = serializeDiagram(
      people,
      partnerships,
      emotionalLines,
      pageNotes,
      triangles,
      functionalIndicatorDefinitions,
      eventCategories,
      relationshipTypes,
      relationshipStatuses
    );
    if (snapshot !== savedSnapshotRef.current) {
      if (!isDirty) {
        setIsDirty(true);
        setLastDirtyTimestamp(Date.now());
      }
    } else if (isDirty) {
      setIsDirty(false);
      setLastDirtyTimestamp(null);
    }
  }, [
    people,
    partnerships,
    emotionalLines,
    pageNotes,
    triangles,
    functionalIndicatorDefinitions,
    eventCategories,
    relationshipTypes,
    relationshipStatuses,
    isDirty,
    serializeDiagram,
  ]);

  useEffect(() => {
    if (!fileMenuOpen && !settingsMenuOpen && !optionsMenuOpen && !helpMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (fileMenuRef.current && !fileMenuRef.current.contains(target)) {
        setFileMenuOpen(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(target)) {
        setSettingsMenuOpen(false);
      }
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(target)) {
        setOptionsMenuOpen(false);
      }
      if (helpMenuRef.current && !helpMenuRef.current.contains(target)) {
        setHelpMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [fileMenuOpen, settingsMenuOpen, optionsMenuOpen, helpMenuOpen]);

  useEffect(() => {
    if (!emotionalPatternModalOpen) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setEmotionalPatternModalOpen(false);
      setEmotionalPatternDraft(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [emotionalPatternModalOpen]);

  useEffect(() => {
    if (!clientProfileDraft) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setClientProfileDraft(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [clientProfileDraft]);

  useEffect(() => {
    if (!addFamilyModalOpen) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setAddFamilyModalOpen(false);
      setAddFamilyDraft(null);
      setAddFamilyPosition(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [addFamilyModalOpen]);

  useEffect(() => {
    setStoredValue('autoSave', String(autoSaveMinutes));
  }, [autoSaveMinutes]);

  useEffect(() => {
    if (!isDirty) return;
    const interval = setInterval(() => forceTimeRefresh(Date.now()), 500);
    return () => clearInterval(interval);
  }, [isDirty, forceTimeRefresh]);
  useEffect(() => {
    if (!sessionNotesOpen) {
      if (sessionAutosaveTimerRef.current) {
        clearInterval(sessionAutosaveTimerRef.current);
        sessionAutosaveTimerRef.current = null;
      }
      return;
    }
    if (!sessionNoteStartedAt) {
      setSessionNoteStartedAt(Date.now());
    }
    const savePrimary = () => {
      const payload = composeSessionNotePayload();
      localStorage.setItem('session-note-primary', JSON.stringify(payload));
      setSessionAutosaveInfo((info) => ({ ...info, primary: new Date().toISOString() }));
    };
    savePrimary();
    sessionAutosavePhaseRef.current = 'backup';
    sessionAutosaveTimerRef.current = setInterval(() => {
      if (sessionAutosavePhaseRef.current === 'backup') {
        const existing = localStorage.getItem('session-note-primary');
        if (existing) {
          localStorage.setItem('session-note-backup', existing);
          setSessionAutosaveInfo((info) => ({ ...info, backup: new Date().toISOString() }));
        }
        sessionAutosavePhaseRef.current = 'file';
      } else {
        savePrimary();
        sessionAutosavePhaseRef.current = 'backup';
      }
    }, 5 * 60 * 1000);
    return () => {
      if (sessionAutosaveTimerRef.current) {
        clearInterval(sessionAutosaveTimerRef.current);
        sessionAutosaveTimerRef.current = null;
      }
    };
  }, [
    sessionNotesOpen,
    composeSessionNotePayload,
    sessionNoteStartedAt,
  ]);
  useEffect(() => {
    if (!sessionNotesOpen) return;
    if (!sessionNoteStartedAt) {
      setSessionNoteStartedAt(Date.now());
      return;
    }
    if (sessionNoteRecordId) return;
    const expected = buildSessionNoteFileName(sessionNoteCoachName, sessionNoteClientName, sessionNoteStartedAt);
    if (sessionNoteFileName !== expected) {
      setSessionNoteFileName(expected);
    }
  }, [
    sessionNotesOpen,
    sessionNoteCoachName,
    sessionNoteClientName,
    sessionNoteStartedAt,
    sessionNoteFileName,
    sessionNoteRecordId,
    buildSessionNoteFileName,
  ]);
  useEffect(() => {
    const storedPrimary = localStorage.getItem('session-note-primary');
    if (storedPrimary) {
      try {
        const parsed = JSON.parse(storedPrimary);
        setSessionNoteCoachName(parsed.coachName || '');
        setSessionNoteClientName(parsed.clientName || '');
        setSessionNoteFileName(parsed.noteFileName || 'session-note.json');
        setSessionNoteIssue(parsed.presentingIssue || '');
        setSessionNoteContent(parsed.noteContent || '');
        setSessionNoteStartedAt(parsed.startedAt ?? Date.now());
        setSessionAutosaveInfo((info) => ({ ...info, primary: parsed.updatedAt || null }));
      } catch {
        // ignore malformed session note
      }
    }
    const storedBackup = localStorage.getItem('session-note-backup');
    if (storedBackup) {
      try {
        const parsed = JSON.parse(storedBackup);
        setSessionAutosaveInfo((info) => ({ ...info, backup: parsed.updatedAt || null }));
      } catch {
        // ignore malformed backup
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!sessionNotesTarget && sessionTargetOptions.length) {
      setSessionNotesTarget(sessionTargetOptions[0].value);
    } else if (
      sessionNotesTarget &&
      !sessionTargetOptions.some((option) => option.value === sessionNotesTarget)
    ) {
      setSessionNotesTarget(sessionTargetOptions.length ? sessionTargetOptions[0].value : null);
    }
  }, [sessionNotesTarget, sessionTargetOptions]);
  useEffect(() => {
    if (!sessionNotesOpen) return;
    if (!sessionOpenCandidates.length) {
      setSessionOpenCandidateId(null);
      return;
    }
    if (!sessionOpenCandidateId) {
      setSessionOpenCandidateId(sessionOpenCandidates[0].id);
    } else if (!sessionOpenCandidates.some((candidate) => candidate.id === sessionOpenCandidateId)) {
      setSessionOpenCandidateId(sessionOpenCandidates[0].id);
    }
  }, [sessionNotesOpen, sessionOpenCandidates, sessionOpenCandidateId]);
  useEffect(() => {
    if (!sessionNotesOpen) return;
    if (selectedPeopleIds.length === 1) {
      setSessionNotesTarget(`person:${selectedPeopleIds[0]}`);
    } else if (selectedPartnershipId) {
      setSessionNotesTarget(`partnership:${selectedPartnershipId}`);
    } else if (selectedEmotionalLineId) {
      setSessionNotesTarget(`emotional:${selectedEmotionalLineId}`);
    }
  }, [sessionNotesOpen, selectedPeopleIds, selectedPartnershipId, selectedEmotionalLineId]);

  const {
    applyIndicatorDefinitionArray,
    addFunctionalIndicatorDefinition,
    addFunctionalIndicatorDefinitionForGroup,
    updateFunctionalIndicatorLabel,
    updateFunctionalIndicatorGroup,
    updateFunctionalIndicatorUseLetter,
    updateFunctionalIndicatorColor,
    updateFunctionalIndicatorIcon,
    clearFunctionalIndicatorIcon,
    removeFunctionalIndicatorDefinition,
    ensureSymptomDefinition,
  } = useIndicatorHandlers({
    functionalIndicatorDefinitions,
    indicatorDraftLabel,
    defaultSymptomColorByGroup,
    setFunctionalIndicatorDefinitions,
    setPeople,
    setPropertiesPanelItem,
    setIndicatorDraftLabel,
  });

  const alignAllAnchors = (list: Person[], partnershipSource: Partnership[] = partnerships) => {
    if (!partnershipSource.length) return list;
    const personLookup = new Map(list.map((p) => [p.id, p]));
    const partnershipRanges = new Map<string, { min: number; max: number }>();
    partnershipSource.forEach((partnership) => {
      const partner1 = personLookup.get(partnership.partner1_id);
      const partner2 = personLookup.get(partnership.partner2_id);
      if (!partner1 || !partner2) return;
      partnershipRanges.set(partnership.id, {
        min: Math.min(partner1.x, partner2.x),
        max: Math.max(partner1.x, partner2.x),
      });
    });

    const multiGroupMembers = new Map<
      string,
      { partnershipId: string; members: Person[] }
    >();
    list.forEach((person) => {
      if (!person.parentPartnership) return;
      if (!person.multipleBirthGroupId) return;
      const current = multiGroupMembers.get(person.multipleBirthGroupId);
      if (current) {
        current.members.push(person);
      } else {
        multiGroupMembers.set(person.multipleBirthGroupId, {
          partnershipId: person.parentPartnership,
          members: [person],
        });
      }
    });

    const derivedAssignments = new Map<string, string>();

    const anchorByPerson = new Map<string, number>();
    const clampValue = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));

    multiGroupMembers.forEach(({ partnershipId, members }) => {
      if (members.length < 2) {
        return;
      }
      const range = partnershipRanges.get(partnershipId);
      if (!range) return;
      const center =
        members.reduce((sum, member) => sum + member.x, 0) / members.length;
      const anchor = clampValue(center, range.min, range.max);
      members.forEach((member) => {
        anchorByPerson.set(member.id, anchor);
      });
    });

    let changed = false;
    const next = list.map((person) => {
      let updated = person;
      const derivedGroupId = derivedAssignments.get(person.id);
      if (derivedGroupId && person.multipleBirthGroupId !== derivedGroupId) {
        updated = { ...updated, multipleBirthGroupId: derivedGroupId };
        changed = true;
      }

      const targetAnchor = anchorByPerson.get(person.id);
      if (typeof targetAnchor === 'number') {
        if (updated.connectionAnchorX !== targetAnchor) {
          updated = { ...updated, connectionAnchorX: targetAnchor };
          changed = true;
        }
        return updated;
      }

      if (!updated.parentPartnership && updated.connectionAnchorX !== undefined) {
        updated = { ...updated };
        delete updated.connectionAnchorX;
        changed = true;
        return updated;
      }

      if (updated.parentPartnership && updated.multipleBirthGroupId && typeof updated.connectionAnchorX === 'number') {
        const range = partnershipRanges.get(updated.parentPartnership);
        if (range) {
          const clamped = clampValue(updated.connectionAnchorX, range.min, range.max);
          if (clamped !== updated.connectionAnchorX) {
            updated = { ...updated, connectionAnchorX: clamped };
            changed = true;
          }
        }
      } else if (updated.parentPartnership && !updated.multipleBirthGroupId && updated.connectionAnchorX !== undefined) {
        updated = { ...updated };
        delete updated.connectionAnchorX;
        changed = true;
      }
      return updated;
    });

    return changed ? next : list;
  };

  const setPeopleAligned = (updater: (prev: Person[]) => Person[]) => {
    setPeople((prev) => alignAllAnchors(updater(prev)));
  };

  const translateDiagram = (dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    setPeopleAligned((prev) =>
      prev.map((person) => {
        const next: Person = {
          ...person,
          x: person.x + dx,
          y: person.y + dy,
          notesPosition: person.notesPosition
            ? { x: person.notesPosition.x + dx, y: person.notesPosition.y + dy }
            : undefined,
        };
        if (typeof person.connectionAnchorX === 'number') {
          next.connectionAnchorX = person.connectionAnchorX + dx;
        }
        return next;
      })
    );
    setPartnerships((prev) =>
      prev.map((partnership) => ({
        ...partnership,
        horizontalConnectorY: partnership.horizontalConnectorY + dy,
        notesPosition: partnership.notesPosition
          ? { x: partnership.notesPosition.x + dx, y: partnership.notesPosition.y + dy }
          : undefined,
      }))
    );
    setEmotionalLines((prev) =>
      prev.map((line) => ({
        ...line,
        notesPosition: line.notesPosition
          ? { x: line.notesPosition.x + dx, y: line.notesPosition.y + dy }
          : undefined,
      }))
    );
    setPageNotes((prev) =>
      prev.map((note) => ({
        ...note,
        x: note.x + dx,
        y: note.y + dy,
      }))
    );
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    try {
      applyIndicatorDefinitionArray(initialIndicatorDefinitions);
    } catch {
      // keep fallback defaults if initialization ever fails
      setTriangles(initialTriangles);
    }
    markSnapshotClean(
      people,
      partnerships,
      emotionalLines,
      pageNotes,
      triangles,
      functionalIndicatorDefinitions,
      eventCategories,
      relationshipTypes,
      relationshipStatuses
    );
  }, [markSnapshotClean]); // eslint-disable-line react-hooks/exhaustive-deps

useEffect(() => {
  const handleResize = () => {
    setViewport({ width: window.innerWidth, height: window.innerHeight });
  };
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

useEffect(() => {
  const ribbon = ribbonRef.current;
  if (!ribbon) return;

  const measure = () => {
    const nextHeight = Math.ceil(ribbon.getBoundingClientRect().height);
    if (nextHeight > 0) {
      setRibbonHeight(nextHeight);
    }
  };

  measure();

  if (typeof ResizeObserver === 'undefined') return;
  const observer = new ResizeObserver(() => measure());
  observer.observe(ribbon);
  return () => observer.disconnect();
}, []);

useEffect(() => {
  if (typeof window === 'undefined') return;
  setStoredValue('ideas', ideasText);
}, [ideasText]);

useEffect(() => {
  if (typeof window === 'undefined') return;
  setStoredValue('predictions', JSON.stringify(predictionSets));
}, [predictionSets]);

useEffect(() => {
  if (typeof window === 'undefined') return;
  const payload: StoredUserSettings = {
    eventCategories,
    relationshipTypes,
    relationshipStatuses,
    functionalIndicatorDefinitions,
    sirCategories,
    functionalFactCategories,
    nodalCategories,
    autoSaveMinutes,
    backupCount,
  };
  setStoredValue('userSettings', JSON.stringify(payload));
}, [
  autoSaveMinutes,
  backupCount,
  eventCategories,
  functionalIndicatorDefinitions,
  functionalFactCategories,
  nodalCategories,
  relationshipStatuses,
  relationshipTypes,
  sirCategories,
]);

useEffect(() => {
  const handleMouseMove = (event: MouseEvent) => {
      if (!resizeStateRef.current) return;
      const delta = resizeStateRef.current.startX - event.clientX;
      const nextWidth = Math.min(600, Math.max(180, resizeStateRef.current.startWidth + delta));
      setPanelWidth(nextWidth);
    };
    const handleMouseUp = () => {
      resizeStateRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const autosaveDelayMs = Math.max(0.1, autoSaveMinutes) * 60000;

  const clampAutoSaveMinutes = (value: number) => {
    if (!Number.isFinite(value)) {
      return 1;
    }
    return Math.max(0.25, Math.min(180, value));
  };

  const handleAutoSaveMinutesInput = (value: number) => {
    setAutoSaveMinutes(clampAutoSaveMinutes(value));
  };

  const handleBackupCountInput = (value: number) => {
    if (!Number.isFinite(value)) return;
    setBackupCount(Math.max(1, Math.min(20, Math.round(value))));
  };

  const handleSetBackupFolder = async () => {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      alert('Your browser does not support the directory picker. Use Chrome or Edge for file-based backups.');
      return;
    }
    const attemptPick = async (startIn?: string) => {
      const opts: Record<string, unknown> = { mode: 'readwrite' };
      if (startIn) opts.startIn = startIn;
      return (window as any).showDirectoryPicker(opts) as Promise<FileSystemDirectoryHandle>;
    };

    const applyHandle = async (dirHandle: FileSystemDirectoryHandle) => {
      backupDirHandleRef.current = dirHandle;
      await persistBackupDirectoryHandle(dirHandle);
      alert(`Backup folder set to "${dirHandle.name}". Backups will be saved as "${fileName.replace(/\.json$/i, '')}.backup-N.json" in that folder.`);
    };

    try {
      const dirHandle = await attemptPick();
      await applyHandle(dirHandle);
    } catch (err) {
      const name = (err as Error)?.name;
      if (name === 'AbortError') return;
      if (name === 'SecurityError') {
        // Browser blocked a top-level system folder (Downloads, Desktop, Documents, etc.).
        // Explain what to do, then re-open the picker starting in Downloads.
        alert(
          'That folder is blocked by the browser.\n\n' +
          'The file picker will now open inside your Downloads folder.\n\n' +
          'In the picker: use the "New Folder" button to create a folder (e.g. "FamilyDiagramMaker"), then select it.'
        );
        try {
          const dirHandle = await attemptPick('downloads');
          await applyHandle(dirHandle);
        } catch (retryErr) {
          const retryName = (retryErr as Error)?.name;
          if (retryName === 'AbortError') return;
          if (retryName === 'SecurityError') {
            alert(
              'Still blocked — you selected a protected folder again.\n\n' +
              'Use the "New Folder" button inside the picker to create a subfolder first, then select that new folder.'
            );
          } else {
            alert('Could not set backup folder.');
          }
        }
      } else {
        alert('Could not set backup folder.');
      }
    }
  };

  const handleOpenFileBackupRestore = async () => {
    if (!backupDirHandleRef.current) {
      alert('No backup folder is set. Use Settings > Set Backup Folder first.');
      return;
    }
    try {
      const perm = await (backupDirHandleRef.current as any).requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        alert('Permission denied to read backup folder.');
        return;
      }
    } catch {
      alert('Could not access backup folder.');
      return;
    }
    const diagramName = diagramFileHandleRef.current?.name || fileName || FALLBACK_FILE_NAME;
    const backups = await listFileBackups(backupDirHandleRef.current, diagramName, backupCount);
    if (backups.length === 0) {
      alert('No backup files found for this diagram.');
      return;
    }
    fileBackupHandlesRef.current = new Map(backups.map((b) => [b.slot, b.handle]));
    setFileBackupEntries(backups.map((b) => ({ slot: b.slot, fileName: b.fileName, lastModified: b.lastModified })));
    setFileBackupListOpen(true);
  };

  const handleFileBackupSelect = async (slot: number) => {
    setFileBackupListOpen(false);
    const handle = fileBackupHandlesRef.current.get(slot);
    if (!handle) return;
    const diagramName = diagramFileHandleRef.current?.name || fileName || FALLBACK_FILE_NAME;
    try {
      const file = await handle.getFile();
      const text = await file.text();
      const data = JSON.parse(text);
      replaceDiagramState(data, diagramName);
    } catch {
      alert('Could not restore backup file.');
    }
  };

  useAutosave(
    people,
    (data) => {
      setStoredValue('people', JSON.stringify(data));
    },
    autosaveDelayMs
  );

  useAutosave(
    partnerships,
    (data) => {
      setStoredValue('partnerships', JSON.stringify(data));
    },
    autosaveDelayMs
  );

  useAutosave(
    emotionalLines,
    (data) => {
      setStoredValue('emotionalLines', JSON.stringify(data));
    },
    autosaveDelayMs
  );

  useAutosave(
    triangles,
    (data) => {
      setStoredValue('triangles', JSON.stringify(data));
    },
    autosaveDelayMs
  );

  useAutosave(
    pageNotes,
    (data) => {
      setStoredValue('pageNotes', JSON.stringify(data));
    },
    autosaveDelayMs
  );

  useAutosave(
    fileName,
    (data) => {
      setStoredValue('fileName', data);
    },
    autosaveDelayMs
  );

  useAutosave(
    eventCategories,
    (data) => {
      setStoredValue('eventCategories', JSON.stringify(data));
    },
    autosaveDelayMs
  );

  useAutosave(
    relationshipTypes,
    (data) => {
      setStoredValue('relationshipTypes', JSON.stringify(data));
    },
    autosaveDelayMs
  );

  useAutosave(
    relationshipStatuses,
    (data) => {
      setStoredValue('relationshipStatuses', JSON.stringify(data));
    },
    autosaveDelayMs
  );

  useAutosave(
    functionalIndicatorDefinitions,
    (data) => {
      setStoredValue('indicatorDefinitions', JSON.stringify(data));
    },
    autosaveDelayMs
  );


  const {
    handleUpdatePerson,
    handleBatchUpdatePersons,
    handleUpdatePartnership,
    handleUpdateEmotionalLine,
    getEventClassForTargetType,
    openPersonSectionPopup,
    openPartnershipSectionPopup,
    openContextualEventCreator,
    openClientProfileModal,
    openCoachThinkingModal,
    updateCoachThinkingField,
    saveCoachThinkingDraft,
    updateClientProfileDraftField,
    saveClientProfileDraft,
  } = useUpdateHandlers({
    people,
    coachThinkingDraft,
    clientProfileDraft,
    setPeople,
    setPeopleAligned,
    setPartnerships,
    setEmotionalLines,
    setTriangles,
    setCoachThinkingDraft,
    setClientProfileDraft,
    setPropertiesPanelItem,
    setPropertiesPanelIntent,
    setPersonSectionPopup,
    setPartnershipSectionPopup,
    setSelectedPeopleIds,
    setSelectedPartnershipId,
    setSelectedEmotionalLineId,
    setSelectedChildId,
  });

  const {
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
  } = useSessionNoteHandlers({
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
  });

  const {
    addEmotionalLine,
    openAddEmotionalPatternModal,
    updateEmotionalPatternDraft,
    saveAddEmotionalPattern,
    removeEmotionalLine,
    addTriangle,
    removeTriangle,
    updateTriangle,
    updateTriangleColor,
    updateTriangleIntensity,
  } = useEmotionalLineOperations({
    people,
    triangles,
    emotionalLines,
    emotionalPatternDraft,
    setEmotionalLines,
    setTriangles,
    setEmotionalPatternDraft,
    setEmotionalPatternModalOpen,
    setSelectedPeopleIds,
    setSelectedPartnershipId,
    setSelectedEmotionalLineId,
    setSelectedChildId,
    setPropertiesPanelItem,
    setContextMenu,
  });

  const predictionHandlers = usePredictionHandlers({
    predictionSets,
    setPredictionSets,
  });


  const changeSex = (personId: string) => {
    setPeopleAligned((prev) =>
      prev.map((p) => {
        if (p.id !== personId) return p;
        const currentSex = (p.birthSex || (p.gender === 'male' ? 'male' : 'female')) as BirthSex;
        const nextSex: BirthSex = currentSex === 'male' ? 'female' : 'male';
        const nextIdentity: GenderIdentity = nextSex === 'male' ? 'masculine' : 'feminine';
        return {
          ...p,
          gender: nextSex,
          birthSex: nextSex,
          genderIdentity: nextIdentity,
          genderSymbol: nextSex === 'male' ? 'male_cis' : 'female_cis',
        };
      })
    );
  };

  const addPartnerForPerson = (person: Person) => {
    const partnerGender = person.gender === 'male' ? 'female' : 'male';
    const partnerOffsetX = person.gender === 'female' ? -140 : 140;
    const newPartnerId = nanoid();
    const newPartnershipId = nanoid();
    const newPartnership: Partnership = {
      id: newPartnershipId,
      partner1_id: person.id,
      partner2_id: newPartnerId,
      horizontalConnectorY: Math.max(person.y, person.y) + 100,
      relationshipType: 'dating',
      relationshipStatus: 'married',
      children: [],
      events: [],
    };

    const newPartner: Person = {
      id: newPartnerId,
      name: 'New Partner',
      x: person.x + partnerOffsetX,
      y: person.y,
      gender: partnerGender,
      partnerships: [newPartnershipId],
      events: [],
    };

    setPartnerships((prev) => [...prev, newPartnership]);
    setPeopleAligned((prev) =>
      prev.map((entry) =>
        entry.id === person.id
          ? { ...entry, partnerships: [...new Set([...(entry.partnerships || []), newPartnershipId])] }
          : entry
      ).concat(newPartner)
    );
    setSelectedPeopleIds([person.id, newPartnerId]);
    setSelectedPartnershipId(newPartnershipId);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setPropertiesPanelItem(newPartnership);
  };

  const addChildToPartnership = (childIdOverride?: string, partnershipIdOverride?: string) => {
    const childId =
      childIdOverride ?? (selectedPeopleIds.length === 1 ? selectedPeopleIds[0] : null);
    const partnershipId = partnershipIdOverride ?? selectedPartnershipId;
    if (!childId || !partnershipId) {
      alert('Select a partnership first to add this child.');
      return;
    }

    const targetPartnership = partnerships.find((p) => p.id === partnershipId);
    if (!targetPartnership) return;
    if (targetPartnership.partner1_id === childId || targetPartnership.partner2_id === childId) {
      alert('A PRL partner cannot also be added as that PRL child.');
      return;
    }
    if (targetPartnership.children.includes(childId)) {
      setSelectedPeopleIds([childId]);
      setSelectedPartnershipId(partnershipId);
      return;
    }

    setPartnerships((prev) =>
      prev.map((p) => {
        if (p.id === partnershipId) {
          return { ...p, children: [...p.children, childId] };
        }
        if (p.children.includes(childId)) {
          return { ...p, children: p.children.filter((id) => id !== childId) };
        }
        return p;
      })
    );

    setPeopleAligned((prev) =>
      prev.map((p) =>
        p.id === childId
          ? { ...p, parentPartnership: partnershipId, connectionAnchorX: undefined }
          : p
      )
    );

    setSelectedPeopleIds((ids) => ids.filter((id) => id !== childId));
    setSelectedPartnershipId(partnershipId);
    setPropertiesPanelItem(targetPartnership);
  };

  const {
    reviewVoiceCommands,
    toggleVoiceListening,
    applyVoiceCommands,
  } = useVoiceHandlers({
    voiceCommandText,
    voiceListening,
    people,
    partnerships,
    emotionalLines,
    speechRecognitionRef,
    alignAllAnchors,
    setVoiceCommandOperations,
    setVoiceCommandErrors,
    setVoiceStatusMessage,
    setVoiceListening,
    setPeople,
    setPartnerships,
    setEmotionalLines,
    setSelectedPeopleIds,
    setSelectedPartnershipId,
    setPropertiesPanelItem,
  });


  const buildDiagramPayload = (targetFileName = fileName) => ({
    fileMeta: {
      fileName: targetFileName,
      displayName: targetFileName,
      exportedAt: new Date().toISOString(),
    },
    people,
    partnerships,
    emotionalLines,
    pageNotes,
    triangles,
    functionalIndicatorDefinitions,
    eventCategories,
    relationshipTypes,
    relationshipStatuses,
    autoSaveMinutes,
    ideasText,
    predictionSets,
    functionalFactCategories,
    nodalCategories,
  });

  const setDiagramFileHandle = useCallback((handle: any | null) => {
    diagramFileHandleRef.current = handle;
    setDiagramFileHandleName(handle?.name || null);
    void persistDiagramFileHandle(handle);
  }, []);

  const ensureDiagramHandlePermission = useCallback(async (handle: any, mode: 'read' | 'readwrite') => {
    if (!handle?.queryPermission) return true;
    try {
      const current = await handle.queryPermission({ mode });
      if (current === 'granted') return true;
      if (!handle.requestPermission) return false;
      const requested = await handle.requestPermission({ mode });
      return requested === 'granted';
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!browserSupportsFileSystemAccess) return;
    void (async () => {
      const restoredHandle = await restoreDiagramFileHandle();
      if (restoredHandle) {
        const hasReadPermission =
          !restoredHandle.queryPermission ||
          (await ensureDiagramHandlePermission(restoredHandle, 'read'));
        if (hasReadPermission) {
          setDiagramFileHandle(restoredHandle);
        } else {
          // Permission not auto-granted (needs user gesture). Stash the handle
          // so the File menu can offer a one-click "Reopen [filename]" shortcut.
          setPendingReopenHandle(restoredHandle);
          setPendingReopenName((restoredHandle.name as string) || '');
        }
      }
      // Restore backup directory handle — silently set if already granted,
      // otherwise it will be re-prompted on the next save.
      const restoredBackupDir = await restoreBackupDirectoryHandle();
      if (restoredBackupDir) {
        backupDirHandleRef.current = restoredBackupDir;
      }
    })();
  }, [browserSupportsFileSystemAccess, ensureDiagramHandlePermission, setDiagramFileHandle]);

  const writeDiagramJsonToHandle = useCallback(async (handle: any, jsonString: string) => {
    const writable = await handle.createWritable();
    await writable.write(new Blob([jsonString], { type: 'application/json' }));
    await writable.close();
  }, []);

  const readDiagramJsonFromHandle = useCallback(async (handle: any) => {
    const file = await handle.getFile();
    return await file.text();
  }, []);

  const saveDiagramToCurrentTarget = useCallback(
    async ({
      requestedFileName,
      forceChooseLocation = false,
      allowPicker = true,
      isAutosave = false,
    }: {
      requestedFileName?: string;
      forceChooseLocation?: boolean;
      allowPicker?: boolean;
      isAutosave?: boolean;
    } = {}) => {
      const normalizedRequestedName = (() => {
        const base = (requestedFileName || fileName || FALLBACK_FILE_NAME).trim() || FALLBACK_FILE_NAME;
        return base.toLowerCase().endsWith('.json') ? base : `${base}.json`;
      })();

      let handle = forceChooseLocation ? null : diagramFileHandleRef.current;
      if (!handle && allowPicker && typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
        const handles = await (window as any).showOpenFilePicker({
          multiple: false,
          types: DIAGRAM_FILE_PICKER_TYPES,
        });
        handle = handles?.[0] ?? null;
        setDiagramFileHandle(handle);
      }

      if (handle) {
        const hasPermission = await ensureDiagramHandlePermission(handle, 'readwrite');
        if (!hasPermission) {
          if (!forceChooseLocation) {
            setDiagramFileHandle(null);
          }
          handle = null;
        }
      }

      const resolvedFileName = handle?.name || normalizedRequestedName;
      const jsonString = JSON.stringify(buildDiagramPayload(resolvedFileName), null, 2);
      const backupKey = resolvedFileName.toLowerCase();

      if (handle) {
        let priorJson: string | null = null;
        try {
          priorJson = await readDiagramJsonFromHandle(handle);
        } catch {
          priorJson = null;
        }
        await writeDiagramJsonToHandle(handle, jsonString);
        if (priorJson) {
          await rotateDiagramBackups(backupKey, priorJson, backupCount);

          // Write file-based backup to the same folder as the diagram file.
          // On first save we auto-prompt for the directory (pre-navigated to the file's folder).
          let dirHandle = backupDirHandleRef.current;
          if (!dirHandle && !isAutosave && typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
            try {
              dirHandle = await (window as any).showDirectoryPicker({
                id: 'backup-dir',
                mode: 'readwrite',
                startIn: handle,  // opens picker in the same folder as the diagram file
              });
              backupDirHandleRef.current = dirHandle;
              await persistBackupDirectoryHandle(dirHandle);
            } catch {
              dirHandle = null;
            }
          }
          if (dirHandle) {
            try {
              const perm = await (dirHandle as any).requestPermission({ mode: 'readwrite' });
              if (perm === 'granted') {
                await writeFileBackup(dirHandle, resolvedFileName, priorJson, backupCount);
              }
            } catch { /* silently skip if permission denied */ }
          }
        }
        setFileName(resolvedFileName);
        markSnapshotClean(
          people,
          partnerships,
          emotionalLines,
          pageNotes,
          triangles,
          functionalIndicatorDefinitions,
          eventCategories,
          relationshipTypes,
          relationshipStatuses
        );
        setLastSavedAt(Date.now());
        return true;
      }

      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resolvedFileName;
      a.click();
      URL.revokeObjectURL(url);
      await rotateDiagramBackups(backupKey, jsonString, backupCount);

      // Write file-based backup for the download path too
      if (backupDirHandleRef.current) {
        try {
          const perm = await (backupDirHandleRef.current as any).requestPermission({ mode: 'readwrite' });
          if (perm === 'granted') {
            await writeFileBackup(backupDirHandleRef.current, resolvedFileName, jsonString, backupCount);
          }
        } catch { /* silently skip */ }
      }
      setFileName(resolvedFileName);
      markSnapshotClean(
        people,
        partnerships,
        emotionalLines,
        pageNotes,
        triangles,
        functionalIndicatorDefinitions,
        eventCategories,
        relationshipTypes,
        relationshipStatuses
      );
      setLastSavedAt(Date.now());
      return true;
    },
    [backupCount, buildDiagramPayload, emotionalLines, ensureDiagramHandlePermission, fileName, markSnapshotClean, pageNotes, partnerships, people, readDiagramJsonFromHandle, setDiagramFileHandle, triangles, writeDiagramJsonToHandle]
  );

  useEffect(() => {
    if (!isDirty) return;
    if (!diagramFileHandleRef.current) return;
    const timeout = window.setTimeout(() => {
      void saveDiagramToCurrentTarget({
        requestedFileName: fileName,
        forceChooseLocation: false,
        allowPicker: false,
        isAutosave: true,
      }).catch(() => {
        // Keep the diagram dirty if the autosave write fails.
      });
    }, autosaveDelayMs);
    return () => window.clearTimeout(timeout);
  }, [
    autosaveDelayMs,
    emotionalLines,
    fileName,
    isDirty,
    pageNotes,
    partnerships,
    people,
    saveDiagramToCurrentTarget,
    triangles,
  ]);

  const replaceDiagramState = (
    data: any,
    sourceFileName?: string,
    options?: { normalizeLayout?: boolean }
  ) => {
    if (!Array.isArray(data.people) || !Array.isArray(data.partnerships) || !Array.isArray(data.emotionalLines)) {
      throw new Error('Invalid file format');
    }
    const normalizeLayout = options?.normalizeLayout ?? false;
    const nextDefinitions: FunctionalIndicatorDefinition[] = Array.isArray(data.functionalIndicatorDefinitions)
      ? data.functionalIndicatorDefinitions
      : functionalIndicatorDefinitions;
    applyIndicatorDefinitionArray(nextDefinitions);
    const cleaned = removeOrphanedMiscarriages(data.people, data.partnerships);
    const normalizedLines = normalizeEmotionalLines(data.emotionalLines);
    const normalizedTriangles = normalizeTriangles(Array.isArray(data.triangles) ? data.triangles : []);
    const normalizedImportedPeople = normalizeLayout
      ? normalizeImportedChildLayout(cleaned.people, cleaned.partnerships, {
          expandParentSpan: true,
          autoResizeDenseFamilies: true,
        })
      : cleaned.people;
    const aligned = alignAllAnchors(normalizedImportedPeople, cleaned.partnerships);
    const sanitizedPeople = sanitizePeopleIndicators(aligned, nextDefinitions);
    const peopleWithEvents = attachEventClassToEntities(sanitizedPeople, 'individual');
    const partnershipsWithEvents = attachFamilyEventsToPartnerships(
      attachEventClassToEntities(cleaned.partnerships, 'relationship')
    );
    const linesWithEvents = attachEventClassToEntities(normalizedLines, 'emotional-pattern');
    const peopleIdSet = new Set(peopleWithEvents.map((person) => person.id));
    const trianglesWithKnownPeople = normalizedTriangles.filter(
      (triangle) =>
        peopleIdSet.has(triangle.person1_id) &&
        peopleIdSet.has(triangle.person2_id) &&
        peopleIdSet.has(triangle.person3_id)
    );
    setPeople(peopleWithEvents);
    setPartnerships(partnershipsWithEvents);
    setEmotionalLines(linesWithEvents);
    setPageNotes(Array.isArray(data.pageNotes) ? data.pageNotes : []);
    setTriangles(trianglesWithKnownPeople);
    if (Array.isArray(data.eventCategories) && data.eventCategories.length > 0) {
      setEventCategories(data.eventCategories);
    }
    if (Array.isArray(data.relationshipTypes) && data.relationshipTypes.length > 0) {
      setRelationshipTypes(data.relationshipTypes);
    }
    if (Array.isArray(data.relationshipStatuses) && data.relationshipStatuses.length > 0) {
      setRelationshipStatuses(data.relationshipStatuses);
    }
    if (Array.isArray(data.sirCategories) && data.sirCategories.length > 0) {
      setSirCategories(data.sirCategories);
    }
    if (Array.isArray(data.functionalFactCategories)) {
      setFunctionalFactCategories(data.functionalFactCategories);
    }
    if (Array.isArray(data.nodalCategories)) {
      setNodalCategories(data.nodalCategories);
    }
    if (typeof data.autoSaveMinutes === 'number' && !Number.isNaN(data.autoSaveMinutes)) {
      setAutoSaveMinutes(Math.max(0.25, data.autoSaveMinutes));
    }
    const embeddedFileName =
      typeof data.fileMeta?.fileName === 'string' && data.fileMeta.fileName.trim().length
        ? data.fileMeta.fileName.trim()
        : typeof data.fileName === 'string' && data.fileName.trim().length
        ? data.fileName.trim()
        : '';
    const sourceName = typeof sourceFileName === 'string' ? sourceFileName.trim() : '';
    const derivedName =
      sourceName ||
      (embeddedFileName && embeddedFileName !== FALLBACK_FILE_NAME
        ? embeddedFileName
        : embeddedFileName || FALLBACK_FILE_NAME);
    setFileName(derivedName);
    if (typeof data.ideasText === 'string') {
      setIdeasText(data.ideasText);
    } else {
      setIdeasText(DEFAULT_DIAGRAM_STATE.ideasText);
    }
    setPredictionSets(Array.isArray(data.predictionSets) ? data.predictionSets : []);
    setTimelinePlaying(false);
    setTimelineYear(new Date().getFullYear());
    setTimelineSelectionIds([]);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    markSnapshotClean(
      peopleWithEvents,
      partnershipsWithEvents,
      linesWithEvents,
      Array.isArray(data.pageNotes) ? data.pageNotes : [],
      trianglesWithKnownPeople,
      nextDefinitions,
      Array.isArray(data.eventCategories) && data.eventCategories.length > 0
        ? data.eventCategories
        : eventCategories,
      Array.isArray(data.relationshipTypes) && data.relationshipTypes.length > 0
        ? data.relationshipTypes
        : DEFAULT_DIAGRAM_STATE.relationshipTypes,
      Array.isArray(data.relationshipStatuses) && data.relationshipStatuses.length > 0
        ? data.relationshipStatuses
        : DEFAULT_DIAGRAM_STATE.relationshipStatuses
    );
    setLastSavedAt(null);
  };

  const beginImportFlow = (
    data: DiagramImportData,
    sourceFileName: string,
    source: 'import' | 'transcript' | 'facts'
  ) => {
    setPendingImportData(data);
    setPendingImportFileName(sourceFileName);
    setPendingImportSource(source);
    setImportModeDialogOpen(true);
  };

  const beginSessionCaptureFlow = (data: SessionCaptureImportData, sourceFileName: string) => {
    const defaults: Record<string, boolean> = {};
    data.operations.forEach((operation) => {
      const confidence = operation.confidence ?? 0.5;
      const recommendApply = operation.recommendedAction ? operation.recommendedAction !== 'skip' : true;
      defaults[operation.id] = recommendApply && confidence >= 0.7 && !operation.ambiguity;
    });
    setPendingSessionCaptureData(data);
    setPendingSessionCaptureFileName(sourceFileName);
    setSessionCaptureSelections(defaults);
    setSessionCaptureDialogOpen(true);
  };

  const findPersonIndexForSessionOp = (
    peopleList: Person[],
    operation: SessionCaptureOperation
  ): number => {
    const normalize = (value?: string) =>
      (value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    const hints = operation.matchHints;
    const payloadName =
      (operation.payload?.personName as string | undefined) ||
      (operation.payload?.name as string | undefined);
    if (hints?.personId) {
      const byId = peopleList.findIndex((person) => person.id === hints.personId);
      if (byId >= 0) return byId;
    }
    const targetNames = [
      hints?.personName,
      ...(hints?.aliases || []),
      payloadName,
    ]
      .filter(Boolean)
      .map((entry) => normalize(entry as string))
      .filter(Boolean);
    if (!targetNames.length) return -1;
    return peopleList.findIndex((person) => {
      const personName = normalize(person.name || [person.firstName, person.lastName].filter(Boolean).join(' '));
      return targetNames.some((name) => name === personName || personName.startsWith(`${name} `));
    });
  };

  const completeSessionCaptureImport = () => {
    if (!pendingSessionCaptureData) return;
    const selectedOps = pendingSessionCaptureData.operations.filter(
      (operation) => sessionCaptureSelections[operation.id]
    );
    if (!selectedOps.length) {
      setSessionCaptureDialogOpen(false);
      setPendingSessionCaptureData(null);
      setPendingSessionCaptureFileName('');
      setSessionCaptureSelections({});
      return;
    }

    const dedupeEventFingerprint = (personId: string, event: EmotionalProcessEvent) =>
      `${personId}|${event.date || ''}|${(event.category || '').trim().toLowerCase()}|${(event.observations || '').trim().toLowerCase()}`;

    const nextPeople = [...people];
    const existingFingerprints = new Set<string>();
    nextPeople.forEach((person) => {
      (person.events || []).forEach((event) => {
        existingFingerprints.add(dedupeEventFingerprint(person.id, event));
      });
    });

    selectedOps.forEach((operation) => {
      if (operation.type === 'upsert_person') {
        const matchedIndex = findPersonIndexForSessionOp(nextPeople, operation);
        const payload = operation.payload || {};
        if (matchedIndex >= 0) {
          const existing = nextPeople[matchedIndex];
          const incomingNotes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
          const mergedNotes =
            incomingNotes && existing.notes && !existing.notes.includes(incomingNotes)
              ? `${existing.notes}\n${incomingNotes}`
              : existing.notes || incomingNotes || undefined;
          nextPeople[matchedIndex] = {
            ...existing,
            name: existing.name || payload.name || payload.personName || existing.name,
            firstName: existing.firstName || payload.firstName,
            lastName: existing.lastName || payload.lastName,
            birthDate: existing.birthDate || payload.birthDate,
            deathDate: existing.deathDate || payload.deathDate,
            gender: existing.gender || payload.gender,
            notes: mergedNotes,
          };
          return;
        }
        const baseName = (payload.name || payload.personName || operation.matchHints?.personName || '').trim();
        if (!baseName) return;
        const newPerson: Person = {
          id: (operation.matchHints?.personId as string) || nanoid(),
          name: baseName,
          firstName: payload.firstName,
          lastName: payload.lastName,
          birthDate: payload.birthDate,
          deathDate: payload.deathDate,
          gender: payload.gender || inferGenderFromName(baseName) || 'female',
          notes: payload.notes,
          x: 120 + (nextPeople.length % 10) * 90,
          y: 140 + Math.floor(nextPeople.length / 10) * 90,
          partnerships: [],
          events: [],
        };
        nextPeople.push(newPerson);
        return;
      }

      if (operation.type === 'add_person_event') {
        const matchedIndex = findPersonIndexForSessionOp(nextPeople, operation);
        const payload = operation.payload || {};
        let personIndex = matchedIndex;
        if (personIndex < 0) {
          const fallbackName =
            (operation.matchHints?.personName || payload.personName || payload.name || '').trim();
          if (!fallbackName) return;
          const newPerson: Person = {
            id: (operation.matchHints?.personId as string) || nanoid(),
            name: fallbackName,
            gender: inferGenderFromName(fallbackName) || 'female',
            x: 120 + (nextPeople.length % 10) * 90,
            y: 140 + Math.floor(nextPeople.length / 10) * 90,
            partnerships: [],
            events: [],
          };
          nextPeople.push(newPerson);
          personIndex = nextPeople.length - 1;
        }
        const target = nextPeople[personIndex];
        const event: EmotionalProcessEvent = {
          id: payload.id || nanoid(),
          date: payload.date || new Date().toISOString().slice(0, 10),
          category: payload.category || 'Session Event',
          eventType: payload.eventType || 'NODAL',
          status: payload.status || 'discrete',
          intensity: typeof payload.intensity === 'number' ? payload.intensity : 0,
          frequency: typeof payload.frequency === 'number' ? payload.frequency : 0,
          impact: typeof payload.impact === 'number' ? payload.impact : 0,
          howWell: typeof payload.howWell === 'number' ? payload.howWell : 5,
          otherPersonName: payload.otherPersonName || '',
          primaryPersonName: target.name || payload.primaryPersonName || '',
          wwwwh: payload.wwwwh || '',
          observations: payload.observations || payload.notes || '',
          priorEventsNote: payload.priorEventsNote || '',
          reflectionsNote: payload.reflectionsNote || '',
          createdAt: payload.createdAt || Date.now(),
          eventClass: 'individual',
        };
        const fingerprint = dedupeEventFingerprint(target.id, event);
        if (existingFingerprints.has(fingerprint)) return;
        existingFingerprints.add(fingerprint);
        nextPeople[personIndex] = {
          ...target,
          events: [...(target.events || []), event],
        };
        return;
      }

      if (operation.type === 'upsert_partnership') {
        const payload = operation.payload || {};
        const p1Op: SessionCaptureOperation = {
          ...operation,
          type: 'upsert_person',
          payload: { personName: payload.partner1Name || payload.partner1 },
          matchHints: { personName: payload.partner1Name || payload.partner1 },
        };
        const p2Op: SessionCaptureOperation = {
          ...operation,
          type: 'upsert_person',
          payload: { personName: payload.partner2Name || payload.partner2 },
          matchHints: { personName: payload.partner2Name || payload.partner2 },
        };
        [p1Op, p2Op].forEach((synthetic, syntheticIndex) => {
          const matchedIndex = findPersonIndexForSessionOp(nextPeople, synthetic);
          if (matchedIndex >= 0) return;
          const name = (synthetic.payload?.personName as string | undefined)?.trim();
          if (!name) return;
          nextPeople.push({
            id: nanoid(),
            name,
            gender: inferGenderFromName(name) || (syntheticIndex === 0 ? 'male' : 'female'),
            x: 120 + (nextPeople.length % 10) * 90,
            y: 140 + Math.floor(nextPeople.length / 10) * 90,
            partnerships: [],
            events: [],
          });
        });
      }
    });

    setPeopleAligned(() => nextPeople);

    if ((pendingSessionCaptureData.ambiguityNotes || []).length) {
      const imported = pendingSessionCaptureData.ambiguityNotes!.join('\n');
      setIdeasText((prev) => (prev.trim() ? `${prev}\n\nSession Import Ambiguities:\n${imported}` : `Session Import Ambiguities:\n${imported}`));
    }

    setSessionCaptureDialogOpen(false);
    setPendingSessionCaptureData(null);
    setPendingSessionCaptureFileName('');
    setSessionCaptureSelections({});
    alert(`Applied ${selectedOps.length} reviewed session operations.`);
  };

  const mergeDiagramState = (data: DiagramImportData, options?: { allowNewPeople?: boolean }) => {
    const allowNewPeople = options?.allowNewPeople ?? true;
    if (!Array.isArray(data.people) || !Array.isArray(data.partnerships) || !Array.isArray(data.emotionalLines)) {
      throw new Error('Invalid file format');
    }

    const incomingDefs: FunctionalIndicatorDefinition[] = Array.isArray(data.functionalIndicatorDefinitions)
      ? data.functionalIndicatorDefinitions
      : [];
    const definitionById = new Map(functionalIndicatorDefinitions.map((def) => [def.id, def]));
    incomingDefs.forEach((def) => {
      if (def?.id && !definitionById.has(def.id)) {
        definitionById.set(def.id, def);
      }
    });
    const mergedDefinitions = [...definitionById.values()];
    applyIndicatorDefinitionArray(mergedDefinitions);

    const cleaned = removeOrphanedMiscarriages(data.people, data.partnerships);
    const normalizedLines = normalizeEmotionalLines(data.emotionalLines);
    const normalizedTriangles = normalizeTriangles(Array.isArray(data.triangles) ? data.triangles : []);
    const incomingPeople = attachEventClassToEntities(cleaned.people, 'individual');
    const incomingPartnerships = attachFamilyEventsToPartnerships(
      attachEventClassToEntities(cleaned.partnerships, 'relationship')
    );
    const incomingLines = attachEventClassToEntities(normalizedLines, 'emotional-pattern');

    const usedPersonIds = new Set(people.map((p) => p.id));
    const usedPartnershipIds = new Set(partnerships.map((p) => p.id));
    const usedLineIds = new Set(emotionalLines.map((line) => line.id));
    const usedTriangleIds = new Set(triangles.map((triangle) => triangle.id));

    const personIdMap = new Map<string, string>();
    const partnershipIdMap = new Map<string, string>();
    const lineIdMap = new Map<string, string>();

    const nextUniqueId = (preferred: string | undefined, used: Set<string>) => {
      if (preferred && !used.has(preferred)) {
        used.add(preferred);
        return preferred;
      }
      let next = nanoid();
      while (used.has(next)) {
        next = nanoid();
      }
      used.add(next);
      return next;
    };

    const normalizeNameKey = (person: Pick<Person, 'name' | 'firstName' | 'lastName'>) => {
      const combined = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
      const base = (combined || person.name || '').trim().toLowerCase();
      return base.replace(/[^a-z0-9]+/g, ' ').trim();
    };
    const normalizeFirstName = (person: Pick<Person, 'name' | 'firstName'>) => {
      const first = (person.firstName || person.name || '').trim().split(/\s+/)[0] || '';
      return first.toLowerCase();
    };
    const normalizeLastName = (person: Pick<Person, 'name' | 'lastName'>) => {
      const fromField = (person.lastName || '').trim();
      if (fromField) return fromField.toLowerCase();
      const tokens = (person.name || '').trim().split(/\s+/).filter(Boolean);
      return tokens.length > 1 ? tokens[tokens.length - 1].toLowerCase() : '';
    };

    const mergeEvents = (
      current?: EmotionalProcessEvent[],
      incoming?: EmotionalProcessEvent[]
    ): EmotionalProcessEvent[] | undefined => {
      const merged = [...(current || [])];
      const seen = new Set(merged.map((event) => event.id));
      (incoming || []).forEach((event) => {
        if (!seen.has(event.id)) {
          merged.push(event);
          seen.add(event.id);
        }
      });
      return merged.length ? merged : undefined;
    };

    const mergeIndicators = (
      current?: Person['functionalIndicators'],
      incoming?: Person['functionalIndicators']
    ): Person['functionalIndicators'] => {
      const merged = [...(current || [])];
      const seen = new Set(merged.map((entry) => `${entry.definitionId}:${entry.status}`));
      (incoming || []).forEach((entry) => {
        const key = `${entry.definitionId}:${entry.status}`;
        if (!seen.has(key)) {
          merged.push(entry);
          seen.add(key);
        }
      });
      return merged.length ? merged : undefined;
    };

    const existingPersonByNameKey = new Map<string, Person>();
    const existingPersonByFirst = new Map<string, Person[]>();
    people.forEach((person) => {
      const key = normalizeNameKey(person);
      if (key && !existingPersonByNameKey.has(key)) {
        existingPersonByNameKey.set(key, person);
      }
      const first = normalizeFirstName(person);
      if (first) {
        const bucket = existingPersonByFirst.get(first) || [];
        bucket.push(person);
        existingPersonByFirst.set(first, bucket);
      }
    });

    const updatedPeopleById = new Map<string, Person>(people.map((person) => [person.id, person]));
    const newPeople: Person[] = [];

    incomingPeople.forEach((incomingPerson) => {
      const key = normalizeNameKey(incomingPerson);
      const incomingFirst = normalizeFirstName(incomingPerson);
      const incomingLast = normalizeLastName(incomingPerson);
      let existingMatch = key ? existingPersonByNameKey.get(key) : undefined;
      if (!existingMatch && incomingFirst) {
        const candidates = existingPersonByFirst.get(incomingFirst) || [];
        if (incomingLast) {
          existingMatch = candidates.find(
            (candidate) => normalizeLastName(candidate) === incomingLast
          );
        } else if (candidates.length === 1) {
          // If incoming record is single-name (e.g., "Donald"), attach to the unique existing first-name match.
          existingMatch = candidates[0];
        }
      }
      if (existingMatch) {
        personIdMap.set(incomingPerson.id, existingMatch.id);
        const mergedPerson: Person = {
          ...existingMatch,
          firstName: existingMatch.firstName || incomingPerson.firstName,
          lastName: existingMatch.lastName || incomingPerson.lastName,
          maidenName: existingMatch.maidenName || incomingPerson.maidenName,
          birthDate: existingMatch.birthDate || incomingPerson.birthDate,
          deathDate: existingMatch.deathDate || incomingPerson.deathDate,
          gender: existingMatch.gender || incomingPerson.gender,
          notes:
            existingMatch.notes && incomingPerson.notes
              ? existingMatch.notes.includes(incomingPerson.notes)
                ? existingMatch.notes
                : `${existingMatch.notes}\n${incomingPerson.notes}`
              : existingMatch.notes || incomingPerson.notes,
          lifeStatus: existingMatch.lifeStatus || incomingPerson.lifeStatus,
          adoptionStatus: existingMatch.adoptionStatus || incomingPerson.adoptionStatus,
          parentConnectionPattern:
            existingMatch.parentConnectionPattern || incomingPerson.parentConnectionPattern,
          functionalIndicators: mergeIndicators(
            existingMatch.functionalIndicators,
            incomingPerson.functionalIndicators
          ),
          events: mergeEvents(existingMatch.events, incomingPerson.events),
        };
        updatedPeopleById.set(existingMatch.id, mergedPerson);
        return;
      }

      if (!allowNewPeople) {
        // Facts-mode merge: ignore unmatched names instead of creating noisy/duplicate people.
        return;
      }

      const newId = nextUniqueId(incomingPerson.id, usedPersonIds);
      personIdMap.set(incomingPerson.id, newId);
      const nextPerson: Person = {
        ...incomingPerson,
        id: newId,
        partnerships: [],
      };
      newPeople.push(nextPerson);
      if (key) {
        existingPersonByNameKey.set(key, nextPerson);
      }
      const first = normalizeFirstName(nextPerson);
      if (first) {
        const bucket = existingPersonByFirst.get(first) || [];
        bucket.push(nextPerson);
        existingPersonByFirst.set(first, bucket);
      }
    });

    const basePeopleMerged = [...updatedPeopleById.values(), ...newPeople];

    const partnershipPairKey = (partner1: string, partner2: string) =>
      [partner1, partner2].sort().join('::');

    const existingPartnershipByPair = new Map<string, Partnership>();
    partnerships.forEach((partnership) => {
      existingPartnershipByPair.set(
        partnershipPairKey(partnership.partner1_id, partnership.partner2_id),
        partnership
      );
    });

    const mergedPartnerships = [...partnerships];
    incomingPartnerships.forEach((partnership) => {
      const partner1 = personIdMap.get(partnership.partner1_id) ?? partnership.partner1_id;
      const partner2 = personIdMap.get(partnership.partner2_id) ?? partnership.partner2_id;
      const pairKey = partnershipPairKey(partner1, partner2);
      const existingMatch = existingPartnershipByPair.get(pairKey);
      if (existingMatch) {
        partnershipIdMap.set(partnership.id, existingMatch.id);
        const mergedChildren = [
          ...new Set([
            ...(existingMatch.children || []),
            ...(partnership.children || []).map((childId) => personIdMap.get(childId) ?? childId),
          ]),
        ];
        const merged: Partnership = {
          ...existingMatch,
          relationshipType:
            existingMatch.relationshipType === 'dating' ? partnership.relationshipType : existingMatch.relationshipType,
          relationshipStatus:
            existingMatch.relationshipStatus === 'married' && partnership.relationshipStatus !== 'married'
              ? partnership.relationshipStatus
              : existingMatch.relationshipStatus,
          relationshipStartDate: existingMatch.relationshipStartDate || partnership.relationshipStartDate,
          marriedStartDate: existingMatch.marriedStartDate || partnership.marriedStartDate,
          separationDate: existingMatch.separationDate || partnership.separationDate,
          divorceDate: existingMatch.divorceDate || partnership.divorceDate,
          statusDates: {
            ...(existingMatch.statusDates || {}),
            ...(partnership.statusDates || {}),
          },
          notes:
            existingMatch.notes && partnership.notes
              ? existingMatch.notes.includes(partnership.notes)
                ? existingMatch.notes
                : `${existingMatch.notes}\n${partnership.notes}`
              : existingMatch.notes || partnership.notes,
          children: mergedChildren,
          events: mergeEvents(existingMatch.events, partnership.events),
        };
        const index = mergedPartnerships.findIndex((candidate) => candidate.id === existingMatch.id);
        if (index >= 0) mergedPartnerships[index] = merged;
        return;
      }

      const newId = nextUniqueId(partnership.id, usedPartnershipIds);
      partnershipIdMap.set(partnership.id, newId);
      const added: Partnership = {
        ...partnership,
        id: newId,
        partner1_id: partner1,
        partner2_id: partner2,
        children: (partnership.children || []).map((childId) => personIdMap.get(childId) ?? childId),
      };
      mergedPartnerships.push(added);
      existingPartnershipByPair.set(pairKey, added);
    });

    const lineKey = (line: EmotionalLine) =>
      [
        ...[line.person1_id, line.person2_id].sort(),
        line.relationshipType,
        line.lineStyle,
        line.lineEnding,
      ].join('::');

    const existingLineByKey = new Map<string, EmotionalLine>();
    emotionalLines.forEach((line) => {
      existingLineByKey.set(lineKey(line), line);
    });

    const mergedLines = [...emotionalLines];
    incomingLines.forEach((line) => {
      const remappedLine: EmotionalLine = {
        ...line,
        person1_id: personIdMap.get(line.person1_id) ?? line.person1_id,
        person2_id: personIdMap.get(line.person2_id) ?? line.person2_id,
      };
      const key = lineKey(remappedLine);
      const existingMatch = existingLineByKey.get(key);
      if (existingMatch) {
        lineIdMap.set(line.id, existingMatch.id);
        const merged: EmotionalLine = {
          ...existingMatch,
          status: existingMatch.status || remappedLine.status,
          startDate: existingMatch.startDate || remappedLine.startDate,
          endDate: existingMatch.endDate || remappedLine.endDate,
          notes:
            existingMatch.notes && remappedLine.notes
              ? existingMatch.notes.includes(remappedLine.notes)
                ? existingMatch.notes
                : `${existingMatch.notes}\n${remappedLine.notes}`
              : existingMatch.notes || remappedLine.notes,
          events: mergeEvents(existingMatch.events, remappedLine.events),
        };
        const index = mergedLines.findIndex((candidate) => candidate.id === existingMatch.id);
        if (index >= 0) mergedLines[index] = merged;
        return;
      }
      const newId = nextUniqueId(line.id, usedLineIds);
      lineIdMap.set(line.id, newId);
      const added = { ...remappedLine, id: newId };
      mergedLines.push(added);
      existingLineByKey.set(key, added);
    });

    const triangleKey = (triangle: Triangle) =>
      [triangle.person1_id, triangle.person2_id, triangle.person3_id].sort().join('::');

    const existingTriangleByKey = new Map<string, Triangle>();
    triangles.forEach((triangle) => {
      existingTriangleByKey.set(triangleKey(triangle), triangle);
    });

    const mergedTriangles = [...triangles];
    normalizedTriangles.forEach((triangle) => {
      const remappedTriangle: Triangle = {
        ...triangle,
        person1_id: personIdMap.get(triangle.person1_id) ?? triangle.person1_id,
        person2_id: personIdMap.get(triangle.person2_id) ?? triangle.person2_id,
        person3_id: personIdMap.get(triangle.person3_id) ?? triangle.person3_id,
      };
      const uniquePeople = new Set([
        remappedTriangle.person1_id,
        remappedTriangle.person2_id,
        remappedTriangle.person3_id,
      ]);
      if (uniquePeople.size !== 3) return;
      const key = triangleKey(remappedTriangle);
      const existingMatch = existingTriangleByKey.get(key);
      if (existingMatch) {
        const index = mergedTriangles.findIndex((candidate) => candidate.id === existingMatch.id);
        if (index >= 0) {
          mergedTriangles[index] = {
            ...existingMatch,
            color: existingMatch.color || remappedTriangle.color,
            intensity: existingMatch.intensity || remappedTriangle.intensity || 'medium',
          };
        }
        return;
      }
      const newId = nextUniqueId(triangle.id, usedTriangleIds);
      const added = { ...remappedTriangle, id: newId };
      mergedTriangles.push(added);
      existingTriangleByKey.set(key, added);
    });

    const peopleWithLinks: Person[] = basePeopleMerged.map((person) => {
      const personPartnerships = mergedPartnerships
        .filter((partnership) => partnership.partner1_id === person.id || partnership.partner2_id === person.id)
        .map((partnership) => partnership.id);
      const remappedParent = person.parentPartnership
        ? partnershipIdMap.get(person.parentPartnership) ?? person.parentPartnership
        : undefined;
      const remappedBirthParent = person.birthParentPartnership
        ? partnershipIdMap.get(person.birthParentPartnership) ?? person.birthParentPartnership
        : undefined;
      const parentExists = remappedParent
        ? mergedPartnerships.some((partnership) => partnership.id === remappedParent)
        : false;
      const birthParentExists = remappedBirthParent
        ? mergedPartnerships.some((partnership) => partnership.id === remappedBirthParent)
        : false;
      return {
        ...person,
        parentPartnership: parentExists ? remappedParent : person.parentPartnership,
        birthParentPartnership: birthParentExists ? remappedBirthParent : person.birthParentPartnership,
        partnerships: [...new Set([...(person.partnerships || []), ...personPartnerships])],
      };
    });

    const normalizedImportedPeople = normalizeImportedChildLayout(peopleWithLinks, mergedPartnerships, {
      expandParentSpan: true,
      autoResizeDenseFamilies: true,
    });
    const alignedPeople = alignAllAnchors(normalizedImportedPeople, mergedPartnerships);
    const sanitizedPeople = sanitizePeopleIndicators(alignedPeople, mergedDefinitions);
    const importedPageNotes = Array.isArray(data.pageNotes) ? data.pageNotes : [];
    const mergedPageNotes = (() => {
      const usedNoteIds = new Set(pageNotes.map((note) => note.id));
      return [
        ...pageNotes,
        ...importedPageNotes.map((note) => ({
          ...note,
          id: nextUniqueId(note.id, usedNoteIds),
        })),
      ];
    })();

    setPeople(sanitizedPeople);
    setPartnerships(mergedPartnerships);
    setEmotionalLines(mergedLines);
    setPageNotes(mergedPageNotes);
    setTriangles(mergedTriangles);

    const mergedCategories = [
      ...new Set([
        ...eventCategories,
        ...(Array.isArray(data.eventCategories) ? data.eventCategories : []),
      ]),
    ];
    if (mergedCategories.length) {
      setEventCategories(mergedCategories);
    }

    const mergedRelationshipTypes = [
      ...new Set([
        ...relationshipTypes,
        ...(Array.isArray(data.relationshipTypes) ? data.relationshipTypes : []),
      ]),
    ];
    if (mergedRelationshipTypes.length) {
      setRelationshipTypes(mergedRelationshipTypes);
    }

    const mergedRelationshipStatuses = [
      ...new Set([
        ...relationshipStatuses,
        ...(Array.isArray(data.relationshipStatuses) ? data.relationshipStatuses : []),
      ]),
    ];
    if (mergedRelationshipStatuses.length) {
      setRelationshipStatuses(mergedRelationshipStatuses);
    }

    if (typeof data.ideasText === 'string' && data.ideasText.trim()) {
      const importedIdeas = data.ideasText.trim();
      setIdeasText((prev) => (prev.trim() ? `${prev}\n\n${importedIdeas}` : importedIdeas));
    }
  };

  const completePendingImport = (mode: 'replace' | 'merge') => {
    if (!pendingImportData) return;
    try {
      if (mode === 'replace') {
        const normalizeLayout = pendingImportSource === 'transcript' || pendingImportSource === 'facts';
        replaceDiagramState(pendingImportData, pendingImportFileName, { normalizeLayout });
      } else {
        const allowNewPeople = pendingImportSource !== 'facts';
        mergeDiagramState(pendingImportData, { allowNewPeople });
      }
      // Imported diagrams should open with all elements visible rather than staying on a prior year cutoff.
      setTimelinePlaying(false);
      setTimelineYear(new Date().getFullYear());
      setTimelineSelectionIds([]);
      setImportModeDialogOpen(false);
      setPendingImportData(null);
      setPendingImportFileName('');
    } catch (error) {
      alert('Error importing data');
    }
  };


  const openSaveAsDialog = useCallback((onConfirm: (name: string) => void) => {
    saveAsOnConfirmRef.current = onConfirm;
    setSaveAsDialogOpen(true);
  }, []);

  // Always points to the latest saveDiagramToCurrentTarget so async flows
  // (e.g. triggerSaveAs) read fresh state after a reset, not a stale closure.
  const saveDiagramToCurrentTargetRef = useRef(saveDiagramToCurrentTarget);
  saveDiagramToCurrentTargetRef.current = saveDiagramToCurrentTarget;

  /**
   * triggerSaveAs — unified "Save As" entry point.
   * On Chrome/Edge: opens the native OS Save dialog (user can navigate to any folder + type a name).
   * On Firefox/Safari (no showSaveFilePicker): falls back to the in-app name dialog + download.
   *
   * Uses saveDiagramToCurrentTargetRef so that a state reset (File > New) that happens
   * before the async dialog resolves doesn't produce a stale-closure save of the old diagram.
   */
  const triggerSaveAs = useCallback(async (suggestedName: string) => {
    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: DIAGRAM_FILE_PICKER_TYPES,
        });
        setDiagramFileHandle(handle);
        await saveDiagramToCurrentTargetRef.current({ requestedFileName: handle.name, forceChooseLocation: false, allowPicker: false });
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return; // user cancelled — do nothing
        // Unexpected error: fall through to name-dialog fallback
      }
    }
    // Fallback for browsers without showSaveFilePicker
    openSaveAsDialog((name: string) => {
      void saveDiagramToCurrentTargetRef.current({ requestedFileName: name, forceChooseLocation: false, allowPicker: false });
    });
  }, [openSaveAsDialog, setDiagramFileHandle]);

  const handleImageDiagramPicker = useCallback(() => {
    // Open the modal directly. The modal owns its own file input + drag-drop,
    // so we don't pre-prompt the user with an OS picker first.
    setImageDiagramModalOpen(true);
    setImageDiagramAnalyzing(false);
  }, []);

  const handleAiSettingsSave = useCallback(
    (values: { anthropicApiKey: string; deepseekApiKey: string; modelId: string }) => {
      localStorage.setItem('anthropic_api_key', values.anthropicApiKey);
      localStorage.setItem('deepseek_api_key', values.deepseekApiKey);
      localStorage.setItem('selected_model_id', values.modelId);
      // Keep the legacy key in sync for any reader that hasn't migrated yet.
      localStorage.setItem('anthropic_model', values.modelId);
      setAiSettingsAnthropicApiKey(values.anthropicApiKey);
      setAiSettingsDeepseekApiKey(values.deepseekApiKey);
      setAiSettingsModelId(values.modelId);
      setAiSettingsOpen(false);
    },
    []
  );

  const handleImageDiagramLoad = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setImageDiagramModalOpen(true);
      setImageDiagramAnalyzing(false);
      e.target.value = '';
    },
    []
  );

  const handleImageDiagramAnalyze = useCallback(
    async (
      imageBlob: Blob,
      hints?: {
        generationCount: number;
        expectedPersonCount: number;
        handDrawn: boolean;
        hasNotes: boolean;
      }
    ) => {
      if (setImageDiagramAnalyzing) {
        setImageDiagramAnalyzing(true);
      }
      setImageDiagramProgress('Preparing…');
      const log = new ImportLog();
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const logFilename = `image-import-log-${ts}.txt`;
      log.info(`Image import started at ${new Date().toISOString()}`);
      if (hints) {
        log.info(
          `User hints: generations=${hints.generationCount || 'auto'} ` +
            `people~${hints.expectedPersonCount || 'auto'} ` +
            `handDrawn=${hints.handDrawn} hasNotes=${hints.hasNotes}`
        );
      }

      const showLog = (summary: string) => {
        log.info(`Final summary: ${summary}`);
        setImportLogText(log.serialize());
        setImportLogFilename(logFilename);
        setImportLogOpen(true);
      };

      try {
        // VLM-based genogram extraction: send whole image to Claude Vision for holistic reading
        const modelId =
          localStorage.getItem('selected_model_id') ||
          localStorage.getItem('anthropic_model') ||
          'claude-sonnet-4-6';
        const apiKey = localStorage.getItem('anthropic_api_key') || '';
        const activeModel = lookupModel(modelId);

        if (!apiKey || !activeModel || activeModel.provider !== 'anthropic' || !activeModel.supportsVision) {
          throw new Error(
            'Claude Vision is required for image import. ' +
              'Please set your Anthropic API key and select a Vision model in AI Settings.'
          );
        }

        log.info(`Using VLM for extraction: ${activeModel.label}`);

        // Import vlmImport at the top if not already imported
        const { vlmImport, GENOGRAM_IMPORT_COST_ESTIMATE } = await import('../utils/genogram/vlmImport');
        const { factsToDiagramImportData } = await import('../utils/dataImport');

        // Extract facts from image using VLM
        const facts = await vlmImport(imageBlob, {
          apiKey,
          model: activeModel.id,
          maxImageDimension: 1600, // Can be made configurable from settings later
          imageQuality: 0.85,
          maxTokens: 4000,
          timeoutMs: 60000,
          onProgress: (msg) => setImageDiagramProgress(msg),
        });

        log.info(`Extracted ${facts.people?.length ?? 0} people from image`);
        if (facts.uncertainties && facts.uncertainties.length > 0) {
          facts.uncertainties.forEach((u) => log.info(`Uncertainty: ${u}`));
        }

        // Convert FactsImportData to DiagramImportData
        const diagramData = factsToDiagramImportData(facts);
        const people = diagramData.people ?? [];
        const partnerships = diagramData.partnerships ?? [];

        if (people.length === 0) {
          showLog(
            `0 people extracted from image. This may indicate low contrast, heavy shadows, or an image that is not a genogram. Try a clearer image or check if the diagram uses standard genogram symbols (squares=male, circles=female).`
          );
          return;
        }

        setPeople((prev) => [...prev, ...people]);
        setPartnerships((prev) => [...prev, ...partnerships]);
        setImageDiagramModalOpen(false);
        setExtractedDiagramData(null);
        setPersonInventory([]);
        log.info(`Imported ${people.length} people and ${partnerships.length} partnerships.`);
        log.info(`Estimated cost per image: ~$${GENOGRAM_IMPORT_COST_ESTIMATE.estimatedCostPerImage.toFixed(3)} USD`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        log.error(`Caught exception: ${message}`);
        showLog(`Analysis failed: ${message}`);
      } finally {
        setImageDiagramAnalyzing(false);
        setImageDiagramProgress('');
      }
    },
    []
  );

  const handleImageDiagramCreateDiagram = useCallback(
    async (reviewedInventory: PersonInventoryItem[]) => {
      if (!extractedDiagramData) return;

      // Convert reviewed inventory back to ReviewedDiagramData
      const reviewed = {
        persons: extractedDiagramData.persons.map((p) => {
          const item = reviewedInventory.find((inv) => inv.id === p.id);
          return {
            id: p.id,
            name: item?.name || p.extractedName,
            gender: (item?.gender || p.gender) as 'male' | 'female' | 'unknown',
            notes: item?.notes,
            removed: false,
          };
        }),
        relationships: extractedDiagramData.relationships,
      };

      // Convert to Person and Partnership objects
      const { people: newPeople, partnerships: newPartnerships } = convertExtractedToDiagram(reviewed);

      // Auto-layout the extracted diagram
      const positions = autoLayoutExtractedDiagram(newPeople, newPartnerships);

      // Apply positions to people, then derive notesPosition from final x/y.
      const positionedPeople = applyNotesPositions(
        newPeople.map((p) => ({ ...p, ...positions[p.id] }))
      );

      // Now that people have final y values, compute horizontalConnectorY per partnership.
      const connectedPartnerships = applyHorizontalConnectorY(positionedPeople, newPartnerships);

      // Add to current diagram
      setPeople((prev) => [...prev, ...positionedPeople]);
      setPartnerships((prev) => [...prev, ...connectedPartnerships]);

      // Close modal and reset state
      setImageDiagramModalOpen(false);
      setExtractedDiagramData(null);
      setPersonInventory([]);
    },
    [extractedDiagramData]
  );

  const {
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
    handleStartBuildDemo,
    handleCloseBuildDemo,
    handleBuildDemoStepChange,
    handleCloseDemoTour,
  } = useFileOperations({
    fileName,
    isDirty,
    people,
    partnerships,
    emotionalLines,
    pageNotes,
    triangles,
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
    triggerSaveAs,
  });


  // Re-opens the last-used file when browser permission wasn't auto-granted on
  // startup. Called from the File menu "Reopen [filename]" item so the browser
  // has a user-gesture context for requestPermission().
  const handleReopenLastFile = useCallback(async () => {
    if (!pendingReopenHandle) return;
    const granted = await ensureDiagramHandlePermission(pendingReopenHandle, 'readwrite');
    if (!granted) {
      alert('Permission was not granted. Please use File > Open to locate the file manually.');
      return;
    }
    try {
      const file = await pendingReopenHandle.getFile();
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      replaceDiagramState(data, pendingReopenHandle.name as string);
      setDiagramFileHandle(pendingReopenHandle);
      setPendingReopenHandle(null);
      setPendingReopenName('');
    } catch {
      alert('Could not read the file. Please use File > Open to locate it manually.');
    }
  }, [pendingReopenHandle, ensureDiagramHandlePermission, replaceDiagramState, setDiagramFileHandle]);

  const handleCanvasScrollHint = () => {
    if (scrollHintShownRef.current) return;
    scrollHintShownRef.current = true;
    setCanvasScrollHintOpen(true);
  };

  useEffect(() => {
    if (!demoTourOpen) return;
    const step = demoTourSteps[demoTourStepIndex];
    if (!step) return;
    const focus = step.focus;

    if (focus.kind === 'none') {
      setSelectedPeopleIds([]);
      setSelectedPartnershipId(null);
      setSelectedEmotionalLineId(null);
      setSelectedChildId(null);
      setPropertiesPanelItem(null);
      setTimelineSelectionIds([]);
      return;
    }

    if (focus.kind === 'person') {
      const person = people.find((entry) => entry.id === focus.personId);
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
      setTimelineSelectionIds([]);
      return;
    }

    if (focus.kind === 'partnership') {
      const partnership = partnerships.find((entry) => entry.id === focus.partnershipId);
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
      setTimelineSelectionIds([]);
      return;
    }

    if (focus.kind === 'emotional') {
      const line = allEmotionalLines.find((entry) => entry.id === focus.lineId);
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
      setTimelineSelectionIds([]);
      return;
    }

    if (focus.kind === 'toolbar') {
      setSelectedPeopleIds([]);
      setSelectedPartnershipId(null);
      setSelectedEmotionalLineId(null);
      setSelectedChildId(null);
      setPropertiesPanelItem(null);
      setTimelineSelectionIds([]);
      return;
    }

    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setPropertiesPanelItem(null);
    if (focus.kind === 'timeline') {
      setTimelineSelectionIds(focus.personIds);
    }
  }, [
    allEmotionalLines,
    demoTourOpen,
    demoTourStepIndex,
    demoTourSteps,
    people,
    partnerships,
  ]);

  useEffect(() => {
    if (!demoTourOpen) {
      setDemoBlinkVisible(true);
      return;
    }
    const step = demoTourSteps[demoTourStepIndex];
    const shouldBlink =
      step?.focus.kind === 'canvas' ||
      step?.focus.kind === 'person' ||
      step?.focus.kind === 'partnership' ||
      step?.focus.kind === 'emotional' ||
      step?.focus.kind === 'toolbar';
    if (!shouldBlink) {
      setDemoBlinkVisible(true);
      return;
    }
    setDemoBlinkVisible(true);
    let toggles = 0;
    const interval = window.setInterval(() => {
      toggles += 1;
      setDemoBlinkVisible((prev) => !prev);
      if (toggles >= 8) {
        window.clearInterval(interval);
        setDemoBlinkVisible(true);
      }
    }, 220);
    return () => {
      window.clearInterval(interval);
      setDemoBlinkVisible(true);
    };
  }, [demoTourOpen, demoTourStepIndex, demoTourSteps]);

  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setVoiceSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      const chunks: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result?.isFinal) continue;
        const transcript = result[0]?.transcript?.trim();
        if (transcript) chunks.push(transcript);
      }
      if (!chunks.length) return;
      setVoiceCommandText((prev) => {
        const prefix = prev.trim();
        const appended = chunks.join('. ');
        return prefix ? `${prefix}\n${appended}` : appended;
      });
      setVoiceStatusMessage('Captured voice input. Review before applying.');
    };
    recognition.onerror = () => {
      setVoiceListening(false);
      setVoiceStatusMessage('Speech recognition stopped due to an error.');
    };
    recognition.onend = () => {
      setVoiceListening(false);
    };

    speechRecognitionRef.current = recognition;
    setVoiceSupported(true);

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
      speechRecognitionRef.current = null;
    };
  }, []);

  const handleExportPersonEvents = () => {
    const payload = buildTimelineJson(people, fileName);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(payload.timelineName || 'timeline').replace(/[^a-z0-9- _]/gi, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPersonEventsLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || ''));
        const bundle = isTimelineJson(parsed)
          ? timelineJsonToBundle(parsed)
          : isPersonEventBundle(parsed)
          ? parsed
          : null;
        if (!bundle) {
          throw new Error('Not a person-event bundle');
        }
        const result = mergePersonEventsFromBundle(people, bundle);
        setPeople(result.people);
        setTimelineYear(new Date().getFullYear());
        setTimelinePlaying(false);
        const summary = result.summary;
        const unmatched =
          summary.unmatchedPeople.length > 0
            ? `\nUnmatched: ${summary.unmatchedPeople.join(', ')}`
            : '';
        alert(
          `Imported person events.\nMatched people: ${summary.matchedPeople}\nAdded: ${summary.addedEvents}\nUpdated: ${summary.updatedEvents}\nRemoved: ${summary.removedEvents}${unmatched}`
        );
      } catch {
        alert('Error parsing timeline/person events JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleOpenEventCreator = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'event-creator');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  const handleQuit = () => {
    const confirmQuit = window.confirm(
      'Quit the Family Diagram Maker? Unsaved changes will be lost.'
    );
    if (confirmQuit) {
      window.close();
    }
  };

  const {
    addPerson,
    addCoach,
    addAIAgent,
    addParentsForPerson,
    createChildrenForPartnership,
    createAdoptedChildForPartnership,
    removePartnership,
    removePerson,
    removeChildFromPartnership,
    createFamilyFromDraft,
  } = usePersonOperations({
    people,
    partnerships,
    selectedPeopleIds,
    propertiesPanelItem,
    setPeople,
    setPeopleAligned,
    alignAllAnchors,
    setPartnerships,
    setEmotionalLines,
    setTriangles,
    setSelectedPeopleIds,
    setSelectedPartnershipId,
    setSelectedEmotionalLineId,
    setSelectedChildId,
    setPropertiesPanelItem,
    setContextMenu,
  });


  const handleExportPNG = () => {
    const uri = stageRef.current?.toDataURL();
    if (uri) {
      const a = document.createElement('a');
      a.href = uri;
      a.download = 'family-diagram.png';
      a.click();
    }
  };

  const handleExportSVG = () => {
    const uri = stageRef.current?.toDataURL({ mimeType: 'image/svg+xml' });
    if (uri) {
      const a = document.createElement('a');
      a.href = uri;
      a.download = 'family-diagram.svg';
      a.click();
    }
  };

  const {
    handlePersonDragStart,
    handlePersonDrag,
    handleGroupBoxDragStart,
    handleGroupBoxDragMove,
    handleHorizontalConnectorDragEnd,
    handlePersonNoteDragEnd,
    handlePersonNoteResizeEnd,
    handlePartnershipNoteDragEnd,
    handlePartnershipNoteResizeEnd,
    handleFamilyNoteDragEnd,
    handleFamilyNoteResizeEnd,
    handleEmotionalLineNoteDragEnd,
    handleEmotionalLineNoteResizeEnd,
    handleTriangleNoteDragEnd,
    handleTriangleNoteResizeEnd,
  } = useCanvasDragHandlers({
    selectedPeopleIds,
    selectedPageNoteIds,
    people,
    partnerships,
    allEmotionalLines,
    pageNotes,
    dragGroupRef,
    setPeopleAligned,
    setPartnerships,
    setEmotionalLines,
    setTriangles,
    setPageNotes,
  });

  const addGeneralNote = (x: number, y: number) => {
    const newNote: PageNote = {
      id: nanoid(),
      x,
      y,
      title: 'General Note',
      text: '',
      width: 220,
      height: 140,
      fillColor: '#fff8c6',
    };
    setPageNotes((prev) => [...prev, newNote]);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setPropertiesPanelItem(null);
    setSelectedPageNoteId(newNote.id);
    setPageNoteDraft({
      title: newNote.title,
      text: newNote.text,
      fillColor: newNote.fillColor || '#fff8c6',
    });
  };

  const openAddFamilyModal = (position: { x: number; y: number }) => {
    setAddFamilyDraft({
      parent1: { sex: 'male' as const, firstName: '', birthDate: '' },
      parent2: { sex: 'female' as const, firstName: '', birthDate: '' },
      familySurname: '',
      children: [
        { sex: 'male' as const, firstName: '', birthDate: '' },
        { sex: 'female' as const, firstName: '', birthDate: '' },
        { sex: 'male' as const, firstName: '', birthDate: '' },
      ],
    });
    setAddFamilyPosition(position);
    setAddFamilyModalOpen(true);
  };

  const updateAddFamilyDraft = (updates: Partial<AddFamilyDraft>) => {
    if (!addFamilyDraft) return;
    setAddFamilyDraft({ ...addFamilyDraft, ...updates });
  };

  const saveAddFamily = () => {
    if (!addFamilyDraft || !addFamilyPosition) return;
    createFamilyFromDraft(addFamilyDraft, addFamilyPosition);
    setAddFamilyModalOpen(false);
    setAddFamilyDraft(null);
    setAddFamilyPosition(null);
  };

  const {
    handlePersonContextMenu,
    handleChildLineContextMenu,
    handlePartnershipContextMenu,
    handleStageContextMenu,
    handleGroupContextMenu,
  } = useContextMenuHandlers({
    people,
    partnerships,
    selectedPeopleIds,
    selectedPartnershipId,
    selectedFamilyIds,
    relationshipTypes,
    functionalFactCategories,
    setContextMenu,
    setSelectedPeopleIds,
    setSelectedPartnershipId,
    setSelectedEmotionalLineId,
    setSelectedChildId,
    setSelectedPageNoteId,
    setPageNoteDraft,
    setPropertiesPanelItem,
    setPropertiesPanelIntent,
    setTimelineSelectionIds,
    setTimelineFamilySelectionIds,
    addPerson,
    addCoach,
    addAIAgent,
    addParentsForPerson,
    createChildrenForPartnership,
    createAdoptedChildForPartnership,
    removePartnership,
    removePerson,
    removeChildFromPartnership,
    addPartnerForPerson,
    openAddEmotionalPatternModal,
    handleUpdatePerson,
    handleUpdatePartnership,
    openContextualEventCreator,
    openClientProfileModal,
    openCoachThinkingModal,
    addTriangle,
    changeSex,
    addChildToPartnership,
    openPersonSectionPopup,
    openPartnershipSectionPopup,
    addGeneralNote,
    openAddFamilyModal,
    addEmotionalLine,
    removeEmotionalLine,
    zoom,
    viewport,
    panelWidth,
    ribbonHeight,
  });

  const openTrianglePropertyModal = (
    triangleId: string,
    seed: Partial<EmotionalProcessEvent>,
    position: { x: number; y: number },
    modalTitle?: string
  ) => {
    const triangle = triangles.find((t) => t.id === triangleId);
    if (!triangle) return;
    const person1 = people.find((p) => p.id === triangle.person1_id);
    const person2 = people.find((p) => p.id === triangle.person2_id);
    const person3 = people.find((p) => p.id === triangle.person3_id);
    const today = new Date().toISOString().slice(0, 10);
    const sub = seed?.subtype || 'Functioning';
    const resolvedTitle = modalTitle || ['Triangle', seed?.category || 'Triangle', sub].filter(Boolean).join(' ');
    setTrianglePropertyModal({
      triangleId,
      position,
      modalTitle: resolvedTitle,
      draft: {
        date: today,
        startDate: today,
        category: 'Triangle',
        subtype: 'Functioning',
        status: 'ongoing',
        intensity: 1,
        frequency: 1,
        impact: 1,
        howWell: 0,
        wwwwh: '',
        observations: '',
        primaryPersonName: person1?.name || person2?.name || '',
        otherPersonName: person3?.name || person2?.name || '',
        ...seed,
        id: nanoid(),
        eventType: 'TRIANGLE',
        eventClass: 'triangle',
        anchorType: 'EMOTIONAL_PROCESS_EP',
        anchorId: triangleId,
      },
    });
  };

  const openFamilyPropertyModal = (
    partnershipId: string,
    seed: Partial<EmotionalProcessEvent>,
    position: { x: number; y: number },
    modalTitle?: string
  ) => {
    const partnership = partnerships.find((p) => p.id === partnershipId);
    if (!partnership) return;
    const partner1 = people.find((p) => p.id === partnership.partner1_id);
    const partner2 = people.find((p) => p.id === partnership.partner2_id);
    const today = new Date().toISOString().slice(0, 10);
    setFamilyPropertyModal({
      partnershipId,
      position,
      modalTitle,
      draft: {
        date: today,
        startDate: today,
        category: 'Triangles',
        subtype: 'Functioning',
        status: 'ongoing',
        intensity: 1,
        frequency: 1,
        impact: 1,
        howWell: 0,
        wwwwh: '',
        observations: '',
        primaryPersonName: partner1?.name || '',
        otherPersonName: partner2?.name || '',
        ...seed,
        id: nanoid(),
        eventType: (seed?.eventType as EventType | undefined) || 'FAMILY',
        eventClass: seed?.eventClass || 'emotional-pattern',
        anchorType: 'EMOTIONAL_PROCESS_EP',
        anchorId: partnershipId,
      },
    });
  };

  const handleFamilyIndicatorClick = (
    partnershipId: string,
    eventId: string,
    position: { x: number; y: number }
  ) => {
    const partnership = partnerships.find((p) => p.id === partnershipId);
    if (!partnership) return;
    const event = (partnership.familyEvents || []).find((e) => e.id === eventId);
    if (!event) return;
    setSelectedFamilyId(partnershipId);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    const eType = event.eventType || 'FAMILY';
    const typeLabel = EVENT_TYPE_LABELS[eType as EventType] || eType;
    const cat = event.category || '';
    const sub = event.subtype || '';
    const editTitle = ['Edit', typeLabel, cat, sub].filter(Boolean).join(' ');
    setFamilyPropertyModal({
      partnershipId,
      position,
      editingEventId: eventId,
      modalTitle: editTitle,
      draft: { ...event },
    });
  };

  const handleDeleteFamilyEvent = (partnershipId: string, eventId: string) => {
    setPartnerships((prev) =>
      prev.map((p) =>
        p.id !== partnershipId
          ? p
          : { ...p, familyEvents: (p.familyEvents || []).filter((e) => e.id !== eventId) }
      )
    );
  };

  const handleFamilyClick = (partnershipId: string, shiftKey?: boolean) => {
    // Family click works just like person click:
    //   plain click  → replace selection with this family (no toggle off)
    //   shift-click  → toggle this family in/out of the family selection
    //                  WITHOUT touching person / EPL selections, so mixed
    //                  Person + Family selections compose naturally.
    // Deselect-all only happens on a background (stage) click, never on
    // an object click.
    if (shiftKey) {
      setSelectedFamilyIds((prev) => {
        const next = prev.includes(partnershipId)
          ? prev.filter((id) => id !== partnershipId)
          : [...prev, partnershipId];
        if (next.length === 1) {
          const partnership = partnerships.find((p) => p.id === next[0]);
          setPropertiesPanelItem(partnership || null);
        } else {
          setPropertiesPanelItem(null);
        }
        return next;
      });
      return;
    }
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    setSelectedFamilyIds([partnershipId]);
    const partnership = partnerships.find((p) => p.id === partnershipId);
    setPropertiesPanelItem(partnership || null);
  };

  const handleFamilyContextMenu = (e: KonvaEventObject<PointerEvent>, partnershipId: string) => {
    e.evt.preventDefault();
    // If the right-clicked family isn't part of the current family selection,
    // make it the new single-family selection. Otherwise leave the selection
    // alone (so the user's multi-select stays intact and Timeline can use it).
    // Person / EPL selections are NOT cleared — the user may want to combine
    // selected people and selected families on the timeline.
    setSelectedFamilyIds((prev) => (prev.includes(partnershipId) ? prev : [partnershipId]));
    const pos = { x: e.evt.clientX, y: e.evt.clientY };
    const makeFamilyItem = (label: string, processType: string, category: string, menuGroup: string) => ({
      label,
      onClick: () => {
        openFamilyPropertyModal(
          partnershipId,
          {
            eventType: 'FAMILY',
            subtype: processType,
            category,
            eventClass: 'emotional-pattern',
            status: 'ongoing',
            intensity: 1,
            frequency: 1,
            impact: 1,
          },
          pos,
          `Family ${menuGroup} ${label}`
        );
        setContextMenu(null);
      },
    });
    setContextMenu({
      x: e.evt.clientX,
      y: e.evt.clientY,
      items: [
        {
          label: 'Triangles',
          children: [
            makeFamilyItem('Functioning', 'Functioning', 'Triangles', 'Triangles'),
            makeFamilyItem('Flexibility', 'Flexibility', 'Triangles', 'Triangles'),
            makeFamilyItem('Stress Response', 'Stress Response', 'Triangles', 'Triangles'),
          ],
        },
        {
          label: 'Stressors',
          children: [
            makeFamilyItem('Emotional Reactivity', 'Emotional Reactivity', 'Stress', 'Stressors'),
            makeFamilyItem('Adaptability', 'Adaptability', 'Stress', 'Stressors'),
            makeFamilyItem('Family Stressor', 'Family Stressor', 'Stress', 'Stressors'),
            makeFamilyItem('Chronic Stress', 'Chronic Stress', 'Stress', 'Stressors'),
          ],
        },
        {
          label: 'Timeline',
          onClick: () => {
            // Timeline shows whatever is currently selected — all selected
            // families + all selected people. The right-click already
            // guarantees this family is part of the family selection.
            const familyIds = selectedFamilyIds.includes(partnershipId)
              ? selectedFamilyIds
              : [partnershipId, ...selectedFamilyIds];
            setTimelineFamilySelectionIds(familyIds);
            setTimelineSelectionIds(selectedPeopleIds.length ? [...selectedPeopleIds] : []);
            setContextMenu(null);
          },
        },
      ],
    });
  };

  const handleFamilyAddGenericEvent = (partnershipId: string, position: { x: number; y: number }) => {
    openFamilyPropertyModal(partnershipId, { eventType: 'FAMILY' as EventType, eventClass: 'relationship' }, position, 'Family Add Event');
  };

  const {
    handlePageNoteSelect,
    handlePageNoteDraftChange,
    handlePageNoteSave,
    handlePageNoteDelete,
    handlePageNoteDragEnd,
    handlePageNoteResizeEnd,
    handleChildLineSelect,
    handleEmotionalLineSelect,
    handleEmotionalLineContextMenu,
    handleTriangleAreaSelect,
    handleTriangleAreaContextMenu,
    handleSelect,
    handlePartnershipSelect,
  } = useSelectionHandlers({
    pageNotes,
    selectedPageNoteId,
    pageNoteDraft,
    selectedEmotionalLineId,
    selectedPeopleIds,
    selectedPartnershipId,
    people,
    partnerships,
    triangles,
    allEmotionalLines,
    triangleByTplLineId,
    setPageNotes,
    setSelectedPeopleIds,
    setSelectedPartnershipId,
    setSelectedEmotionalLineId,
    setSelectedChildId,
    setSelectedPageNoteId,
    setPageNoteDraft,
    setPropertiesPanelItem,
    setSelectedFamilyId,
    setContextMenu,
    addChildToPartnership,
    handleUpdateEmotionalLine,
    openContextualEventCreator,
    openTrianglePropertyModal,
    removeTriangle,
    removeEmotionalLine,
    updateTriangle,
  });

  const getPersonSelectionBounds = useCallback((person: Person) => {
    const size = person.size ?? 60;
    const half = size / 2;
    return {
      x: person.x - half,
      y: person.y - half,
      width: size,
      height: size,
    };
  }, []);

  const getPageNoteSelectionBounds = useCallback((note: PageNote) => {
    const width = note.width || 220;
    const height = note.height || 140;
    return {
      x: note.x,
      y: note.y,
      width,
      height,
    };
  }, []);

  const selectedGroupBounds = useMemo(() => {
    const selected = people.filter((person) => selectedPeopleIds.includes(person.id));
    if (selected.length < 2) return null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    selected.forEach((person) => {
      const bounds = getPersonSelectionBounds(person);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    });
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }
    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }, [people, selectedPeopleIds, getPersonSelectionBounds]);

  const selectPeopleByMarquee = useCallback(
    (selectionRect: { x: number; y: number; width: number; height: number }) => {
      const selected = people
        .filter((person) => personVisibility.get(person.id))
        .filter((person) => {
          const bounds = getPersonSelectionBounds(person);
          return (
            bounds.x < selectionRect.x + selectionRect.width &&
            bounds.x + bounds.width > selectionRect.x &&
            bounds.y < selectionRect.y + selectionRect.height &&
            bounds.y + bounds.height > selectionRect.y
          );
        })
        .map((person) => person.id);
      const selectedNotes = pageNotes
        .filter((note) => {
          const bounds = getPageNoteSelectionBounds(note);
          return (
            bounds.x < selectionRect.x + selectionRect.width &&
            bounds.x + bounds.width > selectionRect.x &&
            bounds.y < selectionRect.y + selectionRect.height &&
            bounds.y + bounds.height > selectionRect.y
          );
        })
        .map((note) => note.id);

      setSelectedPeopleIds(selected);
      setSelectedPageNoteIds(selectedNotes);
      setSelectedPartnershipId(null);
      setSelectedEmotionalLineId(null);
      setSelectedChildId(null);
      if (selectedNotes.length === 1) {
        const note = pageNotes.find((entry) => entry.id === selectedNotes[0]) || null;
        setSelectedPageNoteId(selectedNotes[0]);
        setPageNoteDraft(
          note
            ? {
                title: note.title,
                text: note.text,
                fillColor: note.fillColor || '#fff8c6',
              }
            : null
        );
        setPropertiesPanelItem(null);
      } else {
        setSelectedPageNoteId(null);
        setPageNoteDraft(null);
      }
      if (selected.length === 1) {
        const only = people.find((person) => person.id === selected[0]) || null;
        setPropertiesPanelItem(only);
      } else if (selected.length !== 0 || selectedNotes.length !== 1) {
        setPropertiesPanelItem(null);
      }
    },
    [people, personVisibility, getPersonSelectionBounds, pageNotes, getPageNoteSelectionBounds]
  );

  const beginGroupResize = useCallback(() => {
    if (!selectedGroupBounds || selectedPeopleIds.length < 2) return;
    const selectionIds = [...selectedPeopleIds];
    const peopleMap = new Map<string, { x: number; y: number; notesPosition?: { x: number; y: number } }>();
    people.forEach((person) => {
      if (!selectionIds.includes(person.id)) return;
      peopleMap.set(person.id, {
        x: person.x,
        y: person.y,
        notesPosition: person.notesPosition ? { ...person.notesPosition } : undefined,
      });
    });

    const partnershipsMap = new Map<string, { horizontalConnectorY: number; notesPosition?: { x: number; y: number } }>();
    partnerships.forEach((partnership) => {
      if (!selectionIds.includes(partnership.partner1_id) || !selectionIds.includes(partnership.partner2_id)) return;
      partnershipsMap.set(partnership.id, {
        horizontalConnectorY: partnership.horizontalConnectorY,
        notesPosition: partnership.notesPosition ? { ...partnership.notesPosition } : undefined,
      });
    });

    const emotionalLinesMap = new Map<string, { notesPosition?: { x: number; y: number } }>();
    allEmotionalLines.forEach((line) => {
      if (!selectionIds.includes(line.person1_id) || !selectionIds.includes(line.person2_id)) return;
      emotionalLinesMap.set(line.id, {
        notesPosition: line.notesPosition ? { ...line.notesPosition } : undefined,
      });
    });

    groupResizeStateRef.current = {
      selectionIds,
      bounds: { ...selectedGroupBounds },
      people: peopleMap,
      partnerships: partnershipsMap,
      emotionalLines: emotionalLinesMap,
    };
  }, [allEmotionalLines, partnerships, people, selectedGroupBounds, selectedPeopleIds]);

  const applyGroupResize = (nextBounds: { width: number; height: number }) => {
    const state = groupResizeStateRef.current;
    if (!state) return;
    const base = state.bounds;
    const baseWidth = Math.max(1, base.width);
    const baseHeight = Math.max(1, base.height);
    const scaleX = Math.max(0.1, nextBounds.width / baseWidth);
    const scaleY = Math.max(0.1, nextBounds.height / baseHeight);

    const scaleFromTopLeft = (x: number, y: number) => ({
      x: base.x + (x - base.x) * scaleX,
      y: base.y + (y - base.y) * scaleY,
    });

    setPeopleAligned((prev) =>
      prev.map((person) => {
        const source = state.people.get(person.id);
        if (!source) return person;
        const scaled = scaleFromTopLeft(source.x, source.y);
        return {
          ...person,
          x: scaled.x,
          y: scaled.y,
          notesPosition: source.notesPosition
            ? scaleFromTopLeft(source.notesPosition.x, source.notesPosition.y)
            : person.notesPosition,
        };
      })
    );

    setPartnerships((prev) =>
      prev.map((partnership) => {
        const source = state.partnerships.get(partnership.id);
        if (!source) return partnership;
        return {
          ...partnership,
          horizontalConnectorY: base.y + (source.horizontalConnectorY - base.y) * scaleY,
          notesPosition: source.notesPosition
            ? scaleFromTopLeft(source.notesPosition.x, source.notesPosition.y)
            : partnership.notesPosition,
        };
      })
    );

    setEmotionalLines((prev) =>
      prev.map((line) => {
        const source = state.emotionalLines.get(line.id);
        if (!source) return line;
        return {
          ...line,
          notesPosition: source.notesPosition
            ? scaleFromTopLeft(source.notesPosition.x, source.notesPosition.y)
            : line.notesPosition,
        };
      })
    );

    setTriangles((prev) =>
      prev.map((triangle) => {
        if (!triangle.tpls?.length) return triangle;
        let changed = false;
        const nextTpls = triangle.tpls.map((tpl) => {
          const source = state.emotionalLines.get(tpl.id);
          if (!source) return tpl;
          changed = true;
          return {
            ...tpl,
            notesPosition: source.notesPosition
              ? scaleFromTopLeft(source.notesPosition.x, source.notesPosition.y)
              : tpl.notesPosition,
          };
        });
        return changed ? { ...triangle, tpls: nextTpls } : triangle;
      })
    );
  };

  const endGroupResize = () => {
    groupResizeStateRef.current = null;
  };

      const canvasWidth = Math.max(0, viewport.width - panelWidth);
      const canvasHeight = Math.max(0, viewport.height - ribbonHeight);
      const stageOffset = {
        x: ((1 - zoom) * canvasWidth) / 2,
        y: ((1 - zoom) * canvasHeight) / 2,
      };
      const toCanvasPoint = (pointer: { x: number; y: number }) => ({
        x: (pointer.x - stageOffset.x) / zoom,
        y: (pointer.y - stageOffset.y) / zoom,
      });
      const handleCenterDiagramView = () => {
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        people.forEach((person) => {
          const personBounds = getPersonSelectionBounds(person);
          minX = Math.min(minX, personBounds.x);
          minY = Math.min(minY, personBounds.y);
          maxX = Math.max(maxX, personBounds.x + personBounds.width);
          maxY = Math.max(maxY, personBounds.y + personBounds.height);
        });

        pageNotes.forEach((note) => {
          const noteBounds = getPageNoteSelectionBounds(note);
          minX = Math.min(minX, noteBounds.x);
          minY = Math.min(minY, noteBounds.y);
          maxX = Math.max(maxX, noteBounds.x + noteBounds.width);
          maxY = Math.max(maxY, noteBounds.y + noteBounds.height);
        });

        setZoom(0.5);
        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
          return;
        }
        translateDiagram(canvasWidth / 2 - (minX + maxX) / 2, canvasHeight / 2 - (minY + maxY) / 2);
      };
      const selectedRibbonHelp = ribbonHelpKey ? RIBBON_HELP[ribbonHelpKey] : null;
      const selectedRibbonHelpBody =
        ribbonHelpKey === 'save' && selectedRibbonHelp
          ? `${selectedRibbonHelp.body}\n\nCurrent save mode: ${storageStatusLabel}`
          : selectedRibbonHelp?.body ?? '';
      const currentDemoStep = demoTourSteps[demoTourStepIndex] || demoTourSteps[0];
      const isDemoFocusedPerson = (personId: string) =>
        demoTourOpen &&
        currentDemoStep?.focus.kind === 'person' &&
        currentDemoStep.focus.personId === personId;
      const isDemoFocusedPartnership = (partnershipId: string) =>
        demoTourOpen &&
        currentDemoStep?.focus.kind === 'partnership' &&
        currentDemoStep.focus.partnershipId === partnershipId;
      const isDemoFocusedEmotionalLine = (lineId: string) =>
        demoTourOpen &&
        currentDemoStep?.focus.kind === 'emotional' &&
        currentDemoStep.focus.lineId === lineId;
      const isDemoFocusedCanvas = demoTourOpen && currentDemoStep?.focus.kind === 'canvas';
      const personSectionPopupPerson = personSectionPopup
        ? people.find((person) => person.id === personSectionPopup.personId) || null
        : null;
      const partnershipSectionPopupPartnership = partnershipSectionPopup
        ? partnerships.find((partnership) => partnership.id === partnershipSectionPopup.partnershipId) || null
        : null;

      return (
        <div>
          <AppRibbon
            ribbonRef={ribbonRef}
            fileMenuRef={fileMenuRef}
            settingsMenuRef={settingsMenuRef}
            optionsMenuRef={optionsMenuRef}
            helpMenuRef={helpMenuRef}
            loadInputRef={loadInputRef}
            importInputRef={importInputRef}
            importPersonEventsInputRef={importPersonEventsInputRef}
            transcriptInputRef={transcriptInputRef}
            imageDiagramInputRef={imageDiagramInputRef}
            fileMenuOpen={fileMenuOpen}
            settingsMenuOpen={settingsMenuOpen}
            optionsMenuOpen={optionsMenuOpen}
            helpMenuOpen={helpMenuOpen}
            isDirty={isDirty}
            lastDirtyTimestamp={lastDirtyTimestamp}
            demoBlinkVisible={demoBlinkVisible}
            ribbonHelpKey={ribbonHelpKey}
            notesLayerEnabled={notesLayerEnabled}
            autoSaveMinutes={autoSaveMinutes}
            backupCount={backupCount}
            timelineYear={timelineYear}
            timelinePlaying={timelinePlaying}
            timelineSliderDisabled={timelineSliderDisabled}
            timelineYearBounds={timelineYearBounds}
            displayTimelineYear={displayTimelineYear}
            zoom={zoom}
            helpOpen={helpOpen}
            fileName={fileName}
            demoTourOpen={demoTourOpen}
            demoTourStepIndex={demoTourStepIndex}
            demoTourSteps={demoTourSteps}
            imageDiagramModalOpen={imageDiagramModalOpen}
            imageDiagramAnalyzing={imageDiagramAnalyzing}
            setFileMenuOpen={setFileMenuOpen}
            setSettingsMenuOpen={setSettingsMenuOpen}
            setOptionsMenuOpen={setOptionsMenuOpen}
            setHelpMenuOpen={setHelpMenuOpen}
            setRibbonHelpKey={setRibbonHelpKey}
            setZoom={setZoom}
            setTimelineYear={setTimelineYear}
            setVoiceInputOpen={setVoiceInputOpen}
            setSettingsOpen={setSettingsOpen}
            setRelationshipTypeSettingsOpen={setRelationshipTypeSettingsOpen}
            setRelationshipStatusSettingsOpen={setRelationshipStatusSettingsOpen}
            setIndicatorSettingsOpen={setIndicatorSettingsOpen}
            setSirSettingsOpen={setSirSettingsOpen}
            setFfSettingsOpen={setFfSettingsOpen}
            setNodalSettingsOpen={setNodalSettingsOpen}
            setAiSettingsOpen={setAiSettingsOpen}
            setIdeasOpen={setIdeasOpen}
            setPredictionsOpen={setPredictionsOpen}
            setSessionNotesOpen={setSessionNotesOpen}
            setDemoTourStepIndex={setDemoTourStepIndex}
            setDemoTourOpen={setDemoTourOpen}
            setBuildDemoStepIndex={setBuildDemoStepIndex}
            setBuildDemoOpen={setBuildDemoOpen}
            setTrainingVideosOpen={setTrainingVideosOpen}
            setReadmeViewerOpen={setReadmeViewerOpen}
            setNotesLayerEnabled={setNotesLayerEnabled}
            showSiblingConflicts={showSiblingConflicts}
            setShowSiblingConflicts={setShowSiblingConflicts}
            handleNewFile={handleNewFile}
            pendingReopenName={pendingReopenName}
            handleReopenLastFile={handleReopenLastFile}
            handleLoadDemoDiagram={handleLoadDemoDiagram}
            handleOpenFilePicker={handleOpenFilePicker}
            handleImportDataPicker={handleImportDataPicker}
            handleImportPersonEventsPicker={handleImportPersonEventsPicker}
            handleSave={handleSave}
            handleSaveAs={handleSaveAs}
            handleOpenBackupRestore={handleOpenBackupRestore}
            handleExportPersonEvents={handleExportPersonEvents}
            handleExportPNG={handleExportPNG}
            handleExportSVG={handleExportSVG}
            handleQuit={handleQuit}
            handleProcessTranscriptPicker={handleProcessTranscriptPicker}
            handleOpenEventCreator={handleOpenEventCreator}
            handleLoad={handleLoad}
            handleImportLoad={handleImportLoad}
            handleImportPersonEventsLoad={handleImportPersonEventsLoad}
            handleProcessTranscriptLoad={handleProcessTranscriptLoad}
            handleTimelinePlayToggle={handleTimelinePlayToggle}
            adjustTimelineYear={adjustTimelineYear}
            handleAutoSaveMinutesInput={handleAutoSaveMinutesInput}
            handleBackupCountInput={handleBackupCountInput}
            handleSetBackupFolder={handleSetBackupFolder}
            handleOpenFileBackupRestore={handleOpenFileBackupRestore}
            handleCenterDiagramView={handleCenterDiagramView}
            handleImageDiagramPicker={handleImageDiagramPicker}
            handleImageDiagramLoad={handleImageDiagramLoad}
          />
          <VoiceInputModal
            open={voiceInputOpen}
            onClose={() => setVoiceInputOpen(false)}
            commandText={voiceCommandText}
            onCommandTextChange={setVoiceCommandText}
            operations={voiceCommandOperations}
            errors={voiceCommandErrors}
            statusMessage={voiceStatusMessage}
            isListening={voiceListening}
            isSupported={voiceSupported}
            onReview={reviewVoiceCommands}
            onToggleListening={toggleVoiceListening}
            onApply={applyVoiceCommands}
            onClear={() => { setVoiceCommandText(''); setVoiceCommandOperations([]); setVoiceCommandErrors([]); setVoiceStatusMessage(''); }}
          />
          <BackupRestoreDialog
            open={backupRestoreOpen}
            versions={backupRestoreVersions}
            onClose={() => { setBackupRestoreOpen(false); setBackupRestoreVersions(null); }}
            onRestoreVersion={handleRestoreBackupVersion}
          />
          <FileBackupListDialog
            open={fileBackupListOpen}
            entries={fileBackupEntries}
            onSelect={handleFileBackupSelect}
            onClose={() => setFileBackupListOpen(false)}
          />
          <DiagramCanvas
            contextMenu={contextMenu}
            setContextMenu={setContextMenu}
            personSectionPopup={personSectionPopup}
            personSectionPopupPerson={personSectionPopupPerson}
            setPersonSectionPopup={setPersonSectionPopup}
            partnershipSectionPopup={partnershipSectionPopup}
            partnershipSectionPopupPartnership={partnershipSectionPopupPartnership}
            setPartnershipSectionPopup={setPartnershipSectionPopup}
            isDemoFocusedCanvas={isDemoFocusedCanvas}
            demoBlinkVisible={demoBlinkVisible}
            isDemoFocusedPerson={isDemoFocusedPerson}
            isDemoFocusedPartnership={isDemoFocusedPartnership}
            isDemoFocusedEmotionalLine={isDemoFocusedEmotionalLine}
            fileName={fileName}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            stageOffset={stageOffset}
            zoom={zoom}
            stageRef={stageRef}
            spacePanActive={spacePanActive}
            isPanning={isPanning}
            setIsPanning={setIsPanning}
            panStartRef={panStartRef}
            toCanvasPoint={toCanvasPoint}
            translateDiagram={translateDiagram}
            marqueeSelection={marqueeSelection}
            setMarqueeSelection={setMarqueeSelection}
            marqueeDidDragRef={marqueeDidDragRef}
            suppressStageClickRef={suppressStageClickRef}
            selectPeopleByMarquee={selectPeopleByMarquee}
            handleStageContextMenu={handleStageContextMenu}
            setSelectedPeopleIds={setSelectedPeopleIds}
            setSelectedPartnershipId={setSelectedPartnershipId}
            setSelectedEmotionalLineId={setSelectedEmotionalLineId}
            setSelectedChildId={setSelectedChildId}
            setSelectedFamilyId={setSelectedFamilyId}
            setSelectedPageNoteId={setSelectedPageNoteId}
            setPageNoteDraft={setPageNoteDraft}
            setPropertiesPanelItem={setPropertiesPanelItem}
            triangles={triangles}
            people={people}
            partnerships={partnerships}
            allEmotionalLines={allEmotionalLines}
            personVisibility={personVisibility}
            emotionalVisibility={emotionalVisibility}
            partnershipVisibility={partnershipVisibility}
            emotionalSiblingMeta={emotionalSiblingMeta}
            selectedEmotionalLineId={selectedEmotionalLineId}
            selectedChildId={selectedChildId}
            selectedPartnershipId={selectedPartnershipId}
            selectedPeopleIds={selectedPeopleIds}
            handleTriangleAreaSelect={handleTriangleAreaSelect}
            handleTriangleAreaContextMenu={handleTriangleAreaContextMenu}
            handleEmotionalLineSelect={handleEmotionalLineSelect}
            handleEmotionalLineContextMenu={handleEmotionalLineContextMenu}
            handlePartnershipSelect={handlePartnershipSelect}
            handleHorizontalConnectorDragEnd={handleHorizontalConnectorDragEnd}
            handlePartnershipContextMenu={handlePartnershipContextMenu}
            selectedFamilyId={selectedFamilyId}
            selectedFamilyIds={selectedFamilyIds}
            handleFamilyClick={handleFamilyClick}
            handleFamilyContextMenu={handleFamilyContextMenu}
            onFamilyIndicatorClick={handleFamilyIndicatorClick}
            onOpenFamilyProperty={(partnershipId, category, subtype, position) =>
              openFamilyPropertyModal(
                partnershipId,
                {
                  eventType: 'FAMILY',
                  category,
                  subtype,
                  eventClass: 'family',
                  status: 'ongoing',
                  intensity: 1,
                  frequency: 1,
                  impact: 1,
                },
                position,
                ['Family', category, subtype].filter(Boolean).join(' ')
              )
            }
            onAddFamilyEvent={handleFamilyAddGenericEvent}
            onDeleteFamilyEvent={handleDeleteFamilyEvent}
            onCloseFamilyPanel={() => setSelectedFamilyId(null)}
            handleChildLineSelect={handleChildLineSelect}
            handleChildLineContextMenu={handleChildLineContextMenu}
            handleSelect={handleSelect}
            handlePersonDragStart={handlePersonDragStart}
            handlePersonDrag={handlePersonDrag}
            dragGroupRef={dragGroupRef}
            handlePersonContextMenu={handlePersonContextMenu}
            handleGroupContextMenu={handleGroupContextMenu}
            setHoveredPersonId={setHoveredPersonId}
            functionalIndicatorDefinitions={functionalIndicatorDefinitions}
            sirCategories={sirCategories}
            functionalFactCategories={functionalFactCategories}
            nodalCategories={nodalCategories}
            selectedGroupBounds={selectedGroupBounds}
            beginGroupResize={beginGroupResize}
            applyGroupResize={applyGroupResize}
            endGroupResize={endGroupResize}
            handleGroupBoxDragStart={handleGroupBoxDragStart}
            handleGroupBoxDragMove={handleGroupBoxDragMove}
            notesLayerEnabled={notesLayerEnabled}
            showSiblingConflicts={showSiblingConflicts}
            hoveredPersonId={hoveredPersonId}
            handlePersonNoteDragEnd={handlePersonNoteDragEnd}
            handlePersonNoteResizeEnd={handlePersonNoteResizeEnd}
            handlePartnershipNoteDragEnd={handlePartnershipNoteDragEnd}
            handlePartnershipNoteResizeEnd={handlePartnershipNoteResizeEnd}
            handleFamilyNoteDragEnd={handleFamilyNoteDragEnd}
            handleFamilyNoteResizeEnd={handleFamilyNoteResizeEnd}
            handleEmotionalLineNoteDragEnd={handleEmotionalLineNoteDragEnd}
            handleEmotionalLineNoteResizeEnd={handleEmotionalLineNoteResizeEnd}
            pageNotes={pageNotes}
            selectedPageNoteId={selectedPageNoteId}
            handlePageNoteDragEnd={handlePageNoteDragEnd}
            handlePageNoteResizeEnd={handlePageNoteResizeEnd}
            handlePageNoteSelect={handlePageNoteSelect}
            selectedPageNote={selectedPageNote}
            pageNoteDraft={pageNoteDraft}
            handlePageNoteDraftChange={handlePageNoteDraftChange}
            handlePageNoteDelete={handlePageNoteDelete}
            handlePageNoteSave={handlePageNoteSave}
            canvasScrollHintOpen={canvasScrollHintOpen}
            setCanvasScrollHintOpen={setCanvasScrollHintOpen}
            handleCanvasScrollHint={handleCanvasScrollHint}
            panelRef={panelRef}
            panelWidth={panelWidth}
            resizeStateRef={resizeStateRef}
            showMultiPersonPanel={showMultiPersonPanel}
            multiSelectedPeople={multiSelectedPeople}
            handleBatchUpdatePersons={handleBatchUpdatePersons}
            openAddEmotionalPatternModal={openAddEmotionalPatternModal}
            propertiesPanelItem={propertiesPanelItem}
            eventCategories={eventCategories}
            relationshipTypes={relationshipTypes}
            relationshipStatuses={relationshipStatuses}
            handleUpdatePerson={handleUpdatePerson}
            handleUpdatePartnership={handleUpdatePartnership}
            handleUpdateEmotionalLine={handleUpdateEmotionalLine}
            panelTriangleContext={panelTriangleContext}
            updateTriangleColor={updateTriangleColor}
            updateTriangleIntensity={updateTriangleIntensity}
            updateTriangle={updateTriangle}
            handleTriangleNoteDragEnd={handleTriangleNoteDragEnd}
            handleTriangleNoteResizeEnd={handleTriangleNoteResizeEnd}
            propertiesPanelIntent={propertiesPanelIntent}
            setPropertiesPanelIntent={setPropertiesPanelIntent}
            ensureSymptomDefinition={ensureSymptomDefinition}
            onSymptomBadgeClick={(person, group, x, y) => {
              const found = people.find((p) => p.id === person.id);
              const groupTitle = group.charAt(0).toUpperCase() + group.slice(1);
              if (found) openContextualEventCreator(
                { type: 'person', id: found.id },
                found,
                { eventType: 'SYMPTOM', category: group },
                { x, y },
                `Person Symptom ${groupTitle}`
              );
            }}
            onSiblingSquareClick={(person, x, y) => openPersonSectionPopup(person, 'sibling', x, y)}
            onRemoveEmotionalLine={removeEmotionalLine}
            onAutonomySquareClick={(person) => {
              const found = people.find((p) => p.id === person.id);
              if (found) openContextualEventCreator(
                { type: 'person', id: found.id },
                found,
                {
                  eventType: 'EA',
                  category: 'Emotional Autonomy',
                  eventClass: 'emotional-pattern',
                  status: 'ongoing',
                },
                undefined,
                'Person Emotional Autonomy'
              );
            }}
          />
          <DiagramModals
            importModeDialogOpen={importModeDialogOpen}
            pendingImportData={pendingImportData}
            pendingImportSource={pendingImportSource}
            pendingImportFileName={pendingImportFileName}
            completePendingImport={completePendingImport}
            setImportModeDialogOpen={setImportModeDialogOpen}
            setPendingImportData={setPendingImportData}
            setPendingImportFileName={setPendingImportFileName}
            sessionCaptureDialogOpen={sessionCaptureDialogOpen}
            pendingSessionCaptureData={pendingSessionCaptureData}
            pendingSessionCaptureFileName={pendingSessionCaptureFileName}
            sessionCaptureSelections={sessionCaptureSelections}
            setSessionCaptureSelections={setSessionCaptureSelections}
            completeSessionCaptureImport={completeSessionCaptureImport}
            setSessionCaptureDialogOpen={setSessionCaptureDialogOpen}
            setPendingSessionCaptureData={setPendingSessionCaptureData}
            setPendingSessionCaptureFileName={setPendingSessionCaptureFileName}
            clientProfileDraft={clientProfileDraft}
            updateClientProfileDraftField={updateClientProfileDraftField}
            saveClientProfileDraft={saveClientProfileDraft}
            setClientProfileDraft={setClientProfileDraft}
            coachThinkingDraft={coachThinkingDraft}
            updateCoachThinkingField={updateCoachThinkingField}
            saveCoachThinkingDraft={saveCoachThinkingDraft}
            setCoachThinkingDraft={setCoachThinkingDraft}
            emotionalPatternModalOpen={emotionalPatternModalOpen}
            emotionalPatternDraft={emotionalPatternDraft}
            updateEmotionalPatternDraft={updateEmotionalPatternDraft}
            saveAddEmotionalPattern={saveAddEmotionalPattern}
            setEmotionalPatternModalOpen={setEmotionalPatternModalOpen}
            setEmotionalPatternDraft={setEmotionalPatternDraft}
            addFamilyModalOpen={addFamilyModalOpen}
            addFamilyDraft={addFamilyDraft}
            updateAddFamilyDraft={updateAddFamilyDraft}
            saveAddFamily={saveAddFamily}
            cancelAddFamily={() => { setAddFamilyModalOpen(false); setAddFamilyDraft(null); setAddFamilyPosition(null); }}
            settingsOpen={settingsOpen}
            setSettingsOpen={setSettingsOpen}
            eventCategories={eventCategories}
            settingsDraft={settingsDraft}
            setSettingsDraft={setSettingsDraft}
            setEventCategories={setEventCategories}
            relationshipTypeSettingsOpen={relationshipTypeSettingsOpen}
            setRelationshipTypeSettingsOpen={setRelationshipTypeSettingsOpen}
            relationshipTypeDraft={relationshipTypeDraft}
            setRelationshipTypeDraft={setRelationshipTypeDraft}
            setRelationshipTypes={setRelationshipTypes}
            relationshipTypes={relationshipTypes}
            relationshipStatusSettingsOpen={relationshipStatusSettingsOpen}
            setRelationshipStatusSettingsOpen={setRelationshipStatusSettingsOpen}
            relationshipStatusDraft={relationshipStatusDraft}
            setRelationshipStatusDraft={setRelationshipStatusDraft}
            setRelationshipStatuses={setRelationshipStatuses}
            relationshipStatuses={relationshipStatuses}
            indicatorSettingsOpen={indicatorSettingsOpen}
            setIndicatorSettingsOpen={setIndicatorSettingsOpen}
            functionalIndicatorDefinitions={functionalIndicatorDefinitions}
            indicatorDraftLabel={indicatorDraftLabel}
            setIndicatorDraftLabel={setIndicatorDraftLabel}
            addFunctionalIndicatorDefinition={addFunctionalIndicatorDefinition}
            addFunctionalIndicatorDefinitionForGroup={addFunctionalIndicatorDefinitionForGroup}
            onSaveIndicatorsAsDefault={(definitions: FunctionalIndicatorDefinition[]) => {
              const merged = { ...DEMO_DIAGRAM_DATA, functionalIndicatorDefinitions: definitions };
              const blob = new Blob([JSON.stringify(merged, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'PRODUCT_DEFAULT.diagram.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
            updateFunctionalIndicatorLabel={updateFunctionalIndicatorLabel}
            updateFunctionalIndicatorGroup={updateFunctionalIndicatorGroup}
            updateFunctionalIndicatorColor={updateFunctionalIndicatorColor}
            updateFunctionalIndicatorIcon={updateFunctionalIndicatorIcon}
            updateFunctionalIndicatorUseLetter={updateFunctionalIndicatorUseLetter}
            clearFunctionalIndicatorIcon={clearFunctionalIndicatorIcon}
            removeFunctionalIndicatorDefinition={removeFunctionalIndicatorDefinition}
            reorderFunctionalIndicators={setFunctionalIndicatorDefinitions}
            sirSettingsOpen={sirSettingsOpen}
            setSirSettingsOpen={setSirSettingsOpen}
            sirCategories={sirCategories}
            onSaveSirCategories={setSirCategories}
            ffSettingsOpen={ffSettingsOpen}
            setFfSettingsOpen={setFfSettingsOpen}
            functionalFactCategories={functionalFactCategories}
            onSaveFunctionalFactCategories={setFunctionalFactCategories}
            nodalSettingsOpen={nodalSettingsOpen}
            setNodalSettingsOpen={setNodalSettingsOpen}
            nodalCategories={nodalCategories}
            onSaveNodalCategories={setNodalCategories}
            people={people}
            partnerships={partnerships}
            allEmotionalLines={allEmotionalLines}
            timelineSelectionIds={timelineSelectionIds}
            timelineFamilySelectionIds={timelineFamilySelectionIds}
            handleUpdatePerson={handleUpdatePerson}
            handleUpdatePartnership={handleUpdatePartnership}
            handleUpdateEmotionalLine={handleUpdateEmotionalLine}
            setTimelineSelectionIds={setTimelineSelectionIds}
            setTimelineFamilySelectionIds={setTimelineFamilySelectionIds}
            sessionNotesOpen={sessionNotesOpen}
            setSessionNotesOpen={setSessionNotesOpen}
            sessionNoteCoachName={sessionNoteCoachName}
            sessionNoteClientName={sessionNoteClientName}
            sessionNoteFileName={sessionNoteFileName}
            sessionNoteIssue={sessionNoteIssue}
            sessionNoteContent={sessionNoteContent}
            sessionNoteStartedAt={sessionNoteStartedAt}
            sessionAutosaveInfo={sessionAutosaveInfo}
            sessionTargetOptions={sessionTargetOptions}
            sessionNotesTarget={sessionNotesTarget}
            fileName={fileName}
            sessionFocusPersonName={sessionFocusPersonName}
            sessionSaveLocationLabel={sessionSaveLocationLabel}
            sessionOpenCandidates={sessionOpenCandidates}
            sessionOpenCandidateId={sessionOpenCandidateId}
            handleSessionFieldChange={handleSessionFieldChange}
            handleSessionNotesTargetChange={handleSessionNotesTargetChange}
            handleSessionNotesNew={handleSessionNotesNew}
            handleSessionOpenCandidateChange={handleSessionOpenCandidateChange}
            handleSessionOpenNote={handleSessionOpenNote}
            handleSessionSave={handleSessionSave}
            handleSessionSaveAs={handleSessionSaveAs}
            handleSessionChooseLocation={handleSessionChooseLocation}
            handleSaveSessionNoteJson={handleSaveSessionNoteJson}
            handleSaveSessionNoteMarkdown={handleSaveSessionNoteMarkdown}
            handleSessionNotesMakeEvent={handleSessionNotesMakeEvent}
            selectedRibbonHelp={selectedRibbonHelp}
            selectedRibbonHelpBody={selectedRibbonHelpBody}
            setRibbonHelpKey={setRibbonHelpKey}
            helpOpen={helpOpen}
            setHelpOpen={setHelpOpen}
            handleStartDemoTour={handleStartDemoTour}
            handleStartBuildDemo={handleStartBuildDemo}
            setReadmeViewerOpen={setReadmeViewerOpen}
            setTrainingVideosOpen={setTrainingVideosOpen}
            trainingVideosOpen={trainingVideosOpen}
            trainingVideos={TRAINING_VIDEOS}
            selectedTrainingVideoId={selectedTrainingVideoId}
            setSelectedTrainingVideoId={setSelectedTrainingVideoId}
            demoTourOpen={demoTourOpen}
            demoTourSteps={demoTourSteps}
            demoTourStepIndex={demoTourStepIndex}
            handleCloseDemoTour={handleCloseDemoTour}
            setDemoTourStepIndex={setDemoTourStepIndex}
            buildDemoOpen={buildDemoOpen}
            buildDemoSteps={buildDemoSteps}
            buildDemoStepIndex={buildDemoStepIndex}
            handleCloseBuildDemo={handleCloseBuildDemo}
            handleBuildDemoStepChange={handleBuildDemoStepChange}
            readmeViewerOpen={readmeViewerOpen}
            sessionEventDraft={sessionEventDraft}
            sessionEventTarget={sessionEventTarget}
            getEventClassForTargetType={getEventClassForTargetType}
            sessionEventPrimaryOptions={sessionEventPrimaryOptions}
            sessionEventOtherOptions={sessionEventOtherOptions}
            handleSessionEventDraftChange={handleSessionEventDraftChange}
            closeSessionEventModal={closeSessionEventModal}
            commitSessionEventFromNotes={commitSessionEventFromNotes}
            ideasOpen={ideasOpen}
            ideasText={ideasText}
            setIdeasText={setIdeasText}
            setIdeasOpen={setIdeasOpen}
            saveAsDialogOpen={saveAsDialogOpen}
            saveAsCurrentFileName={fileName === FALLBACK_FILE_NAME ? 'family-diagram.json' : fileName}
            onSaveAsConfirm={(name: string) => {
              setSaveAsDialogOpen(false);
              saveAsOnConfirmRef.current?.(name);
              saveAsOnConfirmRef.current = null;
            }}
            onSaveAsClose={() => {
              setSaveAsDialogOpen(false);
              saveAsOnConfirmRef.current = null;
            }}
            imageDiagramModalOpen={imageDiagramModalOpen}
            imageDiagramAnalyzing={imageDiagramAnalyzing}
            imageDiagramProgress={imageDiagramProgress}
            onImageDiagramClose={() => {
              setImageDiagramModalOpen(false);
            }}
            onImageDiagramAnalyze={handleImageDiagramAnalyze}
            imageDiagramReviewOpen={imageDiagramModalOpen && extractedDiagramData !== null}
            personInventory={personInventory}
            onImageDiagramCreateDiagram={handleImageDiagramCreateDiagram}
            onImageDiagramReviewClose={() => {
              setImageDiagramModalOpen(false);
              setExtractedDiagramData(null);
              setPersonInventory([]);
            }}
            aiSettingsOpen={aiSettingsOpen}
            aiSettingsAnthropicApiKey={aiSettingsAnthropicApiKey}
            aiSettingsDeepseekApiKey={aiSettingsDeepseekApiKey}
            aiSettingsModelId={aiSettingsModelId}
            onAiSettingsSave={handleAiSettingsSave}
            onAiSettingsClose={() => setAiSettingsOpen(false)}
            onAiSettingsTest={testApiConnection}
            importLogOpen={importLogOpen}
            importLogText={importLogText}
            importLogFilename={importLogFilename}
            onImportLogClose={() => setImportLogOpen(false)}
          />
        <PredictionsPanel
          isOpen={predictionsOpen}
          predictionSets={predictionSets}
          people={people}
          sirCategories={sirCategories}
          onClose={() => setPredictionsOpen(false)}
          onAddSet={predictionHandlers.addSet}
          onRenameSet={predictionHandlers.renameSet}
          onDeleteSet={predictionHandlers.deleteSet}
          onAddPrediction={predictionHandlers.addPrediction}
          onUpdatePrediction={predictionHandlers.updatePrediction}
          onDeletePrediction={predictionHandlers.deletePrediction}
          onResolvePrediction={predictionHandlers.resolvePrediction}
          onAddCondition={predictionHandlers.addCondition}
          onUpdateCondition={predictionHandlers.updateCondition}
          onRemoveCondition={predictionHandlers.removeCondition}
          onAddOutcome={predictionHandlers.addOutcome}
          onUpdateOutcome={predictionHandlers.updateOutcome}
          onRemoveOutcome={predictionHandlers.removeOutcome}
          onAddEvidence={predictionHandlers.addEvidence}
          onRemoveEvidence={predictionHandlers.removeEvidence}
        />
        {trianglePropertyModal && (
          <EventModal
            eventDraft={trianglePropertyModal.draft}
            position={trianglePropertyModal.position}
            popupLeft={trianglePropertyModal.position.x}
            popupTop={trianglePropertyModal.position.y}
            popupMaxHeight={null}
            primaryPersonOptions={(() => {
              const t = triangles.find((tr) => tr.id === trianglePropertyModal.triangleId);
              if (!t) return [];
              return [t.person1_id, t.person2_id, t.person3_id]
                .map((id) => people.find((p) => p.id === id)?.name || '')
                .filter(Boolean);
            })()}
            otherPersonOptions={(() => {
              const t = triangles.find((tr) => tr.id === trianglePropertyModal.triangleId);
              if (!t) return ['None'];
              return ['None', ...[t.person1_id, t.person2_id, t.person3_id]
                .map((id) => people.find((p) => p.id === id)?.name || '')
                .filter(Boolean)];
            })()}
            eventCategories={eventCategories}
            symptomTypeOptions={[]}
            resolvedEventClass="emotional-pattern"
            modalTitle={trianglePropertyModal.modalTitle}
            onChange={(field, value) =>
              setTrianglePropertyModal((prev) =>
                prev ? { ...prev, draft: { ...prev.draft, [field]: value } } : prev
              )
            }
            onSetDraft={(draft) =>
              setTrianglePropertyModal((prev) => (prev ? { ...prev, draft } : prev))
            }
            onSave={() => {
              if (!trianglePropertyModal) return;
              const { triangleId, draft } = trianglePropertyModal;
              setTriangles((prev) =>
                prev.map((t) =>
                  t.id === triangleId
                    ? { ...t, events: [...(t.events || []), draft] }
                    : t
                )
              );
              setTrianglePropertyModal(null);
            }}
            onCancel={() => setTrianglePropertyModal(null)}
          />
        )}
        {familyPropertyModal && (
          <EventModal
            eventDraft={familyPropertyModal.draft}
            position={familyPropertyModal.position}
            popupLeft={familyPropertyModal.position.x}
            popupTop={familyPropertyModal.position.y}
            popupMaxHeight={null}
            primaryPersonOptions={(() => {
              const p = partnerships.find((p) => p.id === familyPropertyModal.partnershipId);
              if (!p) return [];
              return [p.partner1_id, p.partner2_id]
                .map((id) => people.find((person) => person.id === id)?.name || '')
                .filter(Boolean);
            })()}
            otherPersonOptions={(() => {
              const p = partnerships.find((p) => p.id === familyPropertyModal.partnershipId);
              if (!p) return ['None'];
              return ['None', ...[p.partner1_id, p.partner2_id]
                .map((id) => people.find((person) => person.id === id)?.name || '')
                .filter(Boolean)];
            })()}
            eventCategories={eventCategories}
            symptomTypeOptions={[]}
            resolvedEventClass="emotional-pattern"
            modalTitle={familyPropertyModal.modalTitle}
            lockEventType
            onChange={(field, value) =>
              setFamilyPropertyModal((prev) =>
                prev ? { ...prev, draft: { ...prev.draft, [field]: value } } : prev
              )
            }
            onSetDraft={(draft) =>
              setFamilyPropertyModal((prev) => (prev ? { ...prev, draft } : prev))
            }
            onSave={() => {
              if (!familyPropertyModal) return;
              const { partnershipId, draft, editingEventId } = familyPropertyModal;
              const rawCat = (draft.category || '').toLowerCase();
              const normalizedCat = rawCat.startsWith('triangle') ? 'Triangles' : rawCat === 'stress' ? 'Stress' : (draft.category || 'Triangles');
              const savedDraft = { ...draft, eventType: 'FAMILY' as const, category: normalizedCat };
              setPartnerships((prev) =>
                prev.map((p) => {
                  if (p.id !== partnershipId) return p;
                  const existing = p.familyEvents || [];
                  const updated = editingEventId
                    ? existing.map((e) => (e.id === editingEventId ? savedDraft : e))
                    : [...existing, savedDraft];
                  return { ...p, familyEvents: updated };
                })
              );
              setFamilyPropertyModal(null);
            }}
            onCancel={() => setFamilyPropertyModal(null)}
          />
        )}
        </div>
      );
    };

export default DiagramEditor;
