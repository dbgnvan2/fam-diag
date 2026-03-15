import type { Partnership, Person } from '../types';

export type TomanRank = 'only' | 'oldest' | 'youngest' | 'middle';
export type TomanComposition = 'b' | 's' | 'bs' | 'unknown' | 'partial';
export type SiblingPositionConfidence =
  | 'CONFIRMED'
  | 'PROVISIONAL'
  | 'INDETERMINATE'
  | 'MANUAL';

export type ConflictCategory =
  | 'No Conflict'
  | 'Rank Conflict'
  | 'Sex Conflict'
  | 'Rank and Sex Conflict'
  | 'Indeterminate (missing sex data)'
  | 'Rank Only Applicable (same-sex pair)'
  | 'insufficient data';

export type ConflictResult = {
  other_person_id: string;
  other_effective_position: string;
  rank_conflict: boolean;
  sex_conflict: boolean | null;
  sex_conflict_uncertain: boolean;
  category: ConflictCategory;
  confidence_note: string | null;
};

export type SiblingPositionResult = {
  person_id: string;
  derived_position: string | null;
  manual_position: string | null;
  effective_position: string | null;
  confidence: SiblingPositionConfidence;
  rank: TomanRank | null;
  composition: TomanComposition | null;
  half_sibling_only: boolean;
  conflict_with_father: ConflictResult | null;
  conflict_with_mother: ConflictResult | null;
  conflict_with_partner: ConflictResult | null;
  note: string | null;
};

type PositionParts = {
  sex: 'b' | 's';
  rank: TomanRank;
  composition: TomanComposition | 'oc';
};

const POSITION_LABELS: Record<string, string> = {
  'ob/b': 'Oldest brother of brothers',
  'ob/s': 'Oldest brother of sisters',
  'ob/bs': 'Oldest brother of brothers and sisters',
  'yb/b': 'Youngest brother of brothers',
  'yb/s': 'Youngest brother of sisters',
  'yb/bs': 'Youngest brother of brothers and sisters',
  'mb/b': 'Middle brother of brothers',
  'mb/s': 'Middle brother of sisters',
  'mb/bs': 'Middle brother of brothers and sisters',
  'm/oc': 'Male only child',
  'os/s': 'Oldest sister of sisters',
  'os/b': 'Oldest sister of brothers',
  'os/bs': 'Oldest sister of brothers and sisters',
  'ys/s': 'Youngest sister of sisters',
  'ys/b': 'Youngest sister of brothers',
  'ys/bs': 'Youngest sister of brothers and sisters',
  'ms/s': 'Middle sister of sisters',
  'ms/b': 'Middle sister of brothers',
  'ms/bs': 'Middle sister of brothers and sisters',
  'f/oc': 'Female only child',
};

const MALE_POSITION_CODES = [
  'ob/b',
  'ob/s',
  'ob/bs',
  'yb/b',
  'yb/s',
  'yb/bs',
  'mb/b',
  'mb/s',
  'mb/bs',
  'm/oc',
] as const;

const FEMALE_POSITION_CODES = [
  'os/s',
  'os/b',
  'os/bs',
  'ys/s',
  'ys/b',
  'ys/bs',
  'ms/s',
  'ms/b',
  'ms/bs',
  'f/oc',
] as const;

const ALL_POSITION_CODES = [...MALE_POSITION_CODES, ...FEMALE_POSITION_CODES];

const hasKnownDate = (value?: string) =>
  !!value && !Number.isNaN(new Date(value).getTime());

const personSexCode = (person?: Person | null): 'b' | 's' | null => {
  if (!person) return null;
  if (person.birthSex === 'male' || person.gender === 'male') return 'b';
  if (person.birthSex === 'female' || person.gender === 'female') return 's';
  return null;
};

const parentPartnershipFor = (
  person: Person,
  partnerships: Partnership[]
): Partnership | null => {
  const parentPartnershipId = person.birthParentPartnership || person.parentPartnership;
  if (!parentPartnershipId) return null;
  return partnerships.find((entry) => entry.id === parentPartnershipId) || null;
};

const parentIdsFor = (person: Person, partnerships: Partnership[]) => {
  const partnership = parentPartnershipFor(person, partnerships);
  if (!partnership) return [];
  return [partnership.partner1_id, partnership.partner2_id].filter(Boolean);
};

