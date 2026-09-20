/**
 * Purpose: the vocabulary used to label a relative's event on someone else's
 *          timeline lane ("Father died", "Parents divorced", "Son born").
 * Spec:    docs/implementation_plan_2026-09-19.md#M7.C.3
 * Tests:   src/frontend/src/utils/systemEvents.test.ts
 *
 * Editorial content lives here rather than inside the collector, so the
 * wording can be changed without touching traversal logic.
 */

/** How an in-scope person relates to the person whose lane is being built. */
export type RelationClass =
  | 'self'
  | 'union'
  | 'parental'
  | 'ascendant'
  | 'sibling'
  | 'descendant'
  | 'spousal';

export type RelationGender = 'male' | 'female' | 'unknown';

/** Kinship noun by generation offset and gender. */
export const RELATION_NOUNS: Record<number, Record<RelationGender, string>> = {
  [-2]: { male: 'Grandfather', female: 'Grandmother', unknown: 'Grandparent' },
  [-1]: { male: 'Father', female: 'Mother', unknown: 'Parent' },
  0: { male: 'Brother', female: 'Sister', unknown: 'Sibling' },
  1: { male: 'Son', female: 'Daughter', unknown: 'Child' },
  2: { male: 'Grandson', female: 'Granddaughter', unknown: 'Grandchild' },
};

/** Fallbacks for generations beyond the named nouns above. */
export const DISTANT_ANCESTOR_NOUN = 'Ancestor';
export const DISTANT_DESCENDANT_NOUN = 'Descendant';

/** Noun for a married-in person at the same generation. */
export const SPOUSE_NOUNS: Record<RelationGender, string> = {
  male: 'Husband',
  female: 'Wife',
  unknown: 'Partner',
};

/** Noun for the partnership that produced the lane person. */
export const PARENTAL_UNION_NOUN = 'Parents';

/** Noun for the lane person's own partnership. */
export const OWN_UNION_NOUN = 'Own family';

/**
 * Past-tense phrasing for the standard nodal categories, keyed by the
 * category text the event carries (lower-cased). Anything not listed keeps
 * the event's own category text.
 */
export const EVENT_PHRASES: Record<string, string> = {
  birth: 'born',
  death: 'died',
  adoption: 'adopted',
  marriage: 'married',
  separation: 'separated',
  divorce: 'divorced',
  'relationship started': 'relationship started',
  'pattern started': 'pattern started',
  'pattern ended': 'pattern ended',
};

/** Categories that form a union, kept regardless of the lifetime filter (D11). */
export const UNION_FORMATION_CATEGORIES = ['relationship started', 'marriage'];
