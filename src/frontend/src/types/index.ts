export type PersonFunctionalIndicator = {
  definitionId: string;
  status: 'past' | 'current' | 'none';
  impact: number;
  frequency?: number;
  intensity?: number;
  date?: string;
  handledWell?: number;
  lastUpdatedAt?: number;
};

export type BirthSex = 'female' | 'male' | 'intersex' | 'ai-agent';
export type GenderIdentity = 'feminine' | 'masculine' | 'nonbinary' | 'agender';
export type SymptomGroup = 'physical' | 'emotional' | 'social';

export type GenderSymbol =
  | 'female_cis'
  | 'male_cis'
  | 'intersex'
  | 'female_trans'
  | 'male_trans'
  | 'nonbinary'
  | 'agender'
  | 'intersex_feminine'
  | 'intersex_masculine'
  | 'intersex_nonbinary'
  | 'intersex_agender'
  | 'ai_agent';

export type FunctionalIndicatorDefinition = {
  id: string;
  label: string;
  iconDataUrl?: string;
  group?: SymptomGroup;
  color?: string;
  useLetter?: boolean;
};

export type Person = {
  id: string;
  x: number;
  y: number;
  name: string;
  firstName?: string;
  lastName?: string;
  maidenName?: string;
  birthDate?: string;
  birthOrderOverride?: number;
  deathDate?: string;
  adoptionDate?: string;
  genderDate?: string;
  gender?: string;
  birthSex?: BirthSex;
  genderIdentity?: GenderIdentity;
  genderSymbol?: GenderSymbol;
  partnerships: string[];
  parentPartnership?: string;
  birthParentPartnership?: string;
  notes?: string;
  size?: number;
  notesPosition?: { x: number; y: number };
  notesSize?: { width: number; height: number };
  notesEnabled?: boolean;
  lifeStatus?: 'alive' | 'miscarriage' | 'stillbirth';
  adoptionStatus?: 'biological' | 'adopted';
  siblingsComplete?: boolean;
  siblingPositionOverride?: string;
  siblingMaturityLevel?: 1 | 2 | 3 | 4 | 5;
  fatherPositionOverride?: string;
  motherPositionOverride?: string;
  partnerPositionOverride?: string;
  emotionalCutoffMeasure?: string;
  familyStability?: string;
  familyIntactness?: string;
  parentConnectionPattern?: 'none' | 'family-cutoff';
  familyCutoffLineId?: string;
  connectionAnchorX?: number;
  multipleBirthGroupId?: string;
  borderColor?: string;
  borderEnabled?: boolean;
  foregroundColor?: string;
  foregroundEnabled?: boolean;
  backgroundColor?: string;
  backgroundEnabled?: boolean;
  functionalIndicators?: PersonFunctionalIndicator[];
  isCoach?: boolean;
  coachThinking?: {
    thinking?: string;
    notes?: string;
    updatedAt?: number;
  };
  isClient?: boolean;
  clientProfile?: {
    presentingIssue1?: string;
    presentingIssue2?: string;
    presentingIssue3?: string;
    desiredOutcome1?: string;
    desiredOutcome2?: string;
    desiredOutcome3?: string;
    conceptualization?: string;
  };
  paperoScores?: PaperoScores;
  events?: EmotionalProcessEvent[];
};

export type SIRCategoryDefinition = {
  id: string;
  name: string;
  levels: [string, string, string, string, string]; // 5-level HWDID descriptions
};

export type FunctionalFactCategoryDefinition = {
  id: string;
  name: string;
};

export type PaperoScores = {
  resourceful_engagement?: number;
  resourceful_problemSolving?: number;
  resourceful_familyAwareness?: number;
  resourceful_locusOfControl?: number;
  resourceful_leadership?: number;
  connectedness_extendedFamily?: number;
  connectedness_knowledge?: number;
  connectedness_relationshipQuality?: number;
  connectedness_openness?: number;
  tension_anxietyContainment?: number;
  tension_perceptualFramework?: number;
  systems_fundamentalQuestions?: number;
  systems_familyFocus?: number;
  systems_locusOfChange?: number;
  goals_achievementGoals?: number;
  goals_processGoals?: number;
};

export type Partnership = {
  id: string;
  partner1_id: string;
  partner2_id: string;
  horizontalConnectorY: number;
  relationshipType: string;
  relationshipStatus: string;
  statusDates?: Record<string, string>;
  relationshipStartDate?: string;
  marriedStartDate?: string;
  separationDate?: string;
  divorceDate?: string;
  children: string[];
  familyName?: string;
  familyNameOffsetX?: number;
  familyNameOffsetY?: number;
  familyNameWidth?: number;
  familyNameHeight?: number;
  notes?: string;
  notesEnabled?: boolean;
  notesPosition?: { x: number; y: number };
  notesSize?: { width: number; height: number };
  color?: string;
  backgroundColor?: string;
  events?: EmotionalProcessEvent[];
  familyEvents?: EmotionalProcessEvent[];
};