const sharesParent = (
  personA: Person,
  personB: Person,
  partnerships: Partnership[]
) => {
  const parentIdsA = new Set(parentIdsFor(personA, partnerships));
  if (!parentIdsA.size) return false;
  return parentIdsFor(personB, partnerships).some((parentId) => parentIdsA.has(parentId));
};

const sharedParentCount = (
  personA: Person,
  personB: Person,
  partnerships: Partnership[]
) => {
  const parentIdsA = new Set(parentIdsFor(personA, partnerships));
  let count = 0;
  parentIdsFor(personB, partnerships).forEach((parentId) => {
    if (parentIdsA.has(parentId)) count += 1;
  });
  return count;
};

const sortOrderForFamily = (
  family: Person[]
): { order: Map<string, number> | null; note: string | null } => {
  if (!family.length) return { order: new Map(), note: null };

  const overrideEntries = family
    .filter((person) => typeof person.birthOrderOverride === 'number')
    .map((person) => ({ id: person.id, value: person.birthOrderOverride as number }));

  const overrideValues = overrideEntries.map((entry) => entry.value);
  if (new Set(overrideValues).size !== overrideValues.length) {
    return { order: null, note: 'Duplicate birth order overrides create an indeterminate rank.' };
  }

  const undetermined = family.filter(
    (person) => !hasKnownDate(person.birthDate) && typeof person.birthOrderOverride !== 'number'
  );
  if (undetermined.length) {
    return {
      order: null,
      note: 'One or more siblings are missing both a birth date and a birth order override.',
    };
  }

  const datedWithoutOverride = family
    .filter((person) => hasKnownDate(person.birthDate) && typeof person.birthOrderOverride !== 'number')
    .sort((a, b) => new Date(a.birthDate!).getTime() - new Date(b.birthDate!).getTime());

  for (let index = 1; index < datedWithoutOverride.length; index += 1) {
    const prior = datedWithoutOverride[index - 1];
    const current = datedWithoutOverride[index];
    if (
      prior.birthDate === current.birthDate &&
      typeof prior.birthOrderOverride !== 'number' &&
      typeof current.birthOrderOverride !== 'number'
    ) {
      return {
        order: null,
        note: 'Twins or same-day siblings need birth order overrides to determine rank.',
      };
    }
  }

  const familySize = family.length;
  if (overrideEntries.some((entry) => entry.value < 1 || entry.value > familySize)) {
    return {
      order: null,
      note: 'Birth order overrides must be between 1 and the family size.',
    };
  }

  const takenSlots = new Set(overrideEntries.map((entry) => entry.value));
  const remainingSlots: number[] = [];
  for (let index = 1; index <= familySize; index += 1) {
    if (!takenSlots.has(index)) remainingSlots.push(index);
  }

  if (datedWithoutOverride.length !== remainingSlots.length) {
    return {
      order: null,
      note: 'Birth order overrides and dated siblings do not cover the family consistently.',
    };
  }

  const order = new Map<string, number>();
  overrideEntries.forEach((entry) => {
    order.set(entry.id, entry.value);
  });
  datedWithoutOverride.forEach((person, index) => {
    order.set(person.id, remainingSlots[index]);
  });
  return { order, note: null };
};

const compositionForSiblings = (siblings: Person[]): TomanComposition => {
  if (!siblings.length) return 'unknown';
  const sexCodes = siblings.map((sibling) => personSexCode(sibling));
  const known = sexCodes.filter((code): code is 'b' | 's' => !!code);
  if (!known.length) return 'unknown';
  if (known.length !== sexCodes.length) return 'partial';
  const hasBrothers = known.includes('b');
  const hasSisters = known.includes('s');
  if (hasBrothers && hasSisters) return 'bs';
  return hasBrothers ? 'b' : 's';
};

const rankFromOrder = (
  personOrder: number,
  familySize: number
): TomanRank => {
  if (familySize <= 1) return 'only';
  if (personOrder === 1) return 'oldest';
  if (personOrder === familySize) return 'youngest';
  return 'middle';
};

