/**
 * Types for image-based diagram extraction via Claude Vision API.
 */

export type ExtractedPerson = {
  id: string;
  extractedName: string;
  gender: 'male' | 'female' | 'unknown';
  confidence: number; // 0-1
  notes?: string;
  symbols?: string[]; // e.g., ["X" (deceased), "?" (unknown)]
};

export type ExtractedRelationship = {
  id: string;
  person1Id: string;
  person2Id: string;
  type: 'married' | 'affair' | 'dating' | 'unknown';
  children: string[]; // child person IDs
  confidence: number;
};

export type ExtractedAnnotation = {
  personId?: string;
  text: string;
  confidence: number;
};

export type ExtractedDiagramData = {
  persons: ExtractedPerson[];
  relationships: ExtractedRelationship[];
  annotations: ExtractedAnnotation[];
  rawAnalysis: string; // Full Claude response for debugging
};

export const isExtractedDiagramData = (data: unknown): data is ExtractedDiagramData => {
  const typed = data as ExtractedDiagramData;
  return (
    !!typed &&
    Array.isArray(typed.persons) &&
    Array.isArray(typed.relationships) &&
    Array.isArray(typed.annotations) &&
    typeof typed.rawAnalysis === 'string' &&
    typed.persons.every(
      (p) =>
        typeof p.id === 'string' &&
        typeof p.extractedName === 'string' &&
        ['male', 'female', 'unknown'].includes(p.gender) &&
        typeof p.confidence === 'number'
    ) &&
    typed.relationships.every(
      (r) =>
        typeof r.id === 'string' &&
        typeof r.person1Id === 'string' &&
        typeof r.person2Id === 'string' &&
        ['married', 'affair', 'dating', 'unknown'].includes(r.type) &&
        Array.isArray(r.children) &&
        typeof r.confidence === 'number'
    ) &&
    typed.annotations.every(
      (a) => typeof a.text === 'string' && typeof a.confidence === 'number'
    )
  );
};
