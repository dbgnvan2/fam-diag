import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import type {
  Person,
  Partnership,
  EmotionalLine,
  Triangle,
  FunctionalIndicatorDefinition,
  EmotionalProcessEvent,
  EventClass,
  GenderSymbol,
  BirthSex,
  GenderIdentity,
  SymptomGroup,
  PageNote,
} from '../types';
import PersonNode from './PersonNode';
import PartnershipNode from './PartnershipNode';
import ChildConnection from './ChildConnection';
import { nanoid } from 'nanoid';
import ContextMenu from './ContextMenu';
import type { KonvaEventObject } from 'konva/lib/Node';
import PropertiesPanel from './PropertiesPanel';
import MultiPersonPropertiesPanel from './MultiPersonPropertiesPanel';
import EmotionalLineNode from './EmotionalLineNode';
import TriangleFillNode from './TriangleFillNode';
import NoteNode from './NoteNode';
import ReactMarkdown from 'react-markdown';
import type { Components as MarkdownComponents } from 'react-markdown';
import { Stage as StageType } from 'konva/lib/Stage';
import { useAutosave } from '../hooks/useAutosave';
import { removeOrphanedMiscarriages } from '../utils/dataCleanup';
import SessionNotesPanel from './SessionNotesPanel';
import IdeasPanel from './IdeasPanel';
import DatePickerField from './DatePickerField';
import { getSaveButtonState } from '../utils/saveButtonState';
import {
  shouldShowEmotionalNote,
  shouldShowPartnershipNote,
  shouldShowPersonNote,
} from '../utils/noteVisibility';
import {
  FREQUENCY_OPTIONS,
  INTENSITY_OPTIONS,
  IMPACT_OPTIONS,
} from '../constants/functionalIndicatorScales';
import {
  DEFAULT_DIAGRAM_STATE,
  FALLBACK_FILE_NAME,
} from '../data/defaultDiagramState';
import {
  HELP_SECTIONS,
  RIBBON_HELP,
  type RibbonHelpKey,
} from '../data/helpContent';
import productDefaultDiagramDataJson from '../../../../PRODUCT_DEFAULT.diagram.json';
import {
  buildTimelineJson,
  isPersonEventBundle,
  isTimelineJson,
  mergePersonEventsFromBundle,
  timelineJsonToBundle,
} from '../utils/personEventBundle';
import {
  normalizeCommandName,
  parseVoiceCommands,
  type VoiceCommandOperation,
} from '../utils/voiceCommands';
import readmeContent from '../../../../README.md?raw';
type MarkdownCodeProps = React.ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
};

const codeRenderer = ({ inline, children, ...props }: MarkdownCodeProps) =>
  inline ? (
    <code style={{ background: '#f1f3f7', padding: '2px 4px', borderRadius: 4 }} {...props}>
      {children}
    </code>
  ) : (
    <code {...props}>{children}</code>
  );

const markdownComponents: MarkdownComponents = {
  h1: ({ node: _node, ...props }) => (
    <h1 style={{ borderBottom: '1px solid #e0e0e0', paddingBottom: 4 }} {...props} />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 style={{ marginTop: 24, borderBottom: '1px solid #e0e0e0', paddingBottom: 4 }} {...props} />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre
      style={{
        background: '#1a1d2d',
        color: '#fefefe',
        padding: 12,
        borderRadius: 8,
        overflowX: 'auto',
      }}
      {...props}
    />
  ),
  code: codeRenderer,
};

const DEFAULT_LINE_COLOR = '#444444';
const LINE_STYLE_VALUES: Record<EmotionalLine['relationshipType'], EmotionalLine['lineStyle'][]> = {
  fusion: [
    'fusion-dotted-wide',
    'fusion-dotted-tight',
    'fusion-solid-wide',
    'fusion-solid-tight',
    'fusion-triple',
  ],
  distance: [
    'distance-dashed-tight',
    'distance-dashed-wide',
    'distance-long',
    'distance-dotted-tight',
    'distance-dotted-wide',
  ],
  cutoff: ['cutoff'],
  conflict: [
    'conflict-dotted-wide',
    'conflict-dotted-tight',
    'conflict-solid-wide',
    'conflict-solid-tight',
    'conflict-double',
  ],
  projection: ['projection-1', 'projection-2', 'projection-3', 'projection-4', 'projection-5'],
};
const emotionalPatternIntensityOptions = (relationshipType: EmotionalLine['relationshipType']) => {
  switch (relationshipType) {
    case 'fusion':
      return [
        { value: 'fusion-dotted-wide', label: 'Level 1 (double dotted, two spaces)' },
        { value: 'fusion-dotted-tight', label: 'Level 2 (double dotted, no space)' },
        { value: 'fusion-solid-wide', label: 'Level 3 (double solid, two spaces)' },
        { value: 'fusion-solid-tight', label: 'Level 4 (double solid, no space)' },
        { value: 'fusion-triple', label: 'Level 5 (triple lines)' },
      ] as const;
    case 'distance':
      return [
        { value: 'distance-dashed-tight', label: 'Level 1 (dashed, very little space)' },
        { value: 'distance-dashed-wide', label: 'Level 2 (longer segments, some space)' },
        { value: 'distance-long', label: 'Level 3 (longer segments, lots of space)' },
        { value: 'distance-dotted-tight', label: 'Level 4 (short segments, space)' },
        { value: 'distance-dotted-wide', label: 'Level 5 (dots, space)' },
      ] as const;
    case 'conflict':
      return [
        { value: 'conflict-dotted-wide', label: 'Minimum' },
        { value: 'conflict-dotted-tight', label: 'Mild' },
        { value: 'conflict-solid-wide', label: 'Moderate' },
        { value: 'conflict-solid-tight', label: 'Major' },
        { value: 'conflict-double', label: 'Maximal' },
      ] as const;
    case 'projection':
      return [
        { value: 'projection-1', label: 'Level 1 (>....>)' },
        { value: 'projection-2', label: 'Level 2 (>...>)' },
        { value: 'projection-3', label: 'Level 3 (>.>)' },
        { value: 'projection-4', label: 'Level 4 (>>>>)' },
        { value: 'projection-5', label: 'Level 5 (>>>>>)' },
      ] as const;
    default:
      return [{ value: 'cutoff', label: 'Cutoff' }] as const;
  }
};
const intensityValueForLineStyle = (lineStyle: EmotionalLine['lineStyle']): number => {
  if (
    lineStyle === 'fusion-dotted-wide' ||
    lineStyle === 'distance-dashed-tight' ||
    lineStyle === 'conflict-dotted-wide' ||
    lineStyle === 'projection-1' ||
    lineStyle === 'dotted' ||
    lineStyle === 'dotted-saw-tooth'
  ) return 1;
  if (lineStyle === 'fusion-dotted-tight') return 2;
  if (
    lineStyle === 'distance-dashed-wide' ||
    lineStyle === 'conflict-dotted-tight' ||
    lineStyle === 'projection-2'
  ) return 2;
  if (
    lineStyle === 'fusion-solid-wide' ||
    lineStyle === 'distance-long' ||
    lineStyle === 'conflict-solid-wide' ||
    lineStyle === 'projection-3' ||
    lineStyle === 'dashed' ||
    lineStyle === 'solid-saw-tooth'
  ) return 3;
  if (
    lineStyle === 'fusion-solid-tight' ||
    lineStyle === 'distance-dotted-tight' ||
    lineStyle === 'conflict-solid-tight' ||
    lineStyle === 'projection-4'
  ) return 4;
  if (
    lineStyle === 'fusion-triple' ||
    lineStyle === 'distance-dotted-wide' ||
    lineStyle === 'conflict-double' ||
    lineStyle === 'projection-5' ||
    lineStyle === 'long-dash' ||
    lineStyle === 'double-saw-tooth'
  ) return 5;
  if (lineStyle === 'low') return 1;
  if (lineStyle === 'medium') return 3;
  if (lineStyle === 'high') return 5;
  return 0;
};

const initialPeople: Person[] = DEFAULT_DIAGRAM_STATE.people;
const initialPartnerships: Partnership[] = DEFAULT_DIAGRAM_STATE.partnerships;
const initialEmotionalLines: EmotionalLine[] = DEFAULT_DIAGRAM_STATE.emotionalLines;
const initialPageNotes: PageNote[] = DEFAULT_DIAGRAM_STATE.pageNotes;
const initialTriangles: Triangle[] = DEFAULT_DIAGRAM_STATE.triangles;
const initialEventCategories: string[] = DEFAULT_DIAGRAM_STATE.eventCategories;
const initialRelationshipTypes: string[] = DEFAULT_DIAGRAM_STATE.relationshipTypes;
const initialRelationshipStatuses: string[] = DEFAULT_DIAGRAM_STATE.relationshipStatuses;
const initialIndicatorDefinitions: FunctionalIndicatorDefinition[] =
  DEFAULT_DIAGRAM_STATE.functionalIndicatorDefinitions;
const initialAutoSaveMinutes = DEFAULT_DIAGRAM_STATE.autoSaveMinutes;
const initialFileName = DEFAULT_DIAGRAM_STATE.fileName;
const STORAGE_KEYS = {
  userSettings: 'family-diagram-user-settings',
  autoSave: 'family-diagram-autosave-minutes',
  people: 'family-diagram-people',
  partnerships: 'family-diagram-partnerships',
  emotionalLines: 'family-diagram-emotional-lines',
  triangles: 'family-diagram-triangles',
  eventCategories: 'family-diagram-event-categories',
  relationshipTypes: 'family-diagram-relationship-types',
  relationshipStatuses: 'family-diagram-relationship-statuses',
  indicatorDefinitions: 'family-diagram-functional-indicators',
  ideas: 'family-diagram-ideas',
  sessionNotesLibrary: 'family-diagram-session-notes-library',
} as const;
const EVENT_CLASS_LABELS: Record<EventClass, string> = {
  individual: 'Individual',
  relationship: 'Relationship',
  'emotional-pattern': 'Emotional Pattern',
};
const DIAGRAM_FILE_PICKER_TYPES = [
  {
    description: 'Family Diagram JSON',
    accept: {
      'application/json': ['.json'],
    },
  },
];

const getStoredValue = (key: keyof typeof STORAGE_KEYS) => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS[key]);
};

const setStoredValue = (key: keyof typeof STORAGE_KEYS, value: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS[key], value);
};

type StoredUserSettings = {
  eventCategories?: string[];
  relationshipTypes?: string[];
  relationshipStatuses?: string[];
  functionalIndicatorDefinitions?: FunctionalIndicatorDefinition[];
  autoSaveMinutes?: number;
};

const parseStoredUserSettings = (): StoredUserSettings | null => {
  const raw = getStoredValue('userSettings');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredUserSettings;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const parseStoredArraySetting = (key: keyof typeof STORAGE_KEYS): string[] | null => {
  const raw = getStoredValue(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const parseStoredIndicatorDefinitions = (): FunctionalIndicatorDefinition[] | null => {
  const raw = getStoredValue('indicatorDefinitions');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FunctionalIndicatorDefinition[]) : null;
  } catch {
    return null;
  }
};

const sortLabelsAZ = (values: string[]) =>
  [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

const DIAGRAM_HANDLE_DB = 'family-diagram-file-handle-db';
const DIAGRAM_HANDLE_STORE = 'handles';
const DIAGRAM_BACKUP_STORE = 'diagram-backups';
const DIAGRAM_HANDLE_KEY = 'current-diagram';

const openDiagramHandleDb = (): Promise<IDBDatabase | null> =>
  new Promise((resolve) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open(DIAGRAM_HANDLE_DB, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DIAGRAM_HANDLE_STORE)) {
        db.createObjectStore(DIAGRAM_HANDLE_STORE);
      }
      if (!db.objectStoreNames.contains(DIAGRAM_BACKUP_STORE)) {
        db.createObjectStore(DIAGRAM_BACKUP_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

const persistDiagramFileHandle = async (handle: any | null) => {
  const db = await openDiagramHandleDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(DIAGRAM_HANDLE_STORE, 'readwrite');
    const store = tx.objectStore(DIAGRAM_HANDLE_STORE);
    if (handle) {
      store.put(handle, DIAGRAM_HANDLE_KEY);
    } else {
      store.delete(DIAGRAM_HANDLE_KEY);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      resolve();
    };
  });
};

const restoreDiagramFileHandle = async (): Promise<any | null> => {
  const db = await openDiagramHandleDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(DIAGRAM_HANDLE_STORE, 'readonly');
    const store = tx.objectStore(DIAGRAM_HANDLE_STORE);
    const request = store.get(DIAGRAM_HANDLE_KEY);
    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      resolve(null);
    };
  });
};

const rotateDiagramBackups = async (key: string, backupJson: string) => {
  const db = await openDiagramHandleDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(DIAGRAM_BACKUP_STORE, 'readwrite');
    const store = tx.objectStore(DIAGRAM_BACKUP_STORE);
    const request = store.get(key);
    request.onsuccess = () => {
      const current =
        request.result && typeof request.result === 'object'
          ? request.result
          : { v1: null, v2: null, v3: null };
      const next = {
        v1: backupJson,
        v2: current.v1 ?? null,
        v3: current.v2 ?? null,
        updatedAt: new Date().toISOString(),
      };
      store.put(next, key);
    };
    request.onerror = () => {
      store.put(
        {
          v1: backupJson,
          v2: null,
          v3: null,
          updatedAt: new Date().toISOString(),
        },
        key
      );
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
    tx.onabort = () => {
      db.close();
      resolve();
    };
  });
};

const loadDiagramBackups = async (
  key: string
): Promise<{ v1?: string | null; v2?: string | null; v3?: string | null } | null> => {
  const db = await openDiagramHandleDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(DIAGRAM_BACKUP_STORE, 'readonly');
    const store = tx.objectStore(DIAGRAM_BACKUP_STORE);
    const request = store.get(key);
    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      resolve(null);
    };
  });
};

type SessionNoteFileRecord = {
  id: string;
  noteFileName: string;
  diagramFileName: string;
  focusPersonName: string;
  coachName: string;
  clientName: string;
  presentingIssue: string;
  noteContent: string;
  startedAt: number;
  updatedAt: number;
};

type TimelineEntry = {
  timestamp: number;
  date: string;
  label: string;
};
type TimelineBoardSelection = {
  laneLabel: string;
  entityType: 'person' | 'partnership' | 'emotional';
  entityId: string;
  eventId?: string;
  itemLabel: string;
  startDate?: string;
  endDate?: string;
};
type PropertiesPanelIntent = {
  targetId: string;
  tab?: 'properties' | 'functional' | 'events';
  personSection?: 'name' | 'dates' | 'notes' | 'format' | 'sibling';
  focusEventId?: string;
  openNewEventRequestId?: string;
  newEventSeed?: Partial<EmotionalProcessEvent>;
  openNewEventPosition?: { x: number; y: number };
} | null;

type PersonSectionPopupState = {
  personId: string;
  section: 'name' | 'dates' | 'notes' | 'format' | 'sibling';
  x: number;
  y: number;
} | null;

type PartnershipSectionPopupState = {
  partnershipId: string;
  relationshipType: string;
  x: number;
  y: number;
} | null;

type EmotionalPatternDraft = {
  person1Id: string;
  person2Id: string;
  relationshipType: EmotionalLine['relationshipType'];
  status: NonNullable<EmotionalLine['status']>;
  lineStyle: EmotionalLine['lineStyle'];
  startDate: string;
  endDate: string;
  intensityLevel: number;
  frequency: number;
  impact: number;
  notes: string;
  color: string;
};
type ClientProfileDraft = {
  personId: string;
  personName: string;
  clientColor: string;
  presentingIssue1: string;
  presentingIssue2: string;
  presentingIssue3: string;
  desiredOutcome1: string;
  desiredOutcome2: string;
  desiredOutcome3: string;
  conceptualization: string;
};
type CoachThinkingDraft = {
  personId: string;
  personName: string;
  thinking: string;
  notes: string;
};
// Replace these URLs with your own training library as videos are produced.
const TRAINING_VIDEOS = [
  {
    id: 'intro',
    title: 'Getting Started',
    duration: '6 min',
    topic: 'Canvas basics, file workflow, and object editing',
    embedUrl: 'https://www.youtube-nocookie.com/embed/k8ew_qIpEAU',
    url: 'https://youtu.be/k8ew_qIpEAU',
  },
  {
    id: 'transcript',
    title: 'Transcript Session Capture',
    duration: '8 min',
    topic: 'Process transcript, review operations, and import data safely',
    embedUrl: '',
    url: '',
  },
  {
    id: 'timeline',
    title: 'Timeline and Event Creator',
    duration: '7 min',
    topic: 'Export person events, edit in timeline mode, and merge back',
    embedUrl: '',
    url: '',
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

const DEMO_DIAGRAM_DATA: DiagramImportData = productDefaultDiagramDataJson as DiagramImportData;
const DEFAULT_DEMO_FILE_NAME = 'PRODUCT_DEFAULT.diagram.json';
const LEGACY_DEMO_FILE_NAMES = new Set([
  'demo family diagram',
  'demo family diagram.json',
  DEFAULT_DEMO_FILE_NAME,
]);

const isDemoDiagramFileName = (value?: string | null) => {
  const normalized = (value || '').trim().toLowerCase();
  return LEGACY_DEMO_FILE_NAMES.has(normalized);
};

type DemoTourStep = {
  itemNumber: number;
  title: string;
  body: string;
  clickToSelectHint?: string;
  rightClickOptions?: string[];
  focus:
    | { kind: 'none' }
    | { kind: 'canvas' }
    | { kind: 'person'; personId: string; tab?: 'properties' | 'functional' | 'events' }
    | { kind: 'partnership'; partnershipId: string; tab?: 'properties' | 'events' }
    | { kind: 'emotional'; lineId: string; tab?: 'properties' | 'events' }
    | { kind: 'timeline'; personIds: string[] }
    | { kind: 'toolbar'; target: string };
};

type BuildDemoStep = {
  title: string;
  instruction: string;
  focus:
    | { kind: 'none' }
    | { kind: 'person'; personId: string; tab?: 'properties' | 'events' }
    | { kind: 'partnership'; partnershipId: string; tab?: 'properties' | 'events' }
    | { kind: 'emotional'; lineId: string; tab?: 'properties' | 'events' };
};

type BuildDemoStepSpec = Omit<BuildDemoStep, 'instruction'> & {
  fallbackInstruction: string;
};

const BASE_DEMO_TOUR_STEPS: DemoTourStep[] = [
  {
    itemNumber: 1,
    title: 'Item 1 · Alex Carter',
    body: '[1] Alex Carter person note. Person blinks with note 4 times, then remains selected.',
    clickToSelectHint: 'Click Alex Carter to select the person and open properties.',
    rightClickOptions: ['Change sex', 'Show/Hide Note', 'Properties', 'Make Client', 'Timeline', 'Add Partner', 'Add as Child / Remove as Child', 'Delete Person'],
    focus: { kind: 'person', personId: 'demo-dad', tab: 'properties' },
  },
  {
    itemNumber: 2,
    title: 'Item 2 · Renee Carter',
    body: '[2] Renee Carter person note. Person blinks with note 4 times, then remains selected.',
    clickToSelectHint: 'Click Renee Carter to select the person and open properties.',
    rightClickOptions: [
      'Change sex',
      'Show/Hide Note',
      'Properties',
      'Make Client',
      'Timeline',
      'Add Partner',
      'Add as Child / Remove as Child',
      'Delete Person',
    ],
    focus: { kind: 'person', personId: 'demo-mom', tab: 'properties' },
  },
  {
    itemNumber: 3,
    title: 'Item 3 · Liam Carter',
    body: '[3] Liam Carter person note. Person blinks with note 4 times, then remains selected.',
    clickToSelectHint: 'Click Liam Carter to select the person and open properties.',
    focus: { kind: 'person', personId: 'demo-son', tab: 'properties' },
  },
  {
    itemNumber: 4,
    title: 'Item 4 · Emma Carter',
    body: '[4] Emma Carter person note. Person blinks with note 4 times, then remains selected.',
    clickToSelectHint: 'Click Emma Carter to select the person and open properties.',
    focus: { kind: 'person', personId: 'demo-daughter', tab: 'properties' },
  },
  {
    itemNumber: 5,
    title: 'Item 5 · Noah Reed',
    body: '[5] Noah Reed person note. Person blinks with note 4 times, then remains selected.',
    clickToSelectHint: 'Click Noah Reed to select the person and open properties.',
    focus: { kind: 'person', personId: 'demo-emma-partner', tab: 'properties' },
  },
  {
    itemNumber: 6,
    title: 'Item 6 · Parent PRL',
    body: '[6] PRL means Partner Relationship Line. This parent PRL blinks with its note 4 times, then remains selected.',
    clickToSelectHint: 'Click the parent PRL line to open relationship properties.',
    rightClickOptions: [
      'Add Child',
      'Add Twins',
      'Add Triplets',
      'Add Miscarriage',
      'Add Stillbirth',
      'Show/Hide Note',
      'Properties',
      'Delete Partnership',
    ],
    focus: { kind: 'partnership', partnershipId: 'demo-prl-parents', tab: 'properties' },
  },
  {
    itemNumber: 7,
    title: 'Item 7 · Emma-Noah PRL',
    body: '[7] PRL means Partner Relationship Line. This second-generation PRL blinks with its note 4 times, then remains selected.',
    clickToSelectHint: 'Click the Emma-Noah PRL to open relationship properties.',
    rightClickOptions: [
      'Add Child',
      'Add Twins',
      'Add Triplets',
      'Add Miscarriage',
      'Add Stillbirth',
      'Show/Hide Note',
      'Properties',
      'Delete Partnership',
    ],
    focus: { kind: 'partnership', partnershipId: 'demo-prl-emma', tab: 'properties' },
  },
  {
    itemNumber: 8,
    title: 'Item 8 · Distance EPL',
    body: '[8] EPL means Emotional Process Line. This distance EPL blinks with its note 4 times, then remains selected.',
    clickToSelectHint: 'Click the distance EPL to open EPL properties.',
    rightClickOptions: [
      'Show/Hide Note',
      'Properties',
      'Delete Emotional Line (or Delete Triangle if EPL belongs to a triangle)',
    ],
    focus: { kind: 'emotional', lineId: 'demo-epl-distance', tab: 'properties' },
  },
  {
    itemNumber: 9,
    title: 'Item 9 · Conflict EPL',
    body: '[9] EPL means Emotional Process Line. This conflict EPL blinks with its note 4 times, then remains selected.',
    clickToSelectHint: 'Click the conflict EPL to open EPL properties.',
    rightClickOptions: [
      'Show/Hide Note',
      'Properties',
      'Delete Emotional Line (or Delete Triangle if EPL belongs to a triangle)',
    ],
    focus: { kind: 'emotional', lineId: 'demo-epl-conflict', tab: 'properties' },
  },
  {
    itemNumber: 10,
    title: RIBBON_HELP['file-menu'].demoTitle,
    body: RIBBON_HELP['file-menu'].demoBody,
    clickToSelectHint: 'Click File ▾ to open file-level operations.',
    focus: { kind: 'toolbar', target: 'file-menu' },
  },
  {
    itemNumber: 11,
    title: RIBBON_HELP.save.demoTitle,
    body: RIBBON_HELP.save.demoBody,
    focus: { kind: 'toolbar', target: 'save' },
  },
  {
    itemNumber: 12,
    title: RIBBON_HELP['timeline-controls'].demoTitle,
    body: RIBBON_HELP['timeline-controls'].demoBody,
    focus: { kind: 'toolbar', target: 'timeline-controls' },
  },
  {
    itemNumber: 13,
    title: RIBBON_HELP.zoom.demoTitle,
    body: RIBBON_HELP.zoom.demoBody,
    focus: { kind: 'toolbar', target: 'zoom' },
  },
  {
    itemNumber: 14,
    title: RIBBON_HELP['event-categories'].demoTitle,
    body: RIBBON_HELP['event-categories'].demoBody,
    focus: { kind: 'toolbar', target: 'event-categories' },
  },
  {
    itemNumber: 15,
    title: RIBBON_HELP['functional-indicators'].demoTitle,
    body: RIBBON_HELP['functional-indicators'].demoBody,
    focus: { kind: 'toolbar', target: 'functional-indicators' },
  },
  {
    itemNumber: 16,
    title: RIBBON_HELP['transcripts-menu'].demoTitle,
    body: RIBBON_HELP['transcripts-menu'].demoBody,
    focus: { kind: 'toolbar', target: 'transcripts-menu' },
  },
  {
    itemNumber: 17,
    title: RIBBON_HELP['timeline-menu'].demoTitle,
    body: RIBBON_HELP['timeline-menu'].demoBody,
    focus: { kind: 'toolbar', target: 'timeline-menu' },
  },
  {
    itemNumber: 18,
    title: RIBBON_HELP['event-creator'].demoTitle,
    body: RIBBON_HELP['event-creator'].demoBody,
    focus: { kind: 'toolbar', target: 'event-creator' },
  },
  {
    itemNumber: 19,
    title: RIBBON_HELP['notes-layer'].demoTitle,
    body: RIBBON_HELP['notes-layer'].demoBody,
    focus: { kind: 'toolbar', target: 'notes-layer' },
  },
  {
    itemNumber: 20,
    title: RIBBON_HELP.ideas.demoTitle,
    body: RIBBON_HELP.ideas.demoBody,
    focus: { kind: 'toolbar', target: 'ideas' },
  },
  {
    itemNumber: 21,
    title: RIBBON_HELP['session-notes'].demoTitle,
    body: RIBBON_HELP['session-notes'].demoBody,
    focus: { kind: 'toolbar', target: 'session-notes' },
  },
  {
    itemNumber: 22,
    title: RIBBON_HELP.help.demoTitle,
    body: RIBBON_HELP.help.demoBody,
    focus: { kind: 'toolbar', target: 'help' },
  },
];

const parseDemoStepNumber = (notes?: string): number | null => {
  if (!notes) return null;
  const match = notes.match(/\[(\d+)\]|\((\d+)\)/);
  if (!match) return null;
  const parsed = Number(match[1] || match[2]);
  return Number.isFinite(parsed) ? parsed : null;
};

const stripLeadingStepNumber = (notes?: string): string => {
  if (!notes) return '';
  return notes.replace(/^\s*(?:\[\d+\]|\(\d+\))\s*/u, '').trim();
};

const buildDemoTourStepsFromNotes = (base: DiagramImportData): DemoTourStep[] => {
  const people = Array.isArray(base.people) ? base.people : [];
  const partnerships = Array.isArray(base.partnerships) ? base.partnerships : [];
  const lines = Array.isArray(base.emotionalLines) ? base.emotionalLines : [];
  const personNameById = new Map(people.map((person) => [person.id, person.name || 'Person']));

  const noteSteps: DemoTourStep[] = [];
  people.forEach((person) => {
    const itemNumber = parseDemoStepNumber(person.notes);
    if (itemNumber == null) return;
    noteSteps.push({
      itemNumber,
      title: `Item ${itemNumber} · ${person.name || 'Person'}`,
      body: stripLeadingStepNumber(person.notes) || 'Person walkthrough step.',
      clickToSelectHint: 'Click this person to select and open properties.',
      focus: { kind: 'person', personId: person.id, tab: 'properties' },
    });
  });

  partnerships.forEach((partnership) => {
    const itemNumber = parseDemoStepNumber(partnership.notes);
    if (itemNumber == null) return;
    const p1 = personNameById.get(partnership.partner1_id) || 'Partner 1';
    const p2 = personNameById.get(partnership.partner2_id) || 'Partner 2';
    noteSteps.push({
      itemNumber,
      title: `Item ${itemNumber} · ${p1}-${p2} PRL`,
      body: stripLeadingStepNumber(partnership.notes) || 'PRL walkthrough step.',
      clickToSelectHint: 'Click the PRL line to select and open relationship properties.',
      focus: { kind: 'partnership', partnershipId: partnership.id, tab: 'properties' },
    });
  });

  lines.forEach((line) => {
    const itemNumber = parseDemoStepNumber(line.notes);
    if (itemNumber == null) return;
    const p1 = personNameById.get(line.person1_id) || 'Person 1';
    const p2 = personNameById.get(line.person2_id) || 'Person 2';
    noteSteps.push({
      itemNumber,
      title: `Item ${itemNumber} · ${p1}-${p2} EPL`,
      body: stripLeadingStepNumber(line.notes) || 'EPL walkthrough step.',
      clickToSelectHint: 'Click the EPL line to select and open emotional process properties.',
      focus: { kind: 'emotional', lineId: line.id, tab: 'properties' },
    });
  });

  noteSteps.sort((a, b) => a.itemNumber - b.itemNumber);
  const toolbarSteps = BASE_DEMO_TOUR_STEPS.filter((step) => step.focus.kind === 'toolbar').map(
    (step, index) => ({
      ...step,
      itemNumber: noteSteps.length + index + 1,
    })
  );

  if (!noteSteps.length) return BASE_DEMO_TOUR_STEPS;
  return [...noteSteps, ...toolbarSteps];
};

const DEFAULT_DEMO_TOUR_STEPS: DemoTourStep[] = buildDemoTourStepsFromNotes(DEMO_DIAGRAM_DATA);

const deepCloneDiagramImport = (data: DiagramImportData): DiagramImportData =>
  JSON.parse(JSON.stringify(data));

const buildCreationDemoSnapshots = (base: DiagramImportData): DiagramImportData[] => {
  const basePeople = Array.isArray(base.people) ? base.people : [];
  const basePartnerships = Array.isArray(base.partnerships) ? base.partnerships : [];
  const baseLines = Array.isArray(base.emotionalLines) ? base.emotionalLines : [];
  const byPersonId = new Map(basePeople.map((person) => [person.id, person]));
  const byPartnershipId = new Map(basePartnerships.map((prl) => [prl.id, prl]));
  const byLineId = new Map(baseLines.map((line) => [line.id, line]));
  const clonePerson = (id: string) => deepCloneDiagramImport({ people: [byPersonId.get(id)!] }).people![0];
  const clonePartnership = (id: string) =>
    deepCloneDiagramImport({ partnerships: [byPartnershipId.get(id)!] }).partnerships![0];
  const cloneLine = (id: string) => deepCloneDiagramImport({ emotionalLines: [byLineId.get(id)!] }).emotionalLines![0];

  const buildSnapshot = (
    people: Person[],
    partnerships: Partnership[],
    emotionalLines: EmotionalLine[],
    fileName: string
  ): DiagramImportData => ({
    fileMeta: { fileName },
    people,
    partnerships,
    emotionalLines,
    triangles: [],
    functionalIndicatorDefinitions: base.functionalIndicatorDefinitions || [],
    eventCategories: base.eventCategories || [],
    relationshipTypes: base.relationshipTypes || [],
    relationshipStatuses: base.relationshipStatuses || [],
    autoSaveMinutes: base.autoSaveMinutes || 1,
    ideasText: 'Build Demo mode: follow step instructions to construct the full diagram.',
  });

  const alexFinal = clonePerson('demo-dad');
  const reneeFinal = clonePerson('demo-mom');
  const liamFinal = clonePerson('demo-son');
  const emmaFinal = clonePerson('demo-daughter');
  const noahFinal = clonePerson('demo-emma-partner');
  const parentPrlFinal = clonePartnership('demo-prl-parents');
  const emmaPrlFinal = clonePartnership('demo-prl-emma');
  const distanceEplFinal = cloneLine('demo-epl-distance');
  const conflictEplFinal = cloneLine('demo-epl-conflict');

  const alexStart: Person = {
    ...alexFinal,
    x: 120,
    y: 140,
    partnerships: [],
    notesEnabled: false,
    notes: undefined,
    events: [],
  };
  const alexMoved: Person = {
    ...alexFinal,
    partnerships: [],
    notesEnabled: false,
    notes: undefined,
    events: [],
  };
  const reneeAdded: Person = {
    ...reneeFinal,
    partnerships: ['demo-prl-parents'],
    notesEnabled: false,
    notes: undefined,
    events: [],
  };
  const parentPrlDating: Partnership = {
    ...parentPrlFinal,
    relationshipType: 'dating',
    relationshipStatus: 'married',
    notesEnabled: false,
    notes: undefined,
    children: [],
  };
  const parentPrlMarriedNoKids: Partnership = {
    ...parentPrlFinal,
    notesEnabled: false,
    notes: undefined,
    children: [],
  };
  const liamNoNote: Person = {
    ...liamFinal,
    notesEnabled: false,
    notes: undefined,
  };
  const emmaNoNote: Person = {
    ...emmaFinal,
    notesEnabled: false,
    notes: undefined,
    partnerships: [],
  };
  const noahNoNote: Person = {
    ...noahFinal,
    notesEnabled: false,
    notes: undefined,
  };
  const emmaPrlInitial: Partnership = {
    ...emmaPrlFinal,
    relationshipType: 'dating',
    relationshipStatus: 'married',
    notesEnabled: false,
    notes: undefined,
  };

  return [
    buildSnapshot([], [], [], 'Build Demo Step 1 - Blank'),
    buildSnapshot([alexStart], [], [], 'Build Demo Step 2 - Add Alex'),
    buildSnapshot([alexMoved], [], [], 'Build Demo Step 3 - Move Alex'),
    buildSnapshot([alexMoved, reneeAdded], [parentPrlDating], [], 'Build Demo Step 4 - Add Partner'),
    buildSnapshot([alexMoved, reneeAdded], [parentPrlMarriedNoKids], [], 'Build Demo Step 5 - Set Married'),
    buildSnapshot(
      [alexMoved, reneeAdded, liamNoNote],
      [{ ...parentPrlMarriedNoKids, children: ['demo-son'] }],
      [],
      'Build Demo Step 6 - Add Liam'
    ),
    buildSnapshot(
      [alexMoved, reneeAdded, liamNoNote, emmaNoNote],
      [{ ...parentPrlMarriedNoKids, children: ['demo-son', 'demo-daughter'] }],
      [],
      'Build Demo Step 7 - Add Emma'
    ),
    buildSnapshot(
      [alexMoved, reneeAdded, liamNoNote, { ...emmaNoNote, partnerships: ['demo-prl-emma'] }, noahNoNote],
      [{ ...parentPrlMarriedNoKids, children: ['demo-son', 'demo-daughter'] }, emmaPrlInitial],
      [],
      'Build Demo Step 8 - Add Noah + PRL'
    ),
    buildSnapshot(
      [alexMoved, reneeAdded, liamNoNote, { ...emmaNoNote, partnerships: ['demo-prl-emma'] }, noahNoNote],
      [{ ...parentPrlMarriedNoKids, children: ['demo-son', 'demo-daughter'] }, { ...emmaPrlFinal, notes: undefined, notesEnabled: false }],
      [],
      'Build Demo Step 9 - Configure Emma/Noah PRL'
    ),
    buildSnapshot(
      [alexMoved, reneeAdded, liamNoNote, { ...emmaNoNote, partnerships: ['demo-prl-emma'] }, noahNoNote],
      [{ ...parentPrlMarriedNoKids, children: ['demo-son', 'demo-daughter'] }, { ...emmaPrlFinal, notes: undefined, notesEnabled: false }],
      [{ ...distanceEplFinal, notes: undefined, notesEnabled: false }],
      'Build Demo Step 10 - Add Distance EPL'
    ),
    buildSnapshot(
      [alexMoved, reneeAdded, liamNoNote, { ...emmaNoNote, partnerships: ['demo-prl-emma'] }, noahNoNote],
      [{ ...parentPrlMarriedNoKids, children: ['demo-son', 'demo-daughter'] }, { ...emmaPrlFinal, notes: undefined, notesEnabled: false }],
      [
        { ...distanceEplFinal, notes: undefined, notesEnabled: false },
        { ...conflictEplFinal, notes: undefined, notesEnabled: false },
      ],
      'Build Demo Step 11 - Add Conflict EPL'
    ),
    deepCloneDiagramImport(base),
  ];
};

const BUILD_DEMO_STEP_SPECS: BuildDemoStepSpec[] = [
  {
    title: 'Step 1 - Blank Canvas',
    fallbackInstruction: 'Start on a blank screen. Right-click empty canvas and choose Add Person.',
    focus: { kind: 'none' },
  },
  {
    title: 'Step 2 - Add Alex Carter',
    fallbackInstruction: 'Rename New Person to Alex Carter in Person Properties.',
    focus: { kind: 'person', personId: 'demo-dad', tab: 'properties' },
  },
  {
    title: 'Step 3 - Move Alex',
    fallbackInstruction: 'Click and drag Alex Carter to the target top-left parent position.',
    focus: { kind: 'person', personId: 'demo-dad', tab: 'properties' },
  },
  {
    title: 'Step 4 - Add Partner',
    fallbackInstruction: 'Right-click Alex Carter and choose Add Partner (creates partner + PRL). Rename partner to Renee Carter.',
    focus: { kind: 'partnership', partnershipId: 'demo-prl-parents', tab: 'properties' },
  },
  {
    title: 'Step 5 - Set PRL Married',
    fallbackInstruction: 'Click the parent PRL, then set Relationship Type to married.',
    focus: { kind: 'partnership', partnershipId: 'demo-prl-parents', tab: 'properties' },
  },
  {
    title: 'Step 6 - Add Liam',
    fallbackInstruction: 'Right-click the parent PRL and Add Child, then edit child name to Liam Carter and position him.',
    focus: { kind: 'person', personId: 'demo-son', tab: 'properties' },
  },
  {
    title: 'Step 7 - Add Emma',
    fallbackInstruction: 'Add another child from the same parent PRL and rename to Emma Carter.',
    focus: { kind: 'person', personId: 'demo-daughter', tab: 'properties' },
  },
  {
    title: 'Step 8 - Add Noah + PRL',
    fallbackInstruction: 'Right-click Emma Carter and Add Partner. Rename to Noah Reed and place beside Emma.',
    focus: { kind: 'partnership', partnershipId: 'demo-prl-emma', tab: 'properties' },
  },
  {
    title: 'Step 9 - Configure Emma/Noah PRL',
    fallbackInstruction: 'Set Emma-Noah PRL fields (type/status/start date) to match the demo.',
    focus: { kind: 'partnership', partnershipId: 'demo-prl-emma', tab: 'properties' },
  },
  {
    title: 'Step 10 - Add Distance EPL',
    fallbackInstruction: 'Select Alex + Liam and add EPL. Set type distance and style dashed.',
    focus: { kind: 'emotional', lineId: 'demo-epl-distance', tab: 'properties' },
  },
  {
    title: 'Step 11 - Add Conflict EPL',
    fallbackInstruction: 'Select Renee + Emma and add EPL. Set type conflict and style dotted-saw-tooth.',
    focus: { kind: 'emotional', lineId: 'demo-epl-conflict', tab: 'properties' },
  },
  {
    title: 'Step 12 - Finalize Notes',
    fallbackInstruction: 'Add numbered notes [1]-[9] on people, PRLs, and EPLs to complete the same demo diagram.',
    focus: { kind: 'none' },
  },
];

const buildBuildDemoStepsFromNotes = (base: DiagramImportData): BuildDemoStep[] => {
  const people = Array.isArray(base.people) ? base.people : [];
  const partnerships = Array.isArray(base.partnerships) ? base.partnerships : [];
  const lines = Array.isArray(base.emotionalLines) ? base.emotionalLines : [];

  const noteById = new Map<string, string>();
  const orderedNotes: string[] = [];
  const collectNote = (id: string, notes?: string) => {
    const normalized = stripLeadingStepNumber(notes);
    if (!normalized) return;
    noteById.set(id, normalized);
    orderedNotes.push(normalized);
  };
  people.forEach((person) => collectNote(person.id, person.notes));
  partnerships.forEach((partnership) => collectNote(partnership.id, partnership.notes));
  lines.forEach((line) => collectNote(line.id, line.notes));

  return BUILD_DEMO_STEP_SPECS.map((spec, index) => {
    let instruction = spec.fallbackInstruction;
    if (spec.focus.kind === 'person') {
      instruction = noteById.get(spec.focus.personId) || instruction;
    } else if (spec.focus.kind === 'partnership') {
      instruction = noteById.get(spec.focus.partnershipId) || instruction;
    } else if (spec.focus.kind === 'emotional') {
      instruction = noteById.get(spec.focus.lineId) || instruction;
    } else if (index === BUILD_DEMO_STEP_SPECS.length - 1 && orderedNotes.length) {
      instruction = `Finalize by confirming demo notes:\n- ${orderedNotes.join('\n- ')}`;
    }
    return {
      title: spec.title,
      instruction,
      focus: spec.focus,
    };
  });
};

const buildAllowedIndicatorSet = (defs: FunctionalIndicatorDefinition[]) =>
  new Set(defs.map((def) => def.id));

const sanitizePersonIndicatorsWithSet = (person: Person, allowed: Set<string>) => {
  if (!person.functionalIndicators || person.functionalIndicators.length === 0) {
    return person;
  }
  const filtered = person.functionalIndicators.filter((entry) => allowed.has(entry.definitionId));
  if (filtered.length === person.functionalIndicators.length) {
    return person;
  }
  const updated: Person = { ...person };
  if (filtered.length) {
    updated.functionalIndicators = filtered;
  } else {
    delete (updated as any).functionalIndicators;
  }
  return updated;
};

const sanitizePeopleIndicators = (peopleList: Person[], defs: FunctionalIndicatorDefinition[]) => {
  if (!peopleList.length) return peopleList;
  const allowed = buildAllowedIndicatorSet(defs);
  if (allowed.size === 0) {
    let changed = false;
    const next = peopleList.map((person) => {
      if (!person.functionalIndicators || person.functionalIndicators.length === 0) {
        return person;
      }
      changed = true;
      const updated = { ...person };
      delete (updated as any).functionalIndicators;
      return updated;
    });
    return changed ? next : peopleList;
  }
  let changed = false;
  const next = peopleList.map((person) => {
    const sanitized = sanitizePersonIndicatorsWithSet(person, allowed);
    if (sanitized !== person) {
      changed = true;
    }
    return sanitized;
  });
  return changed ? next : peopleList;
};

const sanitizeSinglePersonIndicators = (person: Person, defs: FunctionalIndicatorDefinition[]) => {
  const allowed = buildAllowedIndicatorSet(defs);
  return sanitizePersonIndicatorsWithSet(person, allowed);
};

const parseIsoDateToTimestamp = (value?: string | null) => {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
};

const normalizeEventList = (
  events: EmotionalProcessEvent[] | undefined,
  fallbackClass: EventClass
): EmotionalProcessEvent[] | undefined =>
  events
    ? events.map((event) => ({
        ...event,
        statusLabel: event.statusLabel ?? '',
        eventClass: event.eventClass || fallbackClass,
      }))
    : undefined;

const attachEventClassToEntities = <T extends { events?: EmotionalProcessEvent[] }>(
  entities: T[],
  fallbackClass: EventClass
): T[] =>
  entities.map((entity) => ({
    ...entity,
    events: normalizeEventList(entity.events, fallbackClass),
  }));

type DiagramImportData = {
  fileMeta?: { fileName?: string; displayName?: string };
  people?: Person[];
  partnerships?: Partnership[];
  emotionalLines?: EmotionalLine[];
  pageNotes?: PageNote[];
  triangles?: Triangle[];
  functionalIndicatorDefinitions?: FunctionalIndicatorDefinition[];
  eventCategories?: string[];
  relationshipTypes?: string[];
  relationshipStatuses?: string[];
  autoSaveMinutes?: number;
  ideasText?: string;
};

type FactsImportData = {
  sourceFile?: string;
  processedAt?: string;
  family?: {
    parents?: string[];
    marriageYear?: number;
    childrenCountMentioned?: number;
    childrenMentionedByName?: string[];
  };
  relationships?: Array<{
    a?: string;
    b?: string;
    type?: string;
    status?: string;
    evidence?: string;
  }>;
  clinical?: {
    explicitSchizophreniaMentions?: string[];
    explicitNoDiagnosisMentions?: string[];
    events?: Array<{ person?: string; type?: string; year?: number }>;
  };
  uncertainties?: string[];
};

type SessionCaptureMatchHints = {
  personId?: string;
  personName?: string;
  aliases?: string[];
  birthYear?: number;
};

type SessionCaptureOperation = {
  id: string;
  type: 'upsert_person' | 'add_person_event' | 'upsert_partnership';
  confidence?: number;
  ambiguity?: string;
  recommendedAction?: 'apply' | 'review' | 'skip';
  source?: { startLine?: number; endLine?: number; quote?: string };
  matchHints?: SessionCaptureMatchHints;
  payload?: Record<string, any>;
};

type SessionCaptureImportData = {
  kind: 'fam-diag-session-capture';
  version: 1;
  sessionId?: string;
  transcriptName?: string;
  baseDiagramFileName?: string;
  ambiguityNotes?: string[];
  operations: SessionCaptureOperation[];
};

const sentenceCaseName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());

const GENDER_NAME_OVERRIDES: Record<string, Person['gender']> = {
  don: 'male',
  donald: 'male',
  jim: 'male',
  john: 'male',
  brian: 'male',
  michael: 'male',
  richard: 'male',
  joseph: 'male',
  mark: 'male',
  matthew: 'male',
  peter: 'male',
  rick: 'male',
  mimi: 'female',
  margaret: 'female',
  mary: 'female',
  jean: 'female',
  kathy: 'female',
  nancy: 'female',
  noni: 'female',
  betty: 'female',
};

const GENDER_SYMBOL_OPTIONS: Array<{
  label: string;
  symbol: GenderSymbol;
  birthSex: BirthSex;
  genderIdentity: GenderIdentity;
}> = [
  { label: 'Female × Feminine (Cis)', symbol: 'female_cis', birthSex: 'female', genderIdentity: 'feminine' },
  { label: 'Female × Masculine', symbol: 'female_trans', birthSex: 'female', genderIdentity: 'masculine' },
  { label: 'Female × Non-Binary', symbol: 'nonbinary', birthSex: 'female', genderIdentity: 'nonbinary' },
  { label: 'Female × Agender', symbol: 'agender', birthSex: 'female', genderIdentity: 'agender' },
  { label: 'Male × Feminine', symbol: 'female_trans', birthSex: 'male', genderIdentity: 'feminine' },
  { label: 'Male × Masculine (Cis)', symbol: 'male_cis', birthSex: 'male', genderIdentity: 'masculine' },
  { label: 'Male × Non-Binary', symbol: 'nonbinary', birthSex: 'male', genderIdentity: 'nonbinary' },
  { label: 'Male × Agender', symbol: 'agender', birthSex: 'male', genderIdentity: 'agender' },
  { label: 'Intersex × Feminine', symbol: 'intersex_feminine', birthSex: 'intersex', genderIdentity: 'feminine' },
  { label: 'Intersex × Masculine', symbol: 'intersex_masculine', birthSex: 'intersex', genderIdentity: 'masculine' },
  { label: 'Intersex × Non-Binary', symbol: 'intersex_nonbinary', birthSex: 'intersex', genderIdentity: 'nonbinary' },
  { label: 'Intersex × Agender', symbol: 'intersex_agender', birthSex: 'intersex', genderIdentity: 'agender' },
];

const inferGenderFromName = (value: string): Person['gender'] | undefined => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  const first = normalized.split(/\s+/)[0];
  if (GENDER_NAME_OVERRIDES[first]) return GENDER_NAME_OVERRIDES[first];
  if (GENDER_NAME_OVERRIDES[normalized]) return GENDER_NAME_OVERRIDES[normalized];
  return undefined;
};