const displayCodeFor = (
  sex: 'b' | 's',
  rank: TomanRank,
  composition: TomanComposition
): string | null => {
  if (rank === 'only') return sex === 'b' ? 'm/oc' : 'f/oc';
  if (composition === 'unknown' || composition === 'partial') return null;
  if (sex === 'b') {
    if (rank === 'oldest') return `ob/${composition}`;
    if (rank === 'youngest') return `yb/${composition}`;
    return `mb/${composition}`;
  }
  if (rank === 'oldest') return `os/${composition}`;
  if (rank === 'youngest') return `ys/${composition}`;
  return `ms/${composition}`;
};

const parsePositionCode = (value: string): PositionParts | null => {
  if (value === 'm/oc') return { sex: 'b', rank: 'only', composition: 'oc' };
  if (value === 'f/oc') return { sex: 's', rank: 'only', composition: 'oc' };
  const match = /^(ob|yb|mb|os|ys|ms)\/(b|s|bs)$/.exec(value);
  if (!match) return null;
  const [, prefix, composition] = match;
  const sex = prefix.endsWith('b') ? 'b' : 's';
  const rank =
    prefix.startsWith('o') ? 'oldest' : prefix.startsWith('y') ? 'youngest' : 'middle';
  return { sex, rank, composition: composition as 'b' | 's' | 'bs' };
};

const partnerForPerson = (
  person: Person,
  people: Person[],
  partnerships: Partnership[]
): Person | null => {
  const linked = partnerships.filter((partnership) => person.partnerships.includes(partnership.id));
  if (!linked.length) return null;
  const active =
    linked.find((partnership) =>
      ['married', 'start', 'ongoing', 'separated'].includes(
        (partnership.relationshipStatus || '').toLowerCase()
      )
    ) || linked[0];
  const otherId =
    active.partner1_id === person.id ? active.partner2_id : active.partner1_id;
  return people.find((entry) => entry.id === otherId) || null;
};

const parentMatchForRole = (
  person: Person,
  people: Person[],
  partnerships: Partnership[],
  role: 'father' | 'mother'
): Person | null => {
  const parentPartnership = parentPartnershipFor(person, partnerships);
  if (!parentPartnership) return null;
  const parentA = people.find((entry) => entry.id === parentPartnership.partner1_id) || null;
  const parentB = people.find((entry) => entry.id === parentPartnership.partner2_id) || null;
  const wantedSex = role === 'father' ? 'b' : 's';
  if (personSexCode(parentA) === wantedSex) return parentA;
  if (personSexCode(parentB) === wantedSex) return parentB;
  return null;
};

const confidenceNoteFor = (
  otherLabel: string,
  confidence: SiblingPositionConfidence
) =>
  confidence === 'PROVISIONAL'
    ? `${otherLabel} position is PROVISIONAL`
    : confidence === 'MANUAL'
    ? `${otherLabel} position is MANUAL`
    : null;

export const getSiblingPositionLabel = (code?: string | null) =>
  code ? POSITION_LABELS[code] || code : 'Not available';

export const getSiblingPositionOptions = ({
  person,
  people,
  partnerships,
}: {
  person: Person;
  people: Person[];
  partnerships: Partnership[];
}) => {
  const sexCode = personSexCode(person);
  const siblings = people.filter((candidate) => candidate.id !== person.id && sharesParent(person, candidate, partnerships));
  const knownSiblingSexes = siblings.map((sibling) => personSexCode(sibling)).filter(Boolean) as ('b' | 's')[];
  const hasBrother = knownSiblingSexes.includes('b');
  const hasSister = knownSiblingSexes.includes('s');
  const allowedCompositions =
    hasBrother && hasSister
      ? new Set(['bs'])
      : hasBrother
      ? new Set(['b', 'bs'])
      : hasSister
      ? new Set(['s', 'bs'])
      : new Set(['b', 's', 'bs']);
  const source =
    sexCode === 'b'
      ? MALE_POSITION_CODES
      : sexCode === 's'
      ? FEMALE_POSITION_CODES
      : ALL_POSITION_CODES;
  return source
    .filter((code) => {
      if (code.endsWith('/oc')) return siblings.length === 0;
      const parsed = parsePositionCode(code);
      if (!parsed) return false;
      return allowedCompositions.has(parsed.composition);
    })
    .map((code) => ({
      value: code,
      label: `${code} — ${getSiblingPositionLabel(code)}`,
    }));
};

