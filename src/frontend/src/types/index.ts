export type Person = {
  id: string;
  x: number;
  y: number;
  name: string;
  birthDate?: string;
  deathDate?: string;
  gender?: string;
  partnerships: string[];
  parentPartnership?: string;
  notes?: string;
  size?: number;
  notesPosition?: { x: number; y: number };
  notesEnabled?: boolean;
  lifeStatus?: 'alive' | 'miscarriage' | 'stillbirth';
  adoptionStatus?: 'biological' | 'adopted';
  connectionAnchorX?: number;
  multipleBirthGroupId?: string;
  borderColor?: string;
  backgroundColor?: string;
  backgroundEnabled?: boolean;
  events?: EmotionalProcessEvent[];
};

export type Partnership = {
  id: string;
  partner1_id: string;
  partner2_id: string;
  horizontalConnectorY: number;
  relationshipType: 'married' | 'common-law' | 'living-together' | 'dating';
  relationshipStatus: 'married' | 'separated' | 'divorced';
  relationshipStartDate?: string;
  marriedStartDate?: string;
  separationDate?: string;
  divorceDate?: string;
  children: string[];
  notes?: string;
  notesPosition?: { x: number; y: number };
  events?: EmotionalProcessEvent[];
};

export type EmotionalLine = {
  id: string;
  person1_id: string;
  person2_id: string;
  startDate?: string;
  relationshipType: 'fusion' | 'distance' | 'cutoff' | 'conflict';
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
  notesPosition?: { x: number; y: number };
  events?: EmotionalProcessEvent[];
};

export type EmotionalProcessEvent = {
  id: string;
  date: string;
  category: string;
  intensity: number;
  howWell: number;
  otherPersonName: string;
  wwwwh: string;
  observations: string;
};