const findLikelyExistingPerson = (
  peopleByName: Map<string, Person>,
  normalizedName: string
): Person | undefined => {
  const exact = peopleByName.get(normalizedName);
  if (exact) return exact;

  const normalized = normalizedName.trim().toLowerCase();
  if (!normalized) return undefined;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const all = [...peopleByName.values()];

  if (tokens.length === 1) {
    const first = tokens[0];
    const matches = all.filter(
      (person) => (person.firstName || person.name || '').trim().toLowerCase() === first
    );
    if (matches.length === 1) return matches[0];
  }

  const phraseMatches = all.filter((person) => {
    const existing = (person.name || '').trim().toLowerCase();
    if (!existing) return false;
    return existing.startsWith(`${normalized} `) || normalized.startsWith(`${existing} `);
  });
  if (phraseMatches.length === 1) return phraseMatches[0];

  return undefined;
};

type NormalizeImportedLayoutOptions = {
  expandParentSpan?: boolean;
  autoResizeDenseFamilies?: boolean;
};

const normalizeImportedChildLayout = (
  people: Person[],
  partnerships: Partnership[],
  options?: NormalizeImportedLayoutOptions
): Person[] => {
  if (!people.length || !partnerships.length) return people;

  const expandParentSpan = options?.expandParentSpan ?? false;
  const autoResizeDenseFamilies = options?.autoResizeDenseFamilies ?? false;
  const personById = new Map(people.map((person) => [person.id, person]));
  const updates = new Map<string, Person>();

  const getEditablePerson = (id: string) => {
    const existing = updates.get(id);
    if (existing) return existing;
    const base = personById.get(id);
    if (!base) return null;
    const clone = { ...base };
    updates.set(id, clone);
    return clone;
  };
  const getCurrentPerson = (id: string) => updates.get(id) || personById.get(id) || null;

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(value, max));
  const targetChildSize = (count: number) => {
    if (count >= 12) return 42;
    if (count >= 10) return 46;
    if (count >= 8) return 50;
    if (count >= 6) return 54;
    return 60;
  };
  const targetPartnerSize = (childCount: number) => {
    const childSize = targetChildSize(childCount);
    return Math.max(46, childSize + 6);
  };
  const enforceChildSpouseSequence = () => {
    partnerships.forEach((parentPartnership) => {
      const children = (parentPartnership.children || [])
        .map((childId) => getCurrentPerson(childId))
        .filter((person): person is Person => Boolean(person))
        .filter((person) => person.parentPartnership === parentPartnership.id)
        .sort((a, b) => a.x - b.x);
      if (!children.length) return;

      children.forEach((child, index) => {
        const childEditable = getEditablePerson(child.id);
        if (!childEditable) return;

        const spousePartnership = partnerships.find(
          (candidate) =>
            candidate.id !== parentPartnership.id &&
            (candidate.partner1_id === child.id || candidate.partner2_id === child.id)
        );
        if (!spousePartnership) return;

        const spouseId =
          spousePartnership.partner1_id === child.id
            ? spousePartnership.partner2_id
            : spousePartnership.partner1_id;
        const spouse = getCurrentPerson(spouseId);
        const spouseEditable = getEditablePerson(spouseId);
        if (!spouse || !spouseEditable) return;

        const prev = index > 0 ? children[index - 1] : null;
        const next = index < children.length - 1 ? children[index + 1] : null;
        const distPrev = prev ? Math.abs(child.x - prev.x) : Number.POSITIVE_INFINITY;
        const distNext = next ? Math.abs(next.x - child.x) : Number.POSITIVE_INFINITY;
        const nearestSiblingDistance = Math.min(distPrev, distNext);
        const preferredGap = 56;
        const maxGapFromSibling = Number.isFinite(nearestSiblingDistance)
          ? Math.max(26, nearestSiblingDistance * 0.45)
          : preferredGap;
        const gap = Math.min(preferredGap, maxGapFromSibling);

        let direction = 1;
        if (childEditable.gender === 'female' && spouseEditable.gender === 'male') direction = -1;
        if (childEditable.gender === 'male' && spouseEditable.gender === 'female') direction = 1;

        let targetX = childEditable.x + direction * gap;
        if (direction > 0 && next) {
          const hardMax = childEditable.x + Math.max(24, (next.x - childEditable.x) * 0.45);
          targetX = Math.min(targetX, hardMax);
        }
        if (direction < 0 && prev) {
          const hardMin = childEditable.x - Math.max(24, (childEditable.x - prev.x) * 0.45);
          targetX = Math.max(targetX, hardMin);
        }

        spouseEditable.x = targetX;
        spouseEditable.y = childEditable.y;
        const sharedSize = Math.min(childEditable.size ?? 60, spouseEditable.size ?? 60);
        childEditable.size = sharedSize;
        spouseEditable.size = sharedSize;
        spousePartnership.horizontalConnectorY = Math.max(childEditable.y, spouseEditable.y) + 60;
      });
    });
  };

  partnerships.forEach((partnership, partnershipIndex) => {
    const partner1Base = personById.get(partnership.partner1_id);
    const partner2Base = personById.get(partnership.partner2_id);
    if (!partner1Base || !partner2Base) return;

    const partner1Editable = getEditablePerson(partnership.partner1_id);
    const partner2Editable = getEditablePerson(partnership.partner2_id);
    if (partner1Editable && partner2Editable) {
      // Imported couples should share the same baseline to produce the expected U-shaped PRL.
      const alignedY = Math.min(partner1Editable.y, partner2Editable.y);
      partner1Editable.y = alignedY;
      partner2Editable.y = alignedY;
      const p1Size = partner1Editable.size ?? 60;
      const p2Size = partner2Editable.size ?? 60;
      const matchedPartnerSize = Math.min(p1Size, p2Size);
      partner1Editable.size = matchedPartnerSize;
      partner2Editable.size = matchedPartnerSize;

      // Rule: male left, female right for partnerships when both genders are known.
      if (partner1Editable.gender === 'female' && partner2Editable.gender === 'male') {
        const leftX = Math.min(partner1Editable.x, partner2Editable.x);
        const rightX = Math.max(partner1Editable.x, partner2Editable.x);
        partner2Editable.x = leftX;
        partner1Editable.x = rightX;
      } else if (partner1Editable.gender === 'male' && partner2Editable.gender === 'female') {
        const leftX = Math.min(partner1Editable.x, partner2Editable.x);
        const rightX = Math.max(partner1Editable.x, partner2Editable.x);
        partner1Editable.x = leftX;
        partner2Editable.x = rightX;
      }
    }

    const children = (partnership.children || [])
      .map((childId) => personById.get(childId))
      .filter((person): person is Person => Boolean(person))
      .filter((person) => person.parentPartnership === partnership.id);
    if (children.length === 0) return;

    if (partner1Editable && partner2Editable) {
      const hasChildPartner = Boolean(partner1Base.parentPartnership || partner2Base.parentPartnership);
      if (hasChildPartner) {
        const stagger = (partnershipIndex % 3) * 14;
        partner1Editable.y += stagger;
        partner2Editable.y += stagger;
        partnership.horizontalConnectorY = Math.max(partner1Editable.y, partner2Editable.y) + 60;
      }
    }

    if (autoResizeDenseFamilies) {
      const desiredSize = targetChildSize(children.length);
      const currentPartnerSize = Math.min(partner1Editable?.size ?? 60, partner2Editable?.size ?? 60);
      const maxChildSize = Math.max(36, currentPartnerSize - 6);
      const childSize = Math.min(desiredSize, maxChildSize);
      children.forEach((child) => {
        const editable = getEditablePerson(child.id);
        if (!editable) return;
        const currentSize = editable.size ?? 60;
        editable.size = Math.min(currentSize, childSize);
      });
      if (children.length >= 6) {
        const desiredPartnerSize = targetPartnerSize(children.length);
        const editableP1 = getEditablePerson(partnership.partner1_id);
        const editableP2 = getEditablePerson(partnership.partner2_id);
        if (editableP1) {
          const p1Current = editableP1.size ?? 60;
          editableP1.size = Math.min(p1Current, desiredPartnerSize);
        }
        if (editableP2) {
          const p2Current = editableP2.size ?? 60;
          editableP2.size = Math.min(p2Current, desiredPartnerSize);
        }
        if (editableP1 && editableP2) {
          const syncedPartnerSize = Math.min(editableP1.size ?? 60, editableP2.size ?? 60);
          editableP1.size = syncedPartnerSize;
          editableP2.size = syncedPartnerSize;
        }
      }
    }

    const partner1 = getEditablePerson(partnership.partner1_id);
    const partner2 = getEditablePerson(partnership.partner2_id);
    if (!partner1 || !partner2) return;

    if (expandParentSpan && children.length > 1) {
      const childMin = Math.min(...children.map((child) => child.x));
      const childMax = Math.max(...children.map((child) => child.x));
      const desiredSpan = Math.max(200, childMax - childMin + 80);
      const currentSpan = Math.abs(partner2.x - partner1.x);
      if (currentSpan < desiredSpan) {
        const center = (childMin + childMax) / 2;
        const leftX = center - desiredSpan / 2;
        const rightX = center + desiredSpan / 2;
        if (partner1.x <= partner2.x) {
          partner1.x = leftX;
          partner2.x = rightX;
        } else {
          partner1.x = rightX;
          partner2.x = leftX;
        }
      }
    }

    const minX = Math.min(partner1.x, partner2.x);
    const maxX = Math.max(partner1.x, partner2.x);
    if (maxX <= minX) return;

    const groups = new Map<string, Person[]>();
    children.forEach((child) => {
      const key = child.multipleBirthGroupId || `single:${child.id}`;
      const existing = groups.get(key);
      if (existing) {
        existing.push(child);
      } else {
        groups.set(key, [child]);
      }
    });

    const orderedGroups = [...groups.values()]
      .map((members) => ({
        members,
        center: members.reduce((sum, member) => sum + member.x, 0) / members.length,
      }))
      .sort((a, b) => a.center - b.center);

    const count = orderedGroups.length;
    orderedGroups.forEach((group, index) => {
      const anchor =
        count === 1 ? (minX + maxX) / 2 : minX + (index * (maxX - minX)) / (count - 1);
      group.members.forEach((member) => {
        const editable = getEditablePerson(member.id);
        if (!editable) return;
        const clampedAnchor = clamp(anchor, minX, maxX);
        editable.x = clampedAnchor;
        if (editable.multipleBirthGroupId) {
          // Twins/triplets share a fixed anchor.
          editable.connectionAnchorX = clampedAnchor;
        } else if (editable.connectionAnchorX !== undefined) {
          delete editable.connectionAnchorX;
        }
      });
    });
  });

  enforceChildSpouseSequence();

  // Resolve person-to-person overlaps after anchor and resize adjustments.
  const overlapPasses = 6;
  for (let pass = 0; pass < overlapPasses; pass += 1) {
    const currentPeople = people
      .map((person) => getCurrentPerson(person.id))
      .filter((person): person is Person => Boolean(person))
      .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
    let moved = false;
    for (let i = 0; i < currentPeople.length; i += 1) {
      const a = currentPeople[i];
      const aW = (a.size ?? 60) + 36;
      const aH = (a.size ?? 60) + 44;
      for (let j = i + 1; j < currentPeople.length; j += 1) {
        const b = currentPeople[j];
        const bW = (b.size ?? 60) + 36;
        const bH = (b.size ?? 60) + 44;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = aW / 2 + bW / 2 - Math.abs(dx);
        const overlapY = aH / 2 + bH / 2 - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        const shift = overlapX + 18;
        const target = getEditablePerson(b.id);
        if (!target) continue;
        target.x = target.x + shift;
        moved = true;
      }
    }
    if (!moved) break;
  }

  // Keep child anchors in sync after overlap shifts and assign partnership note positions
  // to reduce overlap with people and with other notes.
  const occupiedNoteRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  const noteIntersects = (x: number, y: number, w: number, h: number) =>
    occupiedNoteRects.some(
      (rect) =>
        x < rect.x + rect.w &&
        x + w > rect.x &&
        y < rect.y + rect.h &&
        y + h > rect.y
    );

  partnerships.forEach((partnership) => {
    const partner1 = getCurrentPerson(partnership.partner1_id);
    const partner2 = getCurrentPerson(partnership.partner2_id);
    if (!partner1 || !partner2) return;
    const minX = Math.min(partner1.x, partner2.x);
    const maxX = Math.max(partner1.x, partner2.x);
    const children = (partnership.children || [])
      .map((childId) => getCurrentPerson(childId))
      .filter((person): person is Person => Boolean(person))
      .filter((person) => person.parentPartnership === partnership.id);
    children.forEach((child) => {
      const editable = getEditablePerson(child.id);
      if (!editable) return;
      if (editable.multipleBirthGroupId && typeof child.connectionAnchorX === 'number') {
        const clamped = clamp(child.connectionAnchorX, minX, maxX);
        editable.connectionAnchorX = clamped;
        editable.x = clamped;
      } else if (editable.connectionAnchorX !== undefined) {
        delete editable.connectionAnchorX;
      }
    });

    if (!partnership.notes || partnership.notesPosition) return;
    const noteWidth = 260;
    const noteHeight = 96;
    let noteX = (partner1.x + partner2.x) / 2 + 24;
    let noteY = partnership.horizontalConnectorY + 88;
    for (let tries = 0; tries < 20; tries += 1) {
      const intersectsPerson = people.some((p) => {
        const current = getCurrentPerson(p.id);
        if (!current) return false;
        const w = (current.size ?? 60) + 30;
        const h = (current.size ?? 60) + 36;
        const px = current.x - w / 2;
        const py = current.y - h / 2;
        return (
          noteX < px + w &&
          noteX + noteWidth > px &&
          noteY < py + h &&
          noteY + noteHeight > py
        );
      });
      if (!intersectsPerson && !noteIntersects(noteX, noteY, noteWidth, noteHeight)) {
        partnership.notesPosition = { x: noteX, y: noteY };
        occupiedNoteRects.push({ x: noteX, y: noteY, w: noteWidth, h: noteHeight });
        break;
      }
      noteY += 28;
      noteX += 18;
    }
  });

  enforceChildSpouseSequence();

  if (updates.size === 0) return people;
  return people.map((person) => updates.get(person.id) || person);
};

const parseTranscriptToDraftDiagram = (transcript: string, sourceFileName: string): DiagramImportData => {
  const peopleByName = new Map<string, Person>();
  const partnershipsByKey = new Map<
    string,
    {
      id: string;
      partner1: string;
      partner2: string;
      relationshipType: Partnership['relationshipType'];
      relationshipStatus: Partnership['relationshipStatus'];
      relationshipStartDate?: string;
      notes?: string;
      children: string[];
    }
  >();
  const personNotes = new Map<string, string[]>();
  const diagnosedSchizophrenia = new Set<string>();
  const parentCouples: Array<{ parent1: string; parent2: string; childCount: number }> = [];
  const coupleChildrenMentions = new Map<string, number>();
  const deceasedNames = new Set<string>();
  const emotionalLineDrafts = new Map<
    string,
    {
      person1: string;
      person2: string;
      relationshipType: EmotionalLine['relationshipType'];
      lineStyle: EmotionalLine['lineStyle'];
      lineEnding: EmotionalLine['lineEnding'];
      notes: string;
    }
  >();

  const getPerson = (raw: string) => {
    const normalized = sentenceCaseName(raw);
    const existing = findLikelyExistingPerson(peopleByName, normalized);
    if (existing) return existing;
    const next: Person = {
      id: nanoid(),
      name: normalized,
      firstName: normalized.split(/\s+/)[0],
      lastName: normalized.split(/\s+/).slice(1).join(' ') || undefined,
      x: 0,
      y: 0,
      gender: inferGenderFromName(normalized) || 'female',
      partnerships: [],
      events: [],
    };
    peopleByName.set(normalized, next);
    return next;
  };

  const addPartnership = (
    personA: string,
    personB: string,
    relationshipType: Partnership['relationshipType'] = 'married',
    relationshipStatus: Partnership['relationshipStatus'] = 'married',
    relationshipStartDate?: string,
    note?: string
  ) => {
    const a = getPerson(personA);
    const b = getPerson(personB);
    const pair = [a.name, b.name].sort();
    const key = pair.join('::');
    const existing = partnershipsByKey.get(key);
    if (existing) {
      if (note) {
        existing.notes = existing.notes ? `${existing.notes} ${note}` : note;
      }
      if (relationshipStartDate && !existing.relationshipStartDate) {
        existing.relationshipStartDate = relationshipStartDate;
      }
      return existing.id;
    }
    const id = nanoid();
    partnershipsByKey.set(key, {
      id,
      partner1: pair[0],
      partner2: pair[1],
      relationshipType,
      relationshipStatus,
      relationshipStartDate,
      notes: note,
      children: [],
    });
    return id;
  };

  const addNote = (name: string, note: string) => {
    const person = getPerson(name);
    const notes = personNotes.get(person.name) || [];
    notes.push(note);
    personNotes.set(person.name, notes);
  };

  const addEmotionalPatternDraft = (
    personA: string,
    personB: string,
    relationshipType: EmotionalLine['relationshipType'],
    notes: string
  ) => {
    const a = getPerson(personA);
    const b = getPerson(personB);
    const directional = relationshipType === 'projection';
    const key = directional
      ? `${a.name}->${b.name}::${relationshipType}`
      : [[a.name, b.name].sort().join('::'), relationshipType].join('::');
    if (emotionalLineDrafts.has(key)) {
      return;
    }
    const styleMap: Record<EmotionalLine['relationshipType'], EmotionalLine['lineStyle']> = {
      fusion: 'fusion-solid-wide',
      distance: 'distance-dashed-wide',
      cutoff: 'cutoff',
      conflict: 'conflict-dotted-wide',
      projection: 'projection-3',
    };
    emotionalLineDrafts.set(key, {
      person1: a.name,
      person2: b.name,
      relationshipType,
      lineStyle: styleMap[relationshipType],
      lineEnding: 'none',
      notes,
    });
  };

  const marryPattern = /\b([A-Z][a-z]+)\s+(?:did\s+)?marry(?:\s+to)?\s+([A-Z][a-z]+)\b/g;
  for (const match of transcript.matchAll(marryPattern)) {
    addPartnership(match[1], match[2], 'married', 'married');
  }

  const couplePattern = /\b([A-Z][a-z]+)\s+and\s+([A-Z][a-z]+)[^.\n]{0,120}\bmarried(?:\s+in\s+(\d{4}))?/gi;
  for (const match of transcript.matchAll(couplePattern)) {
    const year = match[3] ? `${match[3]}-01-01` : undefined;
    addPartnership(match[1], match[2], 'married', 'married', year);
  }

  const parentPattern = /\b([A-Z][a-z]+)\s+and\s+([A-Z][a-z]+)[^.\n]{0,120}\bhad\s+(\d+)\s+children\b/gi;
  for (const match of transcript.matchAll(parentPattern)) {
    parentCouples.push({
      parent1: sentenceCaseName(match[1]),
      parent2: sentenceCaseName(match[2]),
      childCount: Number(match[3]),
    });
  }

  const dxPattern = /\b([A-Z][a-z]+)\b[^.\n]{0,120}\bdiagnos(?:ed|is|e)\b[^.\n]{0,120}\bschizophrenia\b/gi;
  for (const match of transcript.matchAll(dxPattern)) {
    const name = sentenceCaseName(match[1]);
    diagnosedSchizophrenia.add(name);
  }

  const killPattern = /\b([A-Z][a-z]+)\b[^.\n]{0,140}\bkilled\s+([A-Z][a-z]+)\b[^.\n]{0,80}\bkilled\s+(?:himself|herself)\b/gi;
  for (const match of transcript.matchAll(killPattern)) {
    addPartnership(match[1], match[2], 'dating', 'ended', undefined, 'Transcript references homicide-suicide sequence.');
    const killer = sentenceCaseName(match[1]);
    const victim = sentenceCaseName(match[2]);
    deceasedNames.add(killer);
    deceasedNames.add(victim);
    addNote(killer, `Transcript: killed ${victim}, then died by suicide.`);
    addNote(victim, `Transcript: killed by ${killer}.`);
  }

  const bornPattern = /\b([A-Z][a-z]+)\s+([A-Z][a-z]+)[^.\n]{0,30}\bborn\s+(\d{4})/gi;
  for (const match of transcript.matchAll(bornPattern)) {
    const person = getPerson(`${match[1]} ${match[2]}`);
    person.birthDate = `${match[3]}-01-01`;
  }

  const diedPattern = /\b([A-Z][a-z]+)\b[^.\n]{0,40}\bdied\s+(\d{4})/gi;
  for (const match of transcript.matchAll(diedPattern)) {
    const person = getPerson(match[1]);
    person.deathDate = `${match[2]}-01-01`;
  }

  const coupleChildrenPattern =
    /\b([A-Z][a-z]+)\s+and\s+([A-Z][a-z]+)[^.\n]{0,140}\b(?:have|had)\s+(one|two|three|four|five|\d+)\s+children\b/gi;
  const countFromWord = (value: string) => {
    const lowered = value.toLowerCase();
    const map: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
    };
    if (map[lowered]) return map[lowered];
    const parsed = Number(lowered);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  for (const match of transcript.matchAll(coupleChildrenPattern)) {
    const a = sentenceCaseName(match[1]);
    const b = sentenceCaseName(match[2]);
    const key = [a, b].sort().join('::');
    const count = countFromWord(match[3]);
    if (count > 0) {
      coupleChildrenMentions.set(key, Math.max(coupleChildrenMentions.get(key) || 0, count));
    }
  }

  const conflictPattern =
    /\b([A-Z][a-z]+)\s+and\s+([A-Z][a-z]+)[^.\n]{0,120}\b(argu(?:e|ed|ing)|argur(?:e|ed|ing)|go at it|fight(?:ing)?|conflict)\b/gi;
  for (const match of transcript.matchAll(conflictPattern)) {
    addEmotionalPatternDraft(
      match[1],
      match[2],
      'conflict',
      `Transcript conflict phrase: "${match[0].trim()}"`
    );
  }

  const cutoffPattern =
    /\b([A-Z][a-z]+)[^.\n]{0,90}\b(no contact|cut\s*off|cutoff|estranged|distance|distant)\b[^.\n]{0,80}\b(with|from)\b[^A-Z\n]{0,12}([A-Z][a-z]+)/gi;
  for (const match of transcript.matchAll(cutoffPattern)) {
    addEmotionalPatternDraft(
      match[1],
      match[4],
      'cutoff',
      `Transcript cutoff phrase: "${match[0].trim()}"`
    );
  }

  const fusionPattern =
    /\b([A-Z][a-z]+)[^.\n]{0,120}\b(reactive|fused|fusion|enmeshed|overly close)\b[^.\n]{0,80}\b(around|with|to)\b[^A-Z\n]{0,16}([A-Z][a-z]+)/gi;
  for (const match of transcript.matchAll(fusionPattern)) {
    addEmotionalPatternDraft(
      match[1],
      match[4],
      'fusion',
      `Transcript fusion phrase: "${match[0].trim()}"`
    );
  }

  const projectionPatternNamed =
    /\b([A-Z][a-z]+)\s+(?:and|&)\s+([A-Z][a-z]+)[^.\n]{0,100}\b(focused on|project(?:ed|ion)\s+onto|overly focused on)\b[^A-Z\n]{0,16}([A-Z][a-z]+)/gi;
  for (const match of transcript.matchAll(projectionPatternNamed)) {
    addEmotionalPatternDraft(
      match[1],
      match[4],
      'projection',
      `Transcript projection phrase: "${match[0].trim()}"`
    );
    addEmotionalPatternDraft(
      match[2],
      match[4],
      'projection',
      `Transcript projection phrase: "${match[0].trim()}"`
    );
  }

  const projectionPatternSingle =
    /\b([A-Z][a-z]+)[^.\n]{0,100}\b(focused on|project(?:ed|ion)\s+onto|overly focused on)\b[^A-Z\n]{0,16}([A-Z][a-z]+)/gi;
  for (const match of transcript.matchAll(projectionPatternSingle)) {
    addEmotionalPatternDraft(
      match[1],
      match[3],
      'projection',
      `Transcript projection phrase: "${match[0].trim()}"`
    );
  }

  const peopleList = [...peopleByName.values()];
  peopleList.forEach((person, index) => {
    person.x = 120 + (index % 6) * 150;
    person.y = 140 + Math.floor(index / 6) * 180;
    person.gender = inferGenderFromName(person.name) || person.gender || 'female';
    const notes = personNotes.get(person.name);
    if (notes?.length) {
      person.notes = notes.join(' ');
      person.notesEnabled = true;
    }
    if (diagnosedSchizophrenia.has(person.name)) {
      person.functionalIndicators = [
        {
          definitionId: 'indicator-schizophrenia-spectrum',
          status: 'past',
          impact: 5,
          frequency: 5,
          intensity: 5,
        },
      ];
    }
    if (deceasedNames.has(person.name) && !person.deathDate) {
      person.deathDate = '1973-01-01';
    }
  });

  const partnerships: Partnership[] = [...partnershipsByKey.values()].map((entry, idx) => {
    const p1 = peopleByName.get(entry.partner1)!;
    const p2 = peopleByName.get(entry.partner2)!;
    p1.partnerships = [...new Set([...p1.partnerships, entry.id])];
    p2.partnerships = [...new Set([...p2.partnerships, entry.id])];
    return {
      id: entry.id,
      partner1_id: p1.id,
      partner2_id: p2.id,
      horizontalConnectorY: Math.max(p1.y, p2.y) + 60 + idx * 4,
      relationshipType: entry.relationshipType,
      relationshipStatus: entry.relationshipStatus,
      relationshipStartDate: entry.relationshipStartDate,
      children: entry.children,
      notes: entry.notes,
      events: [],
    };
  });

  const emotionalLines: EmotionalLine[] = [...emotionalLineDrafts.values()].map((entry) => {
    const p1 = peopleByName.get(entry.person1)!;
    const p2 = peopleByName.get(entry.person2)!;
    return {
      id: nanoid(),
      person1_id: p1.id,
      person2_id: p2.id,
      status: 'ongoing',
      relationshipType: entry.relationshipType,
      lineStyle: entry.lineStyle,
      lineEnding: entry.lineEnding,
      startDate: new Date().toISOString().slice(0, 10),
      color: DEFAULT_LINE_COLOR,
      notes: entry.notes,
      events: [],
    };
  });

  for (const parent of parentCouples) {
    const parentPair = [parent.parent1, parent.parent2].sort().join('::');
    const parentPartnership = partnershipsByKey.get(parentPair);
    if (!parentPartnership) continue;
    const children = peopleList
      .filter((person) => person.name !== parent.parent1 && person.name !== parent.parent2)
      .slice(0, parent.childCount);
    children.forEach((child) => {
      child.parentPartnership = parentPartnership.id;
      parentPartnership.children.push(child.id);
    });
  }

  coupleChildrenMentions.forEach((count, pairKey) => {
    const parentPartnership = partnershipsByKey.get(pairKey);
    if (!parentPartnership) return;
    const partnership = partnerships.find((p) => p.id === parentPartnership.id);
    if (!partnership) return;
    const parent1 = peopleByName.get(parentPartnership.partner1);
    const parent2 = peopleByName.get(parentPartnership.partner2);
    if (!parent1 || !parent2) return;
    const existingCount = partnership.children.length;
    if (existingCount >= count) return;
    const needed = count - existingCount;
    const anchorX = (parent1.x + parent2.x) / 2;
    const baseY = partnership.horizontalConnectorY + 120;
    for (let i = 0; i < needed; i += 1) {
      const childIndex = existingCount + i + 1;
      const childName = `${parentPartnership.partner1.split(' ')[0]}-${parentPartnership.partner2.split(' ')[0]} Child ${childIndex}`;
      const child: Person = {
        id: nanoid(),
        name: childName,
        firstName: childName,
        x: anchorX + (i - (needed - 1) / 2) * 42,
        y: baseY,
        gender: i % 2 === 0 ? 'female' : 'male',
        partnerships: [],
        parentPartnership: partnership.id,
        notes: 'Placeholder child generated from transcript statement about child count.',
        notesEnabled: false,
        events: [],
      };
      peopleByName.set(childName, child);
      peopleList.push(child);
      partnership.children.push(child.id);
      parentPartnership.children.push(child.id);
    }
  });

  const normalizedPeople = normalizeImportedChildLayout(peopleList, partnerships, {
    expandParentSpan: true,
    autoResizeDenseFamilies: true,
  });

  return {
    fileMeta: {
      fileName: `processed-${sourceFileName.replace(/\.[^.]+$/, '')}.json`,
    },
    people: normalizedPeople,
    partnerships,
    emotionalLines,
    functionalIndicatorDefinitions: [
      {
        id: 'indicator-schizophrenia-spectrum',
        label: 'Schizophrenia Spectrum',
        group: 'emotional',
        color: '#7b1fa2',
        useLetter: true,
      },
    ],
    eventCategories: ['Mental Health', 'Relationship', 'Hospitalization', 'Loss/Death', 'Other'],
    autoSaveMinutes: 1,
    ideasText:
      'Transcript-processed draft. Review person names, genders, dates, parent-child links, diagnoses, and extracted emotional pattern lines before clinical use.',
  };
};

