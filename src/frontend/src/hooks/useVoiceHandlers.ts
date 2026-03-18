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

interface UseVoiceHandlersDeps {
  voiceCommandText: string;
  voiceListening: boolean;
  people: Person[];
  partnerships: Partnership[];
  emotionalLines: EmotionalLine[];
  speechRecognitionRef: MutableRefObject<SpeechRecognition | null>;
  alignAllAnchors: (people: Person[]) => Person[];
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
  const reviewVoiceCommands = () => {
    const result = parseVoiceCommands(voiceCommandText);
    setVoiceCommandOperations(result.operations);
    setVoiceCommandErrors(result.errors);
    setVoiceStatusMessage(
      result.errors.length
        ? 'Review the unsupported commands before applying.'
        : result.operations.length
        ? `Ready to apply ${result.operations.length} command${result.operations.length === 1 ? '' : 's'}.`
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
    const reviewed = parseVoiceCommands(voiceCommandText);
    setVoiceCommandOperations(reviewed.operations);
    setVoiceCommandErrors(reviewed.errors);
    if (!reviewed.operations.length) {
      setVoiceStatusMessage('No supported commands found.');
      return;
    }
    if (reviewed.errors.length) {
      setVoiceStatusMessage('Fix the unsupported commands before applying.');
      return;
    }

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

    const personNameKey = (value: string) => normalizeCommandName(value).toLowerCase();
    const personByKey = new Map<string, Person>();
    nextPeople.forEach((person) => {
      personByKey.set(personNameKey(person.name || ''), person);
    });

    const ensurePerson = (
      rawName: string,
      options?: { gender?: 'male' | 'female'; near?: Person; role?: 'partner' | 'child' }
    ) => {
      const name = normalizeCommandName(rawName);
      const key = personNameKey(name);
      const existing = personByKey.get(key);
      if (existing) {
        if (!existing.gender && options?.gender) {
          existing.gender = options.gender;
        }
        return existing;
      }

      let x = 120 + (nextPeople.length % 6) * 150;
      let y = 140 + Math.floor(nextPeople.length / 6) * 180;
      if (options?.near && options.role === 'partner') {
        const offsetX = options.gender === 'female' ? 140 : -140;
        x = options.near.x + offsetX;
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
        gender: options?.gender || inferGenderFromName(name) || 'female',
        partnerships: [],
        events: [],
      };
      nextPeople.push(created);
      personByKey.set(key, created);
      return created;
    };

    const ensurePartnership = (firstName: string, secondName: string) => {
      const first = ensurePerson(firstName, { gender: 'male' });
      const second = ensurePerson(secondName, {
        gender: first.gender === 'male' ? 'female' : 'male',
        near: first,
        role: 'partner',
      });
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

    reviewed.operations.forEach((operation) => {
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
        person.birthDate = `${operation.year}-01-01`;
        return;
      }

      if (operation.type === 'set_person_death_year') {
        const person = ensurePerson(operation.name);
        person.deathDate = `${operation.year}-01-01`;
        return;
      }

      if (operation.type === 'set_person_adoption_status') {
        const person = ensurePerson(operation.name);
        person.adoptionStatus = operation.adoptionStatus;
        return;
      }

      if (operation.type === 'set_partnership_status') {
        const { partnership } = ensurePartnership(operation.person1Name, operation.person2Name);
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

      const { partnership, first, second } = ensurePartnership(
        operation.parent1Name,
        operation.parent2Name
      );
      const anchorX = (first.x + second.x) / 2;
      const baseY = partnership.horizontalConnectorY + 120;
      const spacing = 70;
      const startX = anchorX - ((operation.childNames.length - 1) * spacing) / 2;

      operation.childNames.forEach((childName, index) => {
        const child = ensurePerson(childName, {
          near: {
            ...first,
            x: startX + index * spacing,
            y: baseY,
          },
          role: 'child',
        });
        if (child.parentPartnership && child.parentPartnership !== partnership.id) {
          const prior = nextPartnerships.find((entry) => entry.id === child.parentPartnership);
          if (prior) {
            prior.children = prior.children.filter((entry) => entry !== child.id);
          }
        }
        child.parentPartnership = partnership.id;
        delete child.connectionAnchorX;
        if (!partnership.children.includes(child.id)) {
          partnership.children.push(child.id);
        }
        child.x = startX + index * spacing;
        child.y = baseY;
      });
    });

    const normalizedPeople = normalizeImportedChildLayout(nextPeople, nextPartnerships, {
      expandParentSpan: true,
      autoResizeDenseFamilies: true,
    });
    setPeople(alignAllAnchors(normalizedPeople));
    setPartnerships(nextPartnerships);
    setEmotionalLines(nextEmotionalLines);
    setVoiceStatusMessage(
      `Applied ${reviewed.operations.length} command${reviewed.operations.length === 1 ? '' : 's'}.`
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
