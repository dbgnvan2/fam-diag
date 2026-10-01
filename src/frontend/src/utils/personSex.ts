import type { BirthSex, GenderIdentity, GenderSymbol, Person } from '../types';

/**
 * One place that decides a person's sex from the fields that can record it
 * (review nodes-10 / struct-07). PersonNode, partnershipUtils and
 * siblingPosition each had their own copy and they disagreed: the sibling
 * code accepted the 'b' / 's' codes, PersonNode drew them (and 'Male') as
 * female.
 */
type SexFields = Pick<Person, 'gender' | 'birthSex' | 'genderIdentity' | 'genderSymbol'>;

/**
 * The stored `gender` string as a birth sex. Case-insensitive; accepts the
 * sibling-position codes 'b' (brother) and 's' (sister) and the one-letter
 * 'm' / 'f'. Anything else, including "unknown", is null — not female.
 */
const GENDER_CODES: Record<string, BirthSex> = {
  male: 'male',
  m: 'male',
  b: 'male',
  female: 'female',
  f: 'female',
  s: 'female',
  intersex: 'intersex',
  'ai-agent': 'ai-agent',
  ai_agent: 'ai-agent',
};

export const normalizeGender = (gender?: string | null): BirthSex | null =>
  (gender && GENDER_CODES[gender.trim().toLowerCase()]) || null;

// Birth sex implied by a gender symbol. female_trans is a person born male
// who identifies as feminine (see deriveGenderSymbol); nonbinary and agender
// say nothing about birth sex.
const BIRTH_SEX_FROM_SYMBOL: Partial<Record<GenderSymbol, BirthSex>> = {
  male_cis: 'male',
  female_trans: 'male',
  female_cis: 'female',
  male_trans: 'female',
  intersex: 'intersex',
  intersex_feminine: 'intersex',
  intersex_masculine: 'intersex',
  intersex_nonbinary: 'intersex',
  intersex_agender: 'intersex',
  ai_agent: 'ai-agent',
};

const IDENTITY_FROM_SYMBOL: Partial<Record<GenderSymbol, GenderIdentity>> = {
  female_cis: 'feminine',
  male_cis: 'masculine',
  nonbinary: 'nonbinary',
  intersex_nonbinary: 'nonbinary',
  agender: 'agender',
  intersex_agender: 'agender',
  intersex_feminine: 'feminine',
  intersex_masculine: 'masculine',
  female_trans: 'feminine',
  male_trans: 'masculine',
};

/**
 * True when nothing usable about a person's sex has been recorded: no birth
 * sex, gender identity or symbol, and a `gender` that is empty or not a
 * recognised value ("unknown", "x", ...). Imports leave these unset rather
 * than guessing; such people are drawn as a triangle, the genogram mark for
 * unknown sex.
 */
export const isSexUnknown = (person: SexFields) =>
  !person.genderSymbol &&
  !person.birthSex &&
  !person.genderIdentity &&
  normalizeGender(person.gender) === null;

/** The gender symbol to draw, or null when it cannot be told from the fields. */
export const deriveGenderSymbol = (person: SexFields): GenderSymbol | null => {
  if (person.genderSymbol) return person.genderSymbol;
  const sex = person.birthSex ?? normalizeGender(person.gender);
  const identity = person.genderIdentity;
  if (sex && identity) {
    if (sex === 'female' && identity === 'feminine') return 'female_cis';
    if (sex === 'male' && identity === 'masculine') return 'male_cis';
    if (sex === 'intersex' && identity === 'feminine') return 'intersex_feminine';
    if (sex === 'intersex' && identity === 'masculine') return 'intersex_masculine';
    if (sex === 'intersex' && identity === 'nonbinary') return 'intersex_nonbinary';
    if (sex === 'intersex' && identity === 'agender') return 'intersex_agender';
    if (sex === 'ai-agent') return 'ai_agent';
    if (identity === 'nonbinary') return 'nonbinary';
    if (identity === 'agender') return 'agender';
    return identity === 'feminine' ? 'female_trans' : 'male_trans';
  }
  if (sex === 'ai-agent') return 'ai_agent';
  if (sex === 'male') return 'male_cis';
  if (sex === 'female') return 'female_cis';
  if (sex === 'intersex') return 'intersex';
  if (identity === 'nonbinary') return 'nonbinary';
  if (identity === 'agender') return 'agender';
  return null;
};

/** Birth sex: the field itself, else the symbol, else `gender`. Null = unknown. */
export const deriveBirthSex = (person: SexFields): BirthSex | null => {
  if (person.birthSex) return person.birthSex;
  const fromSymbol = person.genderSymbol ? BIRTH_SEX_FROM_SYMBOL[person.genderSymbol] : undefined;
  return fromSymbol ?? normalizeGender(person.gender);
};

/**
 * Gender identity: the field itself, else the symbol, else the one that
 * matches the birth sex (masculine for male, feminine for any other known
 * birth sex, as before). Null when neither is known.
 */
export const deriveGenderIdentity = (person: SexFields): GenderIdentity | null => {
  if (person.genderIdentity) return person.genderIdentity;
  const symbol = deriveGenderSymbol(person);
  const fromSymbol = symbol ? IDENTITY_FROM_SYMBOL[symbol] : undefined;
  if (fromSymbol) return fromSymbol;
  const sex = deriveBirthSex(person);
  if (sex === 'male') return 'masculine';
  return sex ? 'feminine' : null;
};

/**
 * Male / female for the rules that need a binary answer (sibling position,
 * default family name). Birth sex first, then `gender`, then identity, then
 * symbol; null when none says male or female.
 */
export const resolveBinarySex = (person?: SexFields | null): 'male' | 'female' | null => {
  if (!person) return null;
  const binary = (sex: BirthSex | null | undefined) =>
    sex === 'male' || sex === 'female' ? sex : null;
  const fromBirth = binary(person.birthSex) ?? binary(normalizeGender(person.gender));
  if (fromBirth) return fromBirth;
  if (person.genderIdentity === 'masculine') return 'male';
  if (person.genderIdentity === 'feminine') return 'female';
  const gs = person.genderSymbol;
  if (gs === 'male_cis' || gs === 'male_trans' || gs === 'intersex_masculine') return 'male';
  if (gs === 'female_cis' || gs === 'female_trans' || gs === 'intersex_feminine') return 'female';
  return null;
};

/**
 * The sex "Change Sex" switches to: the opposite of the person's resolved
 * sex (read from any of the sex fields). When the sex is unknown it switches
 * to male, as before. The menu label and the change both read this rule; the
 * label used to read only `gender`, so someone with only `birthSex: male`
 * was offered "Change Sex to male" and became female (review struct-07).
 */
export const toggledBinarySex = (person: SexFields): 'male' | 'female' =>
  resolveBinarySex(person) === 'male' ? 'female' : 'male';