const isDiagramImportData = (data: unknown): data is DiagramImportData => {
  const typed = data as DiagramImportData;
  return (
    !!typed &&
    Array.isArray(typed.people) &&
    Array.isArray(typed.partnerships) &&
    Array.isArray(typed.emotionalLines)
  );
};

const isFactsImportData = (data: unknown): data is FactsImportData => {
  const typed = data as FactsImportData;
  return !!typed && typeof typed === 'object' && (Array.isArray(typed.relationships) || !!typed.family);
};

const isSessionCaptureImportData = (data: unknown): data is SessionCaptureImportData => {
  if (!data || typeof data !== 'object') return false;
  const raw = data as SessionCaptureImportData;
  if (raw.kind !== 'fam-diag-session-capture' || raw.version !== 1) return false;
  if (!Array.isArray(raw.operations)) return false;
  return raw.operations.every(
    (operation) => operation && typeof operation.id === 'string' && typeof operation.type === 'string'
  );
};

const normalizeRelationshipType = (value?: string): Partnership['relationshipType'] => {
  const raw = (value || '').toLowerCase();
  if (raw.includes('married')) return 'married';
  if (raw.includes('engag')) return 'engaged';
  if (raw.includes('common')) return 'common-law';
  if (raw.includes('living')) return 'living-together';
  if (raw.includes('dating')) return 'dating';
  if (raw.includes('affair')) return 'affair';
  if (raw.includes('friend')) return 'friendship';
  return 'dating';
};

const normalizeRelationshipStatus = (value?: string): Partnership['relationshipStatus'] => {
  const raw = (value || '').toLowerCase();
  if (raw.includes('divorc')) return 'divorce';
  if (raw.includes('end')) return 'ended';
  if (raw.includes('separat')) return 'separated';
  if (raw.includes('widow')) return 'widowed';
  if (raw.includes('ongoing')) return 'ongoing';
  if (raw.includes('start')) return 'start';
  return 'married';
};

