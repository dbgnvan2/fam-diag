import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Person, Partnership, EmotionalLine } from '../types';
import { nanoid } from 'nanoid';
import {
  normalizeCommandName,
  parseVoiceCommands,
  type VoiceCommandOperation,
} from '../utils/voiceCommands';
import { DEFAULT_LINE_COLOR } from '../utils/emotionalPatternOptions';
import { inferGenderFromName, normalizeImportedChildLayout } from '../utils/dataNormalization';

export type VoiceCommandPlan = {
  /** The operations, each with createsPeople set to the people it will create. */
  operations: VoiceCommandOperation[];
  /** Problems that block applying (ambiguous names, children already in a family). */
  errors: string[];
  people: Person[];
  partnerships: Partnership[];
  emotionalLines: EmotionalLine[];
};

const nameKey = (value: string) => normalizeCommandName(value).toLowerCase();

/** Every full-name form a person can be referred to by. */
const fullNameKeys = (person: Person) =>
  new Set(
    [person.name || '', [person.firstName, person.lastName].filter(Boolean).join(' ')]
      .map(nameKey)
      .filter(Boolean)
  );

const firstNameKey = (person: Person) =>
  nameKey(person.firstName || (person.name || '').split(/\s+/)[0] || '');

type NameLookup =
  | { kind: 'found'; person: Person }
  | { kind: 'none' }
  | { kind: 'ambiguous'; message: string };

/**
 * Find the person a spoken name refers to (voice-05).
 *
 * An exact full-name match wins. Several exact matches are an error, never
 * "the last one". A one-word name may match a first name, but only when
 * exactly one person has that first name.
 */
export const lookupVoicePerson = (people: Person[], rawName: string): NameLookup => {
  const name = normalizeCommandName(rawName);
  const key = name.toLowerCase();
  const exact = people.filter((person) => fullNameKeys(person).has(key));
  if (exact.length === 1) return { kind: 'found', person: exact[0] };
  if (exact.length > 1) {
    return {
      kind: 'ambiguous',
      message: `${exact.length} people named ${name} — use the canvas.`,
    };
  }
  if (!key.includes(' ')) {
    const byFirst = people.filter((person) => firstNameKey(person) === key);
    if (byFirst.length === 1) return { kind: 'found', person: byFirst[0] };
    if (byFirst.length > 1) {
      return {
        kind: 'ambiguous',
        message: `${byFirst.length} people have the first name ${name} — say the full name or use the canvas.`,
      };
    }
  }
  return { kind: 'none' };
};

/**
 * Choose between the stripped and the spoken form of a possessive name
 * (voice-07): the spoken form ("Doris") when it matches someone, else the
 * stripped form ("Dori") when that matches someone, else the spoken form.
 */
export const resolveSpokenName = (people: Person[], name: string, spoken?: string) => {
  if (!spoken) return name;
  if (lookupVoicePerson(people, spoken).kind !== 'none') return spoken;
  if (lookupVoicePerson(people, name).kind !== 'none') return name;
  return spoken;
};

/**
 * Work out what a reviewed list of voice operations will do to the diagram,
 * without touching React state. Review and Apply both call this, so the
 * review list shows exactly what Apply will do.
 *
 * Inputs are copied first; only the copies are changed.
 */
