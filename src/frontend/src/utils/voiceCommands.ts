import voiceVocabulary from '../data/voiceVocabulary.json';
/**
 * Fields any operation may carry besides its own.
 *
 * - possessiveForms (voice-07): speech often drops the apostrophe ("Doris
 *   partner is Tom", "harrys partner is betty"), so the parser cannot tell a
 *   possessive "s" from a name that ends in "s". The name fields hold the
 *   stripped form ("Dori", "Harry"); this map gives, for each stripped name,
 *   the name as spoken ("Doris", "Harrys"). The apply step picks one against
 *   the people on the diagram (see resolveSpokenName in useVoiceHandlers).
 * - createsPeople (voice-05): filled in at review time with the names of the
 *   people the operation will create, so the review list says so.
 */
export type VoiceCommandOperationExtras = {
  possessiveForms?: Record<string, string>;
  createsPeople?: string[];
};

export type VoiceCommandOperation = VoiceCommandOperationExtras & (
  | {
      type: 'add_person';
      name: string;
      gender?: 'male' | 'female';
    }
  | {
      type: 'add_partnership';
      personName: string;
      partnerName: string;
    }
  | {
      type: 'add_children';
      parent1Name: string;
      parent2Name: string;
      childNames: string[];
    }
  | {
      type: 'set_person_birth_year';
      name: string;
      year: number;
    }
  | {
      type: 'set_person_death_year';
      name: string;
      year: number;
    }
  | {
      type: 'set_person_adoption_status';
      name: string;
      adoptionStatus: 'adopted' | 'biological';
    }
  | {
      type: 'set_partnership_status';
      person1Name: string;
      person2Name: string;
      relationshipType: 'married' | 'dating';
      relationshipStatus: 'married' | 'divorced' | 'separated' | 'ongoing';
      year?: number;
    }
  | {
      type: 'add_emotional_line';
      person1Name: string;
      person2Name: string;
      relationshipType: 'cutoff' | 'conflict' | 'fusion' | 'distance';
    }
);

export type VoiceCommandParseResult = {
  operations: VoiceCommandOperation[];
  errors: string[];
};

const normalizeSpacing = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalizeInput = (value: string) =>
  normalizeSpacing(value.replace(/[’‘]/g, "'").replace(/[“”]/g, '"'));