const factsToDiagramImportData = (facts: FactsImportData): DiagramImportData => {
  const peopleByName = new Map<string, Person>();
  const getPerson = (name: string) => {
    const normalized = name.trim();
    if (!normalized) return null;
    const existing = findLikelyExistingPerson(peopleByName, normalized);
    if (existing) return existing;
    const next: Person = {
      id: nanoid(),
      name: normalized,
      firstName: normalized.split(/\s+/)[0],
      lastName: normalized.split(/\s+/).slice(1).join(' ') || undefined,
      x: 0,
      y: 0,
      gender: inferGenderFromName(normalized) || 'female',
      partnerships: [],
      events: [],
    };
    peopleByName.set(normalized, next);
    return next;
  };

  const parents = facts.family?.parents || [];
  parents.forEach((name) => getPerson(name));
  (facts.family?.childrenMentionedByName || []).forEach((name) => getPerson(name));
  (facts.relationships || []).forEach((rel) => {
    if (rel.a) getPerson(rel.a);
    if (rel.b) getPerson(rel.b);
  });
  (facts.clinical?.explicitSchizophreniaMentions || []).forEach((name) => getPerson(name));
  (facts.clinical?.explicitNoDiagnosisMentions || []).forEach((name) => getPerson(name));
  (facts.clinical?.events || []).forEach((evt) => {
    if (evt.person) getPerson(evt.person);
  });

  const people = [...peopleByName.values()];
  people.forEach((person, idx) => {
    person.x = 120 + (idx % 6) * 150;
    person.y = 140 + Math.floor(idx / 6) * 170;
    person.gender = inferGenderFromName(person.name) || person.gender || 'female';
  });

  const partnerships: Partnership[] = [];
  const toChildCount = (text?: string) => {
    if (!text) return 0;
    const match = text.match(/\b(one|two|three|four|five|\d+)\s+children\b/i);
    if (!match) return 0;
    const token = match[1].toLowerCase();
    const map: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    if (map[token]) return map[token];
    const parsed = Number(token);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  if (parents.length >= 2) {
    const parentPartnershipId = nanoid();
    const parent1 = getPerson(parents[0])!;
    const parent2 = getPerson(parents[1])!;
    const children = (facts.family?.childrenMentionedByName || [])
      .map((name) => getPerson(name))
      .filter((person): person is Person => Boolean(person));
    children.forEach((child) => {
      child.parentPartnership = parentPartnershipId;
    });
    parent1.partnerships = [...new Set([...parent1.partnerships, parentPartnershipId])];
    parent2.partnerships = [...new Set([...parent2.partnerships, parentPartnershipId])];
    partnerships.push({
      id: parentPartnershipId,
      partner1_id: parent1.id,
      partner2_id: parent2.id,
      horizontalConnectorY: Math.max(parent1.y, parent2.y) + 60,
      relationshipType: 'married',
      relationshipStatus: 'ended',
      relationshipStartDate: facts.family?.marriageYear
        ? `${facts.family.marriageYear}-01-01`
        : undefined,
      children: children.map((child) => child.id),
      notes: 'Derived from facts.family',
      events: [],
    });
  }

  (facts.relationships || []).forEach((rel, index) => {
    if (!rel.a || !rel.b) return;
    const personA = getPerson(rel.a);
    const personB = getPerson(rel.b);
    if (!personA || !personB) return;
    const existing = partnerships.find(
      (partnership) =>
        (partnership.partner1_id === personA.id && partnership.partner2_id === personB.id) ||
        (partnership.partner1_id === personB.id && partnership.partner2_id === personA.id)
    );
    if (existing) {
      if (rel.evidence) {
        existing.notes = existing.notes ? `${existing.notes}\n${rel.evidence}` : rel.evidence;
      }
      const childCount = toChildCount(rel.evidence);
      if (childCount > existing.children.length) {
        const parent1 = people.find((person) => person.id === existing.partner1_id);
        const parent2 = people.find((person) => person.id === existing.partner2_id);
        const anchorX = parent1 && parent2 ? (parent1.x + parent2.x) / 2 : 120;
        const baseY = existing.horizontalConnectorY + 120;
        for (let i = existing.children.length; i < childCount; i += 1) {
          const childName = `${(parent1?.firstName || parent1?.name || 'Child').split(' ')[0]}-${(parent2?.firstName || parent2?.name || 'Child').split(' ')[0]} Child ${i + 1}`;
          const child = getPerson(childName);
          if (!child) continue;
          child.parentPartnership = existing.id;
          child.x = anchorX + (i - (childCount - 1) / 2) * 42;
          child.y = baseY;
          child.notes = 'Placeholder child generated from facts relationship evidence.';
          child.notesEnabled = false;
          existing.children.push(child.id);
        }
      }
      return;
    }
    const id = nanoid();
    personA.partnerships = [...new Set([...personA.partnerships, id])];
    personB.partnerships = [...new Set([...personB.partnerships, id])];
    partnerships.push({
      id,
      partner1_id: personA.id,
      partner2_id: personB.id,
      horizontalConnectorY: Math.max(personA.y, personB.y) + 60 + index * 6,
      relationshipType: normalizeRelationshipType(rel.type),
      relationshipStatus: normalizeRelationshipStatus(rel.status),
      children: [],
      notes: rel.evidence,
      events: [],
    });
    const childCount = toChildCount(rel.evidence);
    if (childCount > 0) {
      const created = partnerships[partnerships.length - 1];
      const anchorX = (personA.x + personB.x) / 2;
      const baseY = created.horizontalConnectorY + 120;
      for (let i = 0; i < childCount; i += 1) {
        const childName = `${(personA.firstName || personA.name || 'Child').split(' ')[0]}-${(personB.firstName || personB.name || 'Child').split(' ')[0]} Child ${i + 1}`;
        const child = getPerson(childName);
        if (!child) continue;
        child.parentPartnership = created.id;
        child.x = anchorX + (i - (childCount - 1) / 2) * 42;
        child.y = baseY;
        child.notes = 'Placeholder child generated from facts relationship evidence.';
        child.notesEnabled = false;
        created.children.push(child.id);
      }
    }
  });

  const schizophreniaSet = new Set(
    (facts.clinical?.explicitSchizophreniaMentions || []).map((name) => name.trim())
  );
  const noDxSet = new Set(
    (facts.clinical?.explicitNoDiagnosisMentions || []).map((name) => name.trim())
  );
  people.forEach((person) => {
    if (schizophreniaSet.has(person.name)) {
      person.functionalIndicators = [
        {
          definitionId: 'indicator-schizophrenia-spectrum',
          status: 'past',
          impact: 5,
          frequency: 5,
          intensity: 5,
        },
      ];
    }
    if (noDxSet.has(person.name)) {
      person.notes = person.notes
        ? `${person.notes}\nFacts: explicitly no schizophrenia diagnosis mention.`
        : 'Facts: explicitly no schizophrenia diagnosis mention.';
      person.notesEnabled = true;
    }
  });

  (facts.clinical?.events || []).forEach((evt, idx) => {
    if (!evt.person || !evt.type) return;
    const person = getPerson(evt.person);
    if (!person) return;
    const event: EmotionalProcessEvent = {
      id: `facts-event-${idx}-${person.id}`,
      date: evt.year ? `${evt.year}-01-01` : '',
      category: 'Clinical',
      statusLabel: evt.type,
      intensity: 3,
      howWell: 0,
      otherPersonName: '',
      wwwwh: 'Derived from facts JSON',
      observations: evt.type,
      eventClass: 'individual',
    };
    person.events = [...(person.events || []), event];
    if ((evt.type || '').toLowerCase().includes('homicide_suicide') && !person.deathDate) {
      person.deathDate = evt.year ? `${evt.year}-01-01` : '1973-01-01';
    }
  });

  const normalizedPeople = normalizeImportedChildLayout(people, partnerships, {
    expandParentSpan: true,
    autoResizeDenseFamilies: true,
  });

  return {
    fileMeta: {
      fileName: `facts-import-${facts.processedAt || 'processed'}.json`,
    },
    people: normalizedPeople,
    partnerships,
    emotionalLines: [],
    triangles: [],
    functionalIndicatorDefinitions: [
      {
        id: 'indicator-schizophrenia-spectrum',
        label: 'Schizophrenia Spectrum',
        group: 'emotional',
        color: '#7b1fa2',
        useLetter: true,
      },
    ],
    eventCategories: ['Clinical', 'Relationship', 'Hospitalization', 'Loss/Death', 'Other'],
    autoSaveMinutes: 1,
    ideasText: (facts.uncertainties || []).join('\n'),
  };
};

const DiagramEditor = () => {
  const defaultSymptomColorByGroup: Record<SymptomGroup, string> = {
    physical: '#1f77b4',
    emotional: '#d81b60',
    social: '#2e7d32',
  };
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [partnerships, setPartnerships] = useState<Partnership[]>(initialPartnerships);
  const [emotionalLines, setEmotionalLines] = useState<EmotionalLine[]>(initialEmotionalLines);
  const [pageNotes, setPageNotes] = useState<PageNote[]>(initialPageNotes);
  const [triangles, setTriangles] = useState<Triangle[]>(initialTriangles);
  const [fileName, setFileName] = useState(initialFileName);
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
  const [indicatorSettingsOpen, setIndicatorSettingsOpen] = useState(false);
  const [indicatorDraftLabel, setIndicatorDraftLabel] = useState('');
  const [timelineYear, setTimelineYear] = useState<number | null>(new Date().getFullYear());
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [timelineSelectionIds, setTimelineSelectionIds] = useState<string[]>([]);
  const [timelineFilterStartYear, setTimelineFilterStartYear] = useState<number | null>(null);
  const [timelineFilterEndYear, setTimelineFilterEndYear] = useState<number | null>(null);
  const [timelineYearPickTarget, setTimelineYearPickTarget] = useState<'start' | 'end' | null>(null);
  const [timelineYearDrag, setTimelineYearDrag] = useState<{
    pointerId: number;
    startClientX: number;
    stripLeft: number;
    stripWidth: number;
    startYear: number;
    endYear: number;
    minYear: number;
    maxYear: number;
    moved: boolean;
  } | null>(null);
  const [timelineHoverNote, setTimelineHoverNote] = useState<{ text: string; x: number; y: number } | null>(null);
  const [timelineBoardSelection, setTimelineBoardSelection] = useState<TimelineBoardSelection | null>(null);
  const [timelineBoardEventDraft, setTimelineBoardEventDraft] = useState<{
    event: EmotionalProcessEvent;
    original?: EmotionalProcessEvent | null;
    isNew: boolean;
  } | null>(null);
  const [notesLayerEnabled, setNotesLayerEnabled] = useState(true);
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
  const [backupRestoreVersions, setBackupRestoreVersions] = useState<{
    v1?: string | null;
    v2?: string | null;
    v3?: string | null;
  } | null>(null);
  const scrollHintShownRef = useRef(false);
  const [canvasScrollHintOpen, setCanvasScrollHintOpen] = useState(false);
  const [sessionCaptureDialogOpen, setSessionCaptureDialogOpen] = useState(false);
  const [pendingSessionCaptureData, setPendingSessionCaptureData] = useState<SessionCaptureImportData | null>(null);
  const [pendingSessionCaptureFileName, setPendingSessionCaptureFileName] = useState('');
  const [sessionCaptureSelections, setSessionCaptureSelections] = useState<Record<string, boolean>>({});
  const stageRef = useRef<StageType>(null);
  const ribbonRef = useRef<HTMLDivElement | null>(null);
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
  } | null>(null);
  const savedSnapshotRef = useRef(
    JSON.stringify({
      people: initialPeople,
      partnerships: initialPartnerships,
      emotionalLines: initialEmotionalLines,
      pageNotes: initialPageNotes,
      triangles: initialTriangles,
      functionalIndicatorDefinitions: initialIndicatorDefinitions,
      eventCategories: initialEventCategories,
      relationshipTypes: initialRelationshipTypes,
      relationshipStatuses: initialRelationshipStatuses,
    })
  );
  const fileMenuRef = useRef<HTMLDivElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const optionsMenuRef = useRef<HTMLDivElement | null>(null);
  const helpMenuRef = useRef<HTMLDivElement | null>(null);
  const loadInputRef = useRef<HTMLInputElement | null>(null);
  const diagramFileHandleRef = useRef<any>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const importPersonEventsInputRef = useRef<HTMLInputElement | null>(null);
  const transcriptInputRef = useRef<HTMLInputElement | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const timelinePlayRef = useRef<NodeJS.Timeout | null>(null);
  const [, forceTimeRefresh] = useState(0);
  const [diagramFileHandleName, setDiagramFileHandleName] = useState<string | null>(null);
  const sortedRelationshipTypes = useMemo(
    () => sortLabelsAZ(relationshipTypes),
    [relationshipTypes]
  );
  const sortedRelationshipStatuses = useMemo(
    () => sortLabelsAZ(relationshipStatuses),
    [relationshipStatuses]
  );
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
  const isCurrentDemoDiagram = useMemo(() => isDemoDiagramFileName(fileName), [fileName]);
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
    const nameMap = new Map<string, string>();
    people.forEach((person) => {
      const label = displayName(person);
      nameMap.set(person.id, label);
      addEntry(person.birthDate, `Birth – ${label}`);
      addEntry(person.deathDate, `Death – ${label}`);
      (person.events || []).forEach((event) => addEntry(event.date, `${event.category || 'Event'} – ${label}`));
    });
    partnerships.forEach((partnership) => {
      const partnerLabel = `${nameMap.get(partnership.partner1_id) || 'Partner 1'} + ${nameMap.get(partnership.partner2_id) || 'Partner 2'}`;
      const base = `${partnership.relationshipType} – ${partnerLabel}`;
      addEntry(partnership.relationshipStartDate, `${base} start`);
      addEntry(partnership.marriedStartDate, `${base} married`);
      addEntry(partnership.separationDate, `${base} separation`);
      addEntry(partnership.divorceDate, `${base} divorce`);
      (partnership.events || []).forEach((event) => addEntry(event.date, `${event.category || 'Event'} – ${partnerLabel}`));
    });
    emotionalLines.forEach((line) => {
      const person1Name = nameMap.get(line.person1_id) || 'Person 1';
      const person2Name = nameMap.get(line.person2_id) || 'Person 2';
      const summary = `${person1Name} ↔ ${person2Name}`;
      addEntry(line.startDate, `EPL start – ${summary}`);
      addEntry(line.endDate, `EPL end – ${summary}`);
      (line.events || []).forEach((event) => addEntry(event.date, `${event.category || 'Event'} – ${summary}`));
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

  const handleTimelineStripDragMove = useCallback(
    (clientX: number) => {
      if (!timelineYearDrag) return;
      const dx = clientX - timelineYearDrag.startClientX;
      const spanYears = timelineYearDrag.endYear - timelineYearDrag.startYear;
      const visibleYears = Math.max(1, spanYears + 1);
      const sensitivity = 2.5;
      let deltaYears = Math.trunc(
        (dx / Math.max(1, timelineYearDrag.stripWidth)) * visibleYears * sensitivity
      );
      if (deltaYears === 0 && Math.abs(dx) > 10) {
        deltaYears = dx > 0 ? 1 : -1;
      }
      const maxStart = timelineYearDrag.maxYear - spanYears;
      const nextStart = Math.max(
        timelineYearDrag.minYear,
        Math.min(timelineYearDrag.startYear + deltaYears, maxStart)
      );
      const nextEnd = nextStart + spanYears;
      setTimelineFilterStartYear(nextStart);
      setTimelineFilterEndYear(nextEnd);
      if (!timelineYearDrag.moved && Math.abs(dx) > 3) {
        setTimelineYearDrag((prev) => (prev ? { ...prev, moved: true } : prev));
      }
    },
    [timelineYearDrag]
  );

  const finishTimelineStripDrag = useCallback(
    (clientX: number) => {
      if (!timelineYearDrag) return;
      if (!timelineYearDrag.moved) {
        const relative = (clientX - timelineYearDrag.stripLeft) / Math.max(1, timelineYearDrag.stripWidth);
        const spanYears = timelineYearDrag.endYear - timelineYearDrag.startYear;
        const clickedYear = Math.max(
          timelineYearDrag.startYear,
          Math.min(
            timelineYearDrag.endYear,
            timelineYearDrag.startYear + Math.floor(relative * (spanYears + 1))
          )
        );
        if (timelineYearPickTarget === 'end') {
          const currentStart = timelineFilterStartYear ?? timelineYearDrag.startYear;
          setTimelineFilterEndYear(Math.max(clickedYear, currentStart));
        } else {
          const currentEnd = timelineFilterEndYear ?? timelineYearDrag.endYear;
          setTimelineFilterStartYear(Math.min(clickedYear, currentEnd));
        }
      }
      setTimelineYearDrag(null);
    },
    [timelineYearDrag, timelineYearPickTarget, timelineFilterEndYear, timelineFilterStartYear]
  );

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

  const handleSessionFieldChange = (field: 'coach' | 'client' | 'fileName' | 'issue' | 'content', value: string) => {
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

  const writeSessionNoteToLocation = async (fileNameValue: string, content: string, mimeType: string) => {
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
    const savedToLocation = await writeSessionNoteToLocation(record.noteFileName, serialized, 'application/json');
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
      alert('Directory picker is not supported in this browser. Files will download to your default location.');
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

  const getEventClassForTargetType = (type: 'person' | 'partnership' | 'emotional'): EventClass =>
    type === 'person' ? 'individual' : type === 'partnership' ? 'relationship' : 'emotional-pattern';

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
      return people.filter((p) => p.id !== sessionEventTarget.id).map((p) => p.name).filter(Boolean) as string[];
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
      if (field === 'intensity' || field === 'howWell' || field === 'frequency' || field === 'impact') {
        const numeric = Number(value);
        return { ...prev, [field]: Number.isNaN(numeric) ? 0 : numeric };
      }
      if (field === 'isNodalEvent') {
        return { ...prev, isNodalEvent: value === 'true' };
      }
      return { ...prev, [field]: value };
    });
  };

  const appendEventToTarget = (target: { type: 'person' | 'partnership' | 'emotional'; id: string }, event: EmotionalProcessEvent) => {
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

  const focusItemInPropertiesPanel = (
    item: Person | Partnership | EmotionalLine,
    intent?: {
      tab?: 'properties' | 'functional' | 'events';
      personSection?: 'name' | 'dates' | 'notes' | 'format';
      focusEventId?: string;
      openNewEventRequestId?: string;
      newEventSeed?: Partial<EmotionalProcessEvent>;
      openNewEventPosition?: { x: number; y: number };
    }
  ) => {
    setPropertiesPanelItem(item);
    if (intent) {
      setPropertiesPanelIntent({
        targetId: item.id,
        tab: intent.tab,
        personSection: intent.personSection,
        focusEventId: intent.focusEventId,
        openNewEventRequestId: intent.openNewEventRequestId,
        newEventSeed: intent.newEventSeed,
        openNewEventPosition: intent.openNewEventPosition,
      });
    } else {
      setPropertiesPanelIntent(null);
    }
  };

  const openPersonSectionPopup = (
    person: Person,
    section: 'name' | 'dates' | 'notes' | 'format' | 'sibling',
    x: number,
    y: number
  ) => {
    setPropertiesPanelItem(null);
    setPropertiesPanelIntent(null);
    setPersonSectionPopup({ personId: person.id, section, x, y });
  };

  const openPartnershipSectionPopup = (
    partnership: Partnership,
    relationshipType: string,
    x: number,
    y: number
  ) => {
    setPersonSectionPopup(null);
    setPropertiesPanelItem(null);
    setPropertiesPanelIntent(null);
    setPartnershipSectionPopup({ partnershipId: partnership.id, relationshipType, x, y });
  };

  const openContextualEventCreator = (
    target: { type: 'person' | 'partnership' | 'emotional'; id: string },
    targetItem: Person | Partnership | EmotionalLine,
    seed?: Partial<EmotionalProcessEvent>,
    popupPosition?: { x: number; y: number }
  ) => {
    const anchorType =
      target.type === 'person'
        ? 'PERSON'
        : target.type === 'partnership'
        ? 'RELATIONSHIP_PRL'
        : 'EMOTIONAL_PROCESS_EP';
    const eventType = seed?.eventType || (target.type === 'emotional' ? 'EPE' : 'FF');
    const baseSeed: Partial<EmotionalProcessEvent> = {
      ...seed,
      eventType,
      anchorType,
      anchorId: target.id,
      eventClass: getEventClassForTargetType(target.type),
      date: seed?.date || new Date().toISOString().slice(0, 10),
      startDate: seed?.startDate || seed?.date || new Date().toISOString().slice(0, 10),
    };
    if (target.type === 'person') {
      const person = targetItem as Person;
      setSelectedPeopleIds([person.id]);
      setSelectedPartnershipId(null);
      setSelectedEmotionalLineId(null);
      setSelectedChildId(null);
      focusItemInPropertiesPanel(person, {
        tab: 'events',
        openNewEventRequestId: nanoid(),
        openNewEventPosition: popupPosition,
        newEventSeed: {
          ...baseSeed,
          primaryPersonName: person.name || '',
        },
      });
      return;
    }
    if (target.type === 'partnership') {
      const partnership = targetItem as Partnership;
      const partner1 = people.find((p) => p.id === partnership.partner1_id);
      const partner2 = people.find((p) => p.id === partnership.partner2_id);
      setSelectedPeopleIds([]);
      setSelectedPartnershipId(partnership.id);
      setSelectedEmotionalLineId(null);
      setSelectedChildId(null);
      focusItemInPropertiesPanel(partnership, {
        tab: 'events',
        openNewEventRequestId: nanoid(),
        openNewEventPosition: popupPosition,
        newEventSeed: {
          ...baseSeed,
          category: seed?.category || 'Relationship',
          primaryPersonName: partner1?.name || '',
          otherPersonName: partner2?.name || '',
        },
      });
      return;
    }
    const line = targetItem as EmotionalLine;
    const person1 = people.find((p) => p.id === line.person1_id);
    const person2 = people.find((p) => p.id === line.person2_id);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(line.id);
    setSelectedChildId(null);
    focusItemInPropertiesPanel(line, {
      tab: 'events',
      openNewEventRequestId: nanoid(),
      openNewEventPosition: popupPosition,
      newEventSeed: {
        ...baseSeed,
        eventType: 'EPE',
        emotionalProcessType: line.relationshipType,
        category: seed?.category || 'Emotional Pattern',
        primaryPersonName: person1?.name || '',
        otherPersonName: person2?.name || '',
      },
    });
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
  const syncPropertiesPanelIndicators = (defs: FunctionalIndicatorDefinition[]) => {
    setPropertiesPanelItem((prev) => {
      if (prev && 'name' in prev) {
        return sanitizeSinglePersonIndicators(prev as Person, defs);
      }
      return prev;
    });
  };
  const applyIndicatorDefinitionArray = (nextDefs: FunctionalIndicatorDefinition[]) => {
    setFunctionalIndicatorDefinitions(nextDefs);
    setPeople((prev) => sanitizePeopleIndicators(prev, nextDefs));
    syncPropertiesPanelIndicators(nextDefs);
  };

  const updateIndicatorDefinitions = (
    updater: (prev: FunctionalIndicatorDefinition[]) => FunctionalIndicatorDefinition[]
  ) => {
    setFunctionalIndicatorDefinitions((prev) => {
      const next = updater(prev);
      setPeople((peoplePrev) => sanitizePeopleIndicators(peoplePrev, next));
      syncPropertiesPanelIndicators(next);
      return next;
    });
  };

  const resetIndicatorDraft = () => {
    setIndicatorDraftLabel('');
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const addFunctionalIndicatorDefinition = () => {
    const trimmed = indicatorDraftLabel.trim();
    if (!trimmed) return;
    updateIndicatorDefinitions((prev) => [
      ...prev,
      {
        id: nanoid(),
        label: trimmed,
        group: 'physical',
        useLetter: true,
        color: '#1f77b4',
      },
    ]);
    resetIndicatorDraft();
  };

  const updateFunctionalIndicatorLabel = (id: string, label: string) => {
    updateIndicatorDefinitions((prev) =>
      prev.map((definition) => (definition.id === id ? { ...definition, label } : definition))
    );
  };

  const updateFunctionalIndicatorGroup = (
    id: string,
    group: 'physical' | 'emotional' | 'social'
  ) => {
    updateIndicatorDefinitions((prev) =>
      prev.map((definition) => (definition.id === id ? { ...definition, group } : definition))
    );
  };

  const updateFunctionalIndicatorUseLetter = (id: string, useLetter: boolean) => {
    updateIndicatorDefinitions((prev) =>
      prev.map((definition) => (definition.id === id ? { ...definition, useLetter } : definition))
    );
  };

  const updateFunctionalIndicatorColor = (id: string, color: string) => {
    updateIndicatorDefinitions((prev) =>
      prev.map((definition) => (definition.id === id ? { ...definition, color } : definition))
    );
  };

  const updateFunctionalIndicatorIcon = async (id: string, file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      updateIndicatorDefinitions((prev) =>
        prev.map((definition) =>
          definition.id === id ? { ...definition, iconDataUrl: dataUrl, useLetter: false } : definition
        )
      );
    } catch (error) {
      console.error('Failed to read icon file', error);
    }
  };

  const clearFunctionalIndicatorIcon = (id: string) => {
    updateIndicatorDefinitions((prev) =>
      prev.map((definition) =>
        definition.id === id ? { ...definition, iconDataUrl: undefined, useLetter: true } : definition
      )
    );
  };

  const removeFunctionalIndicatorDefinition = (id: string) => {
    updateIndicatorDefinitions((prev) => prev.filter((definition) => definition.id !== id));
  };

  const ensureSymptomDefinition = (label: string, group: SymptomGroup): string | null => {
    const trimmed = label.trim();
    const existingByLabel = trimmed
      ? functionalIndicatorDefinitions.find(
          (definition) => definition.label.trim().toLowerCase() === trimmed.toLowerCase()
        )
      : null;
    if (existingByLabel) {
      if (!existingByLabel.group || existingByLabel.group !== group) {
        updateIndicatorDefinitions((prev) =>
          prev.map((definition) =>
            definition.id === existingByLabel.id
              ? { ...definition, group: definition.group || group }
              : definition
          )
        );
      }
      return existingByLabel.id;
    }
    const existingByGroup = functionalIndicatorDefinitions.find((definition) => definition.group === group);
    if (!trimmed) {
      return existingByGroup?.id || null;
    }
    const created: FunctionalIndicatorDefinition = {
      id: nanoid(),
      label: trimmed,
      group,
      color: defaultSymptomColorByGroup[group],
      useLetter: true,
    };
    updateIndicatorDefinitions((prev) => [...prev, created]);
    return created.id;
  };

  const STYLE_ONLY_FIELDS = useMemo(
    () =>
      new Set<keyof Person>([
        'size',
        'borderColor',
        'borderEnabled',
        'foregroundColor',
        'foregroundEnabled',
        'backgroundColor',
        'backgroundEnabled',
        'functionalIndicators',
      ]),
    []
  );
  const isStyleOnlyUpdate = (updates: Partial<Person>) => {
    const keys = Object.keys(updates) as (keyof Person)[];
    if (!keys.length) return false;
    return keys.every((key) => STYLE_ONLY_FIELDS.has(key));
  };

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

  type EmotionalLineInput = Partial<EmotionalLine> & { lineStyle?: string; color?: string };
  type TriangleInput = Partial<Triangle>;

  const normalizeEmotionalLine = (line: EmotionalLineInput): EmotionalLine => {
    let normalized = { ...line } as EmotionalLine;
    if (!normalized.status) {
      normalized = { ...normalized, status: 'ongoing' };
    }
    if (normalized.relationshipType === 'distance' && normalized.lineStyle === 'cutoff') {
      normalized = { ...normalized, lineStyle: 'distance-long' };
    }
    if (normalized.relationshipType === 'cutoff' && normalized.lineStyle !== 'cutoff') {
      normalized = { ...normalized, lineStyle: 'cutoff' };
    }
    if (normalized.relationshipType === 'projection') {
      const projectionStyles: EmotionalLine['lineStyle'][] = [
        'projection-1',
        'projection-2',
        'projection-3',
        'projection-4',
        'projection-5',
      ];
      const currentStyle = normalized.lineStyle as EmotionalLine['lineStyle'];
      let nextStyle: EmotionalLine['lineStyle'] =
        projectionStyles.includes(currentStyle) ? currentStyle : 'projection-3';
      if ((normalized.lineStyle as unknown as string) === 'projection-flow') {
        nextStyle = 'projection-5';
      } else if ((normalized.lineStyle as unknown as string) === 'low') {
        nextStyle = 'projection-1';
      } else if ((normalized.lineStyle as unknown as string) === 'medium') {
        nextStyle = 'projection-3';
      } else if ((normalized.lineStyle as unknown as string) === 'high') {
        nextStyle = 'projection-5';
      }
      normalized = { ...normalized, lineStyle: nextStyle, lineEnding: 'none' };
    }
    if (normalized.relationshipType === 'distance') {
      const legacyMap: Record<string, EmotionalLine['lineStyle']> = {
        dotted: 'distance-dotted-wide',
        dashed: 'distance-dashed-wide',
        'long-dash': 'distance-long',
      };
      const mapped = legacyMap[(normalized.lineStyle as unknown as string)] || null;
      if (mapped) {
        normalized = { ...normalized, lineStyle: mapped };
      }
    }
    if (normalized.relationshipType === 'conflict') {
      const legacyMap: Record<string, EmotionalLine['lineStyle']> = {
        'dotted-saw-tooth': 'conflict-dotted-wide',
        'solid-saw-tooth': 'conflict-solid-wide',
        'double-saw-tooth': 'conflict-double',
      };
      const mapped = legacyMap[(normalized.lineStyle as unknown as string)] || null;
      if (mapped) {
        normalized = { ...normalized, lineStyle: mapped };
      }
    }
    if (normalized.relationshipType === 'fusion') {
      const legacyMap: Record<string, EmotionalLine['lineStyle']> = {
        single: 'fusion-dotted-tight',
        double: 'fusion-solid-tight',
        triple: 'fusion-triple',
        low: 'fusion-dotted-tight',
        medium: 'fusion-solid-tight',
        high: 'fusion-triple',
      };
      const mapped = legacyMap[(normalized.lineStyle as unknown as string)] || null;
      if (mapped) {
        normalized = { ...normalized, lineStyle: mapped };
      }
    }
    if (!normalized.color) {
      normalized = { ...normalized, color: DEFAULT_LINE_COLOR };
    }
    return normalized;
  };

  const normalizeEmotionalLines = (lines: EmotionalLineInput[]): EmotionalLine[] =>
    lines.map((line) => normalizeEmotionalLine(line));

  const buildDefaultTpl = (
    person1_id: string,
    person2_id: string,
    triangleColor?: string
  ): EmotionalLine => ({
    id: nanoid(),
    person1_id,
    person2_id,
    status: 'ongoing',
    relationshipType: 'fusion',
    lineStyle: 'fusion-dotted-wide',
    lineEnding: 'none',
    startDate: new Date().toISOString().slice(0, 10),
    color: triangleColor || DEFAULT_LINE_COLOR,
    events: [],
  });

  const normalizeTriangles = (items: TriangleInput[]): Triangle[] =>
    items
      .map((item) => {
        const id = item.id || nanoid();
        const person1_id = item.person1_id || '';
        const person2_id = item.person2_id || '';
        const person3_id = item.person3_id || '';
        const pairA = [person1_id, person2_id];
        const pairB = [person2_id, person3_id];
        const pairC = [person3_id, person1_id];
        const intensity: Triangle['intensity'] =
          item.intensity === 'low' || item.intensity === 'high' ? item.intensity : 'medium';
        const existingTpls = Array.isArray(item.tpls) ? normalizeEmotionalLines(item.tpls) : [];
        const findTpl = (a: string, b: string) =>
          existingTpls.find(
            (tpl) =>
              (tpl.person1_id === a && tpl.person2_id === b) ||
              (tpl.person1_id === b && tpl.person2_id === a)
          );
        const tpls: EmotionalLine[] = [
          findTpl(pairA[0], pairA[1]) || buildDefaultTpl(pairA[0], pairA[1], item.color),
          findTpl(pairB[0], pairB[1]) || buildDefaultTpl(pairB[0], pairB[1], item.color),
          findTpl(pairC[0], pairC[1]) || buildDefaultTpl(pairC[0], pairC[1], item.color),
        ];
        return {
          id,
          person1_id,
          person2_id,
          person3_id,
          color: item.color,
          intensity,
          tpls,
        };
      })
      .filter(
        (item) =>
          !!item.person1_id &&
          !!item.person2_id &&
          !!item.person3_id &&
          item.person1_id !== item.person2_id &&
          item.person1_id !== item.person3_id &&
          item.person2_id !== item.person3_id
      );

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
  const payload: StoredUserSettings = {
    eventCategories,
    relationshipTypes,
    relationshipStatuses,
    functionalIndicatorDefinitions,
    autoSaveMinutes,
  };
  setStoredValue('userSettings', JSON.stringify(payload));
}, [
  autoSaveMinutes,
  eventCategories,
  functionalIndicatorDefinitions,
  relationshipStatuses,
  relationshipTypes,
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

  const handleUpdatePerson = (personId: string, updatedProps: Partial<Person>) => {
    console.log('Updating person:', personId, updatedProps);
    const updater = (prev: Person[]) =>
      prev.map((p) => (p.id === personId ? { ...p, ...updatedProps } : p));
    if (isStyleOnlyUpdate(updatedProps)) {
      setPeople((prev) => updater(prev));
    } else {
      setPeopleAligned((prev) => updater(prev));
    }
    setPropertiesPanelItem(prev => {
        if (prev && prev.id === personId && 'name' in prev) { // check if it is a person
            return { ...prev, ...updatedProps };
        }
        return prev;
    });
  };

  const openClientProfileModal = (person: Person) => {
    setClientProfileDraft({
      personId: person.id,
      personName: person.name || '',
      clientColor: person.backgroundColor || '#FFF7C2',
      presentingIssue1: person.clientProfile?.presentingIssue1 || '',
      presentingIssue2: person.clientProfile?.presentingIssue2 || '',
      presentingIssue3: person.clientProfile?.presentingIssue3 || '',
      desiredOutcome1: person.clientProfile?.desiredOutcome1 || '',
      desiredOutcome2: person.clientProfile?.desiredOutcome2 || '',
      desiredOutcome3: person.clientProfile?.desiredOutcome3 || '',
      conceptualization: person.clientProfile?.conceptualization || '',
    });
  };

  const openCoachThinkingModal = (person: Person) => {
    setCoachThinkingDraft({
      personId: person.id,
      personName: person.name || '',
      thinking: person.coachThinking?.thinking || '',
      notes: person.coachThinking?.notes || '',
    });
  };

  const updateCoachThinkingField = (field: 'thinking' | 'notes', value: string) => {
    setCoachThinkingDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const saveCoachThinkingDraft = () => {
    if (!coachThinkingDraft) return;
    handleUpdatePerson(coachThinkingDraft.personId, {
      coachThinking: {
        thinking: coachThinkingDraft.thinking.trim(),
        notes: coachThinkingDraft.notes.trim(),
        updatedAt: Date.now(),
      },
    });
    setCoachThinkingDraft(null);
  };

  const updateClientProfileDraftField = (
    field: keyof Omit<ClientProfileDraft, 'personId' | 'personName'>,
    value: string
  ) => {
    setClientProfileDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const saveClientProfileDraft = () => {
    if (!clientProfileDraft) return;
    handleUpdatePerson(clientProfileDraft.personId, {
      isClient: true,
      backgroundEnabled: true,
      backgroundColor: clientProfileDraft.clientColor || '#FFF7C2',
      clientProfile: {
        presentingIssue1: clientProfileDraft.presentingIssue1.trim(),
        presentingIssue2: clientProfileDraft.presentingIssue2.trim(),
        presentingIssue3: clientProfileDraft.presentingIssue3.trim(),
        desiredOutcome1: clientProfileDraft.desiredOutcome1.trim(),
        desiredOutcome2: clientProfileDraft.desiredOutcome2.trim(),
        desiredOutcome3: clientProfileDraft.desiredOutcome3.trim(),
        conceptualization: clientProfileDraft.conceptualization.trim(),
      },
    });
    setClientProfileDraft(null);
  };

  const handleBatchUpdatePersons = (personIds: string[], updatedProps: Partial<Person>) => {
    if (!personIds.length) return;
    const updater = (prev: Person[]) =>
      prev.map((person) =>
        personIds.includes(person.id) ? { ...person, ...updatedProps } : person
      );
    if (isStyleOnlyUpdate(updatedProps)) {
      setPeople((prev) => updater(prev));
    } else {
      setPeopleAligned((prev) => updater(prev));
    }
    setPropertiesPanelItem((prev) => {
      if (prev && 'name' in prev && personIds.includes(prev.id)) {
        return { ...prev, ...updatedProps };
      }
      return prev;
    });
  };

  const handleUpdatePartnership = (partnershipId: string, updatedProps: Partial<Partnership>) => {
    setPartnerships((prev) =>
      prev.map((p) => (p.id === partnershipId ? { ...p, ...updatedProps } : p))
    );
    setPropertiesPanelItem((prev) => {
      if (prev && prev.id === partnershipId && 'partner1_id' in prev) {
        return { ...prev, ...updatedProps };
      }
      return prev;
    });
  };

  const handleUpdateEmotionalLine = (emotionalLineId: string, updatedProps: Partial<EmotionalLine>) => {
    console.log('Updating emotional line:', emotionalLineId, updatedProps);
    setEmotionalLines((prev) =>
      prev.map((el) => (el.id !== emotionalLineId ? el : normalizeEmotionalLine({ ...el, ...updatedProps })))
    );
    setTriangles((prev) =>
      prev.map((triangle) => {
        if (!triangle.tpls?.length) return triangle;
        let changed = false;
        const nextTpls = triangle.tpls.map((tpl) => {
          if (tpl.id !== emotionalLineId) return tpl;
          changed = true;
          return normalizeEmotionalLine({ ...tpl, ...updatedProps });
        });
        return changed ? { ...triangle, tpls: nextTpls } : triangle;
      })
    );
    setPropertiesPanelItem(prev => {
        if (prev && prev.id === emotionalLineId && 'lineStyle' in prev) { // check if it is an emotional line
            return normalizeEmotionalLine({ ...prev, ...updatedProps });
        }
        return prev;
    });
  };

  const addEmotionalLine = (
    person1_id: string,
    person2_id: string,
    relationshipType: EmotionalLine['relationshipType'],
    lineStyle: EmotionalLine['lineStyle'],
    lineEnding: EmotionalLine['lineEnding']
  ) => {
    const newEmotionalLine: EmotionalLine = {
        id: nanoid(),
        person1_id,
        person2_id,
        status: 'ongoing',
        relationshipType,
        lineStyle,
        lineEnding,
        startDate: new Date().toISOString().slice(0, 10),
        color: DEFAULT_LINE_COLOR,
        events: [],
    };
    setEmotionalLines((prev) => [...prev, newEmotionalLine]);
    return newEmotionalLine;
  };

  const openAddEmotionalPatternModal = (person1Id: string, person2Id: string) => {
    setEmotionalPatternDraft({
      person1Id,
      person2Id,
      relationshipType: 'fusion',
      status: 'ongoing',
      lineStyle: 'fusion-dotted-wide',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      intensityLevel: intensityValueForLineStyle('fusion-dotted-wide'),
      frequency: 0,
      impact: 0,
      notes: '',
      color: DEFAULT_LINE_COLOR,
    });
    setEmotionalPatternModalOpen(true);
  };

  const updateEmotionalPatternDraft = (updates: Partial<EmotionalPatternDraft>) => {
    setEmotionalPatternDraft((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const saveAddEmotionalPattern = () => {
    if (!emotionalPatternDraft) return;
    const {
      person1Id,
      person2Id,
      relationshipType,
      status,
      lineStyle,
      startDate,
      endDate,
      intensityLevel,
      frequency,
      impact,
      notes,
      color,
    } = emotionalPatternDraft;
    const newEmotionalLine = addEmotionalLine(person1Id, person2Id, relationshipType, lineStyle, 'none');
    const person1 = people.find((person) => person.id === person1Id);
    const person2 = people.find((person) => person.id === person2Id);
    const start = startDate || new Date().toISOString().slice(0, 10);
    const seededEvent: EmotionalProcessEvent = {
      id: nanoid(),
      date: start,
      startDate: start,
      endDate: endDate || undefined,
      category: 'Emotional Pattern',
      eventType: 'EPE',
      emotionalProcessType: relationshipType,
      anchorType: 'EMOTIONAL_PROCESS_EP',
      anchorId: newEmotionalLine.id,
      statusLabel: status,
      intensity: intensityLevel,
      frequency,
      impact,
      howWell: 5,
      otherPersonName: person2?.name || '',
      primaryPersonName: person1?.name || '',
      wwwwh: '',
      observations: notes || '',
      isNodalEvent: false,
      eventClass: 'emotional-pattern',
      createdAt: Date.now(),
    };
    const updatedLine: EmotionalLine = normalizeEmotionalLine({
      ...newEmotionalLine,
      status,
      startDate: start,
      endDate: endDate || undefined,
      notes: notes || undefined,
      color: color || DEFAULT_LINE_COLOR,
      events: [seededEvent],
    });
    setEmotionalLines((prev) =>
      prev.map((line) => (line.id === updatedLine.id ? updatedLine : line))
    );
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(updatedLine.id);
    setSelectedChildId(null);
    setPropertiesPanelItem(updatedLine);
    setEmotionalPatternModalOpen(false);
    setEmotionalPatternDraft(null);
    setContextMenu(null);
  };

  const removeEmotionalLine = (emotionalLineId: string) => {
    setEmotionalLines(emotionalLines.filter(el => el.id !== emotionalLineId));
    setContextMenu(null);
  };

  const addTriangle = (personIds: string[]) => {
    if (personIds.length !== 3) return;
    const uniqueIds = [...new Set(personIds)];
    if (uniqueIds.length !== 3) return;
    const key = [...uniqueIds].sort().join('::');
    const existing = triangles.find(
      (triangle) =>
        [triangle.person1_id, triangle.person2_id, triangle.person3_id].sort().join('::') === key
    );
    if (existing) {
      setSelectedPeopleIds([]);
      return;
    }
    const [person1_id, person2_id, person3_id] = uniqueIds;
    const newTriangle: Triangle = {
      id: nanoid(),
      person1_id,
      person2_id,
      person3_id,
      color: '#8a5a00',
      intensity: 'medium',
      tpls: [
        buildDefaultTpl(person1_id, person2_id, '#8a5a00'),
        buildDefaultTpl(person2_id, person3_id, '#8a5a00'),
        buildDefaultTpl(person3_id, person1_id, '#8a5a00'),
      ],
    };
    setTriangles((prev) => [...prev, newTriangle]);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setPropertiesPanelItem(null);
  };

  const removeTriangle = (triangleId: string) => {
    setTriangles((prev) => prev.filter((triangle) => triangle.id !== triangleId));
    setContextMenu(null);
  };

  const updateTriangleColor = (triangleId: string, color: string) => {
    setTriangles((prev) =>
      prev.map((triangle) => {
        if (triangle.id !== triangleId) return triangle;
        return {
          ...triangle,
          color,
        };
      })
    );
  };

  const updateTriangleIntensity = (
    triangleId: string,
    intensity: 'low' | 'medium' | 'high'
  ) => {
    setTriangles((prev) =>
      prev.map((triangle) =>
        triangle.id === triangleId ? { ...triangle, intensity } : triangle
      )
    );
  };

  const addPartnership = () => {
    if (selectedPeopleIds.length !== 2) return;

    const [p1_id, p2_id] = selectedPeopleIds;
    const newPartnership: Partnership = {
        id: nanoid(),
        partner1_id: p1_id,
        partner2_id: p2_id,
        horizontalConnectorY: Math.max(people.find(p=>p.id === p1_id)!.y, people.find(p=>p.id === p2_id)!.y) + 100, // default y
        relationshipType: 'dating',
        relationshipStatus: 'married',
        children: [],
        events: [],
    };
    setPartnerships([...partnerships, newPartnership]);
  };

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

  const reviewVoiceCommands = () => {
    const result = parseVoiceCommands(voiceCommandText);
    setVoiceCommandOperations(result.operations);
    setVoiceCommandErrors(result.errors);
    setVoiceStatusMessage(
      result.errors.length
        ? 'Review the unsupported commands before applying.'
        : result.operations.length
        ? `Ready to apply ${result.operations.length} command${result.operations.length === 1 ? '' : 's'}.`
        : 'No supported commands found.'
    );
  };

  const toggleVoiceListening = () => {
    const recognition = speechRecognitionRef.current;
    if (!recognition) {
      setVoiceStatusMessage('Speech recognition is not available in this browser.');
      return;
    }
    if (voiceListening) {
      recognition.stop();
      setVoiceListening(false);
      return;
    }
    try {
      recognition.start();
      setVoiceListening(true);
      setVoiceStatusMessage('Listening for commands...');
    } catch {
      setVoiceStatusMessage('Speech recognition could not start.');
    }
  };

  const applyVoiceCommands = () => {
    const reviewed = parseVoiceCommands(voiceCommandText);
    setVoiceCommandOperations(reviewed.operations);
    setVoiceCommandErrors(reviewed.errors);
    if (!reviewed.operations.length) {
      setVoiceStatusMessage('No supported commands found.');
      return;
    }
    if (reviewed.errors.length) {
      setVoiceStatusMessage('Fix the unsupported commands before applying.');
      return;
    }

    const nextPeople: Person[] = people.map((person) => ({
      ...person,
      partnerships: [...(person.partnerships || [])],
      events: person.events ? [...person.events] : undefined,
    }));
    const nextPartnerships: Partnership[] = partnerships.map((partnership) => ({
      ...partnership,
      children: [...(partnership.children || [])],
      events: partnership.events ? [...partnership.events] : undefined,
    }));
    const nextEmotionalLines: EmotionalLine[] = emotionalLines.map((line) => ({
      ...line,
      events: line.events ? [...line.events] : undefined,
    }));

    const personNameKey = (value: string) => normalizeCommandName(value).toLowerCase();
    const personByKey = new Map<string, Person>();
    nextPeople.forEach((person) => {
      personByKey.set(personNameKey(person.name || ''), person);
    });

    const ensurePerson = (
      rawName: string,
      options?: { gender?: 'male' | 'female'; near?: Person; role?: 'partner' | 'child' }
    ) => {
      const name = normalizeCommandName(rawName);
      const key = personNameKey(name);
      const existing = personByKey.get(key);
      if (existing) {
        if (!existing.gender && options?.gender) {
          existing.gender = options.gender;
        }
        return existing;
      }

      let x = 120 + (nextPeople.length % 6) * 150;
      let y = 140 + Math.floor(nextPeople.length / 6) * 180;
      if (options?.near && options.role === 'partner') {
        const offsetX = options.gender === 'female' ? 140 : -140;
        x = options.near.x + offsetX;
        y = options.near.y;
      }
      if (options?.near && options.role === 'child') {
        x = options.near.x;
        y = options.near.y;
      }

      const created: Person = {
        id: nanoid(),
        name,
        firstName: name.split(/\s+/)[0],
        lastName: name.split(/\s+/).slice(1).join(' ') || undefined,
        x,
        y,
        gender: options?.gender || inferGenderFromName(name) || 'female',
        partnerships: [],
        events: [],
      };
      nextPeople.push(created);
      personByKey.set(key, created);
      return created;
    };

    const ensurePartnership = (firstName: string, secondName: string) => {
      const first = ensurePerson(firstName, { gender: 'male' });
      const second = ensurePerson(secondName, {
        gender: first.gender === 'male' ? 'female' : 'male',
        near: first,
        role: 'partner',
      });
      const existing = nextPartnerships.find(
        (entry) =>
          (entry.partner1_id === first.id && entry.partner2_id === second.id) ||
          (entry.partner1_id === second.id && entry.partner2_id === first.id)
      );
      if (existing) return { partnership: existing, first, second };

      const partnershipId = nanoid();
      const created: Partnership = {
        id: partnershipId,
        partner1_id: first.id,
        partner2_id: second.id,
        horizontalConnectorY: Math.max(first.y, second.y) + 100,
        relationshipType: 'dating',
        relationshipStatus: 'ongoing',
        children: [],
        events: [],
      };
      nextPartnerships.push(created);
      first.partnerships = [...new Set([...(first.partnerships || []), partnershipId])];
      second.partnerships = [...new Set([...(second.partnerships || []), partnershipId])];
      return { partnership: created, first, second };
    };

    const ensureEmotionalLine = (
      firstName: string,
      secondName: string,
      relationshipType: 'cutoff' | 'conflict' | 'fusion' | 'distance'
    ) => {
      const first = ensurePerson(firstName);
      const second = ensurePerson(secondName);
      const existing = nextEmotionalLines.find(
        (line) =>
          ((line.person1_id === first.id && line.person2_id === second.id) ||
            (line.person1_id === second.id && line.person2_id === first.id)) &&
          line.relationshipType === relationshipType
      );
      if (existing) return;

      const styleMap: Record<
        'cutoff' | 'conflict' | 'fusion' | 'distance',
        EmotionalLine['lineStyle']
      > = {
        cutoff: 'cutoff',
        conflict: 'conflict-dotted-wide',
        fusion: 'fusion-solid-wide',
        distance: 'distance-dashed-wide',
      };
      nextEmotionalLines.push({
        id: nanoid(),
        person1_id: first.id,
        person2_id: second.id,
        relationshipType,
        lineStyle: styleMap[relationshipType],
        lineEnding: 'none',
        status: 'ongoing',
        color: DEFAULT_LINE_COLOR,
        events: [],
      });
    };

    reviewed.operations.forEach((operation) => {
      if (operation.type === 'add_person') {
        ensurePerson(operation.name, { gender: operation.gender });
        return;
      }

      if (operation.type === 'add_partnership') {
        ensurePartnership(operation.personName, operation.partnerName);
        return;
      }

      if (operation.type === 'set_person_birth_year') {
        const person = ensurePerson(operation.name);
        person.birthDate = `${operation.year}-01-01`;
        return;
      }

      if (operation.type === 'set_person_death_year') {
        const person = ensurePerson(operation.name);
        person.deathDate = `${operation.year}-01-01`;
        return;
      }

      if (operation.type === 'set_person_adoption_status') {
        const person = ensurePerson(operation.name);
        person.adoptionStatus = operation.adoptionStatus;
        return;
      }

      if (operation.type === 'set_partnership_status') {
        const { partnership } = ensurePartnership(operation.person1Name, operation.person2Name);
        partnership.relationshipType = operation.relationshipType;
        partnership.relationshipStatus = operation.relationshipStatus;
        if (operation.relationshipStatus === 'married' && operation.year) {
          partnership.relationshipStartDate = `${operation.year}-01-01`;
          partnership.marriedStartDate = `${operation.year}-01-01`;
        }
        if (operation.relationshipStatus === 'divorced' && operation.year) {
          partnership.divorceDate = `${operation.year}-01-01`;
        }
        if (operation.relationshipStatus === 'separated' && operation.year) {
          partnership.separationDate = `${operation.year}-01-01`;
        }
        return;
      }

      if (operation.type === 'add_emotional_line') {
        ensureEmotionalLine(operation.person1Name, operation.person2Name, operation.relationshipType);
        return;
      }

      const { partnership, first, second } = ensurePartnership(
        operation.parent1Name,
        operation.parent2Name
      );
      const anchorX = (first.x + second.x) / 2;
      const baseY = partnership.horizontalConnectorY + 120;
      const spacing = 70;
      const startX = anchorX - ((operation.childNames.length - 1) * spacing) / 2;

      operation.childNames.forEach((childName, index) => {
        const child = ensurePerson(childName, {
          near: {
            ...first,
            x: startX + index * spacing,
            y: baseY,
          },
          role: 'child',
        });
        if (child.parentPartnership && child.parentPartnership !== partnership.id) {
          const prior = nextPartnerships.find((entry) => entry.id === child.parentPartnership);
          if (prior) {
            prior.children = prior.children.filter((entry) => entry !== child.id);
          }
        }
        child.parentPartnership = partnership.id;
        delete child.connectionAnchorX;
        if (!partnership.children.includes(child.id)) {
          partnership.children.push(child.id);
        }
        child.x = startX + index * spacing;
        child.y = baseY;
      });
    });

    const normalizedPeople = normalizeImportedChildLayout(nextPeople, nextPartnerships, {
      expandParentSpan: true,
      autoResizeDenseFamilies: true,
    });
    setPeople(alignAllAnchors(normalizedPeople));
    setPartnerships(nextPartnerships);
    setEmotionalLines(nextEmotionalLines);
    setVoiceStatusMessage(
      `Applied ${reviewed.operations.length} command${reviewed.operations.length === 1 ? '' : 's'}.`
    );
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setPropertiesPanelItem(null);
  };

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
      if (!restoredHandle) return;
      const hasReadPermission =
        !restoredHandle.queryPermission ||
        (await ensureDiagramHandlePermission(restoredHandle, 'read'));
      if (!hasReadPermission) return;
      setDiagramFileHandle(restoredHandle);
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
    }: {
      requestedFileName?: string;
      forceChooseLocation?: boolean;
      allowPicker?: boolean;
    } = {}) => {
      const normalizedRequestedName = (() => {
        const base = (requestedFileName || fileName || FALLBACK_FILE_NAME).trim() || FALLBACK_FILE_NAME;
        return base.toLowerCase().endsWith('.json') ? base : `${base}.json`;
      })();

      let handle = forceChooseLocation ? null : diagramFileHandleRef.current;
      if (!handle && allowPicker && typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        handle = await (window as any).showSaveFilePicker({
          suggestedName: normalizedRequestedName,
          types: DIAGRAM_FILE_PICKER_TYPES,
        });
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
          await rotateDiagramBackups(backupKey, priorJson);
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
      await rotateDiagramBackups(backupKey, jsonString);
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
    [buildDiagramPayload, emotionalLines, ensureDiagramHandlePermission, fileName, markSnapshotClean, pageNotes, partnerships, people, readDiagramJsonFromHandle, setDiagramFileHandle, triangles, writeDiagramJsonToHandle]
  );

  useEffect(() => {
    if (!isDirty) return;
    if (!diagramFileHandleRef.current) return;
    const timeout = window.setTimeout(() => {
      void saveDiagramToCurrentTarget({
        requestedFileName: fileName,
        forceChooseLocation: false,
        allowPicker: false,
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
    const partnershipsWithEvents = attachEventClassToEntities(cleaned.partnerships, 'relationship');
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
    setTimelinePlaying(false);
    setTimelineYear(new Date().getFullYear());
    setTimelineSelectionIds([]);
    setTimelineYearPickTarget(null);
    setTimelineYearDrag(null);
    setTimelineFilterStartYear(null);
    setTimelineFilterEndYear(null);
    setTimelineBoardSelection(null);
    setTimelineBoardEventDraft(null);
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
          statusLabel: payload.statusLabel || '',
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
          isNodalEvent: !!payload.isNodalEvent,
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
    const incomingPartnerships = attachEventClassToEntities(cleaned.partnerships, 'relationship');
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
      setTimelineYearPickTarget(null);
      setTimelineYearDrag(null);
      setTimelineFilterStartYear(null);
      setTimelineFilterEndYear(null);
      setTimelineBoardSelection(null);
      setTimelineBoardEventDraft(null);
      setImportModeDialogOpen(false);
      setPendingImportData(null);
      setPendingImportFileName('');
    } catch (error) {
      alert('Error importing data');
    }
  };

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

  const handleCanvasScrollHint = () => {
    if (scrollHintShownRef.current) return;
    scrollHintShownRef.current = true;
    setCanvasScrollHintOpen(true);
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
    // Reset the input value to allow loading the same file again
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
    setTimelineYearPickTarget(null);
    setTimelineYearDrag(null);
    setTimelineFilterStartYear(null);
    setTimelineFilterEndYear(null);
    setTimelineBoardSelection(null);
    setTimelineBoardEventDraft(null);
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
  }, [markSnapshotClean, setDiagramFileHandle]);

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
      const person = (snapshot.people || []).find((entry) => entry.id === focus.personId);
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
        (entry) => entry.id === focus.partnershipId
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
      const line = (snapshot.emotionalLines || []).find((entry) => entry.id === focus.lineId);
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
      setTimelineBoardSelection(null);
      setTimelineBoardEventDraft(null);
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
      setTimelineBoardSelection(null);
      setTimelineBoardEventDraft(null);
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
    setTimelineYearPickTarget(null);
    setTimelineYearDrag(null);
    setTimelineFilterStartYear(null);
    setTimelineFilterEndYear(null);
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

  const addPerson = (x: number, y: number, overrides: Partial<Person> = {}) => {
    const newPerson: Person = {
      id: overrides.id ?? nanoid(),
      name: overrides.name ?? 'New Person',
      x,
      y,
      gender: overrides.gender ?? 'female',
      partnerships: overrides.partnerships ?? [],
      parentPartnership: overrides.parentPartnership,
      birthParentPartnership: overrides.birthParentPartnership,
      lifeStatus: overrides.lifeStatus ?? 'alive',
      connectionAnchorX: overrides.connectionAnchorX,
      multipleBirthGroupId: overrides.multipleBirthGroupId,
      notes: overrides.notes,
      notesPosition: overrides.notesPosition,
      notesEnabled: overrides.notesEnabled,
      isCoach: overrides.isCoach ?? false,
      events: overrides.events ?? [],
    };
    setPeopleAligned(prev => [...prev, newPerson]);
    return newPerson;
  };

  const addCoach = (x: number, y: number) => {
    const coachCount = people.filter((person) => /^Coach(?:\s+\d+)?$/i.test(person.name || '')).length;
    const coachName = coachCount === 0 ? 'Coach' : `Coach ${coachCount + 1}`;
    return addPerson(x, y, { name: coachName, isCoach: true });
  };

  const addParentsForPerson = (
    person: Person,
    options?: { forceBirthParents?: boolean; parentLabelPrefix?: string; parentSize?: number }
  ) => {
    if (person.birthParentPartnership && person.parentPartnership && options?.forceBirthParents) {
      alert('This person already has a birth-parent linkage.');
      return;
    }
    const verticalOffset = 170;
    const horizontalOffset = 90;
    const fatherX = person.x - horizontalOffset;
    const motherX = person.x + horizontalOffset;
    const parentY = person.y - verticalOffset;
    const partnershipId = nanoid();
    const fatherId = nanoid();
    const motherId = nanoid();
    const prefix = options?.parentLabelPrefix ? `${options.parentLabelPrefix} ` : '';
    const fatherName = `${prefix}Birth Father`.trim();
    const motherName = `${prefix}Birth Mother`.trim();
    const parentPartnership: Partnership = {
      id: partnershipId,
      partner1_id: fatherId,
      partner2_id: motherId,
      horizontalConnectorY: parentY + 70,
      relationshipType: 'dating',
      relationshipStatus: 'ongoing',
      children: [person.id],
      events: [],
    };
    const father: Person = {
      id: fatherId,
      name: fatherName,
      x: fatherX,
      y: parentY,
      gender: 'male',
      size: options?.parentSize,
      partnerships: [partnershipId],
      events: [],
    };
    const mother: Person = {
      id: motherId,
      name: motherName,
      x: motherX,
      y: parentY,
      gender: 'female',
      size: options?.parentSize,
      partnerships: [partnershipId],
      events: [],
    };
    setPartnerships((prev) => [...prev, parentPartnership]);
    setPeopleAligned((prev) =>
      prev
        .map((entry) => {
          if (entry.id !== person.id) return entry;
          const next = { ...entry };
          if (options?.forceBirthParents || !!entry.parentPartnership) {
            next.birthParentPartnership = partnershipId;
            next.adoptionStatus = 'adopted';
          } else {
            next.parentPartnership = partnershipId;
          }
          return next;
        })
        .concat([father, mother])
    );
    setSelectedPeopleIds([fatherId, motherId]);
    setSelectedPartnershipId(partnershipId);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setPropertiesPanelItem(parentPartnership);
  };

  const createChildrenForPartnership = (
    partnershipId: string,
    variant: 'male' | 'female' | 'twins' | 'triplets' | 'miscarriage' | 'stillbirth'
  ) => {
    const partnership = partnerships.find(p => p.id === partnershipId);
    if (!partnership) return;
    const partner1 = people.find(person => person.id === partnership.partner1_id);
    const partner2 = people.find(person => person.id === partnership.partner2_id);
    if (!partner1 || !partner2) return;

    const anchorX = (partner1.x + partner2.x) / 2;
    const baseY = partnership.horizontalConnectorY + 120;
    let count = 1;
    let baseName = 'Child';
    let lifeStatus: Person['lifeStatus'] | undefined = 'alive';

    switch (variant) {
      case 'male':
        baseName = 'Son';
        break;
      case 'female':
        baseName = 'Daughter';
        break;
      case 'twins':
        count = 2;
        baseName = 'Twin';
        break;
      case 'triplets':
        count = 3;
        baseName = 'Triplet';
        break;
      case 'miscarriage':
        baseName = 'Miscarriage';
        lifeStatus = 'miscarriage';
        break;
      case 'stillbirth':
        baseName = 'Stillbirth';
        lifeStatus = 'stillbirth';
        break;
    }

    const spacing = 50;
    const startX = anchorX - ((count - 1) * spacing) / 2;
    const multipleBirthGroupId = count > 1 ? nanoid() : undefined;

    const newChildren: Person[] = Array.from({ length: count }, (_, idx) => ({
      id: nanoid(),
      name: count > 1 ? `${baseName} ${idx + 1}` : baseName,
      x: startX + idx * spacing,
      y: baseY,
      gender:
        variant === 'male'
          ? 'male'
          : variant === 'female'
          ? 'female'
          : idx % 2 === 0
          ? 'female'
          : 'male',
      partnerships: [],
      parentPartnership: partnershipId,
      connectionAnchorX: multipleBirthGroupId ? anchorX : undefined,
      multipleBirthGroupId,
      lifeStatus,
      events: [],
    }));

    const childIds = newChildren.map(child => child.id);
    setPeopleAligned(prev => [...prev, ...newChildren]);
    setPartnerships(prev =>
      prev.map(p => (p.id === partnershipId ? { ...p, children: [...p.children, ...childIds] } : p))
    );
  };

  const createAdoptedChildForPartnership = (partnershipId: string) => {
    const partnership = partnerships.find((p) => p.id === partnershipId);
    if (!partnership) return;
    const partner1 = people.find((person) => person.id === partnership.partner1_id);
    const partner2 = people.find((person) => person.id === partnership.partner2_id);
    if (!partner1 || !partner2) return;
    const anchorX = (partner1.x + partner2.x) / 2;
    const baseY = partnership.horizontalConnectorY + 120;
    const child: Person = {
      id: nanoid(),
      name: 'Adopted Child',
      x: anchorX,
      y: baseY,
      gender: 'female',
      partnerships: [],
      parentPartnership: partnershipId,
      adoptionStatus: 'adopted',
      events: [],
    };
    setPeopleAligned((prev) => [...prev, child]);
    setPartnerships((prev) =>
      prev.map((p) =>
        p.id === partnershipId ? { ...p, children: [...p.children, child.id] } : p
      )
    );
    addParentsForPerson(child, { forceBirthParents: true, parentSize: 30 });
  };

  const removePartnership = (partnershipId: string) => {
    const partnershipToRemove = partnerships.find(p => p.id === partnershipId);
    if (!partnershipToRemove) return;

    setPartnerships(partnerships.filter(p => p.id !== partnershipId));

    setPeopleAligned(prev =>
      prev.map(p => {
        if (p.id === partnershipToRemove.partner1_id || p.id === partnershipToRemove.partner2_id) {
          return { ...p, partnerships: p.partnerships.filter(pid => pid !== partnershipId) };
        }
        if (partnershipToRemove.children.includes(p.id)) {
          const newP = { ...p };
          if (newP.parentPartnership === partnershipId) {
            delete newP.parentPartnership;
            delete newP.connectionAnchorX;
          }
          if (newP.birthParentPartnership === partnershipId) {
            delete newP.birthParentPartnership;
          }
          return newP;
        }
        return p;
      })
    );
    setContextMenu(null);
  };

  const removePerson = (personId: string) => {
    const personToRemove = people.find(p => p.id === personId);
    if (!personToRemove) return;

    const partnershipsToRemove = partnerships.filter(
      (p) => p.partner1_id === personId || p.partner2_id === personId
    ).map((p) => p.id);

    setPartnerships((prev) =>
      prev
        .filter((p) => p.partner1_id !== personId && p.partner2_id !== personId)
        .map((p) => ({ ...p, children: p.children.filter((id) => id !== personId) }))
    );

    const childrenNeedingCleanup = new Set(partnershipsToRemove);
    setPeople((prev) =>
      alignAllAnchors(
        prev
          .filter((p) => p.id !== personId)
          .map((p) => {
            if (p.parentPartnership && childrenNeedingCleanup.has(p.parentPartnership)) {
              const copy = { ...p };
              delete copy.parentPartnership;
              delete copy.connectionAnchorX;
              if (copy.birthParentPartnership && childrenNeedingCleanup.has(copy.birthParentPartnership)) {
                delete copy.birthParentPartnership;
              }
              return copy;
            }
            if (p.birthParentPartnership && childrenNeedingCleanup.has(p.birthParentPartnership)) {
              const copy = { ...p };
              delete copy.birthParentPartnership;
              return copy;
            }
            return p;
          })
      )
    );

    setEmotionalLines((prev) =>
      prev.filter((line) => line.person1_id !== personId && line.person2_id !== personId)
    );
    setTriangles((prev) =>
      prev.filter(
        (triangle) =>
          triangle.person1_id !== personId &&
          triangle.person2_id !== personId &&
          triangle.person3_id !== personId
      )
    );

    if (selectedPeopleIds.includes(personId)) {
      setSelectedPeopleIds(selectedPeopleIds.filter((id) => id !== personId));
    }
    if (propertiesPanelItem?.id === personId) {
      setPropertiesPanelItem(null);
    }
    setContextMenu(null);
  };

  const removeChildFromPartnership = (childId: string, partnershipId: string) => {
    setPartnerships(partnerships.map(p => {
        if (p.id === partnershipId) {
            return { ...p, children: p.children.filter(id => id !== childId) };
        }
        return p;
    }));

    setPeopleAligned(prev =>
      prev.map(p => {
        if (p.id === childId) {
          const newP = { ...p };
          if (newP.parentPartnership === partnershipId) {
            delete newP.parentPartnership;
            delete newP.connectionAnchorX;
          }
          if (newP.birthParentPartnership === partnershipId) {
            delete newP.birthParentPartnership;
          }
          return newP;
        }
        return p;
      })
    );
    setContextMenu(null);
  };

  const handlePersonContextMenu = (e: KonvaEventObject<PointerEvent>, person: Person) => {
      e.evt.preventDefault();
      const isCoachPerson = !!person.isCoach || /^coach(?:\s+\d+)?$/i.test((person.name || '').trim());
      if (!selectedPeopleIds.includes(person.id) || selectedPeopleIds.length === 0) {
        setSelectedPeopleIds([person.id]);
        setPropertiesPanelItem(person);
      }
      setSelectedPartnershipId(null);
      setSelectedEmotionalLineId(null);
      setSelectedChildId(null);
      setSelectedPageNoteId(null);
      setPageNoteDraft(null);

      if (selectedPeopleIds.length === 2 && selectedPeopleIds.includes(person.id)) {
        const [p1_id, p2_id] = selectedPeopleIds;
        setContextMenu({
          x: e.evt.clientX,
          y: e.evt.clientY,
          items: [
            {
              label: 'Timeline',
              onClick: () => {
                setTimelineSelectionIds(selectedPeopleIds);
                setTimelineYearPickTarget(null);
                setTimelineYearDrag(null);
                setTimelineFilterStartYear(null);
                setTimelineFilterEndYear(null);
                setTimelineBoardSelection(null);
                setTimelineBoardEventDraft(null);
                setContextMenu(null);
              },
            },
            {
              label: 'Add Partnership',
              onClick: () => {
                addPartnership();
                setContextMenu(null);
                setSelectedPeopleIds([]);
              },
            },
            {
              label: 'Add Emotional Pattern',
              onClick: () => {
                openAddEmotionalPatternModal(p1_id, p2_id);
                setContextMenu(null);
              },
            },
          ],
        });
        return;
      }
      
      const menuItems = [
          {
              label: `Change sex to ${person.gender === 'male' ? 'female' : 'male'}`,
              onClick: () => {
                  changeSex(person.id);
                  setContextMenu(null);
              }
          },
          {
              label: 'Edit Gender',
              onClick: () => {
                  setContextMenu({
                    x: e.evt.clientX,
                    y: e.evt.clientY,
                    items: [
                      ...GENDER_SYMBOL_OPTIONS.map((option) => ({
                        label: option.label,
                        onClick: () => {
                          handleUpdatePerson(person.id, {
                            gender: option.birthSex,
                            birthSex: option.birthSex,
                            genderIdentity: option.genderIdentity,
                            genderSymbol: option.symbol,
                          });
                          setContextMenu(null);
                        },
                      })),
                      {
                        label: 'Cancel',
                        onClick: () => setContextMenu(null),
                      },
                    ],
                  });
              }
          },
          {
            label: person.notes
              ? person.notesEnabled
                ? 'Hide Note (Use Layer)'
                : 'Show Note'
              : 'No Note',
            onClick: () => {
                if (!person.notes) return;
                handleUpdatePerson(person.id, { notesEnabled: person.notesEnabled ? false : true });
                setContextMenu(null);
            }
          },
          {
            label: 'Properties',
            children: [
              {
                label: 'Name',
                onClick: () => {
                  setSelectedPeopleIds([person.id]);
                  setSelectedPartnershipId(null);
                  setSelectedEmotionalLineId(null);
                  setSelectedChildId(null);
                  openPersonSectionPopup(person, 'name', e.evt.clientX, e.evt.clientY);
                  setContextMenu(null);
                },
              },
              {
                label: 'Dates',
                onClick: () => {
                  setSelectedPeopleIds([person.id]);
                  setSelectedPartnershipId(null);
                  setSelectedEmotionalLineId(null);
                  setSelectedChildId(null);
                  openPersonSectionPopup(person, 'dates', e.evt.clientX, e.evt.clientY);
                  setContextMenu(null);
                },
              },
              {
                label: 'Notes',
                onClick: () => {
                  setSelectedPeopleIds([person.id]);
                  setSelectedPartnershipId(null);
                  setSelectedEmotionalLineId(null);
                  setSelectedChildId(null);
                  openPersonSectionPopup(person, 'notes', e.evt.clientX, e.evt.clientY);
                  setContextMenu(null);
                },
              },
              {
                label: 'Format',
                onClick: () => {
                  setSelectedPeopleIds([person.id]);
                  setSelectedPartnershipId(null);
                  setSelectedEmotionalLineId(null);
                  setSelectedChildId(null);
                  openPersonSectionPopup(person, 'format', e.evt.clientX, e.evt.clientY);
                  setContextMenu(null);
                },
              },
              {
                label: 'Sibling',
                onClick: () => {
                  setSelectedPeopleIds([person.id]);
                  setSelectedPartnershipId(null);
                  setSelectedEmotionalLineId(null);
                  setSelectedChildId(null);
                  openPersonSectionPopup(person, 'sibling', e.evt.clientX, e.evt.clientY);
                  setContextMenu(null);
                },
              },
            ],
          },
          {
            label: 'Make Client',
            onClick: () => {
              setSelectedPeopleIds([person.id]);
              setSelectedPartnershipId(null);
              setSelectedEmotionalLineId(null);
              setSelectedChildId(null);
              setPropertiesPanelItem(person);
              setPropertiesPanelIntent(null);
              openClientProfileModal(person);
              setContextMenu(null);
            }
          },
          {
            label: 'Timeline',
            onClick: () => {
                const nextIds =
                  selectedPeopleIds.length > 1 && selectedPeopleIds.includes(person.id)
                    ? selectedPeopleIds
                    : [person.id];
                setTimelineSelectionIds(nextIds);
                setTimelineYearPickTarget(null);
                setTimelineYearDrag(null);
                setTimelineFilterStartYear(null);
                setTimelineFilterEndYear(null);
                setTimelineBoardSelection(null);
                setTimelineBoardEventDraft(null);
                setContextMenu(null);
            }
          },
          {
            label: 'Add Event...',
            onClick: () => {
              openContextualEventCreator(
                { type: 'person', id: person.id },
                person,
                undefined,
                { x: e.evt.clientX, y: e.evt.clientY }
              );
              setContextMenu(null);
            }
          },
          ...(isCoachPerson
            ? [
                {
                  label: 'Coach Events',
                  onClick: () => {
                    openContextualEventCreator(
                      { type: 'person', id: person.id },
                      person,
                      {
                        eventType: 'EPE',
                        category: 'Coaching',
                        emotionalProcessType: 'coach-event',
                        eventClass: 'emotional-pattern',
                        statusLabel: 'ongoing',
                        intensity: 1,
                        frequency: 1,
                        impact: 1,
                        primaryPersonName: person.name || 'Coach',
                        otherPersonName: 'None',
                      },
                      { x: e.evt.clientX, y: e.evt.clientY }
                    );
                    setContextMenu(null);
                  },
                },
                {
                  label: 'Coach Thinking',
                  onClick: () => {
                    openCoachThinkingModal(person);
                    setContextMenu(null);
                  },
                },
              ]
            : []),
          {
            label: 'Add Partner',
            onClick: () => {
                addPartnerForPerson(person);
                setContextMenu(null);
            }
          },
          {
            label: 'Add Parents',
            onClick: () => {
                addParentsForPerson(person);
                setContextMenu(null);
            }
          }
      ];
      
      if (selectedPeopleIds.length === 3) {
        menuItems.push({
          label: 'Add Triangle',
          onClick: () => {
            addTriangle(selectedPeopleIds);
            setContextMenu(null);
          },
        });
      }

    menuItems.push({
        label: 'Add as Child',
        onClick: () => {
            if (selectedPartnershipId) {
                addChildToPartnership(person.id, selectedPartnershipId);
                setContextMenu(null);
            } else {
                alert('Select a partnership first (click a PRL) before adding this child.');
            }
        }
    });

    menuItems.push({
        label: 'Remove as Child',
        onClick: () => {
            if (person.parentPartnership || person.birthParentPartnership) {
                removeChildFromPartnership(
                  person.id,
                  person.parentPartnership || person.birthParentPartnership!
                );
                setContextMenu(null);
            } else {
                alert('This person is not currently linked as a child.');
            }
        }
    });

      setContextMenu({
          x: e.evt.clientX,
          y: e.evt.clientY,
          items: [
            ...menuItems,
            {
              label: 'Delete Person',
              onClick: () => removePerson(person.id),
            },
          ],
      });
  };


  const handleChildLineContextMenu = (e: KonvaEventObject<PointerEvent>, childId: string, partnershipId: string) => {
    e.evt.preventDefault();
    const child = people.find((person) => person.id === childId);
    if (!child) return;
    setSelectedChildId(childId);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    setPropertiesPanelItem(null);
    setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items: [
            {
                label:
                    child.parentConnectionPattern === 'family-cutoff'
                        ? 'Remove Family Cutoff'
                        : 'Add Family Cutoff',
                onClick: () => {
                    handleUpdatePerson(childId, {
                        parentConnectionPattern:
                            child.parentConnectionPattern === 'family-cutoff' ? 'none' : 'family-cutoff',
                    });
                    setContextMenu(null);
                }
            },
            {
                label: 'Child Properties',
                onClick: () => {
                    setPropertiesPanelItem(child);
                    setContextMenu(null);
                }
            },
            {
                label: 'Remove as Child',
                onClick: () => {
                    removeChildFromPartnership(childId, partnershipId);
                    setContextMenu(null);
                }
            },
            {
                label: 'Delete Child',
                onClick: () => {
                    removeChildFromPartnership(childId, partnershipId);
                    removePerson(childId);
                }
            },
        ]
    });
  };

  const handlePartnershipContextMenu = (e: KonvaEventObject<PointerEvent>, partnershipId: string) => {
    e.evt.preventDefault();
    const partnership = partnerships.find(p => p.id === partnershipId);
    if (!partnership) return;

    setSelectedPartnershipId(partnershipId);
    setSelectedPeopleIds([]);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    setPropertiesPanelItem(partnership);

    setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items: [
            {
                label: 'Add Child',
                children: [
                  {
                    label: 'Add Male',
                    onClick: () => {
                      createChildrenForPartnership(partnershipId, 'male');
                      setContextMenu(null);
                    },
                  },
                  {
                    label: 'Add Female',
                    onClick: () => {
                      createChildrenForPartnership(partnershipId, 'female');
                      setContextMenu(null);
                    },
                  },
                  {
                    label: 'Twins',
                    onClick: () => {
                      createChildrenForPartnership(partnershipId, 'twins');
                      setContextMenu(null);
                    },
                  },
                  {
                    label: 'Triplets',
                    onClick: () => {
                      createChildrenForPartnership(partnershipId, 'triplets');
                      setContextMenu(null);
                    },
                  },
                  {
                    label: 'Miscarriage',
                    onClick: () => {
                      createChildrenForPartnership(partnershipId, 'miscarriage');
                      setContextMenu(null);
                    },
                  },
                  {
                    label: 'Stillbirth',
                    onClick: () => {
                      createChildrenForPartnership(partnershipId, 'stillbirth');
                      setContextMenu(null);
                    },
                  },
                  {
                    label: 'Adopted',
                    onClick: () => {
                      createAdoptedChildForPartnership(partnershipId);
                      setContextMenu(null);
                    },
                  },
                ]
            },
            {
              label: partnership.notes
                ? partnership.notesEnabled
                  ? 'Hide Note (Use Layer)'
                  : 'Show Note'
                : 'No Note',
              onClick: () => {
                  if (!partnership.notes) return;
                  handleUpdatePartnership(partnershipId, { notesEnabled: partnership.notesEnabled ? false : true });
                  setContextMenu(null);
              }
            },
            {
              label: 'Relationship Properties',
              children: relationshipTypes.map((relationshipType) => ({
                label: relationshipType.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
                onClick: () => {
                  openPartnershipSectionPopup(
                    partnership,
                    relationshipType,
                    e.evt.clientX,
                    e.evt.clientY
                  );
                  setContextMenu(null);
                },
              })),
            },
            {
              label: 'Add Relationship Event',
              onClick: () => {
                openContextualEventCreator(
                  { type: 'partnership', id: partnershipId },
                  partnership,
                  undefined,
                  { x: e.evt.clientX, y: e.evt.clientY }
                );
                setContextMenu(null);
              }
            },
            {
              label: 'Delete Partnership',
              onClick: () => removePartnership(partnershipId)
            },
        ]
    });
  };

  const handleStageContextMenu = (e: KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    if (e.target !== e.target.getStage()) {
        return;
    }
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;
    const canvasPoint = toCanvasPoint(pointerPosition);

    const baseItems = [
        {
            label: 'Add Person',
            onClick: () => {
                addPerson(canvasPoint.x, canvasPoint.y);
                setContextMenu(null);
            }
        },
        {
            label: 'Add Coach',
            onClick: () => {
                addCoach(canvasPoint.x, canvasPoint.y);
                setContextMenu(null);
            }
        },
        {
            label: 'Add Event...',
            onClick: () => {
                const selectedId =
                  selectedPeopleIds.length === 1 ? selectedPeopleIds[0] : null;
                let targetPerson = selectedId
                  ? people.find((person) => person.id === selectedId)
                  : undefined;

                if (!targetPerson) {
                  const defaultName = people[0]?.name || '';
                  const userName = prompt(
                    'Add event for which person? Enter name exactly.',
                    defaultName
                  );
                  if (!userName) {
                    setContextMenu(null);
                    return;
                  }
                  const lookup = userName.trim().toLowerCase();
                  targetPerson = people.find(
                    (person) => (person.name || '').trim().toLowerCase() === lookup
                  );
                }
                if (!targetPerson) {
                  alert('Person not found. Select one person first or enter an exact name.');
                  setContextMenu(null);
                  return;
                }
                openContextualEventCreator(
                  { type: 'person', id: targetPerson.id },
                  targetPerson,
                  undefined,
                  { x: e.evt.clientX, y: e.evt.clientY }
                );
                setContextMenu(null);
            }
        },
        {
            label: 'Add General Note',
            onClick: () => {
                addGeneralNote(canvasPoint.x, canvasPoint.y);
                setContextMenu(null);
            }
        },
    ];

    if (selectedPeopleIds.length === 1) {
      const selectedPerson = people.find((person) => person.id === selectedPeopleIds[0]);
      if (selectedPerson) {
        baseItems.push({
          label: 'Add Partner',
          onClick: () => {
            addPartnerForPerson(selectedPerson);
            setContextMenu(null);
          },
        });
      }
    }

    setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items: baseItems
    });
  };


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

  const handlePersonDragStart = (personId: string, x: number, y: number) => {
    if (!selectedPeopleIds.includes(personId) || selectedPeopleIds.length < 2) {
      dragGroupRef.current = null;
      return;
    }

    const selectedIds = [...selectedPeopleIds];
    const peopleMap = new Map<string, { x: number; y: number; notesPosition?: { x: number; y: number } }>();
    for (const person of people) {
      if (selectedIds.includes(person.id)) {
        peopleMap.set(person.id, {
          x: person.x,
          y: person.y,
          notesPosition: person.notesPosition ? { ...person.notesPosition } : undefined,
        });
      }
    }

    const partnershipsMap = new Map<string, { horizontalConnectorY: number; notesPosition?: { x: number; y: number } }>();
    for (const partnership of partnerships) {
      if (selectedIds.includes(partnership.partner1_id) && selectedIds.includes(partnership.partner2_id)) {
        partnershipsMap.set(partnership.id, {
          horizontalConnectorY: partnership.horizontalConnectorY,
          notesPosition: partnership.notesPosition ? { ...partnership.notesPosition } : undefined,
        });
      }
    }

    const emotionalLinesMap = new Map<string, { notesPosition?: { x: number; y: number } }>();
    for (const emotionalLine of allEmotionalLines) {
      if (selectedIds.includes(emotionalLine.person1_id) && selectedIds.includes(emotionalLine.person2_id)) {
        emotionalLinesMap.set(emotionalLine.id, {
          notesPosition: emotionalLine.notesPosition ? { ...emotionalLine.notesPosition } : undefined,
        });
      }
    }

    dragGroupRef.current = {
      personId,
      startX: x,
      startY: y,
      selectedIds,
      people: peopleMap,
      partnerships: partnershipsMap,
      emotionalLines: emotionalLinesMap,
    };
  };

  const handlePersonDrag = (personId: string, x: number, y: number) => {
    const dragGroup = dragGroupRef.current;
    if (dragGroup && dragGroup.personId === personId) {
      const dx = x - dragGroup.startX;
      const dy = y - dragGroup.startY;

      setPeopleAligned((prev) =>
        prev.map((person) => {
          const base = dragGroup.people.get(person.id);
          if (!base) return person;
          return {
            ...person,
            x: base.x + dx,
            y: base.y + dy,
            notesPosition: base.notesPosition
              ? { x: base.notesPosition.x + dx, y: base.notesPosition.y + dy }
              : person.notesPosition,
          };
        })
      );

      setPartnerships((prev) =>
        prev.map((partnership) => {
          const base = dragGroup.partnerships.get(partnership.id);
          if (!base) return partnership;
          return {
            ...partnership,
            horizontalConnectorY: base.horizontalConnectorY + dy,
            notesPosition: base.notesPosition
              ? { x: base.notesPosition.x + dx, y: base.notesPosition.y + dy }
              : partnership.notesPosition,
          };
        })
      );

      setEmotionalLines((prev) =>
        prev.map((line) => {
          const base = dragGroup.emotionalLines.get(line.id);
          if (!base) return line;
          return {
            ...line,
            notesPosition: base.notesPosition
              ? { x: base.notesPosition.x + dx, y: base.notesPosition.y + dy }
              : line.notesPosition,
          };
        })
      );
      setTriangles((prev) =>
        prev.map((triangle) => {
          if (!triangle.tpls?.length) return triangle;
          let changed = false;
          const nextTpls = triangle.tpls.map((tpl) => {
            const base = dragGroup.emotionalLines.get(tpl.id);
            if (!base) return tpl;
            changed = true;
            return {
              ...tpl,
              notesPosition: base.notesPosition
                ? { x: base.notesPosition.x + dx, y: base.notesPosition.y + dy }
                : tpl.notesPosition,
            };
          });
          return changed ? { ...triangle, tpls: nextTpls } : triangle;
        })
      );
      return;
    }

    setPeopleAligned((prev) =>
      prev.map((person) => (person.id === personId ? { ...person, x, y } : person))
    );
  };

  const handleHorizontalConnectorDragEnd = (partnershipId: string, y: number) => {
    setPartnerships(
      partnerships.map((p) =>
        p.id === partnershipId ? { ...p, horizontalConnectorY: y } : p
      )
    );
  };

  const handlePersonNoteDragEnd = (personId: string, x: number, y: number) => {
    setPeopleAligned((prev) =>
      prev.map((person) =>
        person.id === personId ? { ...person, notesPosition: { x, y } } : person
      )
    );
  };

  const handlePersonNoteResizeEnd = (personId: string, width: number, height: number) => {
    setPeopleAligned((prev) =>
      prev.map((person) =>
        person.id === personId ? { ...person, notesSize: { width, height } } : person
      )
    );
  };

  const handlePartnershipNoteDragEnd = (partnershipId: string, x: number, y: number) => {
    setPartnerships(
      partnerships.map((p) =>
        p.id === partnershipId ? { ...p, notesPosition: { x, y } } : p
      )
    );
  };

  const handlePartnershipNoteResizeEnd = (partnershipId: string, width: number, height: number) => {
    setPartnerships(
      partnerships.map((p) =>
        p.id === partnershipId ? { ...p, notesSize: { width, height } } : p
      )
    );
  };

  const handleEmotionalLineNoteDragEnd = (emotionalLineId: string, x: number, y: number) => {
    setEmotionalLines((prev) =>
      prev.map((el) => (el.id === emotionalLineId ? { ...el, notesPosition: { x, y } } : el))
    );
    setTriangles((prev) =>
      prev.map((triangle) => {
        if (!triangle.tpls?.length) return triangle;
        let changed = false;
        const nextTpls = triangle.tpls.map((tpl) => {
          if (tpl.id !== emotionalLineId) return tpl;
          changed = true;
          return { ...tpl, notesPosition: { x, y } };
        });
        return changed ? { ...triangle, tpls: nextTpls } : triangle;
      })
    );
  };

  const handleEmotionalLineNoteResizeEnd = (emotionalLineId: string, width: number, height: number) => {
    setEmotionalLines((prev) =>
      prev.map((el) => (el.id === emotionalLineId ? { ...el, notesSize: { width, height } } : el))
    );
    setTriangles((prev) =>
      prev.map((triangle) => {
        if (!triangle.tpls?.length) return triangle;
        let changed = false;
        const nextTpls = triangle.tpls.map((tpl) => {
          if (tpl.id !== emotionalLineId) return tpl;
          changed = true;
          return { ...tpl, notesSize: { width, height } };
        });
        return changed ? { ...triangle, tpls: nextTpls } : triangle;
      })
    );
  };

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

  const handlePageNoteSelect = (noteId: string) => {
    const note = pageNotes.find((entry) => entry.id === noteId);
    if (!note) return;
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setPropertiesPanelItem(null);
    setSelectedPageNoteId(noteId);
    setPageNoteDraft({
      title: note.title,
      text: note.text,
      fillColor: note.fillColor || '#fff8c6',
    });
  };

  const handlePageNoteDraftChange = (
    field: 'title' | 'text' | 'fillColor',
    value: string
  ) => {
    setPageNoteDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handlePageNoteSave = () => {
    if (!selectedPageNoteId || !pageNoteDraft) return;
    setPageNotes((prev) =>
      prev.map((note) =>
        note.id === selectedPageNoteId
          ? {
              ...note,
              title: pageNoteDraft.title || 'General Note',
              text: pageNoteDraft.text,
              fillColor: pageNoteDraft.fillColor,
            }
          : note
      )
    );
  };

  const handlePageNoteDelete = (noteId: string) => {
    setPageNotes((prev) => prev.filter((note) => note.id !== noteId));
    if (selectedPageNoteId === noteId) {
      setSelectedPageNoteId(null);
      setPageNoteDraft(null);
    }
  };

  const handlePageNoteDragEnd = (noteId: string, x: number, y: number) => {
    setPageNotes((prev) =>
      prev.map((note) => (note.id === noteId ? { ...note, x, y } : note))
    );
  };

  const handlePageNoteResizeEnd = (noteId: string, width: number, height: number) => {
    setPageNotes((prev) =>
      prev.map((note) => (note.id === noteId ? { ...note, width, height } : note))
    );
  };



  const handleChildLineSelect = (childId: string) => {
    setSelectedChildId(childId);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedEmotionalLineId(null);
    setPropertiesPanelItem(null);
  };

  const handleEmotionalLineSelect = (emotionalLineId: string) => {
    if (selectedEmotionalLineId === emotionalLineId) {
        setSelectedEmotionalLineId(null);
        setPropertiesPanelItem(null); // also clear the properties panel
        return;
    }
    
    if (selectedPeopleIds.length > 0 || selectedPartnershipId) {
        setSelectedPeopleIds([]);
        setSelectedPartnershipId(null);
    }
    setSelectedEmotionalLineId(emotionalLineId);
    setSelectedChildId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);

    const selectedLine = allEmotionalLines.find(el => el.id === emotionalLineId);
    if (selectedLine) {
        setPropertiesPanelItem(selectedLine);
    }
  };


  const handleEmotionalLineContextMenu = (e: KonvaEventObject<PointerEvent>, emotionalLineId: string) => {
    e.evt.preventDefault();
    setSelectedEmotionalLineId(emotionalLineId);
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedChildId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    const emotionalLine = allEmotionalLines.find(el => el.id === emotionalLineId);
    if (!emotionalLine) return;
    const parentTriangleId = triangleByTplLineId.get(emotionalLineId);
    const items = [
      {
        label: emotionalLine.notes
          ? emotionalLine.notesEnabled
            ? 'Hide Note (Use Layer)'
            : 'Show Note'
          : 'No Note',
        onClick: () => {
            if (!emotionalLine.notes) return;
            handleUpdateEmotionalLine(emotionalLineId, { notesEnabled: emotionalLine.notesEnabled ? false : true });
            setContextMenu(null);
        }
      },
      {
        label: 'Properties',
        onClick: () => {
            setPropertiesPanelItem(emotionalLine);
            setContextMenu(null);
        }
      },
      {
        label: 'Add Event...',
        onClick: () => {
          openContextualEventCreator(
            { type: 'emotional', id: emotionalLineId },
            emotionalLine,
            {
              eventType: 'EPE',
              emotionalProcessType: emotionalLine.relationshipType,
              category: 'Emotional Pattern',
            },
            { x: e.evt.clientX, y: e.evt.clientY }
          );
          setContextMenu(null);
        }
      },
    ];

    items.push({
      label: parentTriangleId ? 'Delete Triangle' : 'Delete Emotional Line',
      onClick: () =>
        parentTriangleId ? removeTriangle(parentTriangleId) : removeEmotionalLine(emotionalLineId),
    });

    setContextMenu({
        x: e.evt.clientX,
        y: e.evt.clientY,
        items
    });
  };

  const handleTriangleAreaSelect = (triangleId: string) => {
    const triangle = triangles.find((item) => item.id === triangleId);
    const firstTpl = triangle?.tpls?.[0];
    if (!firstTpl) return;
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedChildId(null);
    setSelectedEmotionalLineId(firstTpl.id);
    setPropertiesPanelItem(firstTpl);
  };

  const handleTriangleAreaContextMenu = (
    e: KonvaEventObject<PointerEvent>,
    triangleId: string
  ) => {
    e.evt.preventDefault();
    const triangle = triangles.find((item) => item.id === triangleId);
    const firstTpl = triangle?.tpls?.[0];
    if (!firstTpl) return;
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setSelectedChildId(null);
    setSelectedEmotionalLineId(firstTpl.id);
    setPropertiesPanelItem(firstTpl);
    setContextMenu({
      x: e.evt.clientX,
      y: e.evt.clientY,
      items: [
        {
          label: 'Properties',
          onClick: () => {
            setPropertiesPanelItem(firstTpl);
            setContextMenu(null);
          },
        },
        {
          label: 'Delete Triangle',
          onClick: () => removeTriangle(triangleId),
        },
      ],
    });
  };

  const handleSelect = (personId: string, additive: boolean) => {
    const selectedPerson = people.find((person) => person.id === personId);
    if (!selectedPerson) return;

    if (!additive && selectedPartnershipId) {
      const selectedPartnership = partnerships.find((p) => p.id === selectedPartnershipId);
      if (selectedPartnership) {
        const isPartner =
          selectedPartnership.partner1_id === personId ||
          selectedPartnership.partner2_id === personId;
        if (!isPartner) {
          addChildToPartnership(personId, selectedPartnershipId);
          return;
        }
      }
    }

    if (additive) {
      const alreadySelected = selectedPeopleIds.includes(personId);
      const next = alreadySelected
        ? selectedPeopleIds.filter((id) => id !== personId)
        : [...selectedPeopleIds, personId];
      setSelectedPeopleIds(next);
      setSelectedEmotionalLineId(null);
      setSelectedPartnershipId(null);
      setSelectedChildId(null);
      setSelectedPageNoteId(null);
      setPageNoteDraft(null);
      setPropertiesPanelItem(next.length === 1 ? selectedPerson : null);
      return;
    }

    setSelectedEmotionalLineId(null);
    setSelectedPartnershipId(null);
    setSelectedChildId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    setSelectedPeopleIds([personId]);
    setPropertiesPanelItem(selectedPerson);
  };

  const handlePartnershipSelect = (partnershipId: string) => {
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setSelectedPageNoteId(null);
    setPageNoteDraft(null);
    if (selectedPartnershipId === partnershipId) {
        setSelectedPartnershipId(null);
        setPropertiesPanelItem(null);
    } else {
        setSelectedPartnershipId(partnershipId);
        setSelectedPeopleIds([]);
        const selectedPartnership = partnerships.find((p) => p.id === partnershipId);
        if (selectedPartnership) {
          setPropertiesPanelItem(selectedPartnership);
        }
    }
  };

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

      type TimelineBlockItem = {
        id: string;
        label: string;
        detail?: string;
        notes?: string;
        startDate: string;
        endDate?: string;
        color: string;
        entityType: 'person' | 'partnership' | 'emotional';
        entityId: string;
        eventId?: string;
      };
      type TimelineLane = { id: string; label: string; items: TimelineBlockItem[] };
      const parseTimelineDate = (value?: string) => {
        if (!value) return null;
        const ts = Date.parse(value);
        return Number.isNaN(ts) ? null : ts;
      };
      const selectedTimelinePeople = people.filter((person) => timelineSelectionIds.includes(person.id));
      const timelineLanes = (() => {
        if (!selectedTimelinePeople.length) return [] as TimelineLane[];
        const lanes: TimelineLane[] = [];
        const selectedIdSet = new Set(selectedTimelinePeople.map((person) => person.id));
        const familyItems: TimelineBlockItem[] = [];
        partnerships.forEach((partnership) => {
          if (!selectedIdSet.has(partnership.partner1_id) && !selectedIdSet.has(partnership.partner2_id)) return;
          if (partnership.relationshipStartDate) {
            const partner1 = people.find((p) => p.id === partnership.partner1_id)?.name || 'Partner 1';
            const partner2 = people.find((p) => p.id === partnership.partner2_id)?.name || 'Partner 2';
            familyItems.push({
              id: `family-prl-${partnership.id}`,
              label: `${partner1} + ${partner2}`,
              detail: partnership.relationshipType,
              notes: partnership.notes,
              startDate: partnership.relationshipStartDate,
              endDate: partnership.divorceDate || partnership.separationDate,
              color: '#dce8ff',
              entityType: 'partnership',
              entityId: partnership.id,
            });
          }
          (partnership.events || []).forEach((event) => {
            if (!event.date) return;
            familyItems.push({
              id: `family-prl-event-${event.id}`,
              label: event.category || 'Relationship Event',
              detail: event.observations || '',
              notes: event.observations || '',
              startDate: event.date,
              color: '#dce8ff',
              entityType: 'partnership',
              entityId: partnership.id,
              eventId: event.id,
            });
          });
        });
        if (familyItems.length) {
          lanes.push({ id: 'family', label: 'Family', items: familyItems });
        }

        selectedTimelinePeople.forEach((person) => {
          const items: TimelineBlockItem[] = [];
          if (person.birthDate) {
            items.push({
              id: `person-birth-${person.id}`,
              label: 'Birth',
              detail: person.birthDate,
              notes: person.notes,
              startDate: person.birthDate,
              color: '#d5f0ff',
              entityType: 'person',
              entityId: person.id,
            });
          }
          if (person.deathDate) {
            items.push({
              id: `person-death-${person.id}`,
              label: 'Death',
              detail: person.deathDate,
              notes: person.notes,
              startDate: person.deathDate,
              color: '#ffd9d9',
              entityType: 'person',
              entityId: person.id,
            });
          }
          (person.events || []).forEach((event) => {
            if (!event.date) return;
            items.push({
              id: `person-event-${event.id}`,
              label: event.category || 'Event',
              detail: event.observations || event.otherPersonName || '',
              notes: event.observations || '',
              startDate: event.date,
              color: '#e8f3ff',
              entityType: 'person',
              entityId: person.id,
              eventId: event.id,
            });
          });
          partnerships
            .filter((p) => p.partner1_id === person.id || p.partner2_id === person.id)
            .forEach((partnership) => {
              if (partnership.relationshipStartDate) {
                const otherId = partnership.partner1_id === person.id ? partnership.partner2_id : partnership.partner1_id;
                const otherName = people.find((p) => p.id === otherId)?.name || 'Partner';
                items.push({
                  id: `person-prl-${partnership.id}-${person.id}`,
                  label: `${otherName}`,
                  detail: partnership.relationshipType,
                  notes: partnership.notes,
                  startDate: partnership.relationshipStartDate,
                  endDate: partnership.divorceDate || partnership.separationDate,
                  color: '#f0efff',
                  entityType: 'partnership',
                  entityId: partnership.id,
                });
              }
            });
          allEmotionalLines
            .filter((line) => line.person1_id === person.id || line.person2_id === person.id)
            .forEach((line) => {
              if (!line.startDate) return;
              const otherId = line.person1_id === person.id ? line.person2_id : line.person1_id;
              const otherName = people.find((p) => p.id === otherId)?.name || 'Other';
              items.push({
                id: `person-epl-${line.id}-${person.id}`,
                label: `${line.relationshipType} · ${otherName}`,
                detail: line.lineStyle,
                notes: line.notes,
                startDate: line.startDate,
                color: '#ffe8f0',
                entityType: 'emotional',
                entityId: line.id,
              });
            });
          lanes.push({ id: person.id, label: person.name || 'Unnamed', items });
        });
        return lanes;
      })();
      const handleTimelineItemClick = (laneLabel: string, item: TimelineBlockItem) => {
        setTimelineHoverNote(null);
        const existingEvent =
          item.eventId && item.entityType === 'person'
            ? people
                .find((entry) => entry.id === item.entityId)
                ?.events?.find((entry) => entry.id === item.eventId)
            : item.eventId && item.entityType === 'partnership'
            ? partnerships
                .find((entry) => entry.id === item.entityId)
                ?.events?.find((entry) => entry.id === item.eventId)
            : item.eventId
            ? allEmotionalLines
                .find((entry) => entry.id === item.entityId)
                ?.events?.find((entry) => entry.id === item.eventId)
            : undefined;
        setTimelineBoardSelection({
          laneLabel,
          entityType: item.entityType,
          entityId: item.entityId,
          eventId: item.eventId,
          itemLabel: item.label,
          startDate: item.startDate,
          endDate: item.endDate,
        });
        if (existingEvent) {
          setTimelineBoardEventDraft({
            event: { ...existingEvent },
            original: { ...existingEvent },
            isNew: false,
          });
        } else {
          setTimelineBoardEventDraft(null);
        }
      };
      const setTimelineEventDraftField = (
        field: 'date' | 'category' | 'observations',
        value: string
      ) => {
        setTimelineBoardEventDraft((prev) =>
          prev
            ? {
                ...prev,
                event: {
                  ...prev.event,
                  date: field === 'date' ? value : prev.event.date,
                  category: field === 'category' ? value : prev.event.category,
                  observations: field === 'observations' ? value : prev.event.observations,
                },
              }
            : prev
        );
      };
      const saveTimelineEventDraft = () => {
        if (!timelineBoardSelection || !timelineBoardEventDraft) return;
        const draft: EmotionalProcessEvent = {
          ...timelineBoardEventDraft.event,
          date: timelineBoardEventDraft.event.date || new Date().toISOString().slice(0, 10),
        };
        if (timelineBoardSelection.entityType === 'person') {
          const person = people.find((entry) => entry.id === timelineBoardSelection.entityId);
          if (!person) return;
          const nextEvents = timelineBoardEventDraft.isNew
            ? [...(person.events || []), draft]
            : (person.events || []).map((event) => (event.id === draft.id ? draft : event));
          handleUpdatePerson(person.id, { events: nextEvents });
        } else if (timelineBoardSelection.entityType === 'partnership') {
          const partnership = partnerships.find((entry) => entry.id === timelineBoardSelection.entityId);
          if (!partnership) return;
          const nextEvents = timelineBoardEventDraft.isNew
            ? [...(partnership.events || []), draft]
            : (partnership.events || []).map((event) => (event.id === draft.id ? draft : event));
          handleUpdatePartnership(partnership.id, { events: nextEvents });
        } else {
          const line = allEmotionalLines.find((entry) => entry.id === timelineBoardSelection.entityId);
          if (!line) return;
          const nextEvents = timelineBoardEventDraft.isNew
            ? [...(line.events || []), draft]
            : (line.events || []).map((event) => (event.id === draft.id ? draft : event));
          handleUpdateEmotionalLine(line.id, { events: nextEvents });
        }
        setTimelineBoardSelection((prev) =>
          prev
            ? {
                ...prev,
                eventId: draft.id,
                itemLabel: draft.category || prev.itemLabel,
                startDate: draft.date || prev.startDate,
              }
            : prev
        );
        setTimelineBoardEventDraft({
          event: { ...draft },
          original: { ...draft },
          isNew: false,
        });
        if (draft.date) {
          const savedYear = new Date(draft.date).getUTCFullYear();
          if (Number.isFinite(savedYear)) {
            if (selectedStartYear != null && savedYear < selectedStartYear) {
              setTimelineFilterStartYear(savedYear);
            }
            if (selectedEndYear != null && savedYear > selectedEndYear) {
              setTimelineFilterEndYear(savedYear);
            }
          }
        }
      };
      const cancelTimelineEventDraft = () => {
        if (!timelineBoardEventDraft) return;
        if (timelineBoardEventDraft.isNew) {
          setTimelineBoardSelection((prev) => (prev ? { ...prev, eventId: undefined } : prev));
          setTimelineBoardEventDraft(null);
          return;
        }
        if (timelineBoardEventDraft.original) {
          setTimelineBoardEventDraft({
            event: { ...timelineBoardEventDraft.original },
            original: { ...timelineBoardEventDraft.original },
            isNew: false,
          });
        }
      };
      const handleTimelinePersonPropertyChange = (
        field: 'name' | 'notes',
        value: string
      ) => {
        if (!timelineBoardSelection || timelineBoardSelection.entityType !== 'person') return;
        const person = people.find((entry) => entry.id === timelineBoardSelection.entityId);
        if (!person) return;
        if (field === 'name') {
          handleUpdatePerson(person.id, { name: value });
        } else {
          handleUpdatePerson(person.id, { notes: value });
        }
      };
      const addTimelineEventToSelectedPerson = () => {
        if (!timelineBoardSelection || timelineBoardSelection.entityType !== 'person') return;
        const person = people.find((entry) => entry.id === timelineBoardSelection.entityId);
        if (!person) return;
        const newEvent: EmotionalProcessEvent = {
          id: nanoid(),
          date: new Date().toISOString().slice(0, 10),
          category: eventCategories[0] || 'Event',
          statusLabel: '',
          intensity: 0,
          frequency: 0,
          impact: 0,
          howWell: 5,
          otherPersonName: '',
          primaryPersonName: person.name || '',
          wwwwh: '',
          observations: '',
          priorEventsNote: '',
          reflectionsNote: '',
          isNodalEvent: false,
          createdAt: Date.now(),
          eventClass: 'individual',
        };
        setTimelineBoardSelection({
          laneLabel: person.name || timelineBoardSelection.laneLabel,
          entityType: 'person',
          entityId: person.id,
          eventId: newEvent.id,
          itemLabel: newEvent.category,
          startDate: newEvent.date,
        });
        setTimelineBoardEventDraft({
          event: { ...newEvent },
          original: null,
          isNew: true,
        });
      };
      const timelineSelectionResolved: {
        person?: Person;
        partnership?: Partnership;
        line?: EmotionalLine;
        event?: EmotionalProcessEvent;
      } | null = (() => {
        if (!timelineBoardSelection) return null;
        if (timelineBoardSelection.entityType === 'person') {
          const person = people.find((entry) => entry.id === timelineBoardSelection.entityId);
          const event = timelineBoardSelection.eventId
            ? person?.events?.find((entry) => entry.id === timelineBoardSelection.eventId)
            : undefined;
          return { person, event };
        }
        if (timelineBoardSelection.entityType === 'partnership') {
          const partnership = partnerships.find((entry) => entry.id === timelineBoardSelection.entityId);
          const event = timelineBoardSelection.eventId
            ? partnership?.events?.find((entry) => entry.id === timelineBoardSelection.eventId)
            : undefined;
          return { partnership, event };
        }
        const line = allEmotionalLines.find((entry) => entry.id === timelineBoardSelection.entityId);
        const event = timelineBoardSelection.eventId
          ? line?.events?.find((entry) => entry.id === timelineBoardSelection.eventId)
          : undefined;
        return { line, event };
      })();
      const timelineRange = (() => {
        const points: number[] = [];
        timelineLanes.forEach((lane) => {
          lane.items.forEach((item) => {
            const start = parseTimelineDate(item.startDate);
            const end = parseTimelineDate(item.endDate || item.startDate);
            if (start != null) points.push(start);
            if (end != null) points.push(end);
          });
        });
        if (!points.length) return null;
        let min = Math.min(...points);
        let max = Math.max(...points);
        if (min === max) {
          const oneYear = 365 * 24 * 60 * 60 * 1000;
          min -= oneYear;
          max += oneYear;
        }
        return { min, max };
      })();
      const timelineYearBoundsForFilter = (() => {
        if (!timelineRange) return null;
        return {
          min: new Date(timelineRange.min).getUTCFullYear(),
          max: new Date(timelineRange.max).getUTCFullYear(),
        };
      })();
      const selectedStartYear = timelineYearBoundsForFilter
        ? Math.min(
            Math.max(
              timelineFilterStartYear ?? timelineYearBoundsForFilter.min,
              timelineYearBoundsForFilter.min
            ),
            timelineYearBoundsForFilter.max
          )
        : null;
      const selectedEndYear = timelineYearBoundsForFilter
        ? Math.max(
            Math.min(
              timelineFilterEndYear ?? timelineYearBoundsForFilter.max,
              timelineYearBoundsForFilter.max
            ),
            selectedStartYear ?? timelineYearBoundsForFilter.min
          )
        : null;
      const timelineDisplayRange =
        selectedStartYear != null && selectedEndYear != null
          ? {
              min: Date.UTC(selectedStartYear, 0, 1),
              max: Date.UTC(selectedEndYear, 11, 31, 23, 59, 59, 999),
            }
          : timelineRange;
      const timelineYearSlices = (() => {
        if (!timelineDisplayRange || selectedStartYear == null || selectedEndYear == null) {
          return [] as Array<{ year: number; leftPct: number; widthPct: number }>;
        }
        const slices: Array<{ year: number; leftPct: number; widthPct: number }> = [];
        for (let year = selectedStartYear; year <= selectedEndYear; year += 1) {
          const startTs = Date.UTC(year, 0, 1);
          const endTs = Date.UTC(year + 1, 0, 1);
          const leftPct =
            ((startTs - timelineDisplayRange.min) / (timelineDisplayRange.max - timelineDisplayRange.min)) *
            100;
          const widthPct =
            ((endTs - startTs) / (timelineDisplayRange.max - timelineDisplayRange.min)) * 100;
          slices.push({ year, leftPct, widthPct });
        }
        return slices;
      })();
      const timelineHasVisibleItems = (() => {
        if (!timelineDisplayRange) return false;
        return timelineLanes.some((lane) =>
          lane.items.some((item) => {
            const startTs = parseTimelineDate(item.startDate);
            const endTs = parseTimelineDate(item.endDate || item.startDate);
            if (startTs == null || endTs == null) return false;
            return endTs >= timelineDisplayRange.min && startTs <= timelineDisplayRange.max;
          })
        );
      })();
      const sparseYearLabels =
        selectedStartYear != null && selectedEndYear != null
          ? selectedEndYear - selectedStartYear + 1 > 25
          : false;
      const shouldShowYearLabel = (year: number) => {
        if (!sparseYearLabels) return true;
        if (year === selectedStartYear || year === selectedEndYear) return true;
        return year % 5 === 0;
      };
      const applyPickedYear = (year: number) => {
        if (selectedStartYear == null || selectedEndYear == null) return;
        if (timelineYearPickTarget === 'end') {
          setTimelineFilterEndYear(Math.max(year, selectedStartYear));
          return;
        }
        setTimelineFilterStartYear(Math.min(year, selectedEndYear));
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
      const now = Date.now();
      const saveVisualState = getSaveButtonState(isDirty, lastDirtyTimestamp, now);
      const shouldBlinkSave = saveVisualState === 'critical';
      const blinkOn = shouldBlinkSave ? Math.floor(now / 600) % 2 === 0 : false;
      const isSaveDirty = saveVisualState !== 'clean';
      const ribbonButtonHeight = 40;
      const saveButtonStyle: React.CSSProperties = {
        backgroundColor: isSaveDirty
          ? blinkOn
            ? '#ff5252'
            : '#c62828'
          : '#1976d2',
        color: '#fff',
        border: 'none',
        borderRadius: 4,
        minHeight: ribbonButtonHeight,
        padding: '4px 10px',
        fontWeight: 600,
        boxShadow: isSaveDirty ? '0 0 0 2px rgba(198,40,40,0.35)' : 'none',
        cursor: 'pointer',
      };
      const ribbonButtonStyle: React.CSSProperties = {
        minHeight: ribbonButtonHeight,
        padding: '4px 10px',
        borderRadius: 4,
        border: '1px solid #b0b0b0',
        background: '#fff',
        cursor: 'pointer',
      };
      const fileMenuItems = [
        { label: 'New', action: handleNewFile },
        { label: 'Load Demo Diagram', action: handleLoadDemoDiagram },
        { label: 'Open', action: handleOpenFilePicker },
        { label: 'Import Data', action: handleImportDataPicker },
        { label: 'Import Person Events', action: handleImportPersonEventsPicker },
        { label: 'Save', action: () => handleSave(false) },
        { label: 'Save As', action: handleSaveAs },
        { label: 'Restore Backup', action: () => void handleOpenBackupRestore() },
        { label: 'Export Person Events', action: handleExportPersonEvents },
        { label: 'Export PNG', action: handleExportPNG },
        { label: 'Export SVG', action: handleExportSVG },
        { label: 'Quit', action: handleQuit },
      ];
      const optionsMenuItems = [
        { label: 'Transcripts', action: handleProcessTranscriptPicker },
        { label: 'Voice Input', action: () => setVoiceInputOpen(true) },
        { label: 'Timeline Event Creator', action: handleOpenEventCreator },
        { label: 'Ideas', action: () => setIdeasOpen(true) },
        { label: 'Session Notes', action: () => setSessionNotesOpen(true) },
      ];
      const settingsMenuItems = [
        { label: 'Event Categories', action: () => setSettingsOpen(true) },
        { label: 'Relationship Categories', action: () => setRelationshipTypeSettingsOpen(true) },
        { label: 'Relationship Statuses', action: () => setRelationshipStatusSettingsOpen(true) },
        { label: 'Symptom Categories', action: () => setIndicatorSettingsOpen(true) },
        {
          label: `Notes Layer: ${notesLayerEnabled ? 'On' : 'Off'}`,
          action: () => setNotesLayerEnabled((prev) => !prev),
        },
        {
          label: `Auto-Save: ${autoSaveMinutes} min`,
          action: () => {
            const entered = window.prompt('Auto-save minutes:', String(autoSaveMinutes));
            if (entered == null) return;
            const next = Number(entered);
            if (Number.isNaN(next)) return;
            handleAutoSaveMinutesInput(next);
          },
        },
      ];
      const helpMenuItems = [
        { label: 'Help Video', action: () => setTrainingVideosOpen(true) },
        {
          label: 'Help Demo',
          action: () => {
            setDemoTourStepIndex(0);
            setDemoTourOpen(true);
          },
        },
        {
          label: 'Build Demo',
          action: () => {
            setBuildDemoStepIndex(0);
            setBuildDemoOpen(true);
          },
        },
        { label: 'Help Docs', action: () => setReadmeViewerOpen(true) },
      ];
      const selectedTrainingVideo =
        TRAINING_VIDEOS.find((video) => video.id === selectedTrainingVideoId) || TRAINING_VIDEOS[0];
      const selectedRibbonHelp = ribbonHelpKey ? RIBBON_HELP[ribbonHelpKey] : null;
      const isDemoFamilyLoaded = isDemoDiagramFileName(fileName);
      const shouldBlinkHelpOnDemo = isDemoFamilyLoaded && !helpOpen;
      const helpBlinkOn = shouldBlinkHelpOnDemo ? Math.floor(now / 500) % 2 === 0 : false;
      const currentDemoStep = demoTourSteps[demoTourStepIndex] || demoTourSteps[0];
      const currentBuildDemoStep =
        buildDemoSteps[buildDemoStepIndex] || buildDemoSteps[0];
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
      const isDemoFocusedToolbar = (target: string) =>
        demoTourOpen &&
        currentDemoStep?.focus.kind === 'toolbar' &&
        currentDemoStep.focus.target === target;
      const isDemoFocusedCanvas = demoTourOpen && currentDemoStep?.focus.kind === 'canvas';
      const toolbarHighlightStyle = (...targets: string[]): React.CSSProperties =>
        targets.some((target) => isDemoFocusedToolbar(target))
          ? {
              outline: demoBlinkVisible ? '3px solid #ff9800' : '3px solid transparent',
              borderRadius: 6,
              boxShadow: demoBlinkVisible ? '0 0 0 2px rgba(255,152,0,0.25)' : 'none',
            }
          : {};
      const personSectionPopupPerson = personSectionPopup
        ? people.find((person) => person.id === personSectionPopup.personId) || null
        : null;
      const partnershipSectionPopupPartnership = partnershipSectionPopup
        ? partnerships.find((partnership) => partnership.id === partnershipSectionPopup.partnershipId) || null
        : null;
      const helpBadgeStyle: React.CSSProperties = {
        width: 20,
        height: 20,
        borderRadius: '50%',
        border: '1px solid #8ba1bd',
        background: '#fff',
        color: '#38557a',
        fontWeight: 700,
        fontSize: 12,
        lineHeight: '18px',
        padding: 0,
        cursor: 'pointer',
      };
      const selectedRibbonHelpBody =
        ribbonHelpKey === 'save' && selectedRibbonHelp
          ? `${selectedRibbonHelp.body}\n\nCurrent save mode: ${storageStatusLabel}`
          : selectedRibbonHelp?.body ?? '';
      const handleFileMenuAction = (action: () => void) => {
        setFileMenuOpen(false);
        setSettingsMenuOpen(false);
        setOptionsMenuOpen(false);
        setHelpMenuOpen(false);
        action();
      };

      return (
        <div>
          <div
            ref={ribbonRef}
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 40,
              padding: '4px 8px 6px',
              borderBottom: '1px solid #ccc',
              background: '#f6f7fb',
              ...(isDemoFocusedToolbar('menu-ribbon')
                ? {
                    outline: demoBlinkVisible ? '3px solid #ff9800' : '3px solid transparent',
                    boxShadow: demoBlinkVisible ? '0 0 0 2px rgba(255,152,0,0.25)' : 'none',
                  }
                : {}),
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
                gap: 4,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  width: 180,
                  padding: '2px 4px',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: ribbonButtonHeight }}
                >
                  <div
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, ...toolbarHighlightStyle('file-menu') }}
                    ref={fileMenuRef}
                  >
                    <button
                      onClick={() => {
                        setFileMenuOpen((prev) => !prev);
                        setSettingsMenuOpen(false);
                        setOptionsMenuOpen(false);
                        setHelpMenuOpen(false);
                      }}
                      style={ribbonButtonStyle}
                      aria-haspopup="menu"
                      aria-expanded={fileMenuOpen}
                    >
                      File ▾
                    </button>
                    <button
                      onClick={() => setRibbonHelpKey('file-menu')}
                      aria-label="File help"
                      style={helpBadgeStyle}
                    >
                      ?
                    </button>
                    {fileMenuOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          left: 0,
                          background: '#fff',
                          border: '1px solid #ccc',
                          borderRadius: 6,
                          boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                          minWidth: 180,
                          zIndex: 1000,
                        }}
                      >
                        {fileMenuItems.map((item) => (
                          <button
                            key={item.label}
                            onClick={() => handleFileMenuAction(item.action)}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 12px',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...toolbarHighlightStyle('save') }}>
                    <button
                      onClick={() => handleFileMenuAction(() => handleSave(false))}
                      style={saveButtonStyle}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setRibbonHelpKey('save')}
                      aria-label="Save help"
                      style={helpBadgeStyle}
                    >
                      ?
                    </button>
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  width: 300,
                  padding: '2px 4px',
                  ...toolbarHighlightStyle('timeline-controls'),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minHeight: ribbonButtonHeight }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, width: 'max-content' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => adjustTimelineYear(-1)}
                        disabled={timelineSliderDisabled}
                        style={{
                          ...ribbonButtonStyle,
                          cursor: timelineSliderDisabled ? 'not-allowed' : 'pointer',
                        }}
                      >
                        -1 yr
                      </button>
                      <button
                        onClick={() => adjustTimelineYear(1)}
                        disabled={timelineSliderDisabled}
                        style={{
                          ...ribbonButtonStyle,
                          cursor: timelineSliderDisabled ? 'not-allowed' : 'pointer',
                        }}
                      >
                        +1 yr
                      </button>
                      <button
                        onClick={handleTimelinePlayToggle}
                        disabled={timelineSliderDisabled}
                        style={{
                          ...ribbonButtonStyle,
                          borderColor: '#1976d2',
                          color: timelinePlaying ? '#fff' : '#1976d2',
                          background: timelinePlaying ? '#1976d2' : '#fff',
                          fontWeight: 700,
                          cursor: timelineSliderDisabled ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {timelinePlaying ? 'Pause' : 'Play'}
                      </button>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 4,
                        width: '100%',
                      }}
                    >
                      <input
                        type="range"
                        min={timelineYearBounds.min}
                        max={timelineYearBounds.max}
                        step={1}
                        value={displayTimelineYear}
                        onChange={(e) => setTimelineYear(Number(e.target.value))}
                        disabled={timelineSliderDisabled}
                        style={{ display: 'block', width: '100%' }}
                      />
                      <div style={{ fontSize: 12, color: '#333', width: '100%', textAlign: 'center' }}>
                        Timeline {timelineSliderDisabled ? '(All Dates)' : `(${displayTimelineYear})`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setRibbonHelpKey('timeline-controls')}
                    aria-label="Timeline controls help"
                    style={{ ...helpBadgeStyle, marginTop: 10 }}
                  >
                    ?
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  width: 330,
                  padding: '2px 4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, minHeight: ribbonButtonHeight }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, width: 'max-content' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          ...toolbarHighlightStyle('event-categories', 'functional-indicators'),
                        }}
                        ref={settingsMenuRef}
                      >
                        <button
                          onClick={() => {
                            setSettingsMenuOpen((prev) => !prev);
                            setFileMenuOpen(false);
                            setOptionsMenuOpen(false);
                            setHelpMenuOpen(false);
                          }}
                          style={ribbonButtonStyle}
                          aria-haspopup="menu"
                          aria-expanded={settingsMenuOpen}
                        >
                          Settings ▾
                        </button>
                        <button
                          onClick={() => setRibbonHelpKey('event-categories')}
                          aria-label="Settings menu help"
                          style={helpBadgeStyle}
                        >
                          ?
                        </button>
                        {settingsMenuOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 4px)',
                              left: 0,
                              background: '#fff',
                              border: '1px solid #ccc',
                              borderRadius: 6,
                              boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                              minWidth: 200,
                              zIndex: 1000,
                            }}
                          >
                            {settingsMenuItems.map((item) => (
                              <button
                                key={item.label}
                                onClick={() => handleFileMenuAction(item.action)}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  textAlign: 'left',
                                  padding: '8px 12px',
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                }}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div
                        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, ...toolbarHighlightStyle('transcripts-menu', 'event-creator', 'ideas', 'session-notes') }}
                        ref={optionsMenuRef}
                      >
                        <button
                          onClick={() => {
                            setOptionsMenuOpen((prev) => !prev);
                            setFileMenuOpen(false);
                            setSettingsMenuOpen(false);
                            setHelpMenuOpen(false);
                          }}
                          style={ribbonButtonStyle}
                          aria-haspopup="menu"
                          aria-expanded={optionsMenuOpen}
                        >
                          Options ▾
                        </button>
                        <button
                          onClick={() => setRibbonHelpKey('transcripts-menu')}
                          aria-label="Options help"
                          style={helpBadgeStyle}
                        >
                          ?
                        </button>
                        {optionsMenuOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 'calc(100% + 4px)',
                              left: 0,
                              background: '#fff',
                              border: '1px solid #ccc',
                              borderRadius: 6,
                              boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                              minWidth: 170,
                              zIndex: 1000,
                            }}
                          >
                            {optionsMenuItems.map((item) => (
                              <button
                                key={item.label}
                                onClick={() => handleFileMenuAction(item.action)}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  textAlign: 'left',
                                  padding: '8px 12px',
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                }}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 4,
                        width: 'calc(100% - 26px)',
                      }}
                    >
                      <input
                        type="range"
                        min={0.25}
                        max={3}
                        step={0.05}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        style={{ display: 'block', width: '100%' }}
                      />
                      <div style={{ fontSize: 12, color: '#333', width: '100%', textAlign: 'center' }}>
                        Zoom ({Math.round(zoom * 100)}%)
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      ...toolbarHighlightStyle('help'),
                    }}
                    ref={helpMenuRef}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => {
                          setHelpMenuOpen((prev) => !prev);
                          setFileMenuOpen(false);
                          setSettingsMenuOpen(false);
                          setOptionsMenuOpen(false);
                        }}
                        style={{
                          ...ribbonButtonStyle,
                          borderColor: shouldBlinkHelpOnDemo ? '#1976d2' : '#b0b0b0',
                          boxShadow:
                            shouldBlinkHelpOnDemo && helpBlinkOn
                              ? '0 0 0 3px rgba(25,118,210,0.35)'
                              : 'none',
                        }}
                      >
                        Help
                      </button>
                      <button
                        onClick={() => setRibbonHelpKey('help')}
                        aria-label="Help button help"
                        style={helpBadgeStyle}
                      >
                        ?
                      </button>
                    </div>
                    <button
                      onClick={handleCenterDiagramView}
                      aria-label="Center diagram"
                      title="Center diagram at 50% zoom"
                      style={{
                        ...ribbonButtonStyle,
                        minHeight: 28,
                        padding: '2px 8px',
                        fontSize: 16,
                        lineHeight: 1,
                      }}
                    >
                      &#8853;
                    </button>
                    {helpMenuOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          left: 0,
                          background: '#fff',
                          border: '1px solid #ccc',
                          borderRadius: 6,
                          boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
                          minWidth: 180,
                          zIndex: 1000,
                        }}
                      >
                        {helpMenuItems.map((item) => (
                          <button
                            key={item.label}
                            onClick={() => handleFileMenuAction(item.action)}
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 12px',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <input
              ref={loadInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleLoad}
            />
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportLoad}
            />
            <input
              ref={importPersonEventsInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportPersonEventsLoad}
            />
            <input
              ref={transcriptInputRef}
              type="file"
              accept=".txt,.md,.rtf,.pdf"
              style={{ display: 'none' }}
              onChange={handleProcessTranscriptLoad}
            />
          </div>
          {voiceInputOpen && (
            <div
              role="dialog"
              aria-label="Voice input"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(24, 31, 43, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1200,
              }}
            >
              <div
                style={{
                  width: 'min(760px, calc(100vw - 32px))',
                  maxHeight: 'min(80vh, 760px)',
                  overflow: 'auto',
                  background: '#fff',
                  borderRadius: 12,
                  boxShadow: '0 20px 48px rgba(0,0,0,0.2)',
                  padding: 20,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22 }}>Voice to Diagram</h2>
                    <div style={{ marginTop: 6, fontSize: 14, color: '#45556f' }}>
                      Supported commands: people, partners, children, birth/death years, adoption, relationship status, and emotional lines.
                    </div>
                  </div>
                  <button onClick={() => setVoiceInputOpen(false)} style={ribbonButtonStyle}>
                    Close
                  </button>
                </div>
                <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                  <div style={{ fontSize: 13, color: '#44516a' }}>
                    Example: <code>Add a male named Harry. Harry&apos;s partner is Betty. Harry and Betty are married in 1972. Harry and Betty&apos;s children are Tom, Dick and Jane. Tom is adopted. Harry and Betty have an emotional cutoff.</code>
                  </div>
                  <textarea
                    aria-label="Voice command text"
                    value={voiceCommandText}
                    onChange={(e) => setVoiceCommandText(e.target.value)}
                    rows={8}
                    style={{
                      width: '100%',
                      resize: 'vertical',
                      borderRadius: 8,
                      border: '1px solid #c9d2de',
                      padding: 12,
                      fontFamily: 'inherit',
                      fontSize: 14,
                    }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button onClick={reviewVoiceCommands} style={ribbonButtonStyle}>
                      Review Commands
                    </button>
                    <button
                      onClick={toggleVoiceListening}
                      style={{
                        ...ribbonButtonStyle,
                        borderColor: voiceListening ? '#b3261e' : '#b0b0b0',
                        color: voiceListening ? '#b3261e' : '#222',
                      }}
                      disabled={!voiceSupported}
                    >
                      {voiceListening ? 'Stop Listening' : 'Start Listening'}
                    </button>
                    <button onClick={applyVoiceCommands} style={saveButtonStyle}>
                      Apply Commands
                    </button>
                    <button
                      onClick={() => {
                        setVoiceCommandText('');
                        setVoiceCommandOperations([]);
                        setVoiceCommandErrors([]);
                        setVoiceStatusMessage('');
                      }}
                      style={ribbonButtonStyle}
                    >
                      Clear
                    </button>
                  </div>
                  <div style={{ fontSize: 13, color: '#45556f' }}>
                    {voiceSupported
                      ? voiceStatusMessage || 'Browser speech recognition is available.'
                      : 'Browser speech recognition is unavailable here. Text commands still work.'}
                  </div>
                  <div
                    style={{
                      border: '1px solid #d9e0ea',
                      borderRadius: 10,
                      padding: 14,
                      background: '#f7f9fc',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>Review</div>
                    {voiceCommandOperations.length === 0 && voiceCommandErrors.length === 0 && (
                      <div style={{ fontSize: 14, color: '#56657d' }}>No reviewed commands yet.</div>
                    )}
                    {voiceCommandOperations.length > 0 && (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {voiceCommandOperations.map((operation, index) => (
                          <div
                            key={`${operation.type}-${index}`}
                            style={{
                              background: '#fff',
                              border: '1px solid #d9e0ea',
                              borderRadius: 8,
                              padding: '8px 10px',
                              fontSize: 14,
                            }}
                          >
                            {operation.type === 'add_person'
                              ? `Add person: ${operation.name}${operation.gender ? ` (${operation.gender})` : ''}`
                              : operation.type === 'add_partnership'
                              ? `Create partnership: ${operation.personName} + ${operation.partnerName}`
                              : operation.type === 'add_children'
                              ? `Add children to ${operation.parent1Name} + ${operation.parent2Name}: ${operation.childNames.join(', ')}`
                              : operation.type === 'set_person_birth_year'
                              ? `Set birth year: ${operation.name} -> ${operation.year}`
                              : operation.type === 'set_person_death_year'
                              ? `Set death year: ${operation.name} -> ${operation.year}`
                              : operation.type === 'set_person_adoption_status'
                              ? `Set adoption: ${operation.name} -> ${operation.adoptionStatus}`
                              : operation.type === 'set_partnership_status'
                              ? `Set relationship: ${operation.person1Name} + ${operation.person2Name} -> ${operation.relationshipStatus}${operation.year ? ` (${operation.year})` : ''}`
                              : `Add emotional line: ${operation.person1Name} + ${operation.person2Name} -> ${operation.relationshipType}`}
                          </div>
                        ))}
                      </div>
                    )}
                    {voiceCommandErrors.length > 0 && (
                      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                        {voiceCommandErrors.map((error) => (
                          <div
                            key={error}
                            style={{
                              background: '#fff4f2',
                              border: '1px solid #f0b4aa',
                              color: '#8a1c12',
                              borderRadius: 8,
                              padding: '8px 10px',
                              fontSize: 14,
                            }}
                          >
                            {error}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {backupRestoreOpen && backupRestoreVersions && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Restore backup"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2420,
              }}
              onClick={() => {
                setBackupRestoreOpen(false);
                setBackupRestoreVersions(null);
              }}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: '18px 20px',
                  width: 'min(420px, 92vw)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>Restore Backup</h3>
                  <button
                    onClick={() => {
                      setBackupRestoreOpen(false);
                      setBackupRestoreVersions(null);
                    }}
                    aria-label="Close restore backup"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: 22,
                      lineHeight: 1,
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ marginTop: 10, fontSize: 14, color: '#45556f' }}>
                  Restore a previous saved version of this diagram.
                </div>
                <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                  {(['v1', 'v2', 'v3'] as const).map((versionKey) => {
                    const value = backupRestoreVersions[versionKey];
                    return (
                      <button
                        key={versionKey}
                        onClick={() => handleRestoreBackupVersion(versionKey)}
                        disabled={!value}
                        style={{
                          ...ribbonButtonStyle,
                          width: '100%',
                          textAlign: 'left',
                          cursor: value ? 'pointer' : 'not-allowed',
                          opacity: value ? 1 : 0.5,
                        }}
                      >
                        {versionKey.toUpperCase()}
                        {versionKey === 'v1'
                          ? ' (most recent backup)'
                          : versionKey === 'v2'
                          ? ' (previous backup)'
                          : ' (oldest backup)'}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex' }}>
            {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
            {personSectionPopup && personSectionPopupPerson && (
              <div
                onClick={() => setPersonSectionPopup(null)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 2200,
                  background: 'transparent',
                }}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    position: 'absolute',
                    left:
                      typeof window !== 'undefined'
                        ? Math.max(12, Math.min(personSectionPopup.x + 10, window.innerWidth - 480))
                        : personSectionPopup.x,
                    top:
                      typeof window !== 'undefined'
                        ? Math.max(12, Math.min(personSectionPopup.y + 10, window.innerHeight - 420))
                        : personSectionPopup.y,
                  }}
                >
                  <PropertiesPanel
                    selectedItem={personSectionPopupPerson}
                    people={people}
                    partnerships={partnerships}
                    eventCategories={eventCategories}
                    relationshipTypes={relationshipTypes}
                    relationshipStatuses={relationshipStatuses}
                    functionalIndicatorDefinitions={functionalIndicatorDefinitions}
                    onUpdatePerson={handleUpdatePerson}
                    onUpdatePartnership={handleUpdatePartnership}
                    onUpdateEmotionalLine={handleUpdateEmotionalLine}
                    initialActiveTab="properties"
                    initialPersonSection={personSectionPopup.section}
                    compactPersonSectionMode
                    onEnsureSymptomCategoryDefinition={ensureSymptomDefinition}
                    onClose={() => setPersonSectionPopup(null)}
                  />
                </div>
              </div>
            )}
            {partnershipSectionPopup && partnershipSectionPopupPartnership && (
              <div
                onClick={() => setPartnershipSectionPopup(null)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 2200,
                  background: 'transparent',
                }}
              >
                <div
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    position: 'absolute',
                    left:
                      typeof window !== 'undefined'
                        ? Math.max(12, Math.min(partnershipSectionPopup.x + 10, window.innerWidth - 540))
                        : partnershipSectionPopup.x,
                    top:
                      typeof window !== 'undefined'
                        ? Math.max(12, Math.min(partnershipSectionPopup.y + 10, window.innerHeight - 420))
                        : partnershipSectionPopup.y,
                  }}
                >
                  <PropertiesPanel
                    selectedItem={partnershipSectionPopupPartnership}
                    people={people}
                    partnerships={partnerships}
                    eventCategories={eventCategories}
                    relationshipTypes={relationshipTypes}
                    relationshipStatuses={relationshipStatuses}
                    functionalIndicatorDefinitions={functionalIndicatorDefinitions}
                    onUpdatePerson={handleUpdatePerson}
                    onUpdatePartnership={handleUpdatePartnership}
                    onUpdateEmotionalLine={handleUpdateEmotionalLine}
                    initialActiveTab="properties"
                    initialPartnershipType={partnershipSectionPopup.relationshipType}
                    compactPartnershipSectionMode
                    onEnsureSymptomCategoryDefinition={ensureSymptomDefinition}
                    onClose={() => setPartnershipSectionPopup(null)}
                  />
                </div>
              </div>
            )}
            <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
              <div style={{ flex: 1, position: 'relative' }}>
              {isDemoFocusedCanvas && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 8,
                    border: demoBlinkVisible ? '3px solid #ff9800' : '3px solid transparent',
                    borderRadius: 8,
                    boxShadow: demoBlinkVisible ? '0 0 0 2px rgba(255,152,0,0.25)' : 'none',
                    pointerEvents: 'none',
                    zIndex: 20,
                  }}
                />
              )}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  transformOrigin: 'top center',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  zIndex: 5,
                  lineHeight: 1.3,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2f45' }}>
                  Family Diagram Maker
                </div>
                <div style={{ fontSize: 14, color: '#333' }}>
                  {fileName || FALLBACK_FILE_NAME}
                </div>
              </div>
              <Stage 
                ref={stageRef}
                width={canvasWidth} 
                height={canvasHeight}
                x={stageOffset.x}
                y={stageOffset.y}
                scaleX={zoom}
                scaleY={zoom}
                onMouseDown={(e) => {
                  if (e.target === e.target.getStage()) {
                    const pointer = e.target.getStage()?.getPointerPosition();
                    if (pointer) {
                      if (spacePanActive || e.evt.altKey || e.evt.button === 1) {
                        setIsPanning(true);
                        panStartRef.current = { x: pointer.x, y: pointer.y };
                        setMarqueeSelection(null);
                        marqueeDidDragRef.current = false;
                        return;
                      }
                      const canvasPoint = toCanvasPoint(pointer);
                      setMarqueeSelection({
                        active: true,
                        startX: canvasPoint.x,
                        startY: canvasPoint.y,
                        currentX: canvasPoint.x,
                        currentY: canvasPoint.y,
                      });
                      marqueeDidDragRef.current = false;
                    }
                  }
                }}
                onMouseMove={(e) => {
                  const pointer = e.target.getStage()?.getPointerPosition();
                  if (!pointer) return;
                  if (marqueeSelection?.active) {
                    const canvasPoint = toCanvasPoint(pointer);
                    const moved =
                      Math.abs(canvasPoint.x - marqueeSelection.startX) > 3 ||
                      Math.abs(canvasPoint.y - marqueeSelection.startY) > 3;
                    if (moved) {
                      marqueeDidDragRef.current = true;
                    }
                    setMarqueeSelection((prev) =>
                      prev
                        ? {
                            ...prev,
                            currentX: canvasPoint.x,
                            currentY: canvasPoint.y,
                          }
                        : prev
                    );
                    return;
                  }
                  if (!isPanning || !panStartRef.current) return;
                  const dx = (pointer.x - panStartRef.current.x) / zoom;
                  const dy = (pointer.y - panStartRef.current.y) / zoom;
                  translateDiagram(dx, dy);
                  panStartRef.current = { x: pointer.x, y: pointer.y };
                }}
                onMouseUp={() => {
                  setIsPanning(false);
                  panStartRef.current = null;
                  if (!marqueeSelection?.active) return;
                  const minX = Math.min(marqueeSelection.startX, marqueeSelection.currentX);
                  const minY = Math.min(marqueeSelection.startY, marqueeSelection.currentY);
                  const width = Math.abs(marqueeSelection.currentX - marqueeSelection.startX);
                  const height = Math.abs(marqueeSelection.currentY - marqueeSelection.startY);
                  if (marqueeDidDragRef.current && width > 1 && height > 1) {
                    selectPeopleByMarquee({ x: minX, y: minY, width, height });
                    suppressStageClickRef.current = true;
                  }
                  setMarqueeSelection(null);
                }}
                onMouseLeave={() => {
                  setIsPanning(false);
                  panStartRef.current = null;
                  setMarqueeSelection(null);
                }}
                onTouchStart={(e) => {
                  if (e.target === e.target.getStage()) {
                    setIsPanning(true);
                    const pointer = e.target.getStage()?.getPointerPosition();
                    if (pointer) {
                      panStartRef.current = { x: pointer.x, y: pointer.y };
                    }
                  }
                }}
                onTouchMove={(e) => {
                  if (!isPanning || !panStartRef.current) return;
                  const pointer = e.target.getStage()?.getPointerPosition();
                  if (!pointer) return;
                  const dx = (pointer.x - panStartRef.current.x) / zoom;
                  const dy = (pointer.y - panStartRef.current.y) / zoom;
                  translateDiagram(dx, dy);
                  panStartRef.current = { x: pointer.x, y: pointer.y };
                }}
                onTouchEnd={() => {
                  setIsPanning(false);
                  panStartRef.current = null;
                  setMarqueeSelection(null);
                }}
                onClick={(e) => {
                  if (suppressStageClickRef.current) {
                    suppressStageClickRef.current = false;
                    return;
                  }
                  if (e.target === e.target.getStage()) {
                    setSelectedPeopleIds([]);
                    setSelectedPartnershipId(null);
                    setSelectedEmotionalLineId(null);
                    setSelectedChildId(null);
                    setSelectedPageNoteId(null);
                    setPageNoteDraft(null);
                    setPropertiesPanelItem(null);
                  }
                }}
                onContextMenu={handleStageContextMenu}
              >
                <Layer>
                  {/* Triangle shading */}
                  {triangles.map((triangle) => {
                    const person1 = people.find((person) => person.id === triangle.person1_id);
                    const person2 = people.find((person) => person.id === triangle.person2_id);
                    const person3 = people.find((person) => person.id === triangle.person3_id);
                    if (!person1 || !person2 || !person3) return null;
                    if (
                      !personVisibility.get(person1.id) ||
                      !personVisibility.get(person2.id) ||
                      !personVisibility.get(person3.id)
                    ) {
                      return null;
                    }
                    return (
                      <TriangleFillNode
                        key={`triangle-fill-${triangle.id}`}
                        triangle={triangle}
                        person1={person1}
                        person2={person2}
                        person3={person3}
                        onSelect={handleTriangleAreaSelect}
                        onContextMenu={handleTriangleAreaContextMenu}
                      />
                    );
                  })}

                  {/* Render Emotional Lines */}
                  {allEmotionalLines.map((el) => {
                      if (!emotionalVisibility.get(el.id)) return null;
                      if (isDemoFocusedEmotionalLine(el.id) && !demoBlinkVisible) {
                        return null;
                      }
                      const person1 = people.find(person => person.id === el.person1_id);
                      const person2 = people.find(person => person.id === el.person2_id);
                      if (!person1 || !person2) return null;
                      if (!personVisibility.get(person1.id) || !personVisibility.get(person2.id)) return null;
                      const sibling = emotionalSiblingMeta.get(el.id);
    
                      return (
                          <EmotionalLineNode
                              key={el.id}
                              emotionalLine={el}
                              person1={person1}
                              person2={person2}
                              isSelected={selectedEmotionalLineId === el.id}
                              onSelect={handleEmotionalLineSelect}
                              onContextMenu={handleEmotionalLineContextMenu}
                              siblingIndex={sibling?.index}
                              siblingCount={sibling?.count}
                          />
                      )
                  })}

                  {/* Render Connections */}
                  {partnerships.map((p) => {
                      if (!partnershipVisibility.get(p.id)) return null;
                      if (isDemoFocusedPartnership(p.id) && !demoBlinkVisible) {
                        return null;
                      }
                      const partner1 = people.find(person => person.id === p.partner1_id);
                      const partner2 = people.find(person => person.id === p.partner2_id);
                      if (!partner1 || !partner2) return null;
                      if (!personVisibility.get(partner1.id) || !personVisibility.get(partner2.id)) return null;
    
                      const childConnections = p.children.map(childId => {
                          const child = people.find(c => c.id === childId);
                          if (!child || !personVisibility.get(child.id)) return null;
                          return <ChildConnection key={`child-conn-${childId}`} child={child} partnership={p} partner1={partner1} partner2={partner2} isSelected={selectedChildId === childId} onSelect={handleChildLineSelect} onContextMenu={handleChildLineContextMenu} />
                      });
    
                      return (
                          <React.Fragment key={p.id}>
                              <PartnershipNode 
                                  partnership={p} 
                                  partner1={partner1} 
                                  partner2={partner2} 
                                  isSelected={selectedPartnershipId === p.id}
                                  onSelect={handlePartnershipSelect}
                                  onHorizontalConnectorDragEnd={handleHorizontalConnectorDragEnd}
                                  onContextMenu={handlePartnershipContextMenu}
                              />
                              {childConnections}
                          </React.Fragment>
                      )
                  })}
    
                  {/* Render People */}
                  {people.map((person) => {
                    if (!personVisibility.get(person.id)) return null;
                    if (isDemoFocusedPerson(person.id) && !demoBlinkVisible) {
                      return null;
                    }
                    return (
                      <PersonNode
                        key={person.id}
                        person={person}
                        isSelected={selectedPeopleIds.includes(person.id)}
                        onSelect={handleSelect}
                        onDragStart={(e) => handlePersonDragStart(person.id, e.target.x(), e.target.y())}
                        onDragMove={(e) => handlePersonDrag(person.id, e.target.x(), e.target.y())}
                        onDragEnd={(e) => {
                          handlePersonDrag(person.id, e.target.x(), e.target.y());
                          dragGroupRef.current = null;
                        }}
                        onContextMenu={handlePersonContextMenu}
                        onHoverChange={setHoveredPersonId}
                        functionalIndicatorDefinitions={functionalIndicatorDefinitions}
                      />
                    );
                  })}

                  {marqueeSelection?.active && (
                    <Rect
                      x={Math.min(marqueeSelection.startX, marqueeSelection.currentX)}
                      y={Math.min(marqueeSelection.startY, marqueeSelection.currentY)}
                      width={Math.abs(marqueeSelection.currentX - marqueeSelection.startX)}
                      height={Math.abs(marqueeSelection.currentY - marqueeSelection.startY)}
                      stroke="#1976d2"
                      strokeWidth={1.5}
                      dash={[6, 4]}
                      fill="rgba(25,118,210,0.12)"
                      listening={false}
                    />
                  )}

                  {selectedGroupBounds && (
                    <>
                      <Rect
                        x={selectedGroupBounds.x}
                        y={selectedGroupBounds.y}
                        width={selectedGroupBounds.width}
                        height={selectedGroupBounds.height}
                        stroke="#1565c0"
                        strokeWidth={1.5}
                        dash={[8, 6]}
                        fillEnabled={false}
                        listening={false}
                      />
                      <Rect
                        x={selectedGroupBounds.x + selectedGroupBounds.width - 10}
                        y={selectedGroupBounds.y + selectedGroupBounds.height - 10}
                        width={10}
                        height={10}
                        fill="#e3f2fd"
                        stroke="#1565c0"
                        strokeWidth={1.2}
                        draggable
                        onDragStart={(e) => {
                          e.cancelBubble = true;
                          beginGroupResize();
                        }}
                        onDragMove={(e) => {
                          e.cancelBubble = true;
                          const localX = e.target.x() - selectedGroupBounds.x + 10;
                          const localY = e.target.y() - selectedGroupBounds.y + 10;
                          applyGroupResize({
                            width: Math.max(20, localX),
                            height: Math.max(20, localY),
                          });
                        }}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          endGroupResize();
                        }}
                      />
                    </>
                  )}

                  {/* Render Notes */}
                  {people.map((person) => {
                    if (!shouldShowPersonNote(person, notesLayerEnabled, hoveredPersonId)) return null;
                    if (!personVisibility.get(person.id)) return null;
                    if (isDemoFocusedPerson(person.id) && !demoBlinkVisible) return null;
                    const x = person.notesPosition?.x || person.x + 50;
                    const y = person.notesPosition?.y || person.y;
                    const genderFill =
                      person.gender === 'male'
                        ? '#d6ecff'
                        : person.gender === 'female'
                          ? '#ffe0ec'
                          : '#fffbe6';
                    return (
                      <NoteNode
                        key={`note-person-${person.id}`}
                        x={x}
                        y={y}
                        title={person.name}
                        text={person.notes || ''}
                        width={person.notesSize?.width}
                        height={person.notesSize?.height}
                        anchorX={person.x}
                        anchorY={person.y}
                        fillColor={genderFill}
                        onDragEnd={(e) => handlePersonNoteDragEnd(person.id, e.target.x(), e.target.y())}
                        onResizeEnd={(w, h) => handlePersonNoteResizeEnd(person.id, w, h)}
                        onSelect={() => {
                          setSelectedPeopleIds([person.id]);
                          setSelectedPartnershipId(null);
                          setSelectedEmotionalLineId(null);
                          setSelectedChildId(null);
                          setPropertiesPanelItem(person);
                        }}
                      />
                    );
                  })}
                  {partnerships.map((p) => {
                    if (!shouldShowPartnershipNote(p, notesLayerEnabled)) return null;
                    if (!partnershipVisibility.get(p.id)) return null;
                    if (isDemoFocusedPartnership(p.id) && !demoBlinkVisible) return null;
                    const partner1 = people.find(person => person.id === p.partner1_id);
                    const partner2 = people.find(person => person.id === p.partner2_id);
                    if (!partner1 || !partner2) return null;
                    if (!personVisibility.get(partner1.id) || !personVisibility.get(partner2.id)) return null;
                    const x = p.notesPosition?.x || (partner1.x + partner2.x) / 2;
                    const y = p.notesPosition?.y || p.horizontalConnectorY + 50;
                    return (
                      <NoteNode
                        key={`note-partnership-${p.id}`}
                        x={x}
                        y={y}
                        title={`${partner1.name}\n${partner2.name}`}
                        text={p.notes || ''}
                        width={p.notesSize?.width}
                        height={p.notesSize?.height}
                        anchorX={(partner1.x + partner2.x) / 2}
                        anchorY={p.horizontalConnectorY}
                        onDragEnd={(e) => handlePartnershipNoteDragEnd(p.id, e.target.x(), e.target.y())}
                        onResizeEnd={(w, h) => handlePartnershipNoteResizeEnd(p.id, w, h)}
                        onSelect={() => {
                          setSelectedPeopleIds([]);
                          setSelectedPartnershipId(p.id);
                          setSelectedEmotionalLineId(null);
                          setSelectedChildId(null);
                          setPropertiesPanelItem(p);
                        }}
                      />
                    );
                  })}
                  {allEmotionalLines.map((el) => {
                    if (!shouldShowEmotionalNote(el, notesLayerEnabled)) return null;
                    if (!emotionalVisibility.get(el.id)) return null;
                    if (isDemoFocusedEmotionalLine(el.id) && !demoBlinkVisible) return null;
                    const person1 = people.find(person => person.id === el.person1_id);
                    const person2 = people.find(person => person.id === el.person2_id);
                    if (!person1 || !person2) return null;
                    if (!personVisibility.get(person1.id) || !personVisibility.get(person2.id)) return null;
                    const x = el.notesPosition?.x || (person1.x + person2.x) / 2;
                    const y = el.notesPosition?.y || (person1.y + person2.y) / 2 + 20;
                    return (
                      <NoteNode
                        key={`note-el-${el.id}`}
                        x={x}
                        y={y}
                        title={`${person1.name}\n${person2.name}`}
                        text={el.notes || ''}
                        width={el.notesSize?.width}
                        height={el.notesSize?.height}
                        anchorX={(person1.x + person2.x) / 2}
                        anchorY={(person1.y + person2.y) / 2}
                        onDragEnd={(e) => handleEmotionalLineNoteDragEnd(el.id, e.target.x(), e.target.y())}
                        onResizeEnd={(w, h) => handleEmotionalLineNoteResizeEnd(el.id, w, h)}
                        onSelect={() => {
                          setSelectedPeopleIds([]);
                          setSelectedPartnershipId(null);
                          setSelectedEmotionalLineId(el.id);
                          setSelectedChildId(null);
                          setPropertiesPanelItem(el);
                        }}
                      />
                    );
                  })}
                  {pageNotes.map((note) => (
                    <NoteNode
                      key={`page-note-${note.id}`}
                      x={note.x}
                      y={note.y}
                      title={note.title}
                      text={note.text}
                      width={note.width}
                      height={note.height}
                      fillColor={note.fillColor || '#fff8c6'}
                      isSelected={selectedPageNoteId === note.id}
                      onDragEnd={(e) => handlePageNoteDragEnd(note.id, e.target.x(), e.target.y())}
                      onResizeEnd={(w, h) => handlePageNoteResizeEnd(note.id, w, h)}
                      onSelect={() => handlePageNoteSelect(note.id)}
                    />
                  ))}
                </Layer>
              </Stage>
              {selectedPageNote && pageNoteDraft && (
                <div
                  style={{
                    position: 'absolute',
                    left: Math.max(
                      8,
                      Math.min(
                        stageOffset.x + selectedPageNote.x * zoom + ((selectedPageNote.width || 220) * zoom) + 12,
                        canvasWidth - 260
                      )
                    ),
                    top: Math.max(8, Math.min(stageOffset.y + selectedPageNote.y * zoom, canvasHeight - 220)),
                    width: 240,
                    background: '#fffdf4',
                    border: '1px solid #d6c27a',
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    padding: 8,
                    zIndex: 25,
                  }}
                >
                  <input
                    aria-label="General note title"
                    type="text"
                    value={pageNoteDraft.title}
                    onChange={(e) => handlePageNoteDraftChange('title', e.target.value)}
                    style={{ width: '100%', marginBottom: 6, fontWeight: 600 }}
                  />
                  <textarea
                    aria-label="General note text"
                    value={pageNoteDraft.text}
                    onChange={(e) => handlePageNoteDraftChange('text', e.target.value)}
                    rows={6}
                    style={{ width: '100%', resize: 'vertical', marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <label htmlFor="general-note-color" style={{ fontSize: 12, fontWeight: 600 }}>
                      Color
                    </label>
                    <input
                      id="general-note-color"
                      aria-label="General note color"
                      type="color"
                      value={pageNoteDraft.fillColor}
                      onChange={(e) => handlePageNoteDraftChange('fillColor', e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <button
                      aria-label="Delete general note"
                      onClick={() => handlePageNoteDelete(selectedPageNote.id)}
                      style={{
                        border: '1px solid #caa',
                        background: '#fff1f1',
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: 12,
                      }}
                    >
                      🗑
                    </button>
                    <button
                      aria-label="Save general note"
                      onClick={handlePageNoteSave}
                      style={{
                        border: '1px solid #7ba37b',
                        background: '#eef9ee',
                        borderRadius: 4,
                        padding: '4px 8px',
                        fontSize: 12,
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
              {canvasScrollHintOpen && (
                <div
                  role="status"
                  style={{
                    position: 'absolute',
                    right: 28,
                    bottom: 16,
                    width: 320,
                    background: '#fffdf4',
                    border: '1px solid #d6c27a',
                    borderRadius: 10,
                    boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
                    padding: '10px 12px',
                    zIndex: 30,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 13, lineHeight: 1.4, color: '#4d4320' }}>
                      To PAN or SCROLL the canvas, hold down SPACE bar and Click to pan the Canvas in any direction
                    </div>
                    <button
                      onClick={() => setCanvasScrollHintOpen(false)}
                      aria-label="Close canvas scroll hint"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: 18,
                        lineHeight: 1,
                        cursor: 'pointer',
                        color: '#6a5a26',
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
            </div>
              <div
                aria-label="Canvas scroll guidance"
                onMouseDown={handleCanvasScrollHint}
                onWheel={handleCanvasScrollHint}
                style={{
                  width: 16,
                  height: canvasHeight,
                  overflowY: 'scroll',
                  overflowX: 'hidden',
                  borderLeft: '1px solid #d7dbe4',
                  background: '#f3f5fa',
                }}
              >
                <div style={{ height: Math.max(canvasHeight * 2, canvasHeight + 200) }} />
              </div>
            </div>
            <div
              ref={panelRef}
              style={{
                width: panelWidth,
                overflow: 'auto',
                minWidth: 180,
                maxWidth: 600,
                position: 'relative',
              }}
            >
              <div
                role="separator"
                aria-orientation="vertical"
                onMouseDown={(event) => {
                  resizeStateRef.current = { startX: event.clientX, startWidth: panelWidth };
                }}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 6,
                  cursor: 'col-resize',
                  background: 'linear-gradient(to right, rgba(0,0,0,0.15), rgba(0,0,0,0))',
                  borderRight: '1px solid #c7c7c7',
                }}
              />
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  marginLeft: 6,
                  padding: '10px 12px',
                  borderBottom: '1px solid #d5d5d5',
                  background: '#f6f7fb',
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#1f3248',
                }}
              >
                Properties Panel
              </div>
              {(showMultiPersonPanel || propertiesPanelItem) && (
                showMultiPersonPanel ? (
                  <MultiPersonPropertiesPanel
                    selectedPeople={multiSelectedPeople}
                    onBatchUpdate={handleBatchUpdatePersons}
                    onClose={() => {
                      setSelectedPeopleIds([]);
                      setPropertiesPanelItem(null);
                    }}
                  />
                ) : (
                  propertiesPanelItem && (
                    <PropertiesPanel
                      selectedItem={propertiesPanelItem}
                      people={people}
                      partnerships={partnerships}
                      eventCategories={eventCategories}
                      relationshipTypes={relationshipTypes}
                      relationshipStatuses={relationshipStatuses}
                      functionalIndicatorDefinitions={functionalIndicatorDefinitions}
                      onUpdatePerson={handleUpdatePerson}
                      onUpdatePartnership={handleUpdatePartnership}
                      onUpdateEmotionalLine={handleUpdateEmotionalLine}
                      triangleId={panelTriangleContext?.id}
                      triangleColor={panelTriangleContext?.color}
                      triangleIntensity={panelTriangleContext?.intensity}
                      onUpdateTriangleColor={updateTriangleColor}
                      onUpdateTriangleIntensity={updateTriangleIntensity}
                      initialActiveTab={
                        propertiesPanelIntent?.targetId === propertiesPanelItem.id
                          ? propertiesPanelIntent.tab
                          : undefined
                      }
                      initialPersonSection={
                        propertiesPanelIntent?.targetId === propertiesPanelItem.id
                          ? propertiesPanelIntent.personSection
                          : undefined
                      }
                      focusEventId={
                        propertiesPanelIntent?.targetId === propertiesPanelItem.id
                          ? propertiesPanelIntent.focusEventId
                          : undefined
                      }
                      openNewEventRequestId={
                        propertiesPanelIntent?.targetId === propertiesPanelItem.id
                          ? propertiesPanelIntent.openNewEventRequestId
                          : undefined
                      }
                      newEventSeed={
                        propertiesPanelIntent?.targetId === propertiesPanelItem.id
                          ? propertiesPanelIntent.newEventSeed
                          : undefined
                      }
                      openNewEventPosition={
                        propertiesPanelIntent?.targetId === propertiesPanelItem.id
                          ? propertiesPanelIntent.openNewEventPosition
                          : undefined
                      }
                      onEnsureSymptomCategoryDefinition={ensureSymptomDefinition}
                      onClose={() => {
                        setPropertiesPanelItem(null);
                        setPropertiesPanelIntent(null);
                      }}
                    />
                  )
                )
              )}
            </div>
          </div>
          {importModeDialogOpen && pendingImportData && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2100,
              }}
            >
              <div style={{ background: 'white', padding: 18, borderRadius: 10, width: 460 }}>
                <h4 style={{ marginTop: 0 }}>
                  {pendingImportSource === 'transcript' ? 'Transcript Processed' : 'Import Data'}
                </h4>
                <p style={{ marginTop: 8, marginBottom: 14, color: '#333' }}>
                  Source: <strong>{pendingImportFileName || 'Imported data'}</strong>
                  <br />
                  Choose whether to replace the current family or merge this data into it.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => completePendingImport('replace')}>
                    Create New Family
                  </button>
                  <button onClick={() => completePendingImport('merge')}>
                    Add To Existing Family
                  </button>
                  <button
                    onClick={() => {
                      setImportModeDialogOpen(false);
                      setPendingImportData(null);
                      setPendingImportFileName('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          {sessionCaptureDialogOpen && pendingSessionCaptureData && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2105,
              }}
            >
              <div style={{ background: 'white', padding: 16, borderRadius: 10, width: 760, maxHeight: '84vh', overflow: 'auto' }}>
                <h4 style={{ marginTop: 0 }}>Session Capture Import Review</h4>
                <p style={{ marginTop: 6, color: '#333', fontSize: 13 }}>
                  Source: <strong>{pendingSessionCaptureFileName || 'Session capture JSON'}</strong>
                  <br />
                  Review each extracted operation before applying to this family. Low-confidence or ambiguous items default to off.
                </p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button
                    onClick={() =>
                      setSessionCaptureSelections(
                        Object.fromEntries(
                          pendingSessionCaptureData.operations.map((operation) => [operation.id, true])
                        )
                      )
                    }
                  >
                    Select All
                  </button>
                  <button
                    onClick={() =>
                      setSessionCaptureSelections(
                        Object.fromEntries(
                          pendingSessionCaptureData.operations.map((operation) => [operation.id, false])
                        )
                      )
                    }
                  >
                    Clear All
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendingSessionCaptureData.operations.map((operation) => {
                    const confidence = operation.confidence ?? 0.5;
                    const payloadPreview = JSON.stringify(operation.payload || {}, null, 2);
                    return (
                      <label
                        key={operation.id}
                        style={{
                          border: '1px solid #d6dbe8',
                          borderRadius: 8,
                          padding: 10,
                          background: sessionCaptureSelections[operation.id] ? '#f7fbff' : '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={!!sessionCaptureSelections[operation.id]}
                            onChange={(event) =>
                              setSessionCaptureSelections((prev) => ({
                                ...prev,
                                [operation.id]: event.target.checked,
                              }))
                            }
                          />
                          <strong>{operation.type}</strong>
                          <span style={{ fontSize: 12, color: '#555' }}>
                            confidence {Math.round(confidence * 100)}%
                          </span>
                          {operation.recommendedAction && (
                            <span style={{ fontSize: 12, color: '#37527a' }}>
                              recommended: {operation.recommendedAction}
                            </span>
                          )}
                        </div>
                        {operation.ambiguity && (
                          <div style={{ color: '#8a4b00', fontSize: 12 }}>
                            Ambiguity: {operation.ambiguity}
                          </div>
                        )}
                        {operation.source?.quote && (
                          <div style={{ fontSize: 12, color: '#444' }}>
                            Source: "{operation.source.quote}"
                          </div>
                        )}
                        <pre
                          style={{
                            margin: 0,
                            fontSize: 11,
                            background: '#f6f7fb',
                            border: '1px solid #e2e7f2',
                            borderRadius: 6,
                            padding: 8,
                            maxHeight: 120,
                            overflow: 'auto',
                          }}
                        >
                          {payloadPreview}
                        </pre>
                      </label>
                    );
                  })}
                </div>
                {(pendingSessionCaptureData.ambiguityNotes || []).length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: '#8a4b00' }}>
                    Global ambiguities:
                    <ul style={{ margin: '6px 0 0 20px' }}>
                      {pendingSessionCaptureData.ambiguityNotes!.map((note, index) => (
                        <li key={`${note}-${index}`}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button onClick={completeSessionCaptureImport}>Apply Selected</button>
                  <button
                    onClick={() => {
                      setSessionCaptureDialogOpen(false);
                      setPendingSessionCaptureData(null);
                      setPendingSessionCaptureFileName('');
                      setSessionCaptureSelections({});
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          {clientProfileDraft && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2070,
              }}
              onClick={() => setClientProfileDraft(null)}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 10,
                  padding: 16,
                  width: 620,
                  maxWidth: 'calc(100vw - 24px)',
                  maxHeight: 'calc(100vh - 24px)',
                  overflowY: 'auto',
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <h4 style={{ marginTop: 0, marginBottom: 10 }}>
                  Client Properties · {clientProfileDraft.personName || 'Person'}
                </h4>
                {(() => {
                  const modalRowStyle: React.CSSProperties = {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 12,
                    marginTop: 8,
                  };
                  const modalLabelStyle: React.CSSProperties = {
                    width: 230,
                    textAlign: 'right',
                    fontWeight: 600,
                  };
                  const modalControlStyle: React.CSSProperties = { width: '58%' };
                  return (
                    <>
                      <div style={modalRowStyle}>
                        <label htmlFor="clientColor" style={modalLabelStyle}>Client Color:</label>
                        <div style={{ ...modalControlStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            id="clientColor"
                            type="color"
                            value={clientProfileDraft.clientColor}
                            onChange={(event) =>
                              updateClientProfileDraftField('clientColor', event.target.value)
                            }
                            style={{ width: 64 }}
                          />
                        </div>
                      </div>
                      <div style={modalRowStyle}>
                        <label htmlFor="clientIssue1" style={modalLabelStyle}>Presenting Issue 1:</label>
                        <input
                          id="clientIssue1"
                          type="text"
                          value={clientProfileDraft.presentingIssue1}
                          onChange={(event) =>
                            updateClientProfileDraftField('presentingIssue1', event.target.value)
                          }
                          style={modalControlStyle}
                        />
                      </div>
                      <div style={modalRowStyle}>
                        <label htmlFor="clientIssue2" style={modalLabelStyle}>Presenting Issue 2:</label>
                        <input
                          id="clientIssue2"
                          type="text"
                          value={clientProfileDraft.presentingIssue2}
                          onChange={(event) =>
                            updateClientProfileDraftField('presentingIssue2', event.target.value)
                          }
                          style={modalControlStyle}
                        />
                      </div>
                      <div style={modalRowStyle}>
                        <label htmlFor="clientIssue3" style={modalLabelStyle}>Presenting Issue 3:</label>
                        <input
                          id="clientIssue3"
                          type="text"
                          value={clientProfileDraft.presentingIssue3}
                          onChange={(event) =>
                            updateClientProfileDraftField('presentingIssue3', event.target.value)
                          }
                          style={modalControlStyle}
                        />
                      </div>
                      <div style={modalRowStyle}>
                        <label htmlFor="clientOutcome1" style={modalLabelStyle}>Desired Outcome 1:</label>
                        <input
                          id="clientOutcome1"
                          type="text"
                          value={clientProfileDraft.desiredOutcome1}
                          onChange={(event) =>
                            updateClientProfileDraftField('desiredOutcome1', event.target.value)
                          }
                          style={modalControlStyle}
                        />
                      </div>
                      <div style={modalRowStyle}>
                        <label htmlFor="clientOutcome2" style={modalLabelStyle}>Desired Outcome 2:</label>
                        <input
                          id="clientOutcome2"
                          type="text"
                          value={clientProfileDraft.desiredOutcome2}
                          onChange={(event) =>
                            updateClientProfileDraftField('desiredOutcome2', event.target.value)
                          }
                          style={modalControlStyle}
                        />
                      </div>
                      <div style={modalRowStyle}>
                        <label htmlFor="clientOutcome3" style={modalLabelStyle}>Desired Outcome 3:</label>
                        <input
                          id="clientOutcome3"
                          type="text"
                          value={clientProfileDraft.desiredOutcome3}
                          onChange={(event) =>
                            updateClientProfileDraftField('desiredOutcome3', event.target.value)
                          }
                          style={modalControlStyle}
                        />
                      </div>
                      <div style={{ ...modalRowStyle, alignItems: 'flex-start' }}>
                        <label htmlFor="clientConceptualization" style={{ ...modalLabelStyle, marginTop: 6 }}>
                          Client&apos;s Conceptualization of the Situation:
                        </label>
                        <textarea
                          id="clientConceptualization"
                          value={clientProfileDraft.conceptualization}
                          onChange={(event) =>
                            updateClientProfileDraftField('conceptualization', event.target.value)
                          }
                          rows={5}
                          style={{ ...modalControlStyle, resize: 'vertical' }}
                        />
                      </div>
                    </>
                  );
                })()}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                  <button onClick={() => setClientProfileDraft(null)}>Cancel</button>
                  <button onClick={saveClientProfileDraft}>Save</button>
                </div>
              </div>
            </div>
          )}
          {coachThinkingDraft && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2072,
              }}
              onClick={() => setCoachThinkingDraft(null)}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 10,
                  padding: 16,
                  width: 620,
                  maxWidth: 'calc(100vw - 24px)',
                  maxHeight: 'calc(100vh - 24px)',
                  overflowY: 'auto',
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <h4 style={{ marginTop: 0, marginBottom: 10 }}>
                  Coach Thinking · {coachThinkingDraft.personName || 'Coach'}
                </h4>
                {(() => {
                  const modalRowStyle: React.CSSProperties = {
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-end',
                    gap: 12,
                    marginTop: 8,
                  };
                  const modalLabelStyle: React.CSSProperties = {
                    width: 180,
                    textAlign: 'right',
                    fontWeight: 600,
                    marginTop: 6,
                  };
                  const modalControlStyle: React.CSSProperties = { width: '66%' };
                  return (
                    <>
                      <div style={modalRowStyle}>
                        <label htmlFor="coachThinkingText" style={modalLabelStyle}>Thinking:</label>
                        <textarea
                          id="coachThinkingText"
                          value={coachThinkingDraft.thinking}
                          onChange={(event) =>
                            updateCoachThinkingField('thinking', event.target.value)
                          }
                          rows={4}
                          style={{ ...modalControlStyle, resize: 'vertical' }}
                        />
                      </div>
                      <div style={modalRowStyle}>
                        <label htmlFor="coachThinkingNotes" style={modalLabelStyle}>Notes:</label>
                        <textarea
                          id="coachThinkingNotes"
                          value={coachThinkingDraft.notes}
                          onChange={(event) =>
                            updateCoachThinkingField('notes', event.target.value)
                          }
                          rows={5}
                          style={{ ...modalControlStyle, resize: 'vertical' }}
                        />
                      </div>
                    </>
                  );
                })()}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                  <button onClick={() => setCoachThinkingDraft(null)}>Cancel</button>
                  <button onClick={saveCoachThinkingDraft}>Save</button>
                </div>
              </div>
            </div>
          )}
          {emotionalPatternModalOpen && emotionalPatternDraft && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2075,
              }}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 10,
                  padding: 16,
                  width: 560,
                  maxWidth: 'calc(100vw - 24px)',
                  maxHeight: 'calc(100vh - 24px)',
                  overflowY: 'auto',
                }}
              >
                <h4 style={{ marginTop: 0, marginBottom: 8 }}>Add Emotional Pattern</h4>
                {(() => {
                  const modalRowStyle: React.CSSProperties = {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 12,
                    marginTop: 8,
                  };
                  const modalLabelStyle: React.CSSProperties = {
                    width: 170,
                    textAlign: 'right',
                    fontWeight: 600,
                  };
                  const modalControlStyle: React.CSSProperties = { width: '60%' };
                  const intensityOptions = emotionalPatternIntensityOptions(
                    emotionalPatternDraft.relationshipType
                  );
                  const colorOptions = [
                    '#444444',
                    '#FF1744',
                    '#2979FF',
                    '#00C853',
                    '#FF9100',
                    '#E040FB',
                  ];
                  return (
                    <>
                      <div style={modalRowStyle}>
                        <label htmlFor="addPatternType" style={modalLabelStyle}>Emotional Pattern:</label>
                        <select
                          id="addPatternType"
                          value={emotionalPatternDraft.relationshipType}
                          onChange={(e) => {
                            const relationshipType = e.target
                              .value as EmotionalLine['relationshipType'];
                            const validStyles = LINE_STYLE_VALUES[relationshipType] || ['low'];
                            const nextStyle = validStyles.includes(emotionalPatternDraft.lineStyle)
                              ? emotionalPatternDraft.lineStyle
                              : validStyles[0];
                            updateEmotionalPatternDraft({
                              relationshipType,
                              lineStyle: nextStyle,
                            });
                          }}
                          style={{ ...modalControlStyle, width: '60%' }}
                        >
                          <option value="fusion">Fusion</option>
                          <option value="distance">Distance</option>
                          <option value="cutoff">Cutoff</option>
                          <option value="conflict">Conflict</option>
                          <option value="projection">Projection</option>
                        </select>
                      </div>
                      <div style={modalRowStyle}>
                        <label htmlFor="addPatternStatus" style={modalLabelStyle}>Status:</label>
                        <select
                          id="addPatternStatus"
                          value={emotionalPatternDraft.status}
                          onChange={(e) =>
                            updateEmotionalPatternDraft({
                              status: e.target.value as NonNullable<EmotionalLine['status']>,
                            })
                          }
                          style={{ ...modalControlStyle, width: '60%' }}
                        >
                          <option value="ongoing">Ongoing</option>
                          <option value="ended">Ended</option>
                        </select>
                      </div>
                      <div style={modalRowStyle}>
                        <label htmlFor="addPatternIntensity" style={modalLabelStyle}>Intensity:</label>
                        <select
                          id="addPatternIntensity"
                          value={emotionalPatternDraft.lineStyle}
                          onChange={(e) =>
                            updateEmotionalPatternDraft({
                              lineStyle: e.target.value as EmotionalLine['lineStyle'],
                              intensityLevel: intensityValueForLineStyle(
                                e.target.value as EmotionalLine['lineStyle']
                              ),
                            })
                          }
                          style={{ ...modalControlStyle, width: '60%' }}
                        >
                          {intensityOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={modalRowStyle}>
                        <label htmlFor="addPatternStart" style={modalLabelStyle}>Start:</label>
                        <div style={modalControlStyle}>
                          <DatePickerField
                            id="addPatternStart"
                            name="addPatternStart"
                            value={emotionalPatternDraft.startDate}
                            placeholder="YYYY-MM-DD"
                            onChange={(e) =>
                              updateEmotionalPatternDraft({
                                startDate: e.target.value,
                              })
                            }
                            pickerLabel="Select emotional pattern start"
                          />
                        </div>
                      </div>
                      <div style={modalRowStyle}>
                        <label htmlFor="addPatternIntensityLevel" style={modalLabelStyle}>Intensity Level:</label>
                        <select
                          id="addPatternIntensityLevel"
                          value={emotionalPatternDraft.intensityLevel}
                          onChange={(e) =>
                            updateEmotionalPatternDraft({
                              intensityLevel: Number(e.target.value),
                            })
                          }
                          style={{ ...modalControlStyle, width: '60%' }}
                        >
                          {INTENSITY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={modalRowStyle}>
                        <label htmlFor="addPatternImpact" style={modalLabelStyle}>Impact:</label>
                        <select
                          id="addPatternImpact"
                          value={emotionalPatternDraft.impact}
                          onChange={(e) =>
                            updateEmotionalPatternDraft({
                              impact: Number(e.target.value),
                            })
                          }
                          style={{ ...modalControlStyle, width: '60%' }}
                        >
                          {IMPACT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={modalRowStyle}>
                        <label htmlFor="addPatternFrequency" style={modalLabelStyle}>Frequency:</label>
                        <select
                          id="addPatternFrequency"
                          value={emotionalPatternDraft.frequency}
                          onChange={(e) =>
                            updateEmotionalPatternDraft({
                              frequency: Number(e.target.value),
                            })
                          }
                          style={{ ...modalControlStyle, width: '60%' }}
                        >
                          {FREQUENCY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={modalRowStyle}>
                        <label htmlFor="addPatternEnd" style={modalLabelStyle}>End Date:</label>
                        <div style={modalControlStyle}>
                          <DatePickerField
                            id="addPatternEnd"
                            name="addPatternEnd"
                            value={emotionalPatternDraft.endDate}
                            placeholder="YYYY-MM-DD"
                            onChange={(e) =>
                              updateEmotionalPatternDraft({
                                endDate: e.target.value,
                              })
                            }
                            pickerLabel="Select emotional pattern end"
                          />
                        </div>
                      </div>
                      <div style={{ ...modalRowStyle, alignItems: 'flex-start' }}>
                        <label htmlFor="addPatternNotes" style={{ ...modalLabelStyle, marginTop: 6 }}>
                          Notes:
                        </label>
                        <textarea
                          id="addPatternNotes"
                          rows={4}
                          value={emotionalPatternDraft.notes}
                          onChange={(e) =>
                            updateEmotionalPatternDraft({
                              notes: e.target.value,
                            })
                          }
                          style={{ ...modalControlStyle, resize: 'vertical' }}
                        />
                      </div>
                      <div style={modalRowStyle}>
                        <label htmlFor="addPatternColor" style={modalLabelStyle}>Color:</label>
                        <div style={{ ...modalControlStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="color"
                            id="addPatternColor"
                            value={emotionalPatternDraft.color}
                            onChange={(e) =>
                              updateEmotionalPatternDraft({
                                color: e.target.value,
                              })
                            }
                            style={{ width: 60 }}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            {colorOptions.map((hex) => (
                              <button
                                key={hex}
                                type="button"
                                onClick={() => updateEmotionalPatternDraft({ color: hex })}
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  border: '1px solid #ccc',
                                  background: hex,
                                  cursor: 'pointer',
                                }}
                                aria-label={`Set color ${hex}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                  <button
                    onClick={() => {
                      setEmotionalPatternModalOpen(false);
                      setEmotionalPatternDraft(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button onClick={saveAddEmotionalPattern}>Save</button>
                </div>
              </div>
            </div>
          )}
          {settingsOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000,
              }}
            >
              <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 360 }}>
                <h4>Event Categories</h4>
                <p style={{ marginTop: 4, color: '#555', fontSize: 13 }}>
                  Default categories are shipped with the app. You can add categories, but categories cannot be deleted.
                </p>
                <div style={{ marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Add category"
                    value={settingsDraft}
                    onChange={(e) => setSettingsDraft(e.target.value)}
                  />
                  <button
                    onClick={() => {
                      const trimmed = settingsDraft.trim();
                      if (!trimmed) return;
                      if (!eventCategories.includes(trimmed)) {
                        setEventCategories([...eventCategories, trimmed]);
                      }
                      setSettingsDraft('');
                    }}
                    style={{ marginLeft: 6 }}
                  >
                    Add
                  </button>
                </div>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {eventCategories.map((category) => (
                    <li key={category} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>{category}</span>
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button onClick={() => setSettingsOpen(false)}>Close</button>
                </div>
              </div>
            </div>
          )}
          {relationshipTypeSettingsOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2020,
              }}
            >
              <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 360 }}>
                <h4>Relationship Categories</h4>
                <p style={{ marginTop: 4, color: '#555', fontSize: 13 }}>
                  Add partnership relationship categories used in the Properties panel. Existing categories cannot be deleted here.
                </p>
                <div style={{ marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Add relationship category"
                    value={relationshipTypeDraft}
                    onChange={(e) => setRelationshipTypeDraft(e.target.value)}
                  />
                  <button
                    onClick={() => {
                      const trimmed = relationshipTypeDraft.trim();
                      if (!trimmed) return;
                      if (!relationshipTypes.includes(trimmed)) {
                        setRelationshipTypes(sortLabelsAZ([...relationshipTypes, trimmed]));
                      }
                      setRelationshipTypeDraft('');
                    }}
                    style={{ marginLeft: 6 }}
                  >
                    Add
                  </button>
                </div>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {sortedRelationshipTypes.map((category) => (
                    <li key={category} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>{category.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}</span>
                      <button
                        type="button"
                        aria-label="Delete"
                        title="Delete"
                        onClick={() =>
                          setRelationshipTypes((prev) => prev.filter((entry) => entry !== category))
                        }
                        style={{ color: '#b00020' }}
                      >
                        🗑
                      </button>
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button onClick={() => setRelationshipTypeSettingsOpen(false)}>Close</button>
                </div>
              </div>
            </div>
          )}
          {relationshipStatusSettingsOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2030,
              }}
            >
              <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 360 }}>
                <h4>Relationship Statuses</h4>
                <p style={{ marginTop: 4, color: '#555', fontSize: 13 }}>
                  Add partnership relationship statuses used in the Properties panel. Existing statuses cannot be deleted here.
                </p>
                <div style={{ marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Add relationship status"
                    value={relationshipStatusDraft}
                    onChange={(e) => setRelationshipStatusDraft(e.target.value)}
                  />
                  <button
                    onClick={() => {
                      const trimmed = relationshipStatusDraft.trim();
                      if (!trimmed) return;
                      if (!relationshipStatuses.includes(trimmed)) {
                        setRelationshipStatuses(sortLabelsAZ([...relationshipStatuses, trimmed]));
                      }
                      setRelationshipStatusDraft('');
                    }}
                    style={{ marginLeft: 6 }}
                  >
                    Add
                  </button>
                </div>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {sortedRelationshipStatuses.map((status) => (
                    <li key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>{status.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}</span>
                      <button
                        type="button"
                        aria-label="Delete"
                        title="Delete"
                        onClick={() =>
                          setRelationshipStatuses((prev) => prev.filter((entry) => entry !== status))
                        }
                        style={{ color: '#b00020' }}
                      >
                        🗑
                      </button>
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button onClick={() => setRelationshipStatusSettingsOpen(false)}>Close</button>
                </div>
              </div>
            </div>
          )}
          {indicatorSettingsOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2050,
              }}
            >
              <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 520, maxHeight: '80vh', overflow: 'auto' }}>
                <h4>Symptom Categories</h4>
                <p style={{ marginTop: 4, color: '#555', fontSize: 13 }}>
                  Add a category name. After adding, edit group, image, letter, and color on the saved category row.
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder="Category Name"
                    value={indicatorDraftLabel}
                    onChange={(e) => setIndicatorDraftLabel(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button onClick={addFunctionalIndicatorDefinition} disabled={!indicatorDraftLabel.trim()}>
                    Add
                  </button>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {functionalIndicatorDefinitions.length === 0 && (
                    <li style={{ fontStyle: 'italic', color: '#777' }}>No symptom categories defined yet.</li>
                  )}
                  {functionalIndicatorDefinitions.map((definition) => (
                    <li
                      key={definition.id}
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: 8,
                        padding: 10,
                        background: '#fdfdfd',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 8,
                            border: '1px solid #ccc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: definition.color ? `${definition.color}22` : '#fff',
                            flexShrink: 0,
                          }}
                        >
                          {definition.iconDataUrl && !definition.useLetter ? (
                            <img src={definition.iconDataUrl} alt={`${definition.label} icon`} style={{ maxWidth: '100%', maxHeight: '100%' }} />
                          ) : (
                            <span style={{ fontWeight: 600 }}>{(definition.label.trim().charAt(0) || '?').toUpperCase()}</span>
                          )}
                        </div>
                        <input
                          type="text"
                          value={definition.label}
                          onChange={(e) => updateFunctionalIndicatorLabel(definition.id, e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <select
                          aria-label={`Symptom Group for ${definition.label}`}
                          value={definition.group || 'physical'}
                          onChange={(e) =>
                            updateFunctionalIndicatorGroup(
                              definition.id,
                              e.target.value as 'physical' | 'emotional' | 'social'
                            )
                          }
                        >
                          <option value="physical">physical</option>
                          <option value="emotional">emotional</option>
                          <option value="social">social</option>
                        </select>
                        <input
                          type="color"
                          aria-label={`Category Color for ${definition.label}`}
                          value={definition.color || '#666666'}
                          onChange={(e) => updateFunctionalIndicatorColor(definition.id, e.target.value)}
                          style={{ width: 38, height: 32, padding: 2 }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <label style={{ fontSize: 13 }}>Category Image:</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              void updateFunctionalIndicatorIcon(definition.id, file);
                            }
                          }}
                        />
                        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                            <input
                              type="checkbox"
                              checked={definition.useLetter ?? !definition.iconDataUrl}
                              onChange={(e) =>
                                updateFunctionalIndicatorUseLetter(definition.id, e.target.checked)
                              }
                            />
                            Use Letter
                          </label>
                          <button onClick={() => clearFunctionalIndicatorIcon(definition.id)}>Clear Image</button>
                          <button onClick={() => removeFunctionalIndicatorDefinition(definition.id)} style={{ color: '#b00020' }}>
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button onClick={() => setIndicatorSettingsOpen(false)}>Close</button>
                </div>
              </div>
            </div>
          )}
          {selectedTimelinePeople.length > 0 && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2100,
              }}
            >
              <div style={{ background: 'white', padding: 16, borderRadius: 8, width: '92vw', maxWidth: 1500, maxHeight: '86vh', overflow: 'auto' }}>
                <h4>Timeline Board</h4>
                <div style={{ marginBottom: 8, color: '#555', fontSize: 13 }}>
                  People: {selectedTimelinePeople.map((person) => person.name).join(', ')}
                </div>
                {timelineYearBoundsForFilter && (
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong>Start Year</strong>
                      <button
                        onClick={() =>
                          setTimelineFilterStartYear((prev) =>
                            Math.min(
                              (prev ?? timelineYearBoundsForFilter.min) + 1,
                              selectedEndYear ?? timelineYearBoundsForFilter.max
                            )
                          )
                        }
                        aria-label="Increase start year"
                      >
                        ▲
                      </button>
                      <input
                        type="number"
                        value={selectedStartYear ?? ''}
                        min={timelineYearBoundsForFilter.min}
                        max={selectedEndYear ?? timelineYearBoundsForFilter.max}
                        onFocus={() => setTimelineYearPickTarget('start')}
                        onChange={(e) => {
                          const parsed = Number(e.target.value);
                          if (!Number.isFinite(parsed)) return;
                          const next = Math.max(
                            timelineYearBoundsForFilter.min,
                            Math.min(parsed, selectedEndYear ?? timelineYearBoundsForFilter.max)
                          );
                          setTimelineFilterStartYear(next);
                        }}
                        style={{
                          width: 84,
                          border: timelineYearPickTarget === 'start' ? '2px solid #3f7ad6' : undefined,
                        }}
                      />
                      <button
                        onClick={() =>
                          setTimelineFilterStartYear((prev) =>
                            Math.max(
                              (prev ?? timelineYearBoundsForFilter.min) - 1,
                              timelineYearBoundsForFilter.min
                            )
                          )
                        }
                        aria-label="Decrease start year"
                      >
                        ▼
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong>End Year</strong>
                      <button
                        onClick={() =>
                          setTimelineFilterEndYear((prev) =>
                            Math.min(
                              (prev ?? timelineYearBoundsForFilter.max) + 1,
                              timelineYearBoundsForFilter.max
                            )
                          )
                        }
                        aria-label="Increase end year"
                      >
                        ▲
                      </button>
                      <input
                        type="number"
                        value={selectedEndYear ?? ''}
                        min={selectedStartYear ?? timelineYearBoundsForFilter.min}
                        max={timelineYearBoundsForFilter.max}
                        onFocus={() => setTimelineYearPickTarget('end')}
                        onChange={(e) => {
                          const parsed = Number(e.target.value);
                          if (!Number.isFinite(parsed)) return;
                          const next = Math.min(
                            timelineYearBoundsForFilter.max,
                            Math.max(parsed, selectedStartYear ?? timelineYearBoundsForFilter.min)
                          );
                          setTimelineFilterEndYear(next);
                        }}
                        style={{
                          width: 84,
                          border: timelineYearPickTarget === 'end' ? '2px solid #3f7ad6' : undefined,
                        }}
                      />
                      <button
                        onClick={() =>
                          setTimelineFilterEndYear((prev) =>
                            Math.max(
                              (prev ?? timelineYearBoundsForFilter.max) - 1,
                              selectedStartYear ?? timelineYearBoundsForFilter.min
                            )
                          )
                        }
                        aria-label="Decrease end year"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                )}
                {!timelineHasVisibleItems || !timelineDisplayRange ? (
                  <div style={{ fontStyle: 'italic' }}>No timeline items.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12 }}>
                    <div style={{ border: '1px solid #d7d7d7', borderRadius: 8, overflow: 'hidden', minWidth: 960 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', borderBottom: '1px solid #ddd' }}>
                        <div style={{ background: '#f0f0f0', padding: '12px 10px', fontWeight: 700 }}>Lane</div>
                        <div
                          style={{
                            position: 'relative',
                            minHeight: 30,
                            background: '#fafafa',
                            borderLeft: '1px solid #ddd',
                            cursor: timelineYearDrag ? 'grabbing' : 'grab',
                            userSelect: 'none',
                            touchAction: 'none',
                          }}
                          onPointerDown={(e) => {
                            if (
                              selectedStartYear == null ||
                              selectedEndYear == null ||
                              !timelineYearBoundsForFilter
                            ) {
                              return;
                            }
                            e.preventDefault();
                            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTimelineYearDrag({
                              pointerId: e.pointerId,
                              startClientX: e.clientX,
                              stripLeft: rect.left,
                              stripWidth: rect.width,
                              startYear: selectedStartYear,
                              endYear: selectedEndYear,
                              minYear: timelineYearBoundsForFilter.min,
                              maxYear: timelineYearBoundsForFilter.max,
                              moved: false,
                            });
                          }}
                          onPointerMove={(e) => {
                            if (!timelineYearDrag || timelineYearDrag.pointerId !== e.pointerId) return;
                            handleTimelineStripDragMove(e.clientX);
                          }}
                          onPointerUp={(e) => {
                            if (!timelineYearDrag || timelineYearDrag.pointerId !== e.pointerId) return;
                            finishTimelineStripDrag(e.clientX);
                            if ((e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId)) {
                              (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                            }
                          }}
                          onPointerCancel={(e) => {
                            if (!timelineYearDrag || timelineYearDrag.pointerId !== e.pointerId) return;
                            setTimelineYearDrag(null);
                            if ((e.currentTarget as HTMLDivElement).hasPointerCapture(e.pointerId)) {
                              (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                            }
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              right: 8,
                              top: 6,
                              fontSize: 10,
                              color: '#5d6b82',
                              background: 'rgba(255,255,255,0.7)',
                              padding: '1px 5px',
                              borderRadius: 10,
                              border: '1px solid #d5ddec',
                              pointerEvents: 'none',
                              zIndex: 2,
                            }}
                          >
                            Drag strip to pan years
                          </div>
                          {timelineYearSlices.map((slice, index) => (
                            <div
                              key={`slice-${slice.year}`}
                              onClick={() => applyPickedYear(slice.year)}
                              style={{
                                position: 'absolute',
                                left: `${slice.leftPct}%`,
                                top: 0,
                                width: `${slice.widthPct}%`,
                                height: 30,
                                background: index % 2 === 0 ? '#edf2fc' : '#e4ebfa',
                                borderRight: '1px solid #d5ddec',
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#37527a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              {shouldShowYearLabel(slice.year) ? slice.year : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                      {timelineLanes.map((lane) => {
                        const filteredItems = lane.items.filter((item) => {
                          const startTs = parseTimelineDate(item.startDate);
                          const endTs = parseTimelineDate(item.endDate || item.startDate);
                          if (startTs == null || endTs == null) return false;
                          return endTs >= timelineDisplayRange.min && startTs <= timelineDisplayRange.max;
                        });
                        const sorted = [...filteredItems].sort((a, b) => {
                          const aStart = parseTimelineDate(a.startDate) ?? Number.MAX_SAFE_INTEGER;
                          const bStart = parseTimelineDate(b.startDate) ?? Number.MAX_SAFE_INTEGER;
                          if (aStart === bStart) return 0;
                          return aStart < bStart ? -1 : 1;
                        });
                        const rowRightEdges = [-Infinity, -Infinity, -Infinity];
                        const place = sorted.map((item) => {
                          const startTs = parseTimelineDate(item.startDate) ?? timelineDisplayRange.min;
                          const endTs = parseTimelineDate(item.endDate || item.startDate) ?? startTs;
                          const leftPct = ((startTs - timelineDisplayRange.min) / (timelineDisplayRange.max - timelineDisplayRange.min)) * 100;
                          const endPct = ((endTs - timelineDisplayRange.min) / (timelineDisplayRange.max - timelineDisplayRange.min)) * 100;
                          const spanPct = Math.max(7, endPct - leftPct);
                          const centeredLeftPct = leftPct - spanPct / 2;
                          const clampedLeftPct = Math.max(0, Math.min(centeredLeftPct, 100 - spanPct));
                          let rowIndex = rowRightEdges.findIndex((edge) => leftPct >= edge + 0.6);
                          if (rowIndex === -1) {
                            rowIndex = rowRightEdges.indexOf(Math.min(...rowRightEdges));
                          }
                          rowRightEdges[rowIndex] = Math.max(rowRightEdges[rowIndex], leftPct + spanPct);
                          return {
                            ...item,
                            leftPct,
                            clampedLeftPct,
                            spanPct,
                            rowOffset: rowIndex * 34,
                          };
                        });
                        const stripSelfName = (value: string, laneLabel: string) => {
                          if (!value) return value;
                          const escaped = laneLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                          const regex = new RegExp(`\\b${escaped}\\b`, 'ig');
                          return value
                            .replace(regex, '')
                            .replace(/\s*·\s*$/, '')
                            .replace(/^\s*·\s*/, '')
                            .replace(/\s{2,}/g, ' ')
                            .trim();
                        };
                        return (
                          <div key={lane.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', borderTop: '1px dashed #d7d7d7' }}>
                            <div
                              style={{ background: '#f6f6f8', padding: '14px 10px', fontWeight: 700, cursor: lane.id === 'family' ? 'default' : 'pointer' }}
                              onClick={() => {
                                if (lane.id === 'family') return;
                                setTimelineBoardSelection({
                                  laneLabel: lane.label,
                                  entityType: 'person',
                                  entityId: lane.id,
                                  itemLabel: lane.label,
                                });
                                setTimelineBoardEventDraft(null);
                              }}
                            >
                              {lane.label}
                            </div>
                            <div style={{ position: 'relative', minHeight: 112, borderLeft: '1px solid #ddd', background: '#fff' }}>
                              {place.map((item) => (
                                <div
                                  key={item.id}
                                  title={item.notes || ''}
                                  onClick={() => handleTimelineItemClick(lane.label, item)}
                                  onMouseEnter={(e) => {
                                    if (!item.notes) return;
                                    setTimelineHoverNote({
                                      text: item.notes,
                                      x: e.clientX + 10,
                                      y: e.clientY + 12,
                                    });
                                  }}
                                  onMouseMove={(e) => {
                                    if (!item.notes) return;
                                    setTimelineHoverNote({
                                      text: item.notes,
                                      x: e.clientX + 10,
                                      y: e.clientY + 12,
                                    });
                                  }}
                                  onMouseLeave={() => setTimelineHoverNote(null)}
                                  style={{
                                  position: 'absolute',
                                    left: `${item.spanPct <= 8 ? item.clampedLeftPct : item.leftPct}%`,
                                    top: 10 + item.rowOffset,
                                    width: `${item.spanPct}%`,
                                    minWidth: 130,
                                    transform: 'none',
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    border:
                                      timelineBoardSelection?.entityId === item.entityId &&
                                      timelineBoardSelection?.eventId === item.eventId
                                        ? '2px solid #2f64b8'
                                        : '1px solid #cad3e0',
                                    background: item.color,
                                    fontSize: 13,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <strong>{stripSelfName(item.label, lane.label)}</strong>
                                  {item.detail ? ` · ${stripSelfName(item.detail, lane.label)}` : ''}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ border: '1px solid #d7d7d7', borderRadius: 8, padding: 10, background: '#fcfdff' }}>
                      <h5 style={{ margin: '2px 0 8px' }}>Timeline Properties</h5>
                      {!timelineBoardSelection ? (
                        <div style={{ fontStyle: 'italic', color: '#667' }}>
                          Click an event block or lane name to inspect properties.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div><strong>Lane:</strong> {timelineBoardSelection.laneLabel}</div>
                          <div><strong>Type:</strong> {timelineBoardSelection.entityType}</div>
                          <div><strong>Item:</strong> {timelineBoardSelection.itemLabel}</div>
                          {timelineBoardSelection.startDate && (
                            <div><strong>Start:</strong> {timelineBoardSelection.startDate}</div>
                          )}
                          {timelineBoardSelection.endDate && (
                            <div><strong>End:</strong> {timelineBoardSelection.endDate}</div>
                          )}
                          {timelineBoardSelection.entityType === 'person' && timelineSelectionResolved?.person && (
                            <>
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                Person Name
                                <input
                                  type="text"
                                  value={timelineSelectionResolved.person.name || ''}
                                  onChange={(e) =>
                                    handleTimelinePersonPropertyChange('name', e.target.value)
                                  }
                                />
                              </label>
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                Person Notes
                                <textarea
                                  rows={4}
                                  value={timelineSelectionResolved.person.notes || ''}
                                  onChange={(e) =>
                                    handleTimelinePersonPropertyChange('notes', e.target.value)
                                  }
                                  style={{ fontFamily: 'inherit' }}
                                />
                              </label>
                              <button onClick={addTimelineEventToSelectedPerson}>Add Event</button>
                            </>
                          )}
                          {timelineBoardEventDraft && (
                            <>
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                Date
                                <input
                                  type="date"
                                  value={timelineBoardEventDraft.event.date || ''}
                                  onChange={(e) => setTimelineEventDraftField('date', e.target.value)}
                                />
                              </label>
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                Category
                                <input
                                  type="text"
                                  value={timelineBoardEventDraft.event.category || ''}
                                  onChange={(e) => setTimelineEventDraftField('category', e.target.value)}
                                />
                              </label>
                              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                Notes
                                <textarea
                                  rows={7}
                                  value={timelineBoardEventDraft.event.observations || ''}
                                  onChange={(e) => setTimelineEventDraftField('observations', e.target.value)}
                                  style={{ fontFamily: 'inherit' }}
                                />
                              </label>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button onClick={cancelTimelineEventDraft}>Cancel</button>
                                <button onClick={saveTimelineEventDraft}>Save</button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {timelineHoverNote && (
                  <div
                    style={{
                      position: 'fixed',
                      left: timelineHoverNote.x,
                      top: timelineHoverNote.y,
                      maxWidth: 320,
                      background: '#fff',
                      border: '1px solid #b6bfd0',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 12,
                      color: '#253044',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                      zIndex: 2300,
                      pointerEvents: 'none',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {timelineHoverNote.text}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    onClick={() => {
                      setTimelineSelectionIds([]);
                      setTimelineYearPickTarget(null);
                      setTimelineYearDrag(null);
                      setTimelineFilterStartYear(null);
                      setTimelineFilterEndYear(null);
                      setTimelineHoverNote(null);
                      setTimelineBoardSelection(null);
                      setTimelineBoardEventDraft(null);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
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
          {selectedRibbonHelp && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Ribbon help"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2420,
              }}
              onClick={() => setRibbonHelpKey(null)}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: '18px 20px',
                  width: 'min(460px, 92vw)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>{selectedRibbonHelp.title}</h3>
                  <button
                    onClick={() => setRibbonHelpKey(null)}
                    aria-label="Close ribbon help"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: 22,
                      lineHeight: 1,
                      cursor: 'pointer',
                    }}
                  >
                    ×
                  </button>
                </div>
                <textarea
                  value={selectedRibbonHelpBody}
                  readOnly
                  style={{
                    marginTop: 10,
                    width: '100%',
                    minHeight: 120,
                    borderRadius: 8,
                    border: '1px solid #c8d3e4',
                    padding: 10,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    lineHeight: 1.4,
                  }}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#596b86' }}>
                  To edit this text, update <code>src/frontend/src/data/helpContent.ts</code>.
                </div>
              </div>
            </div>
          )}
          {helpOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Quick start help"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2400,
              }}
              onClick={() => setHelpOpen(false)}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 16,
                  padding: '24px 28px',
                  width: 'min(50vw, 520px)',
                  maxHeight: '70vh',
                  overflowY: 'auto',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        textTransform: 'uppercase',
                        color: '#616161',
                        letterSpacing: 1,
                      }}
                    >
                      Quick Start
                    </div>
                    <h2 style={{ margin: '4px 0 0', fontSize: 22 }}>Family Diagram Maker</h2>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={handleStartDemoTour}
                      style={{
                        border: '1px solid #1976d2',
                        color: '#1976d2',
                        background: '#fff',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Demo
                    </button>
                    <button
                      onClick={handleStartBuildDemo}
                      style={{
                        border: '1px solid #1976d2',
                        color: '#1976d2',
                        background: '#fff',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Build Demo
                    </button>
                    <button
                      onClick={() => setHelpOpen(false)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: 24,
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                      aria-label="Close help"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                  {HELP_SECTIONS.map((section) => (
                    <div key={section.title}>
                      <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>{section.title}</h3>
                      <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.5 }}>
                        {section.tips.map((tip) => (
                          <li key={tip}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setReadmeViewerOpen(true)}
                      style={{
                        border: '1px solid #1976d2',
                        color: '#1976d2',
                        background: '#fff',
                        borderRadius: 6,
                        padding: '8px 14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Open README Viewer
                    </button>
                    <button
                      onClick={() => setTrainingVideosOpen(true)}
                      style={{
                        border: '1px solid #1976d2',
                        color: '#1976d2',
                        background: '#fff',
                        borderRadius: 6,
                        padding: '8px 14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Open Training Videos
                    </button>
                  </div>
                  <button
                    onClick={() => setHelpOpen(false)}
                    style={{
                      background: '#1976d2',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 18px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
          {trainingVideosOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Training videos"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2460,
              }}
              onClick={() => setTrainingVideosOpen(false)}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  padding: '20px 24px',
                  width: 'min(78vw, 1080px)',
                  maxHeight: '82vh',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <h2 style={{ margin: 0 }}>Training Videos</h2>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#5f6b7a' }}>
                      Open a lesson to review workflows inside the app.
                    </div>
                  </div>
                  <button
                    onClick={() => setTrainingVideosOpen(false)}
                    style={{ border: 'none', background: 'transparent', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}
                    aria-label="Close training videos"
                  >
                    ×
                  </button>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(260px, 320px) 1fr',
                    gap: 14,
                    overflow: 'hidden',
                    minHeight: 0,
                    flex: 1,
                  }}
                >
                  <div style={{ overflowY: 'auto', paddingRight: 6 }}>
                    {TRAINING_VIDEOS.map((video) => (
                      <button
                        key={video.id}
                        onClick={() => setSelectedTrainingVideoId(video.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: 8,
                          border:
                            video.id === selectedTrainingVideo?.id
                              ? '1px solid #1976d2'
                              : '1px solid #d0d7e2',
                          background:
                            video.id === selectedTrainingVideo?.id ? '#eef5ff' : '#fff',
                          cursor: 'pointer',
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#1f2d3d' }}>{video.title}</div>
                        <div style={{ fontSize: 12, color: '#4d627a', marginTop: 3 }}>{video.topic}</div>
                        <div style={{ fontSize: 12, color: '#7a8796', marginTop: 4 }}>
                          Duration: {video.duration}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {selectedTrainingVideo ? (
                      <>
                        <div style={{ fontWeight: 700, marginBottom: 8 }}>{selectedTrainingVideo.title}</div>
                        <div style={{ color: '#4d627a', fontSize: 13, marginBottom: 10 }}>
                          {selectedTrainingVideo.topic}
                        </div>
                        <div style={{ flex: 1, minHeight: 260, border: '1px solid #d0d7e2', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
                          <iframe
                            title={selectedTrainingVideo.title}
                            src={selectedTrainingVideo.embedUrl}
                            width="100%"
                            height="100%"
                            style={{ border: 0, minHeight: 260 }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                          />
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <a
                            href={selectedTrainingVideo.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#1976d2', fontWeight: 600 }}
                          >
                            Open in YouTube
                          </a>
                        </div>
                      </>
                    ) : (
                      <div style={{ color: '#555' }}>No videos configured.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {demoTourOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Interactive demo"
              style={{
                position: 'fixed',
                right: 20,
                bottom: 20,
                zIndex: 2480,
                width: 'min(420px, calc(100vw - 40px))',
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #c8d3e4',
                  borderRadius: 12,
                  boxShadow: '0 16px 40px rgba(0,0,0,0.24)',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: '#4a5b73', fontWeight: 600 }}>
                    Demo Step {demoTourStepIndex + 1} of {demoTourSteps.length}
                  </div>
                  <button
                    onClick={handleCloseDemoTour}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: 20,
                      lineHeight: 1,
                      cursor: 'pointer',
                    }}
                    aria-label="Close interactive demo"
                  >
                    ×
                  </button>
                </div>
                <div style={{ fontSize: 19, fontWeight: 700, color: '#1f2d3d' }}>
                  {currentDemoStep.title}
                </div>
                <div style={{ fontSize: 14, color: '#2a3950', lineHeight: 1.45 }}>
                  {currentDemoStep.body}
                </div>
                {currentDemoStep.clickToSelectHint && (
                  <div
                    style={{
                      fontSize: 13,
                      color: '#1f4f8f',
                      background: '#eef5ff',
                      border: '1px solid #c6dbff',
                      borderRadius: 8,
                      padding: '8px 10px',
                    }}
                  >
                    <strong>Click to Select:</strong> {currentDemoStep.clickToSelectHint}
                  </div>
                )}
                {currentDemoStep.rightClickOptions && currentDemoStep.rightClickOptions.length > 0 && (
                  <div
                    style={{
                      border: '1px solid #d8dfe8',
                      borderRadius: 8,
                      padding: '8px 10px',
                      background: '#fafcff',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#33475b', marginBottom: 4 }}>
                      Right-click options shown
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#3c4f63', lineHeight: 1.4 }}>
                      {currentDemoStep.rightClickOptions.map((option) => (
                        <li key={option}>{option}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <button
                    onClick={() => setDemoTourStepIndex((idx) => Math.max(0, idx - 1))}
                    disabled={demoTourStepIndex === 0}
                  >
                    Previous
                  </button>
                  {demoTourStepIndex < demoTourSteps.length - 1 ? (
                    <button onClick={() => setDemoTourStepIndex((idx) => Math.min(demoTourSteps.length - 1, idx + 1))}>
                      Next
                    </button>
                  ) : (
                    <button onClick={handleCloseDemoTour}>Finish</button>
                  )}
                </div>
              </div>
            </div>
          )}
          {buildDemoOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Build demo walkthrough"
              style={{
                position: 'fixed',
                right: 20,
                bottom: 20,
                zIndex: 2485,
                width: 'min(460px, calc(100vw - 40px))',
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #c8d3e4',
                  borderRadius: 12,
                  boxShadow: '0 16px 40px rgba(0,0,0,0.24)',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: '#4a5b73', fontWeight: 600 }}>
                    Build Step {buildDemoStepIndex + 1} of {buildDemoSteps.length}
                  </div>
                  <button
                    onClick={handleCloseBuildDemo}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      fontSize: 20,
                      lineHeight: 1,
                      cursor: 'pointer',
                    }}
                    aria-label="Close build demo walkthrough"
                  >
                    ×
                  </button>
                </div>
                <div style={{ fontSize: 19, fontWeight: 700, color: '#1f2d3d' }}>
                  {currentBuildDemoStep.title}
                </div>
                <div style={{ fontSize: 14, color: '#2a3950', lineHeight: 1.45 }}>
                  {currentBuildDemoStep.instruction}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#335177',
                    background: '#eef5ff',
                    border: '1px solid #c6dbff',
                    borderRadius: 8,
                    padding: '8px 10px',
                  }}
                >
                  Each step loads the expected result state. Use this to learn what action created it.
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <button
                    onClick={() => handleBuildDemoStepChange(buildDemoStepIndex - 1)}
                    disabled={buildDemoStepIndex === 0}
                  >
                    Previous
                  </button>
                  {buildDemoStepIndex < buildDemoSteps.length - 1 ? (
                    <button onClick={() => handleBuildDemoStepChange(buildDemoStepIndex + 1)}>
                      Next
                    </button>
                  ) : (
                    <button onClick={handleCloseBuildDemo}>Finish</button>
                  )}
                </div>
              </div>
            </div>
          )}
          {readmeViewerOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="README documentation"
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2450,
              }}
              onClick={() => setReadmeViewerOpen(false)}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  padding: '20px 24px',
                  width: 'min(70vw, 900px)',
                  maxHeight: '80vh',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h2 style={{ margin: 0 }}>README Documentation</h2>
                  <button
                    onClick={() => setReadmeViewerOpen(false)}
                    style={{ border: 'none', background: 'transparent', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}
                    aria-label="Close README viewer"
                  >
                    ×
                  </button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1, paddingRight: 6 }}>
                  <ReactMarkdown components={markdownComponents}>{readmeContent}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
          {sessionEventDraft && sessionEventTarget && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2300,
              }}
            >
              <div style={{ background: '#fff', borderRadius: 10, padding: 20, width: 420 }}>
                <h4 style={{ marginTop: 0 }}>Session Note Event</h4>
                {(() => {
                  const rowStyle: React.CSSProperties = {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 12,
                    marginTop: 8,
                  };
                  const labelStyle: React.CSSProperties = { width: 170, textAlign: 'right', fontWeight: 600 };
                  const controlStyle: React.CSSProperties = { width: '60%' };
                  return (
                    <>
                      <div style={rowStyle}>
                        <label htmlFor="sessionEventPrimaryPerson" style={labelStyle}>Primary Person:</label>
                        <div style={controlStyle}>
                          <input
                            type="text"
                            id="sessionEventPrimaryPerson"
                            value={sessionEventDraft.primaryPersonName || ''}
                            onChange={(e) => handleSessionEventDraftChange('primaryPersonName', e.target.value)}
                            list="session-event-primary-person"
                            style={{ width: '100%' }}
                          />
                          <datalist id="session-event-primary-person">
                            {sessionEventPrimaryOptions.map((name) => (
                              <option key={name} value={name} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                      <div style={rowStyle}>
                        <label htmlFor="sessionEventDate" style={labelStyle}>Date:</label>
                        <div style={controlStyle}>
                          <DatePickerField
                            id="sessionEventDate"
                            name="sessionEventDate"
                            value={sessionEventDraft.date}
                            placeholder="YYYY-MM-DD"
                            onChange={(e) => handleSessionEventDraftChange('date', e.target.value)}
                            buttonLabel="Select session event date"
                          />
                        </div>
                      </div>
                      <div style={rowStyle}>
                        <label htmlFor="sessionEventCategory" style={labelStyle}>Category:</label>
                        <select
                          id="sessionEventCategory"
                          value={sessionEventDraft.category}
                          onChange={(e) => handleSessionEventDraftChange('category', e.target.value)}
                          style={controlStyle}
                        >
                          {eventCategories.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={rowStyle}>
                        <label htmlFor="sessionEventStatus" style={labelStyle}>Status:</label>
                        <input
                          type="text"
                          id="sessionEventStatus"
                          value={sessionEventDraft.statusLabel || ''}
                          onChange={(e) => handleSessionEventDraftChange('statusLabel', e.target.value)}
                          style={controlStyle}
                          placeholder="e.g., Start"
                        />
                      </div>
                      <div style={rowStyle}>
                        <label style={labelStyle}>Event Class:</label>
                        <div style={{ ...controlStyle, textAlign: 'left' }}>
                          {EVENT_CLASS_LABELS[
                            sessionEventDraft.eventClass ||
                              getEventClassForTargetType(sessionEventTarget.type)
                          ]}
                        </div>
                      </div>
                      <div style={rowStyle}>
                        <label htmlFor="sessionEventIntensity" style={labelStyle}>Intensity (1-10):</label>
                        <input
                          type="number"
                          id="sessionEventIntensity"
                          min={1}
                          max={10}
                          value={sessionEventDraft.intensity}
                          onChange={(e) => handleSessionEventDraftChange('intensity', e.target.value)}
                          style={controlStyle}
                        />
                      </div>
                      <div style={rowStyle}>
                        <label htmlFor="sessionEventHowWell" style={labelStyle}>How well (1-9):</label>
                        <input
                          type="number"
                          id="sessionEventHowWell"
                          min={1}
                          max={9}
                          value={sessionEventDraft.howWell}
                          onChange={(e) => handleSessionEventDraftChange('howWell', e.target.value)}
                          style={controlStyle}
                        />
                      </div>
                      <div style={rowStyle}>
                        <label htmlFor="sessionEventOtherPerson" style={labelStyle}>Other Person:</label>
                        <div style={controlStyle}>
                          <input
                            type="text"
                            id="sessionEventOtherPerson"
                            value={sessionEventDraft.otherPersonName}
                            onChange={(e) => handleSessionEventDraftChange('otherPersonName', e.target.value)}
                            list="session-event-other-person"
                            style={{ width: '100%' }}
                          />
                          <datalist id="session-event-other-person">
                            {sessionEventOtherOptions.map((name) => (
                              <option key={name} value={name} />
                            ))}
                          </datalist>
                        </div>
                      </div>
                      <div style={rowStyle}>
                        <label htmlFor="sessionEventWwwwh" style={labelStyle}>WWWWH:</label>
                        <textarea
                          id="sessionEventWwwwh"
                          value={sessionEventDraft.wwwwh}
                          onChange={(e) => handleSessionEventDraftChange('wwwwh', e.target.value)}
                          rows={3}
                          style={{ ...controlStyle, resize: 'vertical' }}
                        />
                      </div>
                      <div style={rowStyle}>
                        <label htmlFor="sessionEventObservations" style={labelStyle}>Observations:</label>
                        <textarea
                          id="sessionEventObservations"
                          value={sessionEventDraft.observations}
                          onChange={(e) => handleSessionEventDraftChange('observations', e.target.value)}
                          rows={3}
                          style={{ ...controlStyle, resize: 'vertical' }}
                        />
                      </div>
                      <div style={rowStyle}>
                        <label htmlFor="sessionEventIsNodal" style={labelStyle}>Nodal Event:</label>
                        <input
                          type="checkbox"
                          id="sessionEventIsNodal"
                          checked={!!sessionEventDraft.isNodalEvent}
                          onChange={(e) =>
                            handleSessionEventDraftChange('isNodalEvent', e.target.checked ? 'true' : 'false')
                          }
                          style={{ marginRight: 'auto' }}
                        />
                      </div>
                    </>
                  );
                })()}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
                  <button onClick={closeSessionEventModal}>Cancel</button>
                  <button
                    onClick={commitSessionEventFromNotes}
                    style={{ background: '#1976d2', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4 }}
                  >
                    Save Event
                  </button>
                </div>
              </div>
            </div>
          )}
          <IdeasPanel
            isOpen={ideasOpen}
            ideasText={ideasText}
            onChange={setIdeasText}
            onClose={() => setIdeasOpen(false)}
          />
        </div>
      );
    };

export default DiagramEditor;
