import type { ContextMenuState, OpenTimeline, SessionNoteDirectoryHandle } from '../types/diagramEditor';
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
import { nanoid } from 'nanoid';
import { EVENT_SUBTYPES, EVENT_TYPE_LABELS } from '../constants/eventConstants';
import {
  applyEventDraftFieldChange,
  buildFamilyEventDraft,
  canonicalFamilyCategory,
  normalizeEventForSave,
} from '../utils/eventDraft';
import { partnershipDateSlots, withoutDateSlotCompanions } from '../utils/syntheticDateEvents';
import BackupRestoreDialog from './modals/BackupRestoreDialog';
import AppRibbon from './AppRibbon';
import VoiceInputModal from './modals/VoiceInputModal';
import { Stage as StageType } from 'konva/lib/Stage';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useBrowserStorageWriter } from '../hooks/useBrowserStorageWriter';
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
import { useFamilyScope } from '../hooks/useFamilyScope';
import FamilyScopeChip from './FamilyScopeChip';
import {
  buildPartnershipVisibility,
  buildPersonVisibility,
  computeFamilyScope,
  defaultFocusForRoot,
  deriveTimelineSelection,
  pruneSelectionToScope,
  familyTimelineLanes,
} from '../utils/familyScope';
import DiagramModals from './DiagramModals';
import PredictionsPanel from './PredictionsPanel';
import DiagramCanvas from './DiagramCanvas';
import PropertiesPanelHost from './PropertiesPanelHost';
import EventModal from './EventModal';
import FileBackupListDialog from './modals/FileBackupListDialog';
import type { FileBackupEntry } from './modals/FileBackupListDialog';
import { removeOrphanedMiscarriages } from '../utils/dataCleanup';
import { checkAddChildToPartnership, earliestPartnershipDate } from '../utils/partnershipUtils';
import { activeMarqueePageNoteIds } from '../utils/pageNoteSelection';
import { normalizePredictionSets } from '../utils/predictionSets';
import {
  buildDiagramPayload as buildDiagramPayloadPure,
  contentFingerprint,
  DIAGRAM_CONTENT_KEYS,
  fileHoldsDiagramContent,
  serializeDiagramContent,
  type DiagramContentState,
} from '../utils/diagramPayload';
import { testApiConnection } from '../utils/testApiConnection';
import { lookupModel } from '../utils/lookupModel';
import { checkVisionImportReadiness } from '../utils/visionImportReadiness';
import { ImportLog } from '../utils/importLog';
import {
  DEFAULT_DIAGRAM_STATE,
  FALLBACK_FILE_NAME,
} from '../data/defaultDiagramState';
import { explicitList } from '../data/applicationSettings';
import { categoryUsage, saveCategoryList } from '../utils/categoryRename';
import {
  RIBBON_HELP,
  type RibbonHelpKey,
  HINT_PREFERENCE_NOT_SAVED_MESSAGE,
} from '../data/helpContent';
import {
  buildTimelineJson,
  importPersonEventFile,
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
  parseStoredDiagramArray,
  STORAGE_KEYS,
  trySetStoredValue,
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
  isRightClickHintHidden,
  setRightClickHintHidden,
  isCanvasScrollHintHidden,
  setCanvasScrollHintHidden,
} from '../utils/storage';
import type { BackupVersions } from '../utils/storage';
import { confirmDiscardUnsavedChanges } from '../utils/unsavedChanges';
import { mergeDiagramData } from '../utils/diagramMerge';
import { alignMultipleBirthAnchors } from '../utils/multipleBirthAnchors';
import {
  clampTimelineYear,
  isVisibleAtCutoff,
  timelineCutoffForYear,
  timelineYearBounds as computeTimelineYearBounds,
} from '../utils/dateFormatting';
import {
  sanitizePeopleIndicators,
  parseIsoDateToTimestamp,
  attachEventClassToEntities,
  attachFamilyEventsToPartnerships,
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
} from '../types/diagramEditor';
import {
  applySessionCaptureOperations,
  sessionCaptureSummary,
  withUniqueOperationIds,
} from '../utils/sessionCaptureApply';
import type { ImageImportHints } from '../utils/genogram/vlmImport';
import { resolveBinarySex, toggledBinarySex } from '../utils/personSex';
import { joinCoupleNames } from '../utils/personNames';
import { factsToDiagramImportData } from '../utils/dataImport';