export const planVoiceCommands = (
  operations: VoiceCommandOperation[],
  people: Person[],
  partnerships: Partnership[],
  emotionalLines: EmotionalLine[]
): VoiceCommandPlan => {
  const nextPeople: Person[] = people.map((person) => ({
    ...person,
    partnerships: [...(person.partnerships || [])],
    events: person.events ? [...person.events] : undefined,
  }));
  const nextPartnerships: Partnership[] = partnerships.map((partnership) => ({
    ...partnership,
    children: [...(partnership.children || [])],
    events: partnership.events ? [...partnership.events] : undefined,
  }));
  const nextEmotionalLines: EmotionalLine[] = emotionalLines.map((line) => ({
    ...line,
    events: line.events ? [...line.events] : undefined,
  }));
  const errors: string[] = [];
  const addError = (message: string) => {
    if (!errors.includes(message)) errors.push(message);
  };

  // voice-07: replace each stripped possessive name with the form chosen
  // against the people known at this point in the batch, so both the apply
  // step and the review line use the same name.
  const withSpokenNames = (operation: VoiceCommandOperation): VoiceCommandOperation => {
    const forms = operation.possessiveForms;
    if (!forms) return operation;
    const pick = (name: string) => resolveSpokenName(nextPeople, name, forms[name]);
    if (operation.type === 'add_partnership') {
      return { ...operation, personName: pick(operation.personName), partnerName: pick(operation.partnerName) };
    }
    if (operation.type === 'add_children') {
      return { ...operation, parent1Name: pick(operation.parent1Name), parent2Name: pick(operation.parent2Name) };
    }
    if (operation.type === 'set_partnership_status') {
      return { ...operation, person1Name: pick(operation.person1Name), person2Name: pick(operation.person2Name) };
    }
    return operation;
  };

  const planned = operations.map((spokenOperation) => {
    const operation = withSpokenNames(spokenOperation);
    const createsPeople: string[] = [];

    const ensurePerson = (
      rawName: string,
      options?: { gender?: 'male' | 'female'; near?: Person; role?: 'partner' | 'child' }
    ): Person | null => {
      const name = normalizeCommandName(rawName);
      const lookup = lookupVoicePerson(nextPeople, name);
      if (lookup.kind === 'ambiguous') {
        addError(lookup.message);
        return null;
      }
      if (lookup.kind === 'found') {
        // Only a sex the user stated fills an empty sex; nothing overwrites one.
        if (!lookup.person.gender && options?.gender) {
          lookup.person.gender = options.gender;
        }
        return lookup.person;
      }

      // Decided default (2026-09-27, TODO.md): stated sex, else name
      // evidence, else female.
      const gender = options?.gender || inferGenderFromName(name) || 'female';
      let x = 120 + (nextPeople.length % 6) * 150;
      let y = 140 + Math.floor(nextPeople.length / 6) * 180;
      if (options?.near && options.role === 'partner') {
        x = options.near.x + (gender === 'female' ? 140 : -140);
        y = options.near.y;
      }
      if (options?.near && options.role === 'child') {
        x = options.near.x;
        y = options.near.y;
      }
      const created: Person = {
        id: nanoid(),
        name,
        firstName: name.split(/\s+/)[0],
        lastName: name.split(/\s+/).slice(1).join(' ') || undefined,
        x,
        y,
        gender,
        partnerships: [],
        events: [],
      };
      nextPeople.push(created);
      createsPeople.push(name);
      return created;
    };

    // voice-02: neither partner's sex comes from speaking order. A new partner
    // gets the sex from name evidence or the decided default; an existing
    // person's sex is left as it is.
    const ensurePartnership = (firstName: string, secondName: string) => {
      const first = ensurePerson(firstName);
      if (!first) return null;
      const second = ensurePerson(secondName, { near: first, role: 'partner' });
      if (!second) return null;
      const existing = nextPartnerships.find(
        (entry) =>
          (entry.partner1_id === first.id && entry.partner2_id === second.id) ||
          (entry.partner1_id === second.id && entry.partner2_id === first.id)
      );
      if (existing) return { partnership: existing, first, second };

      const partnershipId = nanoid();
      const created: Partnership = {
        id: partnershipId,
        partner1_id: first.id,
        partner2_id: second.id,
        horizontalConnectorY: Math.max(first.y, second.y) + 100,
        relationshipType: 'dating',
        relationshipStatus: 'ongoing',
        children: [],
        events: [],
      };
      nextPartnerships.push(created);
      first.partnerships = [...new Set([...(first.partnerships || []), partnershipId])];
      second.partnerships = [...new Set([...(second.partnerships || []), partnershipId])];
      return { partnership: created, first, second };
    };

    const ensureEmotionalLine = (
      firstName: string,
      secondName: string,
      relationshipType: 'cutoff' | 'conflict' | 'fusion' | 'distance'
    ) => {
      const first = ensurePerson(firstName);
      const second = ensurePerson(secondName);
      if (!first || !second) return;
      const existing = nextEmotionalLines.find(
        (line) =>
          ((line.person1_id === first.id && line.person2_id === second.id) ||
            (line.person1_id === second.id && line.person2_id === first.id)) &&
          line.relationshipType === relationshipType
      );
      if (existing) return;

      const styleMap: Record<
        'cutoff' | 'conflict' | 'fusion' | 'distance',
        EmotionalLine['lineStyle']
      > = {
        cutoff: 'cutoff',
        conflict: 'conflict-dotted-wide',
        fusion: 'fusion-solid-wide',
        distance: 'distance-dashed-wide',
      };
      nextEmotionalLines.push({
        id: nanoid(),
        person1_id: first.id,
        person2_id: second.id,
        relationshipType,
        lineStyle: styleMap[relationshipType],
        lineEnding: 'none',
        status: 'ongoing',
        color: DEFAULT_LINE_COLOR,
        events: [],
      });
    };

    const applyOne = () => {
      if (operation.type === 'add_person') {
        ensurePerson(operation.name, { gender: operation.gender });
        return;
      }

      if (operation.type === 'add_partnership') {
        ensurePartnership(operation.personName, operation.partnerName);
        return;
      }

      if (operation.type === 'set_person_birth_year') {
        const person = ensurePerson(operation.name);
        if (person) person.birthDate = `${operation.year}-01-01`;
        return;
      }

      if (operation.type === 'set_person_death_year') {
        const person = ensurePerson(operation.name);
        if (person) person.deathDate = `${operation.year}-01-01`;
        return;
      }

      if (operation.type === 'set_person_adoption_status') {
        const person = ensurePerson(operation.name);
        if (person) person.adoptionStatus = operation.adoptionStatus;
        return;
      }

      if (operation.type === 'set_partnership_status') {
        const result = ensurePartnership(operation.person1Name, operation.person2Name);
        if (!result) return;
        const { partnership } = result;
        partnership.relationshipType = operation.relationshipType;
        partnership.relationshipStatus = operation.relationshipStatus;
        if (operation.relationshipStatus === 'married' && operation.year) {
          partnership.relationshipStartDate = `${operation.year}-01-01`;
          partnership.marriedStartDate = `${operation.year}-01-01`;
        }
        if (operation.relationshipStatus === 'divorced' && operation.year) {
          partnership.divorceDate = `${operation.year}-01-01`;
        }
        if (operation.relationshipStatus === 'separated' && operation.year) {
          partnership.separationDate = `${operation.year}-01-01`;
        }
        return;
      }

      if (operation.type === 'add_emotional_line') {
        ensureEmotionalLine(operation.person1Name, operation.person2Name, operation.relationshipType);
        return;
      }

      const result = ensurePartnership(operation.parent1Name, operation.parent2Name);
      if (!result) return;
      const { partnership, first, second } = result;
      const anchorX = (first.x + second.x) / 2;
      const baseY = partnership.horizontalConnectorY + 120;
      const spacing = 70;
      const startX = anchorX - ((operation.childNames.length - 1) * spacing) / 2;

      operation.childNames.forEach((childName, index) => {
        const child = ensurePerson(childName, {
          near: { ...first, x: startX + index * spacing, y: baseY },
          role: 'child',
        });
        if (!child) return;
        // voice-06: a child who already belongs to another family is not
        // moved; the review reports it and Apply is blocked.
        if (child.parentPartnership && child.parentPartnership !== partnership.id) {
          addError(
            `${child.name} already belongs to another family — use the canvas to change their parents.`
          );
          return;
        }
        child.parentPartnership = partnership.id;
        delete child.connectionAnchorX;
        if (!partnership.children.includes(child.id)) {
          partnership.children.push(child.id);
        }
        child.x = startX + index * spacing;
        child.y = baseY;
      });
    };

    applyOne();
    return { ...operation, createsPeople };
  });

  return {
    operations: planned,
    errors,
    people: nextPeople,
    partnerships: nextPartnerships,
    emotionalLines: nextEmotionalLines,
  };
};