export type EmotionalLine = {
  id: string;
  person1_id: string;
  person2_id: string;
  startDate?: string;
  endDate?: string;
  status?: 'ongoing' | 'ended';
  relationshipType: 'fusion' | 'distance' | 'cutoff' | 'conflict' | 'projection' | 'open-connection';
  lineStyle:
    // Fusion
    'fusion-dotted-wide' | 'fusion-dotted-tight' | 'fusion-solid-wide' | 'fusion-solid-tight' | 'fusion-triple' |
    // Projection
    'projection-1' | 'projection-2' | 'projection-3' | 'projection-4' | 'projection-5' |
    'low' | 'medium' | 'high' |
    // Distance
    'distance-dotted-wide' | 'distance-dotted-tight' | 'distance-dashed-wide' | 'distance-dashed-tight' | 'distance-long' |
    'dotted' | 'dashed' | 'long-dash' |
    // Cutoff
    'cutoff' |
    // Conflict
    'conflict-dotted-wide' | 'conflict-dotted-tight' | 'conflict-solid-wide' | 'conflict-solid-tight' | 'conflict-double' |
    'solid-saw-tooth' | 'dotted-saw-tooth' | 'double-saw-tooth' |
    // Open Connection
    'open-connection-1' | 'open-connection-2' | 'open-connection-3' | 'open-connection-4' | 'open-connection-5';
  lineEnding: 'none' | 'arrow-p1-to-p2' | 'arrow-p2-to-p1' | 'arrow-bidirectional' | 'perpendicular-p1' | 'perpendicular-p2' | 'double-perpendicular-p1' | 'double-perpendicular-p2';
  /** For fusion lines: which person is the adequate/overfunctioning (+) side. The other is underfunctioning (−). */
  adequatePersonId?: string;
  color?: string;
  notes?: string;
  notesEnabled?: boolean;
  notesPosition?: { x: number; y: number };
  notesSize?: { width: number; height: number };
  events?: EmotionalProcessEvent[];
};

export type PageNote = {
  id: string;
  x: number;
  y: number;
  title: string;
  text: string;
  width?: number;
  height?: number;
  fillColor?: string;
};

export type Triangle = {
  id: string;
  person1_id: string;
  person2_id: string;
  person3_id: string;
  color?: string;
  intensity?: 'low' | 'medium' | 'high';
  tpls?: EmotionalLine[];
  events?: EmotionalProcessEvent[];
};

// ─── Prediction Types ──────────────────────────────────────────────────────
export type PredictionStatus = 'active' | 'supported' | 'unsupported' | 'revised';
export type PredictionEvidenceDirection = 'supports' | 'contradicts' | 'neutral';
export type PredictionEvidenceType = 'event' | 'sir_entry' | 'papero_change' | 'observation';
export type PredictionConditionType = 'sir' | 'papero' | 'custom';

export type PredictionEvidence = {
  id: string;
  date: string;
  type: PredictionEvidenceType;
  sourceId?: string;
  measurement?: string;
  direction: PredictionEvidenceDirection;
  notes: string;
};

export type PredictionCondition = {
  id: string;
  type: PredictionConditionType;
  personId?: string;
  description: string;
  linkedPaperoKey?: string;
  linkedSIRCategory?: string;
  linkedEventId?: string;
  evidence: PredictionEvidence[];
};

export type PredictionOutcome = {
  id: string;
  description: string;
  personIds: string[];
  evidence: PredictionEvidence[];
};

export type Prediction = {
  id: string;
  title: string;
  status: PredictionStatus;
  createdDate: string;
  resolvedDate?: string;
  conditions: PredictionCondition[];
  outcomes: PredictionOutcome[];
  notes: string;
};

export type PredictionSet = {
  id: string;
  name: string;
  createdDate: string;
  predictions: Prediction[];
};

export type EventClass = 'individual' | 'relationship' | 'emotional-pattern' | 'family' | 'triangle';
export type EventType = 'SYMPTOM' | 'EPE' | 'NODAL' | 'EA' | 'FAMILY' | 'FOO' | 'TRIANGLE' | 'PAPERO' | 'SIR' | 'FF';
export type EventStatus = 'start' | 'ongoing' | 'end' | 'discrete';
export type EventAnchorType = 'PERSON' | 'RELATIONSHIP_PRL' | 'EMOTIONAL_PROCESS_EP' | 'FAMILY' | 'TRIANGLE';

export type EmotionalProcessEvent = {
  id: string;
  date: string;
  startDate?: string;
  endDate?: string;
  category: string;
  eventType: EventType;
  subtype?: string;
  anchorType?: EventAnchorType;
  anchorId?: string;
  status: EventStatus;
  intensity: number;
  howWell: number;
  otherPersonName: string;
  primaryPersonName?: string;
  wwwwh: string;
  observations: string;
  frequency?: number;
  impact?: number;
  priorEventsNote?: string;
  reflectionsNote?: string;
  createdAt?: number;
  sourceIndicatorId?: string;
  symptomType?: string;
  eventClass: EventClass;
};