/** How often a refused browser-storage write is retried. */
const STORAGE_RETRY_MS = 5000;

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
  const storedPartnerships = parseStoredDiagramArray<Partnership>('partnerships');
  return {
    people: parseStoredDiagramArray<Person>('people') ?? initialPeople,
    partnerships: storedPartnerships
      ? attachFamilyEventsToPartnerships(storedPartnerships)
      : initialPartnerships,
    emotionalLines: parseStoredDiagramArray<EmotionalLine>('emotionalLines') ?? initialEmotionalLines,
    pageNotes: parseStoredDiagramArray<PageNote>('pageNotes') ?? initialPageNotes,
    triangles: parseStoredDiagramArray<Triangle>('triangles') ?? initialTriangles,
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
  // Restore the diagram from localStorage. A stored empty array is an emptied
  // diagram and is kept; only a missing key (first run) falls back to the
  // product default. Same rule as readLocalStorageDiagramSnapshot.
  const [initialSnapshot] = useState(readLocalStorageDiagramSnapshot);
  const [people, setPeople] = useState<Person[]>(initialSnapshot.people);
  const [partnerships, setPartnerships] = useState<Partnership[]>(initialSnapshot.partnerships);
  const [emotionalLines, setEmotionalLines] = useState<EmotionalLine[]>(initialSnapshot.emotionalLines);
  const [pageNotes, setPageNotes] = useState<PageNote[]>(initialSnapshot.pageNotes);
  const [triangles, setTriangles] = useState<Triangle[]>(initialSnapshot.triangles);
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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
    // settings-09: a stored list, even an emptied one, is kept.
    return explicitList<string>(stored?.relationshipTypes)
      ?? parseStoredArraySetting('relationshipTypes') ?? initialRelationshipTypes;
  });
  const [relationshipStatuses, setRelationshipStatuses] = useState<string[]>(() => {
    if (typeof window === 'undefined') return initialRelationshipStatuses;
    const stored = parseStoredUserSettings();
    return explicitList<string>(stored?.relationshipStatuses)
      ?? parseStoredArraySetting('relationshipStatuses') ?? initialRelationshipStatuses;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState('');
  const [relationshipTypeSettingsOpen, setRelationshipTypeSettingsOpen] = useState(false);
  const [relationshipTypeDraft, setRelationshipTypeDraft] = useState('');
  const [relationshipStatusSettingsOpen, setRelationshipStatusSettingsOpen] = useState(false);
  const [relationshipStatusDraft, setRelationshipStatusDraft] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  // Browser-storage keys whose last autosave write was refused (quota full,
  // private mode). While any are, the red Save button and a message say the
  // diagram is not being kept between sessions — the throw used to escape a
  // timer and the loss was invisible.
  const [failedStorageKeys, setFailedStorageKeys] = useState<Set<keyof typeof STORAGE_KEYS>>(() => new Set());
  // A problem with the linked file or the backup folder, shown beside Save
  // until the next successful save (review 2026-09-30 DE1-01, DE1-10,
  // DE1-11, DE1-12). These used to fail without a word.
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  // The last value each key was asked to hold, so a refused write can be
  // retried without waiting for the next edit.
  const latestStoredValuesRef = useRef<Partial<Record<keyof typeof STORAGE_KEYS, string>>>({});
  const writeStored = useCallback((key: keyof typeof STORAGE_KEYS, value: string) => {
    latestStoredValuesRef.current[key] = value;
    const ok = trySetStoredValue(key, value);
    setFailedStorageKeys((prev) => {
      if (ok === !prev.has(key)) return prev;
      const next = new Set(prev);
      if (ok) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  // While a write is refused, retry it every few seconds. Writes happened only
  // on a change, so after storage recovered the warning stayed up — and the
  // stored copy stayed stale — until the next edit (gap review F-11).
  useEffect(() => {
    if (failedStorageKeys.size === 0) return;
    const timer = window.setInterval(() => {
      failedStorageKeys.forEach((key) => {
        const value = latestStoredValuesRef.current[key];
        if (value !== undefined) writeStored(key, value);
      });
    }, STORAGE_RETRY_MS);
    return () => window.clearInterval(timer);
  }, [failedStorageKeys, writeStored]);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [predictionsOpen, setPredictionsOpen] = useState(false);
  const [imageDiagramModalOpen, setImageDiagramModalOpen] = useState(false);
  const [imageDiagramAnalyzing, setImageDiagramAnalyzing] = useState(false);
  const [imageDiagramProgress, setImageDiagramProgress] = useState<string>('');
  const imageDiagramAbortRef = useRef<AbortController | null>(null);
  const [predictionSets, setPredictionSets] = useState<PredictionSet[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_DIAGRAM_STATE.predictionSets;
    const stored = getStoredValue('predictions');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return normalizePredictionSets(parsed);
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
    // settings-09: a stored list, even an emptied one, is kept.
    return explicitList<SIRCategoryDefinition>(stored?.sirCategories) ?? initialSirCategories;
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
  // null until the bounds are known, then the latest year in the diagram, so
  // nothing dated later than today is hidden by default (review DE1-08).
  const [timelineYear, setTimelineYear] = useState<number | null>(null);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [timelineSelectionIds, setTimelineSelectionIds] = useState<string[]>([]);
  // Partnership/Family ids to show as Family lanes on the timeline (separate
  // from person selection so user can choose person-only, family-only, or both).
  const [timelineFamilySelectionIds, setTimelineFamilySelectionIds] = useState<string[]>([]);
  // Whether the Timeline board is open. It used to be implied by the lane
  // arrays being non-empty, so every close cleared them and the lanes could
  // not be re-derived while the board stayed open.
  const [timelineOpen, setTimelineOpen] = useState(false);
  // Opened from the family focus: the lanes follow the focus while open.
  const [timelineFollowsFocus, setTimelineFollowsFocus] = useState(false);
  const openTimeline = useCallback<OpenTimeline>((lanes, options) => {
    setTimelineSelectionIds(lanes.personIds);
    setTimelineFamilySelectionIds(lanes.familyIds);
    setTimelineFollowsFocus(!!options?.followFocus);
    setTimelineOpen(true);
  }, []);
  const closeTimeline = useCallback(() => {
    setTimelineOpen(false);
    setTimelineFollowsFocus(false);
    setTimelineSelectionIds([]);
    setTimelineFamilySelectionIds([]);
  }, []);

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
  // Startup hint: right-click is where every option lives. Also re-shown after
  // File > New (see handleNewDiagram below), unless the user ticked
  // "Don't show this again".
  const [rightClickHintOpen, setRightClickHintOpen] = useState(() => !isRightClickHintHidden());
  const [rightClickHintDontShowAgain, setRightClickHintDontShowAgain] = useState(false);
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
  // Page notes caught by the last marquee, together with the people it
  // caught. The notes count as selected only while the people selection is
  // still exactly that marquee's — any later click or shift-click changes it,
  // and a group drag used to keep moving the old, unhighlighted notes.
  const [marqueePageNoteSelection, setMarqueePageNoteSelection] = useState<{
    peopleIds: string[];
    pageNoteIds: string[];
  }>({ peopleIds: [], pageNoteIds: [] });
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
  // Replaced on mount by markSnapshotClean with the restored state.
  const savedSnapshotRef = useRef('');
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
      // Every date the partnership records, from the same slot list the
      // synthesizer uses — legacy fields and statusDates-only statuses
      // (widowed) alike — rather than a hand-kept field list.
      partnershipDateSlots(partnership).forEach((slot) => addEntry(slot.date, `${base} ${slot.category}`));
      withoutDateSlotCompanions(partnership.events).forEach((event) =>
        addEntry(eventStart(event), `${event.category || 'Event'} – ${partnerLabel}`)
      );
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

  const timelineYearBounds = useMemo(
    () =>
      computeTimelineYearBounds(
        timelineEntries.map((entry) => entry.timestamp),
        new Date().getFullYear()
      ),
    [timelineEntries]
  );

  // Keep the slider year inside the bounds whenever the bounds change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setTimelineYear((prev) => clampTimelineYear(prev, timelineYearBounds));
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

  const timelineCutoffTimestamp = useMemo(() => timelineCutoffForYear(timelineYear), [timelineYear]);

  const timelineSliderDisabled = timelineYearBounds.min === timelineYearBounds.max;
  const displayTimelineYear = timelineYear ?? timelineYearBounds.max;

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


  const isVisibleAtTimeline = useMemo(() => isVisibleAtCutoff(timelineCutoffTimestamp), [timelineCutoffTimestamp]);

  useEffect(() => {
    setSelectedPeopleIds((prev) => {
      const next = prev.filter((id) => {
        const person = people.find((p) => p.id === id);
        return person ? isVisibleAtTimeline(person.birthDate) : false;
      });
      // The same array when nothing was removed: a new one on every people
      // change re-rendered the editor and reset the Session Notes target
      // (review 2026-09-30 DE1-13, struct-03).
      return next.length === prev.length ? prev : next;
    });
    setSelectedPartnershipId((prev) => {
      if (!prev) return prev;
      const partnership = partnerships.find((p) => p.id === prev);
      if (!partnership || !isVisibleAtTimeline(earliestPartnershipDate(partnership))) {
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
        return isVisibleAtTimeline(earliestPartnershipDate(prev)) ? prev : null;
      }
      if ('lineStyle' in prev) {
        return isVisibleAtTimeline(prev.startDate) ? prev : null;
      }
      return prev;
    });
  }, [people, partnerships, emotionalLines, triangles, isVisibleAtTimeline]);

  const triangleTplLines = useMemo(
    () => triangles.flatMap((triangle) => triangle.tpls || []),
    [triangles]
  );

  const allEmotionalLines = useMemo(
    () => [...emotionalLines, ...triangleTplLines],
    [emotionalLines, triangleTplLines]
  );

  // Family scope filter — "show only this person's family, N generations up
  // and N down". View state only; ANDed into the visibility maps below so it
  // composes with the timeline-year slider (D9).
  // Spec: docs/implementation_plan_2026-09-19.md#M2.A.4
  const familyScope = useFamilyScope({ people, partnerships, allEmotionalLines, triangles });
  const { scope: activeFamilyScope } = familyScope;

  // Timeline lanes: an explicit person selection wins; otherwise the active
  // family scope drives the lanes (D5).
  // Spec: docs/implementation_plan_2026-09-19.md#M4.A.1
  // Lanes for a focus set in the same handler: focusOnPerson is a setState, so
  // the scope deriveTimelineIds closes over is still the previous render's.
  // Spec: docs/implementation_plan_2026-09-19.md#M4.A.2
  const deriveTimelineIdsForRoot = useCallback(
    (rootId: string, options: { up: number; down: number }) =>
      deriveTimelineSelection(
        computeFamilyScope(people, partnerships, rootId, {
          ...defaultFocusForRoot(rootId),
          ...options,
        }),
        [],
        people,
        partnerships,
        []
      ),
    [people, partnerships]
  );

  const deriveTimelineIds = useCallback(
    (explicitPersonIds: string[], explicitFamilyIds: string[]) =>
      deriveTimelineSelection(
        activeFamilyScope,
        explicitPersonIds,
        people,
        partnerships,
        explicitFamilyIds
      ),
    [activeFamilyScope, people, partnerships]
  );

  // A Timeline opened from the family focus re-derives its lanes when the
  // focus changes (the chip's steppers) while it is open.
  useEffect(() => {
    if (!timelineOpen || !timelineFollowsFocus || !activeFamilyScope) return;
    const derived = deriveTimelineIds([], []);
    setTimelineSelectionIds(derived.personIds);
    setTimelineFamilySelectionIds(derived.familyIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFamilyScope]);

  const personVisibility = useMemo(
    () => buildPersonVisibility(people, activeFamilyScope, isVisibleAtTimeline),
    [people, isVisibleAtTimeline, activeFamilyScope]
  );

  const partnershipVisibility = useMemo(
    () => buildPartnershipVisibility(partnerships, personVisibility, isVisibleAtTimeline),
    [partnerships, personVisibility, isVisibleAtTimeline]
  );

  // A focus can hide the current selection. Prune it, the same way the
  // timeline-year slider already does above.
  // Spec: docs/implementation_plan_2026-09-19.md#M2.A.5
  useEffect(() => {
    if (!activeFamilyScope) return;
    setSelectedPeopleIds((prev) => {
      const next = pruneSelectionToScope(
        activeFamilyScope,
        { personIds: prev, partnershipId: null, familyIds: [], childId: null, emotionalLineId: null },
        allEmotionalLines
      ).personIds;
      return next.length === prev.length ? prev : next;
    });
    setSelectedChildId((prev) =>
      pruneSelectionToScope(
        activeFamilyScope,
        { personIds: [], partnershipId: null, familyIds: [], childId: prev, emotionalLineId: null },
        allEmotionalLines
      ).childId
    );
    setSelectedPartnershipId((prev) =>
      pruneSelectionToScope(
        activeFamilyScope,
        { personIds: [], partnershipId: prev, familyIds: [], childId: null, emotionalLineId: null },
        allEmotionalLines
      ).partnershipId
    );
    setSelectedFamilyIds((prev) => {
      const next = pruneSelectionToScope(
        activeFamilyScope,
        { personIds: [], partnershipId: null, familyIds: prev, childId: null, emotionalLineId: null },
        allEmotionalLines
      ).familyIds;
      return next.length === prev.length ? prev : next;
    });
    setSelectedEmotionalLineId((prev) =>
      pruneSelectionToScope(
        activeFamilyScope,
        { personIds: [], partnershipId: null, familyIds: [], childId: null, emotionalLineId: prev },
        allEmotionalLines
      ).emotionalLineId
    );
    setPropertiesPanelItem((prev) => {
      if (!prev) return prev;
      if ('name' in prev) return activeFamilyScope.personIds.has(prev.id) ? prev : null;
      if ('partner1_id' in prev) {
        return activeFamilyScope.partnershipIds.has(prev.id) ? prev : null;
      }
      if ('lineStyle' in prev) {
        return activeFamilyScope.personIds.has(prev.person1_id) &&
          activeFamilyScope.personIds.has(prev.person2_id)
          ? prev
          : null;
      }
      return prev;
    });
  }, [activeFamilyScope, allEmotionalLines]);

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
      return joinCoupleNames(p1, p2);
    }
    const line = emotionalLines.find((entry) => entry.id === target.id);
    const p1 = people.find((person) => person.id === line?.person1_id)?.name || '';
    const p2 = people.find((person) => person.id === line?.person2_id)?.name || '';
    return [p1, p2].filter(Boolean).join(' ↔ ');
  }, [sessionNotesTarget, people, partnerships, emotionalLines]);

  // Null when a library is stored but cannot be read: returning [] let the
  // next save write [record] over every stored session note.
  const getSessionNotesLibrary = useCallback((): SessionNoteFileRecord[] | null => {
    const raw = getStoredValue('sessionNotesLibrary');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as SessionNoteFileRecord[]) : null;
    } catch {
      return null;
    }
  }, []);

  const setSessionNotesLibrary = useCallback((records: SessionNoteFileRecord[]) => {
    writeStored('sessionNotesLibrary', JSON.stringify(records));
  }, [writeStored]);
  const sessionOpenCandidates = (() => {
    const library = getSessionNotesLibrary() || [];
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
  const sessionSaveDirectoryHandleRef = useRef<SessionNoteDirectoryHandle | null>(null);
  const showMultiPersonPanel = multiSelectedPeople.length > 1;
  // Everything that makes the diagram "unsaved" — the same keys the file
  // payload holds (utils/diagramPayload.ts). Read through a ref so
  // markSnapshotClean keeps one identity.
  const diagramContent: DiagramContentState = {
    people,
    partnerships,
    emotionalLines,
    pageNotes,
    triangles,
    functionalIndicatorDefinitions,
    eventCategories,
    relationshipTypes,
    relationshipStatuses,
    ideasText,
    predictionSets,
    functionalFactCategories,
    nodalCategories,
  };
  const diagramContentRef = useRef(diagramContent);
  diagramContentRef.current = diagramContent;
  // The content fields as an effect dependency list, in DIAGRAM_CONTENT_KEYS
  // order (a fixed length): a field added to the payload is picked up here
  // without editing the effects below.
  const diagramContentDeps = DIAGRAM_CONTENT_KEYS.map((key) => diagramContent[key]);
  /**
   * Record the saved baseline. Callers that have just loaded or reset state
   * pass the values they set (state has not re-rendered yet); anything not
   * passed is taken from the current render.
   */
  const markSnapshotClean = useCallback(
    (baseline: Partial<DiagramContentState> = {}) => {
      const serialized = serializeDiagramContent({ ...diagramContentRef.current, ...baseline });
      savedSnapshotRef.current = serialized;
      // Remembered across reloads, so a restored diagram that was never saved
      // to a file still counts as unsaved (review DE1-04).
      writeStored('savedContentFingerprint', contentFingerprint(serialized));
      setIsDirty(false);
      setLastDirtyTimestamp(null);
    },
    [writeStored]
  );

  useEffect(() => {
    const snapshot = serializeDiagramContent(diagramContentRef.current);
    if (snapshot !== savedSnapshotRef.current) {
      if (!isDirty) {
        setIsDirty(true);
        setLastDirtyTimestamp(Date.now());
      }
    } else if (isDirty) {
      setIsDirty(false);
      setLastDirtyTimestamp(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...diagramContentDeps, isDirty]);

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
    writeStored('autoSave', String(autoSaveMinutes));
  }, [autoSaveMinutes, writeStored]);

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
      // Through writeStored: a refused write is shown with the other storage
      // failures; a bare setItem threw out of this effect and, with no error
      // boundary, unmounted the editor (review DE1-05).
      writeStored('sessionNotePrimary', JSON.stringify(payload));
      setSessionAutosaveInfo((info) => ({ ...info, primary: new Date().toISOString() }));
    };
    savePrimary();
    sessionAutosavePhaseRef.current = 'backup';
    sessionAutosaveTimerRef.current = setInterval(() => {
      if (sessionAutosavePhaseRef.current === 'backup') {
        const existing = getStoredValue('sessionNotePrimary');
        if (existing) {
          writeStored('sessionNoteBackup', existing);
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
    writeStored,
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
    const storedPrimary = getStoredValue('sessionNotePrimary');
    if (storedPrimary) {
      try {
        const parsed = JSON.parse(storedPrimary);
        // Keep the note's library id, so the next Save updates its entry
        // instead of adding a copy after every reload (review DE1-14).
        if (typeof parsed.id === 'string' && (getSessionNotesLibrary() || []).some((entry) => entry.id === parsed.id)) {
          setSessionNoteRecordId(parsed.id);
        }
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
    const storedBackup = getStoredValue('sessionNoteBackup');
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
  // Follow the canvas selection only when the selection itself changes —
  // keyed on the ids, not the array, so an unrelated edit (dragging anyone)
  // no longer resets a target the user picked in Session Notes (DE1-13).
  const singleSelectedPersonId = selectedPeopleIds.length === 1 ? selectedPeopleIds[0] : null;
  useEffect(() => {
    if (!sessionNotesOpen) return;
    if (singleSelectedPersonId) {
      setSessionNotesTarget(`person:${singleSelectedPersonId}`);
    } else if (selectedPartnershipId) {
      setSessionNotesTarget(`partnership:${selectedPartnershipId}`);
    } else if (selectedEmotionalLineId) {
      setSessionNotesTarget(`emotional:${selectedEmotionalLineId}`);
    }
  }, [sessionNotesOpen, singleSelectedPersonId, selectedPartnershipId, selectedEmotionalLineId]);

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
    people,
    functionalIndicatorDefinitions,
    indicatorDraftLabel,
    defaultSymptomColorByGroup,
    setFunctionalIndicatorDefinitions,
    setPeople,
    setPropertiesPanelItem,
    setIndicatorDraftLabel,
  });

  const alignAllAnchors = (list: Person[], partnershipSource: Partnership[] = partnerships) =>
    alignMultipleBirthAnchors(list, partnershipSource);

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
      // Apply the definitions restored from storage (not the defaults, which
      // replaced custom definitions and deleted the indicators using them).
      applyIndicatorDefinitionArray(functionalIndicatorDefinitions);
    } catch {
      // keep fallback defaults if initialization ever fails
      setTriangles(initialTriangles);
    }
    // The diagram restored from this browser is "saved" only if it is the
    // one last saved to or opened from a file. It used to be marked clean
    // always, so File > New or Open discarded a never-saved diagram without
    // asking (review DE1-04). With no fingerprint yet (first run, or data
    // from before this check) there is nothing to compare, so it counts as
    // saved and the fingerprint starts here.
    const restored = serializeDiagramContent(diagramContentRef.current);
    const savedFingerprint = getStoredValue('savedContentFingerprint');
    if (savedFingerprint == null || savedFingerprint === contentFingerprint(restored)) {
      markSnapshotClean();
    } else {
      savedSnapshotRef.current = '';
    }
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
  writeStored('ideas', ideasText);
}, [ideasText, writeStored]);

useEffect(() => {
  if (typeof window === 'undefined') return;
  writeStored('predictions', JSON.stringify(predictionSets));
}, [predictionSets, writeStored]);

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
  writeStored('userSettings', JSON.stringify(payload));
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
  writeStored,
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
      if (!confirmDiscardUnsavedChanges(isDirty, `Restore backup "${handle.name}"`)) return;
      replaceDiagramState(data, diagramName);
    } catch {
      alert('Could not restore backup file.');
    }
  };

  // The browser copy of the diagram: every key in one pass, a second after
  // the last change and again when the page is hidden (review DE1-02/03).
  const storedDiagram = useMemo(
    () => ({
      people,
      partnerships,
      emotionalLines,
      triangles,
      pageNotes,
      fileName,
      eventCategories,
      relationshipTypes,
      relationshipStatuses,
      indicatorDefinitions: functionalIndicatorDefinitions,
    }),
    [
      people,
      partnerships,
      emotionalLines,
      triangles,
      pageNotes,
      fileName,
      eventCategories,
      relationshipTypes,
      relationshipStatuses,
      functionalIndicatorDefinitions,
    ]
  );
  useBrowserStorageWriter(storedDiagram, writeStored);

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
    emotionalPatternDraft,
    setEmotionalLines,
    setPeople,
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
        const nextSex: BirthSex = toggledBinarySex(p);
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
    // Read through the shared sex rule (utils/personSex.ts), not `gender` alone.
    const personSex = resolveBinarySex(person);
    const partnerGender = personSex === 'male' ? 'female' : 'male';
    const partnerOffsetX = personSex === 'female' ? -140 : 140;
    const newPartnerId = nanoid();
    const newPartnershipId = nanoid();
    const newPartnership: Partnership = {
      id: newPartnershipId,
      partner1_id: person.id,
      partner2_id: newPartnerId,
      horizontalConnectorY: Math.max(person.y, person.y) + 100,
      relationshipType: 'dating',
      // Same default as every other new-partnership builder; 'married' was a
      // status the user never chose (review 2026-09-30 DE1-15).
      relationshipStatus: 'ongoing',
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
    const check = checkAddChildToPartnership(childId, targetPartnership, people, partnerships);
    if (check.kind === 'refuse') {
      alert(check.message);
      return;
    }
    if (check.kind === 'already-child') {
      setSelectedPeopleIds([childId]);
      setSelectedPartnershipId(null);
      return;
    }
    if (check.kind === 'confirm' && !window.confirm(check.message)) return;

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

    // The add is done: the partnership is deselected so the next plain click
    // selects a person instead of re-parenting another one.
    setSelectedPeopleIds([childId]);
    setSelectedPartnershipId(null);
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


  // The payload shape lives in utils/diagramPayload.ts so the guarantee that
  // view state (the family focus) never reaches a saved file can be asserted
  // against the real object instead of against this file's source text.
  // Spec: docs/implementation_plan_2026-09-19.md#M5.A.1
  const buildDiagramPayload = (targetFileName = fileName) =>
    buildDiagramPayloadPure(
      {
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
      },
      targetFileName
    );

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
        // Link the file only when it holds the same diagram as the copy
        // restored from this browser. Otherwise the next edit would autosave
        // the browser copy over a newer file — saved on another machine or in
        // another tab (review 2026-09-30 DE1-12). The user can still Reopen it.
        let sameDiagram = false;
        if (hasReadPermission) {
          try {
            const fileData = JSON.parse(await readDiagramJsonFromHandle(restoredHandle));
            sameDiagram = fileHoldsDiagramContent(fileData, diagramContentRef.current);
          } catch {
            sameDiagram = false;
          }
        }
        if (hasReadPermission && sameDiagram) {
          setDiagramFileHandle(restoredHandle);
        } else {
          if (hasReadPermission) {
            setFileNotice(
              `"${restoredHandle.name}" differs from the diagram restored in this browser, so it was not linked. ` +
                'Use File > Reopen to load the file, or Save As to keep this version.'
            );
          }
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
  }, [browserSupportsFileSystemAccess, ensureDiagramHandlePermission, setDiagramFileHandle]); // eslint-disable-line react-hooks/exhaustive-deps

  const writeDiagramJsonToHandle = useCallback(async (handle: any, jsonString: string) => {
    const writable = await handle.createWritable();
    await writable.write(new Blob([jsonString], { type: 'application/json' }));
    await writable.close();
  }, []);

  const readDiagramJsonFromHandle = useCallback(async (handle: any) => {
    const file = await handle.getFile();
    return await file.text();
  }, []);

  /**
   * Write a copy to the backup folder. Returns null on success or a message
   * saying why the copy was not made. During autosave the browser cannot ask
   * for permission (it needs a click), so only an existing grant is used.
   */
  const writeFolderBackup = useCallback(
    async (
      dirHandle: FileSystemDirectoryHandle & {
        queryPermission?: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
        requestPermission?: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
      },
      name: string,
      json: string,
      isAutosave: boolean
    ): Promise<string | null> => {
      try {
        const perm = isAutosave
          ? await dirHandle.queryPermission?.({ mode: 'readwrite' })
          : await dirHandle.requestPermission?.({ mode: 'readwrite' });
        if (perm !== 'granted') {
          return 'Backups to the folder are paused until you click Save to allow them.';
        }
        await writeFileBackup(dirHandle, name, json, backupCount);
        return null;
      } catch (error) {
        return `The backup copy was not written: ${error instanceof Error ? error.message : String(error)}.`;
      }
    },
    [backupCount]
  );

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
        if (isAutosave) {
          // Without a click, the browser cannot be asked for write access.
          // Autosave used to drop the file link, download a copy and mark
          // the diagram saved — the opened file was never updated. Now it
          // keeps the link, stays unsaved and says what to do.
          const current = handle.queryPermission ? await handle.queryPermission({ mode: 'readwrite' }) : 'granted';
          if (current !== 'granted') {
            setFileNotice(`Autosave cannot write to "${handle.name}" until you click Save once to allow it.`);
            return false;
          }
        } else {
          const hasPermission = await ensureDiagramHandlePermission(handle, 'readwrite');
          if (!hasPermission) {
            if (!forceChooseLocation) {
              setDiagramFileHandle(null);
            }
            handle = null;
          }
        }
      }

      const resolvedFileName = handle?.name || normalizedRequestedName;
      // The baseline is what this save writes, not whatever state exists when
      // the async write finishes (an edit made meanwhile stays unsaved).
      const payload = buildDiagramPayload(resolvedFileName);
      const jsonString = JSON.stringify(payload, null, 2);
      const backupKey = resolvedFileName.toLowerCase();

      if (handle) {
        let priorJson: string | null = null;
        try {
          priorJson = await readDiagramJsonFromHandle(handle);
        } catch {
          priorJson = null;
        }
        try {
          await writeDiagramJsonToHandle(handle, jsonString);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          const message = `Could not save "${resolvedFileName}": ${reason}. The diagram is not saved to the file.`;
          setFileNotice(message);
          if (!isAutosave) alert(message);
          return false;
        }
        setFileNotice(null);
        await rotateDiagramBackups(backupKey, jsonString, priorJson, backupCount);
        if (priorJson) {

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
            setBackupNotice(await writeFolderBackup(dirHandle, resolvedFileName, priorJson, isAutosave));
          }
        }
        setFileName(resolvedFileName);
        markSnapshotClean(payload);
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
      // Back up the version this save replaced (the one the last save
      // recorded), as the linked-file path does. This path used to back up
      // what it had just written, so "V1" restored nothing (review
      // 2026-09-30 settings-06).
      const replacedJson = await rotateDiagramBackups(backupKey, jsonString, null, backupCount);
      if (replacedJson && backupDirHandleRef.current) {
        setBackupNotice(await writeFolderBackup(backupDirHandleRef.current, resolvedFileName, replacedJson, isAutosave));
      }
      setFileNotice(null);
      setFileName(resolvedFileName);
      markSnapshotClean(payload);
      setLastSavedAt(Date.now());
      return true;
    },
    [backupCount, buildDiagramPayload, ensureDiagramHandlePermission, fileName, markSnapshotClean, readDiagramJsonFromHandle, setDiagramFileHandle, writeDiagramJsonToHandle, writeFolderBackup]
  );

  // Always points to the latest saveDiagramToCurrentTarget so async flows
  // (e.g. triggerSaveAs) read fresh state after a reset, not a stale closure.
  const saveDiagramToCurrentTargetRef = useRef(saveDiagramToCurrentTarget);
  saveDiagramToCurrentTargetRef.current = saveDiagramToCurrentTarget;

  // File autosave. saveDiagramToCurrentTarget gets a new identity on every
  // render (buildDiagramPayload is not memoized) and the editor re-renders every
  // 500 ms while dirty, so it is read through the ref rather than listed as a
  // dependency — otherwise the timer restarts before it can ever fire.
  useEffect(() => {
    if (!isDirty) return;
    if (!diagramFileHandleRef.current) return;
    const timeout = window.setTimeout(() => {
      void saveDiagramToCurrentTargetRef.current({
        requestedFileName: fileName,
        forceChooseLocation: false,
        allowPicker: false,
        isAutosave: true,
      }).catch((error) => {
        // The diagram stays unsaved; the reason is shown beside Save.
        setFileNotice(`Autosave failed: ${error instanceof Error ? error.message : String(error)}.`);
      });
    }, autosaveDelayMs);
    return () => window.clearTimeout(timeout);
    // Every content field (diagramContentDeps), not the diagramContent object:
    // that is rebuilt on every render, which would restart the timer before
    // it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveDelayMs, fileName, isDirty, ...diagramContentDeps]);

  /**
   * Forget everything that points at the diagram being replaced: the
   * Properties panel item, selections, section popups, property dialogs and
   * an open menu. Called on Open / Restore / Import and File > New (review
   * 2026-09-30 DE1-07: a panel edit after a backup restore wrote the stale
   * snapshot back over the restored person).
   */
  const clearTransientEditorState = useCallback(() => {
    setPropertiesPanelItem(null);
    setPropertiesPanelIntent(null);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setSelectedFamilyIds([]);
    setPersonSectionPopup(null);
    setPartnershipSectionPopup(null);
    setFamilyPropertyModal(null);
    setTrianglePropertyModal(null);
    setContextMenu(null);
  }, []);

  const replaceDiagramState = (
    data: any,
    sourceFileName?: string,
    options?: {
      normalizeLayout?: boolean;
      /**
       * Keep the last-saved baseline, so the new content counts as unsaved.
       * A restored backup is an older version than the file holds: marking
       * it saved hid that from autosave and from the unsaved-changes prompt
       * (gate 2026-10-01 #4).
       */
      keepSavedBaseline?: boolean;
    }
  ) => {
    if (!Array.isArray(data.people) || !Array.isArray(data.partnerships) || !Array.isArray(data.emotionalLines)) {
      throw new Error('Invalid file format');
    }
    clearTransientEditorState();
    const normalizeLayout = options?.normalizeLayout ?? false;
    const nextDefinitions: FunctionalIndicatorDefinition[] = Array.isArray(data.functionalIndicatorDefinitions)
      ? data.functionalIndicatorDefinitions
      : functionalIndicatorDefinitions;
    applyIndicatorDefinitionArray(nextDefinitions);
    const cleaned = removeOrphanedMiscarriages(data.people, data.partnerships);
    const normalizedLines = normalizeEmotionalLines(data.emotionalLines);
    const normalizedTriangles = normalizeTriangles(Array.isArray(data.triangles) ? data.triangles : []);
    const normalized = normalizeLayout
      ? normalizeImportedChildLayout(cleaned.people, cleaned.partnerships, {
          expandParentSpan: true,
          autoResizeDenseFamilies: true,
        })
      : { people: cleaned.people, partnerships: cleaned.partnerships };
    const aligned = alignAllAnchors(normalized.people, normalized.partnerships);
    const sanitizedPeople = sanitizePeopleIndicators(aligned, nextDefinitions);
    const peopleWithEvents = attachEventClassToEntities(sanitizedPeople, 'individual');
    const partnershipsWithEvents = attachFamilyEventsToPartnerships(
      attachEventClassToEntities(normalized.partnerships, 'relationship')
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
    // settings-09: a list in the file, even an empty one, is the file's
    // list; a file without the key keeps the current one.
    if (Array.isArray(data.relationshipTypes)) {
      setRelationshipTypes(data.relationshipTypes);
    }
    if (Array.isArray(data.relationshipStatuses)) {
      setRelationshipStatuses(data.relationshipStatuses);
    }
    if (Array.isArray(data.sirCategories)) {
      setSirCategories(data.sirCategories);
    }
    const nextFunctionalFactCategories = Array.isArray(data.functionalFactCategories)
      ? data.functionalFactCategories
      : functionalFactCategories;
    const nextNodalCategories = Array.isArray(data.nodalCategories) ? data.nodalCategories : nodalCategories;
    setFunctionalFactCategories(nextFunctionalFactCategories);
    setNodalCategories(nextNodalCategories);
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
    // A file without ideas or predictions has none: the product demo's are
    // not carried into it.
    const nextIdeasText = typeof data.ideasText === 'string' ? data.ideasText : '';
    const nextPredictionSets = normalizePredictionSets(data.predictionSets);
    setIdeasText(nextIdeasText);
    setPredictionSets(nextPredictionSets);
    setTimelinePlaying(false);
    setTimelineYear(null);
    closeTimeline();
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    if (options?.keepSavedBaseline) return;
    markSnapshotClean({
      people: peopleWithEvents,
      partnerships: partnershipsWithEvents,
      emotionalLines: linesWithEvents,
      pageNotes: Array.isArray(data.pageNotes) ? data.pageNotes : [],
      triangles: trianglesWithKnownPeople,
      functionalIndicatorDefinitions: nextDefinitions,
      // Same fallback as the setters above: a file without these lists keeps
      // the current ones, so the baseline must too (not the defaults).
      eventCategories:
        Array.isArray(data.eventCategories) && data.eventCategories.length > 0
          ? data.eventCategories
          : eventCategories,
      relationshipTypes:
        explicitList<string>(data.relationshipTypes) ?? relationshipTypes,
      relationshipStatuses:
        explicitList<string>(data.relationshipStatuses) ?? relationshipStatuses,
      ideasText: nextIdeasText,
      predictionSets: nextPredictionSets,
      functionalFactCategories: nextFunctionalFactCategories,
      nodalCategories: nextNodalCategories,
    });
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

  const beginSessionCaptureFlow = (rawData: SessionCaptureImportData, sourceFileName: string) => {
    // Repeated operation ids would share one checkbox (review capture-03).
    const data = withUniqueOperationIds(rawData);
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

    // utils/sessionCaptureApply.ts: the matching, event building and
    // partnership creation, and an honest count of what was applied.
    const result = applySessionCaptureOperations(people, partnerships, selectedOps);
    setPartnerships(result.partnerships);
    setPeopleAligned(() => result.people);

    if ((pendingSessionCaptureData.ambiguityNotes || []).length) {
      const imported = pendingSessionCaptureData.ambiguityNotes!.join('\n');
      setIdeasText((prev) => (prev.trim() ? `${prev}\n\nSession Import Ambiguities:\n${imported}` : `Session Import Ambiguities:\n${imported}`));
    }

    setSessionCaptureDialogOpen(false);
    setPendingSessionCaptureData(null);
    setPendingSessionCaptureFileName('');
    setSessionCaptureSelections({});
    alert(sessionCaptureSummary(result));
  };

  const mergeDiagramState = (data: DiagramImportData, options?: { allowNewPeople?: boolean }) => {
    const merged = mergeDiagramData(
      { people, partnerships, emotionalLines, triangles, pageNotes, functionalIndicatorDefinitions },
      data,
      { allowNewPeople: options?.allowNewPeople, alignAllAnchors }
    );
    applyIndicatorDefinitionArray(merged.functionalIndicatorDefinitions);
    setPeople(merged.people);
    setPartnerships(merged.partnerships);
    setEmotionalLines(merged.emotionalLines);
    setPageNotes(merged.pageNotes);
    setTriangles(merged.triangles);
    const notMerged = [
      merged.skippedPeopleNames.length
        ? `${merged.skippedPeopleNames.length} people with no match in this diagram: ${merged.skippedPeopleNames.join(', ')}`
        : '',
      merged.droppedPartnerships ? `${merged.droppedPartnerships} partnerships involving them` : '',
      merged.droppedLines ? `${merged.droppedLines} emotional pattern lines involving them` : '',
      merged.droppedTriangles
        ? `${merged.droppedTriangles} triangles that involved them or no longer had three different people`
        : '',
    ].filter(Boolean);
    if (notMerged.length) {
      alert(`Merged. Not added:\n- ${notMerged.join('\n- ')}`);
    }

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
        if (!confirmDiscardUnsavedChanges(isDirty, `Replace the current diagram with "${pendingImportFileName}"`)) return;
        const normalizeLayout = pendingImportSource === 'transcript' || pendingImportSource === 'facts';
        replaceDiagramState(pendingImportData, pendingImportFileName, { normalizeLayout });
      } else {
        const allowNewPeople = pendingImportSource !== 'facts';
        mergeDiagramState(pendingImportData, { allowNewPeople });
      }
      // Imported diagrams should open with all elements visible rather than staying on a prior year cutoff.
      setTimelinePlaying(false);
      setTimelineYear(null);
      closeTimeline();
      setImportModeDialogOpen(false);
      setPendingImportData(null);
      setPendingImportFileName('');
    } catch (error) {
      // Say what failed (it was a bare "Error importing data"). The diagram
      // is unchanged: both paths compute the new state before setting any.
      console.error('Import failed:', error);
      alert(
        `The import could not be completed: ${error instanceof Error ? error.message : String(error)}. ` +
          'The diagram was not changed.'
      );
    }
  };


  const openSaveAsDialog = useCallback((onConfirm: (name: string) => void) => {
    saveAsOnConfirmRef.current = onConfirm;
    setSaveAsDialogOpen(true);
  }, []);

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
        const saved = await saveDiagramToCurrentTargetRef.current({ requestedFileName: handle.name, forceChooseLocation: false, allowPicker: false });
        // A file that could not be written is not kept as the save target
        // (the save itself has already said why).
        if (!saved) setDiagramFileHandle(null);
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return; // user cancelled — do nothing
        // Say what failed before offering the download fallback; this used
        // to fall through without a word (review 2026-09-30 DE2-08).
        setDiagramFileHandle(null);
        alert(
          `Save As could not use the chosen file (${err instanceof Error ? err.message : String(err)}). ` +
            'Choose a name to download a copy instead.'
        );
      }
    }
    // Fallback for browsers without showSaveFilePicker
    openSaveAsDialog((name: string) => {
      void saveDiagramToCurrentTargetRef.current({ requestedFileName: name, forceChooseLocation: false, allowPicker: false }).catch(
        (error) => setFileNotice(`Could not save: ${error instanceof Error ? error.message : String(error)}.`)
      );
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
      try {
        localStorage.setItem('anthropic_api_key', values.anthropicApiKey);
        localStorage.setItem('deepseek_api_key', values.deepseekApiKey);
        localStorage.setItem('selected_model_id', values.modelId);
        // Keep the legacy key in sync for any reader that hasn't migrated yet.
        localStorage.setItem('anthropic_model', values.modelId);
      } catch {
        // Used for this session; say it will not be remembered.
        alert('The AI settings could not be stored in this browser (storage is full or blocked). They apply until the page is closed.');
      }
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
      hints?: ImageImportHints
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

      // Created before the first await, so Cancel works from the first moment
      // (it used to be created after two dynamic imports, and a Cancel during
      // "Preparing…" did nothing — review 2026-09-30 DE2-06).
      const abortController = new AbortController();
      imageDiagramAbortRef.current = abortController;
      try {
        // VLM-based genogram extraction: send whole image to Claude Vision for holistic reading
        const modelId =
          localStorage.getItem('selected_model_id') ||
          localStorage.getItem('anthropic_model') ||
          'claude-sonnet-4-6';
        const apiKey = localStorage.getItem('anthropic_api_key') || '';
        const activeModel = lookupModel(modelId);
        log.info(
          `AI settings: model=${modelId} ` +
            `(${activeModel ? `${activeModel.provider}, ${activeModel.supportsVision ? 'vision' : 'text-only'}` : 'not in model list'}) ` +
            `anthropicApiKey=${apiKey.trim() ? 'present' : 'missing'}`
        );

        const readiness = checkVisionImportReadiness(apiKey, modelId, activeModel);
        if (!readiness.ok) {
          throw new Error(`Claude Vision is required for image import. ${readiness.message}`);
        }

        log.info(`Using VLM for extraction: ${readiness.model.label}`);

        // vlmImport is loaded on demand (its own chunk). dataImport is
        // imported statically: useFileOperations already pulls it into the
        // main chunk, so a dynamic import here split nothing.
        const { vlmImport, GENOGRAM_IMPORT_COST_ESTIMATE } = await import('../utils/genogram/vlmImport');

        // Extract facts from image using VLM
        const facts = await vlmImport(imageBlob, {
          apiKey,
          model: readiness.model.id,
          // 2400 px keeps small symbols legible on dense drawings. Models with
          // high-resolution vision (Opus 4.7+, Sonnet 5, Fable) read it as sent;
          // older ones (Sonnet 4.6, Haiku 4.5) are downscaled to 1568 px by the API.
          maxImageDimension: 2400,
          imageQuality: 0.85,
          // A dense diagram (~200 people) needs 20-40k output tokens, and newer
          // models' thinking counts against max_tokens too. 64000 is within every
          // built-in model's output limit (Haiku 4.5's is 64K). The reply streams,
          // so a long one does not time out; only a stalled stream does.
          maxTokens: 64000,
          idleTimeoutMs: 90000,
          effort: activeModel?.supportsEffort ? 'low' : undefined,
          onProgress: (msg) => setImageDiagramProgress(msg),
          signal: abortController.signal,
          hints,
        });
        // Cancelled while the reply was on its way: add nothing.
        if (abortController.signal.aborted) return;

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

        setImageDiagramModalOpen(false);
        log.info(`Read ${people.length} people and ${partnerships.length} partnerships.`);
        log.info(`Estimated cost per image: ~$${GENOGRAM_IMPORT_COST_ESTIMATE.estimatedCostPerImage.toFixed(3)} USD`);
        // Like every other import: the user chooses Replace or Merge, instead
        // of the people being appended to the diagram unasked; and when the
        // model was unsure of anything, the log says what (review DE2-05).
        beginImportFlow(diagramData, 'image import', 'import');
        const uncertain = facts.uncertainties?.length ?? 0;
        if (uncertain > 0) {
          showLog(
            `${people.length} people and ${partnerships.length} partnerships read from the image. ` +
              `The reader was unsure of ${uncertain} thing${uncertain === 1 ? '' : 's'} — check them on the diagram.`
          );
        }
      } catch (error) {
        // A cancel is not a failure to report.
        if (abortController.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Unknown error';
        log.error(`Caught exception: ${message}`);
        showLog(`Analysis failed: ${message}`);
      } finally {
        setImageDiagramAnalyzing(false);
        setImageDiagramProgress('');
        imageDiagramAbortRef.current = null;
      }
    },
    []
  );

  const handleImageDiagramCancel = useCallback(() => {
    if (imageDiagramAbortRef.current) {
      imageDiagramAbortRef.current.abort();
      imageDiagramAbortRef.current = null;
    }
    setImageDiagramAnalyzing(false);
    setImageDiagramProgress('');
    setImageDiagramModalOpen(false);
  }, []);

  const {
    handleSave,
    handleSaveAs,
    handleOpenBackupRestore,
    handleRestoreBackupVersion,
    handleLoad,
    handleImportLoad,
    handleProcessTranscriptLoad,
    handleNewFile: resetToNewDiagram,
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
    closeTimeline,
    setIdeasText,
    setPredictionSets,
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
    clearTransientEditorState,
    setDiagramFileHandle,
    markSnapshotClean,
    triggerSaveAs,
  });

  // File > New: clear the canvas, then re-show the right-click hint so a fresh
  // diagram starts with the same guidance as app startup. Skipped when the user
  // cancels the unsaved-changes confirm (handleNewFile returns false).
  const handleNewDiagram = () => {
    const didReset = resetToNewDiagram();
    if (didReset && !isRightClickHintHidden()) {
      setRightClickHintOpen(true);
    }
  };

  // Closing the hint persists the "don't show this again" preference so it
  // suppresses both the startup show and the File > New re-show.
  const handleCloseRightClickHint = () => {
    setRightClickHintOpen(false);
    if (rightClickHintDontShowAgain && !setRightClickHintHidden(true)) {
      // The store refused the write (quota, private mode). Say so, rather
      // than let the hint simply come back next launch with no explanation.
      window.alert(HINT_PREFERENCE_NOT_SAVED_MESSAGE);
    }
  };

  // Once the user follows the hint and opens a context menu, the hint has done
  // its job — dismiss it, through the same close path so a ticked checkbox still
  // persists. (Stacking order is handled separately, in constants/zIndex.ts.)
  useEffect(() => {
    if (contextMenu && rightClickHintOpen) {
      handleCloseRightClickHint();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextMenu, rightClickHintOpen]);


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
      if (!confirmDiscardUnsavedChanges(isDirty, `Reopen "${pendingReopenHandle.name as string}"`)) return;
      replaceDiagramState(data, pendingReopenHandle.name as string);
      setDiagramFileHandle(pendingReopenHandle);
      setPendingReopenHandle(null);
      setPendingReopenName('');
    } catch {
      alert('Could not read the file. Please use File > Open to locate it manually.');
    }
  }, [pendingReopenHandle, ensureDiagramHandlePermission, isDirty, replaceDiagramState, setDiagramFileHandle]);

  // Shown once per session, and never again once the user turns it off —
  // the same mechanism as the right-click hint.
  const handleCanvasScrollHint = () => {
    if (scrollHintShownRef.current || isCanvasScrollHintHidden()) return;
    scrollHintShownRef.current = true;
    setCanvasScrollHintOpen(true);
  };

  const closeCanvasScrollHint = (dontShowAgain: boolean) => {
    setCanvasScrollHintOpen(false);
    if (dontShowAgain && !setCanvasScrollHintHidden(true)) {
      window.alert(HINT_PREFERENCE_NOT_SAVED_MESSAGE);
    }
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
      closeTimeline();
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
      closeTimeline();
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
      closeTimeline();
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
      closeTimeline();
      return;
    }

    if (focus.kind === 'toolbar') {
      setSelectedPeopleIds([]);
      setSelectedPartnershipId(null);
      setSelectedEmotionalLineId(null);
      setSelectedChildId(null);
      setPropertiesPanelItem(null);
      closeTimeline();
      return;
    }

    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setPropertiesPanelItem(null);
    if (focus.kind === 'timeline') {
      openTimeline({ personIds: focus.personIds, familyIds: [] });
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
        // bundle-01: the same import as File › Import (useFileOperations);
        // it shows the counts and asks before changing any event.
        const outcome = importPersonEventFile(parsed, people, (message) => window.confirm(message));
        if (outcome.status === 'invalid') {
          throw new Error('Not a person-event bundle');
        }
        if (outcome.status === 'applied') {
          setPeople(outcome.people);
          setTimelineYear(null);
          setTimelinePlaying(false);
        }
        if (outcome.status === 'applied' || outcome.status === 'no-changes') alert(outcome.message);
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
    // Ask only when there is something to lose (it warned every time), and
    // say so when the browser will not close the tab: browsers only let a
    // page close a tab it opened itself (review 2026-09-30 DE2-11).
    if (!confirmDiscardUnsavedChanges(isDirty, 'Quit the Family Diagram Maker')) return;
    window.close();
    window.setTimeout(() => {
      if (!window.closed) {
        alert('The browser does not let the app close this tab. Close it yourself; the diagram is kept in this browser.');
      }
    }, 300);
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
    selectedPageNoteIds: activeMarqueePageNoteIds(selectedPeopleIds, marqueePageNoteSelection),
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
      // settings-03: no child rows until the user adds one. Three preset
      // rows (male, female, male) were created as blank children on Save.
      children: [],
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
    openTimeline,
    familyScopeFocus: familyScope.focus,
    focusFamilyOnPerson: familyScope.focusOnPerson,
    clearFamilyFocus: familyScope.clearFocus,
    deriveTimelineIds,
    deriveTimelineIdsForRoot,
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
    const sub = seed?.subtype || 'Functioning';
    const resolvedTitle = modalTitle || ['Triangle', seed?.category || 'Primary', sub].filter(Boolean).join(' ');
    // No date and no ratings until the user gives them (author decisions
    // 2026-09-30); the category and subtype are valid TRIANGLE values.
    setTrianglePropertyModal({
      triangleId,
      position,
      modalTitle: resolvedTitle,
      draft: {
        date: '',
        startDate: '',
        category: 'Primary',
        subtype: 'Functioning',
        status: 'ongoing',
        intensity: 0,
        frequency: 0,
        impact: 0,
        howWell: 0,
        wwwwh: '',
        observations: '',
        primaryPersonName: person1?.name || person2?.name || '',
        otherPersonName: person3?.name || person2?.name || '',
        ...seed,
        id: nanoid(),
        eventType: 'TRIANGLE',
        eventClass: 'triangle',
        anchorType: 'TRIANGLE',
        anchorId: triangleId,
        createdAt: Date.now(),
      },
    });
  };

  const openFamilyPropertyModal = (
    partnershipId: string,
    seed: { category?: string; subtype?: string },
    position: { x: number; y: number },
    modalTitle?: string
  ) => {
    const partnership = partnerships.find((p) => p.id === partnershipId);
    if (!partnership) return;
    const partner1 = people.find((p) => p.id === partnership.partner1_id);
    const partner2 = people.find((p) => p.id === partnership.partner2_id);
    // No date, no ratings and no category until the user gives them (author
    // decisions 2026-09-30; review DE2-03).
    setFamilyPropertyModal({
      partnershipId,
      position,
      modalTitle,
      draft: buildFamilyEventDraft({
        partnershipId,
        partner1Name: partner1?.name,
        partner2Name: partner2?.name,
        category: seed.category,
        subtype: seed.subtype,
      }),
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
          { subtype: processType, category },
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
          // From eventConstants, so a new subtype reaches the menu (struct-08).
          children: (EVENT_SUBTYPES.FAMILY?.Triangles || []).map((subtype) =>
            makeFamilyItem(subtype, subtype, 'Triangles', 'Triangles')
          ),
        },
        {
          label: 'Stressors',
          children: (EVENT_SUBTYPES.FAMILY?.Stress || []).map((subtype) =>
            makeFamilyItem(subtype, subtype, 'Stress', 'Stressors')
          ),
        },
        {
          label: 'Timeline',
          onClick: () => {
            // Timeline shows whatever is currently selected — all selected
            // families + all selected people. The right-click already
            // guarantees this family is part of the family selection.
            // With no explicit person selection, the active family scope
            // supplies the person lanes (D5).
            openTimeline(familyTimelineLanes(partnershipId, selectedPeopleIds, selectedFamilyIds, deriveTimelineIds));
            setContextMenu(null);
          },
        },
      ],
    });
  };

  const handleFamilyAddGenericEvent = (partnershipId: string, position: { x: number; y: number }) => {
    openFamilyPropertyModal(partnershipId, {}, position, 'Family Add Event');
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
    selectSystemEventOwner,
    selectEmotionalLineFromPanel,
    removeEmotionalLineFromPanel,
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
      setMarqueePageNoteSelection({ peopleIds: selected, pageNoteIds: selectedNotes });
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
            storageWriteFailed={failedStorageKeys.size > 0}
            saveNotices={[fileNotice, backupNotice].filter((notice): notice is string => !!notice)}
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
            familyScopeFocus={familyScope.focus}
            familyScopeRootName={familyScope.rootPerson?.name || ''}
            familyScopeExclusions={familyScope.exclusions}
            familyScopeDepth={familyScope.depth}
            onFamilyScopeAdjustUp={familyScope.adjustUp}
            onFamilyScopeAdjustDown={familyScope.adjustDown}
            onFamilyScopeClear={familyScope.clearFocus}
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
            handleStartDemoTour={handleStartDemoTour}
            handleStartBuildDemo={handleStartBuildDemo}
            setTrainingVideosOpen={setTrainingVideosOpen}
            setReadmeViewerOpen={setReadmeViewerOpen}
            setNotesLayerEnabled={setNotesLayerEnabled}
            showSiblingConflicts={showSiblingConflicts}
            setShowSiblingConflicts={setShowSiblingConflicts}
            handleNewFile={handleNewDiagram}
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
            closeCanvasScrollHint={closeCanvasScrollHint}
            panelRef={panelRef}
            panelWidth={panelWidth}
            resizeStateRef={resizeStateRef}
            showMultiPersonPanel={showMultiPersonPanel}
            multiSelectedPeople={multiSelectedPeople}
            propertiesPanelItem={propertiesPanelItem}
            handleUpdatePartnership={handleUpdatePartnership}
            handleTriangleNoteDragEnd={handleTriangleNoteDragEnd}
            handleTriangleNoteResizeEnd={handleTriangleNoteResizeEnd}
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
            propertiesPanel={
              <PropertiesPanelHost
                people={people}
                partnerships={partnerships}
                allEmotionalLines={allEmotionalLines}
                functionalIndicatorDefinitions={functionalIndicatorDefinitions}
                handleUpdatePartnership={handleUpdatePartnership}
                showMultiPersonPanel={showMultiPersonPanel}
                multiSelectedPeople={multiSelectedPeople}
                propertiesPanelItem={propertiesPanelItem}
                setPropertiesPanelItem={setPropertiesPanelItem}
                setSelectedPeopleIds={setSelectedPeopleIds}
                selectedFamilyId={selectedFamilyId}
                onFamilyIndicatorClick={handleFamilyIndicatorClick}
                onSelectSystemEventOwner={selectSystemEventOwner}
                onSelectEmotionalLine={selectEmotionalLineFromPanel}
                personSectionPopup={personSectionPopup}
                personSectionPopupPerson={personSectionPopupPerson}
                setPersonSectionPopup={setPersonSectionPopup}
                partnershipSectionPopup={partnershipSectionPopup}
                partnershipSectionPopupPartnership={partnershipSectionPopupPartnership}
                setPartnershipSectionPopup={setPartnershipSectionPopup}
                familyScope={activeFamilyScope}
                onOpenFamilyProperty={(partnershipId, category, subtype, position) =>
                  openFamilyPropertyModal(
                    partnershipId,
                    { category, subtype },
                    position,
                    ['Family', category, subtype].filter(Boolean).join(' ')
                  )
                }
                onAddFamilyEvent={handleFamilyAddGenericEvent}
                onDeleteFamilyEvent={handleDeleteFamilyEvent}
                onCloseFamilyPanel={() => setSelectedFamilyId(null)}
                sirCategories={sirCategories}
                functionalFactCategories={functionalFactCategories}
                nodalCategories={nodalCategories}
                handleBatchUpdatePersons={handleBatchUpdatePersons}
                openAddEmotionalPatternModal={openAddEmotionalPatternModal}
                eventCategories={eventCategories}
                relationshipTypes={relationshipTypes}
                relationshipStatuses={relationshipStatuses}
                handleUpdatePerson={handleUpdatePerson}
                handleUpdateEmotionalLine={handleUpdateEmotionalLine}
                panelTriangleContext={panelTriangleContext}
                updateTriangleColor={updateTriangleColor}
                updateTriangleIntensity={updateTriangleIntensity}
                updateTriangle={updateTriangle}
                propertiesPanelIntent={propertiesPanelIntent}
                setPropertiesPanelIntent={setPropertiesPanelIntent}
                ensureSymptomDefinition={ensureSymptomDefinition}
                onRemoveEmotionalLine={removeEmotionalLineFromPanel}
              />
            }
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
            ensureSymptomDefinition={ensureSymptomDefinition}
            reorderFunctionalIndicators={setFunctionalIndicatorDefinitions}
            // settings-02: a rename rewrites the events (and SIR prediction
            // links) that name the category; a delete is refused while used.
            categoryUsage={(type, name) =>
              categoryUsage({ people, partnerships, emotionalLines, triangles, predictionSets }, type, name)
            }
            sirSettingsOpen={sirSettingsOpen}
            setSirSettingsOpen={setSirSettingsOpen}
            sirCategories={sirCategories}
            onSaveSirCategories={(next) =>
              saveCategoryList('SIR', sirCategories, next, setSirCategories, {
                setPeople, setPartnerships, setEmotionalLines, setTriangles, setPredictionSets, setPropertiesPanelItem,
              })
            }
            ffSettingsOpen={ffSettingsOpen}
            setFfSettingsOpen={setFfSettingsOpen}
            functionalFactCategories={functionalFactCategories}
            onSaveFunctionalFactCategories={(next) =>
              saveCategoryList('FF', functionalFactCategories, next, setFunctionalFactCategories, {
                setPeople, setPartnerships, setEmotionalLines, setTriangles, setPredictionSets, setPropertiesPanelItem,
              })
            }
            nodalSettingsOpen={nodalSettingsOpen}
            setNodalSettingsOpen={setNodalSettingsOpen}
            nodalCategories={nodalCategories}
            onSaveNodalCategories={(next) =>
              saveCategoryList('NODAL', nodalCategories, next, setNodalCategories, {
                setPeople, setPartnerships, setEmotionalLines, setTriangles, setPredictionSets, setPropertiesPanelItem,
              })
            }
            people={people}
            partnerships={partnerships}
            allEmotionalLines={allEmotionalLines}
            timelineSelectionIds={timelineSelectionIds}
            timelineFamilySelectionIds={timelineFamilySelectionIds}
            familyScope={activeFamilyScope}
            handleUpdatePerson={handleUpdatePerson}
            handleUpdatePartnership={handleUpdatePartnership}
            handleUpdateEmotionalLine={handleUpdateEmotionalLine}
            timelineOpen={timelineOpen}
            timelineFocusControls={
              timelineFollowsFocus ? (
                <FamilyScopeChip
                  focus={familyScope.focus}
                  rootName={familyScope.rootPerson?.name || ''}
                  exclusions={familyScope.exclusions}
                  depth={familyScope.depth}
                  onAdjustUp={familyScope.adjustUp}
                  onAdjustDown={familyScope.adjustDown}
                  onClear={familyScope.clearFocus}
                />
              ) : null
            }
            closeTimeline={closeTimeline}
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
            rightClickHintOpen={rightClickHintOpen}
            rightClickHintDontShowAgain={rightClickHintDontShowAgain}
            setRightClickHintDontShowAgain={setRightClickHintDontShowAgain}
            handleCloseRightClickHint={handleCloseRightClickHint}
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
            onImageDiagramCancel={handleImageDiagramCancel}
            onImageDiagramAnalyze={handleImageDiagramAnalyze}
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
                prev ? { ...prev, draft: applyEventDraftFieldChange(prev.draft, field, value) } : prev
              )
            }
            onSetDraft={(draft) =>
              setTrianglePropertyModal((prev) => (prev ? { ...prev, draft } : prev))
            }
            onSave={() => {
              if (!trianglePropertyModal) return;
              const { triangleId, draft } = trianglePropertyModal;
              const saved = normalizeEventForSave(draft, {
                anchorType: 'TRIANGLE',
                anchorId: triangleId,
                eventClass: 'triangle',
              });
              setTriangles((prev) =>
                prev.map((t) =>
                  t.id === triangleId
                    ? { ...t, events: [...(t.events || []), saved] }
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
                prev ? { ...prev, draft: applyEventDraftFieldChange(prev.draft, field, value) } : prev
              )
            }
            onSetDraft={(draft) =>
              setFamilyPropertyModal((prev) => (prev ? { ...prev, draft } : prev))
            }
            onSave={() => {
              if (!familyPropertyModal) return;
              const { partnershipId, draft, editingEventId } = familyPropertyModal;
              // Family events are always FAMILY / family; the category keeps
              // what the user chose (an empty one is no longer saved as
              // "Triangles").
              const savedDraft = normalizeEventForSave(
                { ...draft, eventType: 'FAMILY' as const, eventClass: 'family', category: canonicalFamilyCategory(draft.category) },
                { anchorType: 'FAMILY', anchorId: partnershipId, eventClass: 'family' }
              );
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