const deriveOwnPosition = (
  person: Person,
  people: Person[],
  partnerships: Partnership[]
) => {
  const sexCode = personSexCode(person);
  const manual_position = person.siblingPositionOverride || null;
  if (manual_position) {
    const parsed = parsePositionCode(manual_position);
    return {
      person_id: person.id,
      derived_position: null,
      manual_position,
      effective_position: manual_position,
      confidence: 'MANUAL' as const,
      rank: parsed?.rank || null,
      composition:
        parsed?.composition && parsed.composition !== 'oc'
          ? (parsed.composition as TomanComposition)
          : null,
      siblings: [] as Person[],
      half_sibling_only: false,
      note: 'Using manual sibling position override.',
    };
  }

  const parentIds = parentIdsFor(person, partnerships);
  if (!parentIds.length) {
    return {
      person_id: person.id,
      derived_position: null,
      manual_position: null,
      effective_position: null,
      confidence: 'INDETERMINATE' as const,
      rank: null,
      composition: null,
      siblings: [] as Person[],
      half_sibling_only: false,
      note: 'No parent relationship is recorded for this person.',
    };
  }

  if (!sexCode) {
    return {
      person_id: person.id,
      derived_position: null,
      manual_position: null,
      effective_position: null,
      confidence: 'INDETERMINATE' as const,
      rank: null,
      composition: null,
      siblings: [] as Person[],
      half_sibling_only: false,
      note: 'A male/female birth sex is required to derive a Toman sibling position.',
    };
  }

  const siblings = people.filter(
    (candidate) => candidate.id !== person.id && sharesParent(person, candidate, partnerships)
  );

  const family = [...siblings, person];
  const { order, note } = sortOrderForFamily(family);
  if (!order) {
    return {
      person_id: person.id,
      derived_position: null,
      manual_position: null,
      effective_position: null,
      confidence: 'INDETERMINATE' as const,
      rank: null,
      composition: null,
      siblings,
      half_sibling_only:
        siblings.length > 0 &&
        siblings.every((sibling) => sharedParentCount(person, sibling, partnerships) === 1),
      note,
    };
  }

  const personOrder = order.get(person.id);
  if (!personOrder) {
    return {
      person_id: person.id,
      derived_position: null,
      manual_position: null,
      effective_position: null,
      confidence: 'INDETERMINATE' as const,
      rank: null,
      composition: null,
      siblings,
      half_sibling_only: false,
      note: 'Could not determine the person rank within the sibling set.',
    };
  }

  const rank = rankFromOrder(personOrder, family.length);
  const composition = rank === 'only' ? null : compositionForSiblings(siblings);
  const derived_position =
    rank === 'only'
      ? displayCodeFor(sexCode, rank, 'unknown')
      : composition
      ? displayCodeFor(sexCode, rank, composition)
      : null;

  const hasMissingSex = siblings.some((sibling) => !personSexCode(sibling));
  const hasMissingSortData = family.some(
    (member) => !hasKnownDate(member.birthDate) && typeof member.birthOrderOverride !== 'number'
  );
  const confidence =
    person.siblingsComplete && !hasMissingSex && !hasMissingSortData
      ? ('CONFIRMED' as const)
      : ('PROVISIONAL' as const);

  return {
    person_id: person.id,
    derived_position,
    manual_position: null,
    effective_position: derived_position,
    confidence,
    rank,
    composition,
    siblings,
    half_sibling_only:
      siblings.length > 0 &&
      siblings.every((sibling) => sharedParentCount(person, sibling, partnerships) === 1),
    note:
      !person.siblingsComplete
        ? 'Sibling set is marked incomplete.'
        : hasMissingSex
        ? 'One or more siblings are missing sex data.'
        : hasMissingSortData
        ? 'One or more siblings are missing sortable birth data.'
        : null,
  };
};

