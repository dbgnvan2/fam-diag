export type Person = {
  id: string;
  x: number;
  y: number;
  name: string;
  birthDate?: Date;
  deathDate?: Date;
  gender?: string;
  partnerships: string[];
  parentPartnership?: string;
};

export type Partnership = {
  id: string;
  partner1_id: string;
  partner2_id: string;
  horizontalConnectorY: number;
  relationshipType: 'married' | 'divorced' | 'separated' | 'partnered';
  startDate?: Date;
  endDate?: Date;
  children: string[];
};