interface UseVoiceHandlersDeps {
  voiceCommandText: string;
  voiceListening: boolean;
  people: Person[];
  partnerships: Partnership[];
  emotionalLines: EmotionalLine[];
  speechRecognitionRef: MutableRefObject<SpeechRecognition | null>;
  alignAllAnchors: (people: Person[], partnershipSource?: Partnership[]) => Person[];
  setVoiceCommandOperations: Dispatch<SetStateAction<VoiceCommandOperation[]>>;
  setVoiceCommandErrors: Dispatch<SetStateAction<string[]>>;
  setVoiceStatusMessage: Dispatch<SetStateAction<string>>;
  setVoiceListening: Dispatch<SetStateAction<boolean>>;
  setPeople: Dispatch<SetStateAction<Person[]>>;
  setPartnerships: Dispatch<SetStateAction<Partnership[]>>;
  setEmotionalLines: Dispatch<SetStateAction<EmotionalLine[]>>;
  setSelectedPeopleIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPartnershipId: Dispatch<SetStateAction<string | null>>;
  setPropertiesPanelItem: Dispatch<SetStateAction<Person | Partnership | EmotionalLine | null>>;
}

export function useVoiceHandlers({
  voiceCommandText,
  voiceListening,
  people,
  partnerships,
  emotionalLines,
  speechRecognitionRef,
  alignAllAnchors,
  setVoiceCommandOperations,
  setVoiceCommandErrors,
  setVoiceStatusMessage,
  setVoiceListening,
  setPeople,
  setPartnerships,
  setEmotionalLines,
  setSelectedPeopleIds,
  setSelectedPartnershipId,
  setPropertiesPanelItem,
}: UseVoiceHandlersDeps) {
  // Parse, then plan against the current diagram, so the review shows the
  // people each command will create and any name or family conflict.
  const reviewAgainstDiagram = () => {
    const parsed = parseVoiceCommands(voiceCommandText);
    const plan = planVoiceCommands(parsed.operations, people, partnerships, emotionalLines);
    const errors = [...parsed.errors, ...plan.errors];
    setVoiceCommandOperations(plan.operations);
    setVoiceCommandErrors(errors);
    return { plan, errors };
  };

  const reviewVoiceCommands = () => {
    const { plan, errors } = reviewAgainstDiagram();
    setVoiceStatusMessage(
      errors.length
        ? 'Review the unsupported commands before applying.'
        : plan.operations.length
        ? `Ready to apply ${plan.operations.length} command${plan.operations.length === 1 ? '' : 's'}.`
        : 'No supported commands found.'
    );
  };

  const toggleVoiceListening = () => {
    const recognition = speechRecognitionRef.current;
    if (!recognition) {
      setVoiceStatusMessage('Speech recognition is not available in this browser.');
      return;
    }
    if (voiceListening) {
      recognition.stop();
      setVoiceListening(false);
      return;
    }
    try {
      recognition.start();
      setVoiceListening(true);
      setVoiceStatusMessage('Listening for commands...');
    } catch {
      setVoiceStatusMessage('Speech recognition could not start.');
    }
  };

  const applyVoiceCommands = () => {
    const { plan, errors } = reviewAgainstDiagram();
    if (!plan.operations.length) {
      setVoiceStatusMessage('No supported commands found.');
      return;
    }
    if (errors.length) {
      setVoiceStatusMessage('Fix the unsupported commands before applying.');
      return;
    }

    const normalized = normalizeImportedChildLayout(plan.people, plan.partnerships, {
      expandParentSpan: true,
      autoResizeDenseFamilies: true,
    });
    setPeople(alignAllAnchors(normalized.people, normalized.partnerships));
    setPartnerships(normalized.partnerships);
    setEmotionalLines(plan.emotionalLines);
    setVoiceStatusMessage(
      `Applied ${plan.operations.length} command${plan.operations.length === 1 ? '' : 's'}.`
    );
    setSelectedPeopleIds([]);
    setSelectedPartnershipId(null);
    setPropertiesPanelItem(null);
  };

  return {
    reviewVoiceCommands,
    toggleVoiceListening,
    applyVoiceCommands,
  };
}
