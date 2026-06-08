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
  notes?: string;
  speculative?: boolean;
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
  rawAnalysis: string; // Set by us after parsing — NOT returned by the model.
};

const VALID_GENDERS = ['male', 'female', 'unknown'];
const VALID_REL_TYPES = ['married', 'affair', 'dating', 'unknown'];

/**
 * Validate the shape of a Claude Vision response. The model returns
 * `persons`, `relationships`, and (optionally) `annotations` — it does NOT
 * return `rawAnalysis`; that field is filled in by our code post-parse, so
 * the guard intentionally does not require it.
 *
 * If validation fails, the optional `errors` array is populated with a
 * human-readable list of which fields are wrong, so the caller can surface
 * a useful diagnostic instead of a generic "schema mismatch" alert.
 */
export const isExtractedDiagramData = (
  data: unknown,
  errors?: string[]
): data is ExtractedDiagramData => {
  const issues: string[] = [];

  if (!data || typeof data !== 'object') {
    issues.push('top-level value is not an object');
    if (errors) errors.push(...issues);
    return false;
  }
  const typed = data as Partial<ExtractedDiagramData>;

  if (!Array.isArray(typed.persons)) {
    issues.push('`persons` is not an array');
  } else {
    typed.persons.forEach((p, i) => {
      if (typeof p?.id !== 'string') issues.push(`persons[${i}].id is not a string`);
      if (typeof p?.extractedName !== 'string')
        issues.push(`persons[${i}].extractedName is not a string`);
      if (!VALID_GENDERS.includes(p?.gender))
        issues.push(`persons[${i}].gender (${JSON.stringify(p?.gender)}) is not male/female/unknown`);
      if (typeof p?.confidence !== 'number')
        issues.push(`persons[${i}].confidence is not a number`);
    });
  }

  if (!Array.isArray(typed.relationships)) {
    issues.push('`relationships` is not an array');
  } else {
    typed.relationships.forEach((r, i) => {
      if (typeof r?.id !== 'string') issues.push(`relationships[${i}].id is not a string`);
      if (typeof r?.person1Id !== 'string')
        issues.push(`relationships[${i}].person1Id is not a string`);
      if (typeof r?.person2Id !== 'string')
        issues.push(`relationships[${i}].person2Id is not a string`);
      if (!VALID_REL_TYPES.includes(r?.type))
        issues.push(`relationships[${i}].type (${JSON.stringify(r?.type)}) is not married/affair/dating/unknown`);
      if (!Array.isArray(r?.children))
        issues.push(`relationships[${i}].children is not an array`);
      if (typeof r?.confidence !== 'number')
        issues.push(`relationships[${i}].confidence is not a number`);
    });
  }

  // annotations is optional — model often omits it entirely.
  if (typed.annotations !== undefined && !Array.isArray(typed.annotations)) {
    issues.push('`annotations` is present but is not an array');
  } else if (Array.isArray(typed.annotations)) {
    typed.annotations.forEach((a, i) => {
      if (typeof a?.text !== 'string') issues.push(`annotations[${i}].text is not a string`);
      if (typeof a?.confidence !== 'number')
        issues.push(`annotations[${i}].confidence is not a number`);
    });
  }

  if (errors) errors.push(...issues);
  return issues.length === 0;
};
