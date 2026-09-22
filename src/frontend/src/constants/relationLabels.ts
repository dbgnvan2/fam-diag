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

/**
 * Kinship nouns for people related by marriage, keyed by HOW the marriage is
 * crossed — see utils/kinship.ts. A single "married in" table cannot work: a
 * son's wife (a relative's spouse) is a daughter-in-law, but a wife's son by
 * an earlier marriage (a spouse's relative) is a step-son, and both sit one
 * generation below the lane person.
 */
type NounTable = Record<number, Record<RelationGender, string>>;

/** A blood relative's partner. Above the lane person this is a step-parent. */
export const RELATIVE_SPOUSE_NOUNS: NounTable = {
  [-2]: { male: 'Step-grandfather', female: 'Step-grandmother', unknown: 'Step-grandparent' },
  [-1]: { male: 'Step-father', female: 'Step-mother', unknown: 'Step-parent' },
  0: { male: 'Brother-in-law', female: 'Sister-in-law', unknown: 'Sibling-in-law' },
  1: { male: 'Son-in-law', female: 'Daughter-in-law', unknown: 'Child-in-law' },
  2: { male: 'Grandson-in-law', female: 'Granddaughter-in-law', unknown: 'Grandchild-in-law' },
};

/**
 * The spouse of a COLLATERAL blood relative, keyed by that relative's path
 * shape (`ups,downs`). The direct line is handled by RELATIVE_SPOUSE_NOUNS:
 * a parent's spouse is a step-parent, a child's a child-in-law. But an aunt's
 * husband is not a step-father — keyed on generation alone he came out as
 * one. "By marriage" is kept explicit, since a genogram is read for exactly
 * the difference between blood and marriage.
 */
export const COLLATERAL_SPOUSE_NOUNS: Record<string, Record<RelationGender, string>> = {
  '1,1': { male: 'Brother-in-law', female: 'Sister-in-law', unknown: 'Sibling-in-law' },
  '2,1': { male: 'Uncle by marriage', female: 'Aunt by marriage', unknown: 'Aunt/Uncle by marriage' },
  '1,2': { male: 'Nephew-in-law', female: 'Niece-in-law', unknown: 'Nibling-in-law' },
  '2,2': { male: 'Cousin-in-law', female: 'Cousin-in-law', unknown: 'Cousin-in-law' },
  '3,1': {
    male: 'Great-uncle by marriage',
    female: 'Great-aunt by marriage',
    unknown: 'Great-aunt/uncle by marriage',
  },
};

/** The own partner's ancestors. */
export const SPOUSE_ANCESTOR_NOUNS: NounTable = {
  [-2]: { male: 'Grandfather-in-law', female: 'Grandmother-in-law', unknown: 'Grandparent-in-law' },
  [-1]: { male: 'Father-in-law', female: 'Mother-in-law', unknown: 'Parent-in-law' },
};

/** The own partner's children by someone else. */
export const SPOUSE_DESCENDANT_NOUNS: NounTable = {
  1: { male: 'Step-son', female: 'Step-daughter', unknown: 'Step-child' },
  2: { male: 'Step-grandson', female: 'Step-granddaughter', unknown: 'Step-grandchild' },
};

/** The own partner's siblings. */
export const SPOUSE_SIBLING_NOUNS: NounTable = {
  0: { male: 'Brother-in-law', female: 'Sister-in-law', unknown: 'Sibling-in-law' },
};

/** Anyone married in beyond the named generations above. */
export const DISTANT_IN_LAW_NOUN = 'Relative by marriage';

/**
 * Blood relatives who are not in the direct line, keyed by the shape of the
 * path to them: `ups,downs` — generations up to the shared ancestor, then
 * down. A sibling shares parents (1 up, 1 down); an uncle shares
 * grandparents but is a generation up (2 up, 1 down).
 */
export const COLLATERAL_NOUNS: Record<string, Record<RelationGender, string>> = {
  '1,1': { male: 'Brother', female: 'Sister', unknown: 'Sibling' },
  '2,1': { male: 'Uncle', female: 'Aunt', unknown: 'Aunt/Uncle' },
  '1,2': { male: 'Nephew', female: 'Niece', unknown: 'Nibling' },
  '2,2': { male: 'Cousin', female: 'Cousin', unknown: 'Cousin' },
  '3,1': { male: 'Great-uncle', female: 'Great-aunt', unknown: 'Great-aunt/uncle' },
  '1,3': { male: 'Grand-nephew', female: 'Grand-niece', unknown: 'Grand-nibling' },
  '2,3': {
    male: 'Cousin once removed',
    female: 'Cousin once removed',
    unknown: 'Cousin once removed',
  },
  '3,2': {
    male: 'Cousin once removed',
    female: 'Cousin once removed',
    unknown: 'Cousin once removed',
  },
};

/** A blood relative further out than the named shapes above. */
export const DISTANT_BLOOD_NOUN = 'Blood relative';

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