export const normalizeCommandName = (value: string) =>
  normalizeSpacing(value.replace(/'+$/g, ''))
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

/**
 * Split a spoken list of child names.
 *
 * voice-04: a comma-separated list, or a list with two or more "and"s, has
 * explicit separators, so each part is one name and stays whole ("Mary Ann,
 * Tom" gives Mary Ann and Tom). Only a list with no comma and at most one
 * "and" ("tom dick and jane", typical of speech transcripts with no
 * punctuation) is split on every space, because it has no other separator.
 */
const splitNameList = (value: string) => {
  const cleaned = normalizeSpacing(value);
  const andCount = (cleaned.match(/\band\b/gi) || []).length;
  const hasExplicitSeparators = cleaned.includes(',') || andCount >= 2;
  const parts = cleaned
    .split(/,|\band\b/i)
    .map((part) => normalizeSpacing(part))
    .filter(Boolean);
  if (hasExplicitSeparators) {
    return parts.map((part) => normalizeCommandName(part)).filter(Boolean);
  }
  return parts
    .flatMap((part) => part.split(/\s+/))
    .map((part) => normalizeCommandName(part))
    .filter(Boolean);
};

/**
 * Words that may stand before "named" in "add a ___ named X" and the sex each
 * one states (voice-03). "person" and "child" state no sex. The words are
 * editorial content and live in data/voiceVocabulary.json.
 */
const PERSON_NOUN_SEX: Record<string, 'male' | 'female' | undefined> = Object.fromEntries([
  ...voiceVocabulary.personNouns.unspecified.map((word) => [word, undefined] as const),
  ...voiceVocabulary.personNouns.male.map((word) => [word, 'male'] as const),
  ...voiceVocabulary.personNouns.female.map((word) => [word, 'female'] as const),
]);
const PERSON_NOUN_PATTERN = Object.keys(PERSON_NOUN_SEX).join('|');

/**
 * A possessive name captured as (name, suffix). With "'s" the name is certain.
 * With a bare "s" (voice-07) the name may itself end in "s", so both forms are
 * kept: the stripped one in the name field and the spoken one in
 * possessiveForms.
 */
const possessiveName = (
  stem: string,
  suffix: string
): { name: string; spoken?: string } => {
  const name = normalizeCommandName(stem);
  if (suffix.toLowerCase() === "'s") return { name };
  return { name, spoken: normalizeCommandName(`${stem}${suffix}`) };
};

const splitCommands = (input: string) => {
  const normalized = normalizeInput(input).replace(/[.;]+/g, '\n');
  const starterPatterns = [
    /\s+(?=(?:add|create)\b)/i,
    /\s+(?=they\s+(?:were|are)\s+married\b)/i,
    /\s+(?=they\s+(?:were|are)\s+divorced\b)/i,
    /\s+(?=they\s+(?:were|are)\s+separated\b)/i,
    /\s+(?=[a-z][a-z-]*(?:'s|s)\s+(?:partner|spouse)\s+is\b)/i,
    /\s+(?=[a-z][a-z-]*(?:'s|s)\s+(?:partner|spouse)\s+name\s+is\b)/i,
    /\s+(?=[a-z][a-z-]*\s+and\s+[a-z][a-z-]*(?:'s|s)\s+(?:children|kids)\s+are\b)/i,
    /\s+(?=[a-z][a-z-]*\s+and\s+[a-z][a-z-]*\s+are\s+married\b)/i,
    /\s+(?=[a-z][a-z-]*\s+and\s+[a-z][a-z-]*\s+(?:are\s+)?divorced\b)/i,
    /\s+(?=[a-z][a-z-]*\s+and\s+[a-z][a-z-]*\s+(?:are\s+)?separated\b)/i,
    /\s+(?=[a-z][a-z-]*\s+and\s+[a-z][a-z-]*\s+(?:have|are in)\s+(?:an?\s+emotional\s+)?(?:cutoff|conflict|fusion|distance)\b)/i,
  ];

  const splitChunk = (chunk: string): string[] => {
    const trimmed = normalizeSpacing(chunk);
    if (!trimmed) return [];
    let earliest = -1;
    for (const pattern of starterPatterns) {
      const index = trimmed.search(pattern);
      if (index > 0 && (earliest === -1 || index < earliest)) {
        earliest = index;
      }
    }
    if (earliest === -1) return [trimmed];
    return [...splitChunk(trimmed.slice(0, earliest)), ...splitChunk(trimmed.slice(earliest))];
  };

  return normalized
    .split(/\n+/)
    .flatMap((part) => splitChunk(part))
    .map((part) => normalizeSpacing(part.replace(/^[, ]+|[, ]+$/g, '')))
    .filter(Boolean);
};

export const parseVoiceCommands = (input: string): VoiceCommandParseResult => {
  const operations: VoiceCommandOperation[] = [];
  const errors: string[] = [];
  let lastPartnership: {
    person1Name: string;
    person2Name: string;
    possessiveForms?: Record<string, string>;
  } | null = null;
  splitCommands(input).forEach((command) => {
    const addAdoptionMatch = command.match(
      /^(?:add|create)\s+(?:an?\s+)?(adopted|biological)\s+(?:child\s+named|child|person\s+named|named)\s+([a-z][a-z' -]*)$/i
    );
    if (addAdoptionMatch) {
      operations.push({
        type: 'set_person_adoption_status',
        name: normalizeCommandName(addAdoptionMatch[2]),
        adoptionStatus: addAdoptionMatch[1].toLowerCase() as 'adopted' | 'biological',
      });
      return;
    }

    // voice-03: the noun ("man", "son", ...) is captured so it can set the
    // sex and is never folded into the name ("add a son named Bob" is Bob).
    const addPersonMatch = command.match(
      new RegExp(
        `^(?:add|create)\\s+(?:an?\\s+)?(?:(male|female)\\s+)?(?:(${PERSON_NOUN_PATTERN})\\s+)?(?:named\\s+)?([a-z][a-z' -]*)$`,
        'i'
      )
    );
    if (addPersonMatch) {
      const adjectiveSex = addPersonMatch[1]?.toLowerCase() as 'male' | 'female' | undefined;
      const nounSex = addPersonMatch[2]
        ? PERSON_NOUN_SEX[addPersonMatch[2].toLowerCase()]
        : undefined;
      if (adjectiveSex && nounSex && adjectiveSex !== nounSex) {
        errors.push(`"${command}" states two different sexes.`);
        return;
      }
      const gender = adjectiveSex || nounSex;
      operations.push({
        type: 'add_person',
        name: normalizeCommandName(addPersonMatch[3]),
        ...(gender ? { gender } : {}),
      });
      return;
    }

    // "X's partner is Y" and "X's partner name is Y". The suffix is captured
    // so a bare "s" keeps the spoken form too (voice-07).
    const partnerMatch = command.match(
      /^([a-z][a-z -]*?)('s|s)\s+(?:partner|spouse)\s+(?:name\s+)?is\s+([a-z][a-z -]*)$/i
    );
    if (partnerMatch) {
      const person = possessiveName(partnerMatch[1], partnerMatch[2]);
      const possessiveForms = person.spoken ? { [person.name]: person.spoken } : undefined;
      const op: VoiceCommandOperation = {
        type: 'add_partnership',
        personName: person.name,
        partnerName: normalizeCommandName(partnerMatch[3]),
        ...(possessiveForms ? { possessiveForms } : {}),
      };
      operations.push(op);
      lastPartnership = {
        person1Name: op.personName,
        person2Name: op.partnerName,
        possessiveForms,
      };
      return;
    }

    const childrenMatch = command.match(
      /^([a-z][a-z -]*)\s+and\s+([a-z][a-z -]*?)('s|s)\s+(?:children|kids)\s+are\s+(.+)$/i
    );
    if (childrenMatch) {
      const childNames = splitNameList(childrenMatch[4]);
      if (!childNames.length) {
        errors.push(`Could not find any child names in "${command}".`);
        return;
      }
      const parent2 = possessiveName(childrenMatch[2], childrenMatch[3]);
      operations.push({
        type: 'add_children',
        parent1Name: normalizeCommandName(childrenMatch[1]),
        parent2Name: parent2.name,
        childNames,
        ...(parent2.spoken ? { possessiveForms: { [parent2.name]: parent2.spoken } } : {}),
      });
      return;
    }

    const birthMatch = command.match(/^([a-z][a-z' -]*?)\s+(?:was\s+)?born\s+in\s+(\d{4})$/i);
    if (birthMatch) {
      operations.push({
        type: 'set_person_birth_year',
        name: normalizeCommandName(birthMatch[1]),
        year: Number(birthMatch[2]),
      });
      return;
    }

    const deathMatch = command.match(/^([a-z][a-z' -]*?)\s+died\s+in\s+(\d{4})$/i);
    if (deathMatch) {
      operations.push({
        type: 'set_person_death_year',
        name: normalizeCommandName(deathMatch[1]),
        year: Number(deathMatch[2]),
      });
      return;
    }

    const adoptionMatch = command.match(/^([a-z][a-z' -]*?)\s+is\s+(adopted|biological)$/i);
    if (adoptionMatch) {
      operations.push({
        type: 'set_person_adoption_status',
        name: normalizeCommandName(adoptionMatch[1]),
        adoptionStatus: adoptionMatch[2].toLowerCase() as 'adopted' | 'biological',
      });
      return;
    }

    const marriedMatch = command.match(
      /^([a-z][a-z' -]*)\s+and\s+([a-z][a-z' -]*)\s+are\s+married(?:\s+in\s+(\d{4}))?$/i
    );
    if (marriedMatch) {
      const op: VoiceCommandOperation = {
        type: 'set_partnership_status',
        person1Name: normalizeCommandName(marriedMatch[1]),
        person2Name: normalizeCommandName(marriedMatch[2]),
        relationshipType: 'married',
        relationshipStatus: 'married',
        year: marriedMatch[3] ? Number(marriedMatch[3]) : undefined,
      };
      operations.push(op);
      lastPartnership = { person1Name: op.person1Name, person2Name: op.person2Name };
      return;
    }

    const theyMarriedMatch = command.match(/^they\s+(?:were|are)\s+married(?:\s+in\s+(\d{4}))?$/i);
    if (theyMarriedMatch && lastPartnership) {
      operations.push({
        type: 'set_partnership_status',
        person1Name: lastPartnership.person1Name,
        person2Name: lastPartnership.person2Name,
        ...(lastPartnership.possessiveForms
          ? { possessiveForms: lastPartnership.possessiveForms }
          : {}),
        relationshipType: 'married',
        relationshipStatus: 'married',
        year: theyMarriedMatch[1] ? Number(theyMarriedMatch[1]) : undefined,
      });
      return;
    }

    const divorcedMatch = command.match(
      /^([a-z][a-z' -]*)\s+and\s+([a-z][a-z' -]*)\s+(?:are\s+)?divorced(?:\s+in\s+(\d{4}))?$/i
    );
    if (divorcedMatch) {
      const op: VoiceCommandOperation = {
        type: 'set_partnership_status',
        person1Name: normalizeCommandName(divorcedMatch[1]),
        person2Name: normalizeCommandName(divorcedMatch[2]),
        relationshipType: 'married',
        relationshipStatus: 'divorced',
        year: divorcedMatch[3] ? Number(divorcedMatch[3]) : undefined,
      };
      operations.push(op);
      lastPartnership = { person1Name: op.person1Name, person2Name: op.person2Name };
      return;
    }

    const theyDivorcedMatch = command.match(/^they\s+(?:were|are)\s+divorced(?:\s+in\s+(\d{4}))?$/i);
    if (theyDivorcedMatch && lastPartnership) {
      operations.push({
        type: 'set_partnership_status',
        person1Name: lastPartnership.person1Name,
        person2Name: lastPartnership.person2Name,
        ...(lastPartnership.possessiveForms
          ? { possessiveForms: lastPartnership.possessiveForms }
          : {}),
        relationshipType: 'married',
        relationshipStatus: 'divorced',
        year: theyDivorcedMatch[1] ? Number(theyDivorcedMatch[1]) : undefined,
      });
      return;
    }

    const separatedMatch = command.match(
      /^([a-z][a-z' -]*)\s+and\s+([a-z][a-z' -]*)\s+(?:are\s+)?separated(?:\s+in\s+(\d{4}))?$/i
    );
    if (separatedMatch) {
      const op: VoiceCommandOperation = {
        type: 'set_partnership_status',
        person1Name: normalizeCommandName(separatedMatch[1]),
        person2Name: normalizeCommandName(separatedMatch[2]),
        relationshipType: 'married',
        relationshipStatus: 'separated',
        year: separatedMatch[3] ? Number(separatedMatch[3]) : undefined,
      };
      operations.push(op);
      lastPartnership = { person1Name: op.person1Name, person2Name: op.person2Name };
      return;
    }

    const theySeparatedMatch = command.match(/^they\s+(?:were|are)\s+separated(?:\s+in\s+(\d{4}))?$/i);
    if (theySeparatedMatch && lastPartnership) {
      operations.push({
        type: 'set_partnership_status',
        person1Name: lastPartnership.person1Name,
        person2Name: lastPartnership.person2Name,
        ...(lastPartnership.possessiveForms
          ? { possessiveForms: lastPartnership.possessiveForms }
          : {}),
        relationshipType: 'married',
        relationshipStatus: 'separated',
        year: theySeparatedMatch[1] ? Number(theySeparatedMatch[1]) : undefined,
      });
      return;
    }

    const emotionalLineMatch = command.match(
      /^([a-z][a-z' -]*)\s+and\s+([a-z][a-z' -]*)\s+(?:have|are in)\s+(?:an?\s+emotional\s+)?(cutoff|conflict|fusion|distance)$/i
    );
    if (emotionalLineMatch) {
      operations.push({
        type: 'add_emotional_line',
        person1Name: normalizeCommandName(emotionalLineMatch[1]),
        person2Name: normalizeCommandName(emotionalLineMatch[2]),
        relationshipType: emotionalLineMatch[3].toLowerCase() as
          | 'cutoff'
          | 'conflict'
          | 'fusion'
          | 'distance',
      });
      return;
    }

    errors.push(`Could not parse "${command}".`);
  });

  return { operations, errors };
};

/**
 * The review-list line for one operation. When review found that the
 * operation will create people (createsPeople, voice-05), the line starts
 * with "Create person ..." so a misheard name is visible before Apply.
 */
export const describeVoiceOperation = (operation: VoiceCommandOperation): string => {
  const created = operation.createsPeople || [];
  if (operation.type === 'add_person') {
    const sex = operation.gender ? ` (${operation.gender})` : '';
    if (operation.createsPeople && created.length === 0) {
      return `Add person: ${operation.name}${sex} — already on the diagram, nothing new is created`;
    }
    return `Add person: ${operation.name}${sex}`;
  }
  const action =
    operation.type === 'add_partnership'
      ? `Create partnership: ${operation.personName} + ${operation.partnerName}`
      : operation.type === 'add_children'
      ? `Add children to ${operation.parent1Name} + ${operation.parent2Name}: ${operation.childNames.join(', ')}`
      : operation.type === 'set_person_birth_year'
      ? `Set birth year: ${operation.name} -> ${operation.year}`
      : operation.type === 'set_person_death_year'
      ? `Set death year: ${operation.name} -> ${operation.year}`
      : operation.type === 'set_person_adoption_status'
      ? `Set adoption: ${operation.name} -> ${operation.adoptionStatus}`
      : operation.type === 'set_partnership_status'
      ? `Set relationship: ${operation.person1Name} + ${operation.person2Name} -> ${operation.relationshipStatus}${operation.year ? ` (${operation.year})` : ''}`
      : `Add emotional line: ${operation.person1Name} + ${operation.person2Name} -> ${operation.relationshipType}`;
  if (!created.length) return action;
  return `Create person ${created.join(', ')}; ${action}`;
};
