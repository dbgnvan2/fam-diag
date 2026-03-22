/**
 * Internal DiagramEditor types — extracted from DiagramEditor.tsx.
 * These describe UI state, import formats, and domain-specific drafts.
 * The core data model (Person, Partnership, EmotionalLine, etc.) lives in types/index.ts.
 */

import type {
  FunctionalIndicatorDefinition,
  SIRCategoryDefinition,
  EmotionalProcessEvent,
  EmotionalLine,
} from './index';

// ---------------------------------------------------------------------------
// Storage / Settings
// ---------------------------------------------------------------------------

export type StoredUserSettings = {
  eventCategories?: string[];
  relationshipTypes?: string[];
  relationshipStatuses?: string[];
  functionalIndicatorDefinitions?: FunctionalIndicatorDefinition[];
  sirCategories?: SIRCategoryDefinition[];
  autoSaveMinutes?: number;
};

// ---------------------------------------------------------------------------
// Session Notes
// ---------------------------------------------------------------------------

export type SessionNoteFileRecord = {
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

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export type TimelineEntry = {
  timestamp: number;
  date: string;
  label: string;
};

export type TimelineBoardSelection = {
  laneLabel: string;
  entityType: 'person' | 'partnership' | 'emotional';
  entityId: string;
  eventId?: string;
  itemLabel: string;
  startDate?: string;
  endDate?: string;
};

// ---------------------------------------------------------------------------
// Properties Panel
// ---------------------------------------------------------------------------

export type PropertiesPanelIntent = {
  targetId: string;
  tab?: 'properties' | 'functional' | 'events';
  personSection?: 'name' | 'dates' | 'format' | 'sibling' | 'foo';
  focusEventId?: string;
  openNewEventRequestId?: string;
  newEventSeed?: Partial<EmotionalProcessEvent>;
  openNewEventPosition?: { x: number; y: number };
  newEventModalTitle?: string;
} | null;

export type PersonSectionPopupState = {
  personId: string;
  section: 'name' | 'dates' | 'format' | 'sibling' | 'foo';
  x: number;
  y: number;
} | null;

export type PartnershipSectionPopupState = {
  partnershipId: string;
  relationshipType: string;
  x: number;
  y: number;
} | null;

// ---------------------------------------------------------------------------
// Draft objects (modals / creation flows)
// ---------------------------------------------------------------------------

export type EmotionalPatternDraft = {
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

export type ClientProfileDraft = {
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

export type CoachThinkingDraft = {
  personId: string;
  personName: string;
  thinking: string;
  notes: string;
};

// ---------------------------------------------------------------------------
// Demo tour
// ---------------------------------------------------------------------------

export type DemoTourStep = {
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

export type BuildDemoStep = {
  title: string;
  instruction: string;
  focus:
    | { kind: 'none' }
    | { kind: 'person'; personId: string; tab?: 'properties' | 'events' }
    | { kind: 'partnership'; partnershipId: string; tab?: 'properties' | 'events' }
    | { kind: 'emotional'; lineId: string; tab?: 'properties' | 'events' };
};

export type BuildDemoStepSpec = Omit<BuildDemoStep, 'instruction'> & {
  fallbackInstruction: string;
};

// ---------------------------------------------------------------------------
// Import / data exchange formats
// ---------------------------------------------------------------------------

export type DiagramImportData = {
  fileMeta?: { fileName?: string; displayName?: string };
  people?: import('./index').Person[];
  partnerships?: import('./index').Partnership[];
  emotionalLines?: import('./index').EmotionalLine[];
  pageNotes?: import('./index').PageNote[];
  triangles?: import('./index').Triangle[];
  functionalIndicatorDefinitions?: FunctionalIndicatorDefinition[];
  eventCategories?: string[];
  relationshipTypes?: string[];
  relationshipStatuses?: string[];
  autoSaveMinutes?: number;
  ideasText?: string;
  predictions?: import('./index').Prediction[];
};

export type FactsImportData = {
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

export type SessionCaptureMatchHints = {
  personId?: string;
  personName?: string;
  aliases?: string[];
  birthYear?: number;
};

export type SessionCaptureOperation = {
  id: string;
  type: 'upsert_person' | 'add_person_event' | 'upsert_partnership';
  confidence?: number;
  ambiguity?: string;
  recommendedAction?: 'apply' | 'review' | 'skip';
  source?: { startLine?: number; endLine?: number; quote?: string };
  matchHints?: SessionCaptureMatchHints;
  payload?: Record<string, any>;
};

export type SessionCaptureImportData = {
  kind: 'fam-diag-session-capture';
  version: 1;
  sessionId?: string;
  transcriptName?: string;
  baseDiagramFileName?: string;
  ambiguityNotes?: string[];
  operations: SessionCaptureOperation[];
};