const buildConflictResult = (
  sourcePerson: Person,
  source: ReturnType<typeof deriveOwnPosition>,
  otherPerson: Person | null,
  otherLabel: string,
  people: Person[],
  partnerships: Partnership[]
): ConflictResult | null => {
  if (!otherPerson) return null;
  const other = deriveOwnPosition(otherPerson, people, partnerships);
  if (!source.effective_position || !other.effective_position) {
    return {
      other_person_id: otherPerson.id,
      other_effective_position: other.effective_position || 'insufficient data',
      rank_conflict: false,
      sex_conflict: null,
      sex_conflict_uncertain: false,
      category: 'insufficient data',
      confidence_note: null,
    };
  }

  const sourceParts = parsePositionCode(source.effective_position);
  const otherParts = parsePositionCode(other.effective_position);
  if (!sourceParts || !otherParts) {
    return {
      other_person_id: otherPerson.id,
      other_effective_position: other.effective_position,
      rank_conflict: false,
      sex_conflict: null,
      sex_conflict_uncertain: false,
      category: 'insufficient data',
      confidence_note: null,
    };
  }

  const rank_conflict =
    sourceParts.rank === 'only' ||
    otherParts.rank === 'only' ||
    sourceParts.rank === otherParts.rank;
  const sourceSex = personSexCode(sourcePerson);
  const otherSex = personSexCode(otherPerson);

  if (!sourceSex || !otherSex) {
    return {
      other_person_id: otherPerson.id,
      other_effective_position: other.effective_position,
      rank_conflict,
      sex_conflict: null,
      sex_conflict_uncertain: true,
      category: 'Indeterminate (missing sex data)',
      confidence_note: confidenceNoteFor(otherLabel, other.confidence),
    };
  }

  if (sourceSex === otherSex) {
    return {
      other_person_id: otherPerson.id,
      other_effective_position: other.effective_position,
      rank_conflict,
      sex_conflict: null,
      sex_conflict_uncertain: false,
      category: 'Rank Only Applicable (same-sex pair)',
      confidence_note: confidenceNoteFor(otherLabel, other.confidence),
    };
  }

  if (
    sourceParts.composition === 'unknown' ||
    sourceParts.composition === 'partial' ||
    otherParts.composition === 'unknown' ||
    otherParts.composition === 'partial'
  ) {
    return {
      other_person_id: otherPerson.id,
      other_effective_position: other.effective_position,
      rank_conflict,
      sex_conflict: null,
      sex_conflict_uncertain: true,
      category: 'Indeterminate (missing sex data)',
      confidence_note: confidenceNoteFor(otherLabel, other.confidence),
    };
  }

  const maleComposition = sourceSex === 'b' ? sourceParts.composition : otherParts.composition;
  const femaleComposition = sourceSex === 's' ? sourceParts.composition : otherParts.composition;
  const maleHasSisterExperience = maleComposition === 's' || maleComposition === 'bs';
  const femaleHasBrotherExperience = femaleComposition === 'b' || femaleComposition === 'bs';
  const sex_conflict = !maleHasSisterExperience && !femaleHasBrotherExperience;
  const category = rank_conflict
    ? sex_conflict
      ? 'Rank and Sex Conflict'
      : 'Rank Conflict'
    : sex_conflict
    ? 'Sex Conflict'
    : 'No Conflict';

  return {
    other_person_id: otherPerson.id,
    other_effective_position: other.effective_position,
    rank_conflict,
    sex_conflict,
    sex_conflict_uncertain: false,
    category,
    confidence_note: confidenceNoteFor(otherLabel, other.confidence),
  };
};

export const deriveSiblingPositionResult = ({
  person,
  people,
  partnerships,
}: {
  person: Person;
  people: Person[];
  partnerships: Partnership[];
}): SiblingPositionResult => {
  const own = deriveOwnPosition(person, people, partnerships);
  const father = parentMatchForRole(person, people, partnerships, 'father');
  const mother = parentMatchForRole(person, people, partnerships, 'mother');
  const partner = partnerForPerson(person, people, partnerships);

  return {
    person_id: own.person_id,
    derived_position: own.derived_position,
    manual_position: own.manual_position,
    effective_position: own.effective_position,
    confidence: own.confidence,
    rank: own.rank,
    composition: own.composition,
    half_sibling_only: own.half_sibling_only,
    conflict_with_father: buildConflictResult(person, own, father, 'Father', people, partnerships),
    conflict_with_mother: buildConflictResult(person, own, mother, 'Mother', people, partnerships),
    conflict_with_partner: buildConflictResult(person, own, partner, 'Partner', people, partnerships),
    note: own.note,
  };
};
