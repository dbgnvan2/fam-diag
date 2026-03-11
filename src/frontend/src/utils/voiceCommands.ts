export type VoiceCommandOperation =
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
    };

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

const splitNameList = (value: string) => {
  const cleaned = normalizeSpacing(value.replace(/\band\b/gi, ','));
  if (cleaned.includes(',')) {
    return cleaned
      .split(',')
      .flatMap((part) => {
        const trimmed = normalizeSpacing(part);
        if (!trimmed) return [];
        const words = trimmed.split(/\s+/).filter(Boolean);
        if (words.length > 1 && words.every((word) => /^[a-z][a-z'-]*$/i.test(word))) {
          return words.map((word) => normalizeCommandName(word));
        }
        return [normalizeCommandName(trimmed)];
      })
      .filter(Boolean);
  }
  const spaceSeparated = cleaned
    .split(/\s+/)
    .map((part) => normalizeCommandName(part))
    .filter(Boolean);
  return spaceSeparated;
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
  let lastPartnership: { person1Name: string; person2Name: string } | null = null;
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

    const addPersonMatch = command.match(
      /^(?:add|create)\s+(?:a\s+)?(?:(male|female)\s+)?(?:(?:person|man|woman)\s+)?(?:named\s+)?([a-z][a-z' -]*)$/i
    );
    if (addPersonMatch) {
      const gender =
        addPersonMatch[1]?.toLowerCase() === 'male' || addPersonMatch[1]?.toLowerCase() === 'female'
          ? (addPersonMatch[1].toLowerCase() as 'male' | 'female')
          : undefined;
      operations.push({
        type: 'add_person',
        name: normalizeCommandName(addPersonMatch[2]),
        gender,
      });
      return;
    }

    const partnerMatch = command.match(
      /^([a-z][a-z -]*)(?:'s|s)\s+(?:partner|spouse)\s+is\s+([a-z][a-z -]*)$/i
    );
    if (partnerMatch) {
      const op: VoiceCommandOperation = {
        type: 'add_partnership',
        personName: normalizeCommandName(partnerMatch[1]),
        partnerName: normalizeCommandName(partnerMatch[2]),
      };
      operations.push(op);
      lastPartnership = { person1Name: op.personName, person2Name: op.partnerName };
      return;
    }

    const partnerNameMatch = command.match(
      /^([a-z][a-z -]*)(?:'s|s)\s+(?:partner|spouse)\s+name\s+is\s+([a-z][a-z -]*)$/i
    );
    if (partnerNameMatch) {
      const op: VoiceCommandOperation = {
        type: 'add_partnership',
        personName: normalizeCommandName(partnerNameMatch[1]),
        partnerName: normalizeCommandName(partnerNameMatch[2]),
      };
      operations.push(op);
      lastPartnership = { person1Name: op.personName, person2Name: op.partnerName };
      return;
    }

    const childrenMatch = command.match(
      /^([a-z][a-z -]*)\s+and\s+([a-z][a-z -]*)(?:'s|s)\s+(?:children|kids)\s+are\s+(.+)$/i
    );
    if (childrenMatch) {
      const childNames = splitNameList(childrenMatch[3]);
      if (!childNames.length) {
        errors.push(`Could not find any child names in "${command}".`);
        return;
      }
      operations.push({
        type: 'add_children',
        parent1Name: normalizeCommandName(childrenMatch[1]),
        parent2Name: normalizeCommandName(childrenMatch[2]),
        childNames,
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
