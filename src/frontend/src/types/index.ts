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
  notesPosition?: { x: number; y: number };
  notesEnabled?: boolean;
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
};

export type EmotionalLine = {
  id: string;
  person1_id: string;
  person2_id: string;
  startDate?: string;
  relationshipType: 'fusion' | 'distance' | 'cutoff' | 'conflict';
  lineStyle: 
    // Fusion
    'single' | 'double' | 'triple' | 
    // Distance
    'dotted' | 'dashed' | 'cutoff' |
    // Conflict
    'solid-saw-tooth' | 'dotted-saw-tooth' | 'double-saw-tooth';
  lineEnding: 'none' | 'arrow-p1-to-p2' | 'arrow-p2-to-p1' | 'arrow-bidirectional' | 'perpendicular-p1' | 'perpendicular-p2' | 'double-perpendicular-p1' | 'double-perpendicular-p2';
  notes?: string;
  notesPosition?: { x: number; y: number };
};
