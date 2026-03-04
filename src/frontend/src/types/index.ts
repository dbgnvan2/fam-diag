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

export type BirthSex = 'female' | 'male' | 'intersex';
export type GenderIdentity = 'feminine' | 'masculine' | 'nonbinary' | 'agender';

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
  | 'intersex_agender';

export type FunctionalIndicatorDefinition = {
  id: string;
  label: string;
  iconDataUrl?: string;
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
  deathDate?: string;
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
  connectionAnchorX?: number;
  multipleBirthGroupId?: string;
  borderColor?: string;
  backgroundColor?: string;
  backgroundEnabled?: boolean;
  functionalIndicators?: PersonFunctionalIndicator[];
  events?: EmotionalProcessEvent[];
};

export type Partnership = {
  id: string;
  partner1_id: string;
  partner2_id: string;
  horizontalConnectorY: number;
  relationshipType: 'married' | 'common-law' | 'living-together' | 'dating' | 'affair' | 'friendship';
  relationshipStatus: 'married' | 'separated' | 'divorced' | 'started' | 'ended' | 'ongoing';
  relationshipStartDate?: string;
  marriedStartDate?: string;
  separationDate?: string;
  divorceDate?: string;
  children: string[];
  notes?: string;
  notesEnabled?: boolean;
  notesPosition?: { x: number; y: number };
  notesSize?: { width: number; height: number };
  events?: EmotionalProcessEvent[];
};

export type EmotionalLine = {
  id: string;
  person1_id: string;
  person2_id: string;
  startDate?: string;
  endDate?: string;
  status?: 'ongoing' | 'ended';
  relationshipType: 'fusion' | 'distance' | 'cutoff' | 'conflict' | 'projection';
  lineStyle: 
    // Fusion
    'low' | 'medium' | 'high' | 
    // Distance
    'dotted' | 'dashed' | 'long-dash' |
    // Cutoff
    'cutoff' |
    // Conflict
    'solid-saw-tooth' | 'dotted-saw-tooth' | 'double-saw-tooth';
  lineEnding: 'none' | 'arrow-p1-to-p2' | 'arrow-p2-to-p1' | 'arrow-bidirectional' | 'perpendicular-p1' | 'perpendicular-p2' | 'double-perpendicular-p1' | 'double-perpendicular-p2';
  color?: string;
  notes?: string;
  notesEnabled?: boolean;
  notesPosition?: { x: number; y: number };
  notesSize?: { width: number; height: number };
  events?: EmotionalProcessEvent[];
};

export type Triangle = {
  id: string;
  person1_id: string;
  person2_id: string;
  person3_id: string;
  color?: string;
  intensity?: 'low' | 'medium' | 'high';
  tpls?: EmotionalLine[];
};

export type EventClass = 'individual' | 'relationship' | 'emotional-pattern';
export type EventType = 'NODAL' | 'FF' | 'EPE';
export type EventAnchorType = 'PERSON' | 'RELATIONSHIP_PRL' | 'EMOTIONAL_PROCESS_EP';
export type EventContinuationState = 'discrete' | 'start' | 'middle' | 'end';

export type EmotionalProcessEvent = {
  id: string;
  date: string;
  startDate?: string;
  endDate?: string;
  category: string;
  eventType?: EventType;
  nodalEventSubtype?: string;
  emotionalProcessType?: string;
  anchorType?: EventAnchorType;
  anchorId?: string;
  statusLabel?: string;
  intensity: number;
  howWell: number;
  otherPersonName: string;
  primaryPersonName?: string;
  wwwwh: string;
  observations: string;
  isNodalEvent?: boolean;
  frequency?: number;
  impact?: number;
  priorEventsNote?: string;
  reflectionsNote?: string;
  continuesFromPrevious?: boolean;
  continuesToNext?: boolean;
  createdAt?: number;
  sourceIndicatorId?: string;
  eventClass: EventClass;
};
