/**
 * Merge an imported diagram into the current one ("Add To Existing Family").
 *
 * Purpose: match incoming people to existing ones by name, remap every id,
 *          merge partnerships / emotional lines / triangles / page notes, and
 *          lay out only what the merge added.
 * Tests:   src/frontend/src/utils/diagramMerge.test.ts
 *
 * Pure: the current state is not modified. Moved out of DiagramEditor so it
 * can be tested. Two behaviours changed in the move:
 * - References to a person the merge skipped (facts mode ignores unmatched
 *   names) are dropped and counted, instead of being stored with the raw
 *   incoming id, which pointed at no one.
 * - The layout normalizer runs only over the new people and new
 *   partnerships. It used to run over the whole diagram and move the user's
 *   existing families.
 */
import { nanoid } from 'nanoid';
import type {
  EmotionalLine,
  EmotionalProcessEvent,
  FunctionalIndicatorDefinition,
  PageNote,
  Partnership,
  Person,
  Triangle,
} from '../types';
import type { DiagramImportData } from '../types/diagramEditor';
import { removeOrphanedMiscarriages } from './dataCleanup';
import { normalizeEmotionalLines, normalizeTriangles } from './emotionalLineNormalization';
import {
  attachEventClassToEntities,
  attachFamilyEventsToPartnerships,
  normalizeImportedChildLayout,
  sanitizePeopleIndicators,
} from './dataNormalization';

/** Horizontal gap between a new child and the previous child in the row. */
const NEW_CHILD_SPACING = 90;
/** How far below a couple's connector line a first child is placed. */
const CHILD_ROW_BELOW_CONNECTOR = 120;
/** Two people whose centres are closer than this vertically share a row. */
const ROW_COLLISION_HEIGHT = 60;

export type DiagramMergeCurrent = {
  people: Person[];
  partnerships: Partnership[];
  emotionalLines: EmotionalLine[];
  triangles: Triangle[];
  pageNotes: PageNote[];
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
};

export type DiagramMergeOptions = {
  /** false = facts mode: unmatched incoming people are skipped, not added. */
  allowNewPeople?: boolean;
  /** DiagramEditor's multiple-birth anchor alignment, applied to the result. */
  alignAllAnchors?: (people: Person[], partnerships: Partnership[]) => Person[];
};

export type DiagramMergeResult = {
  people: Person[];
  partnerships: Partnership[];
  emotionalLines: EmotionalLine[];
  triangles: Triangle[];
  pageNotes: PageNote[];
  functionalIndicatorDefinitions: FunctionalIndicatorDefinition[];
  /** Names of incoming people not added (facts mode, no existing match). */
  skippedPeopleNames: string[];
  /**
   * Incoming items dropped because they referenced a skipped person (or, for
   * triangles, because two of their people merged into one).
   */
  droppedPartnerships: number;
  droppedLines: number;
  droppedTriangles: number;
};

export const mergeDiagramData = (
  current: DiagramMergeCurrent,
  data: DiagramImportData,
  options: DiagramMergeOptions = {}
): DiagramMergeResult => {
  const { people, partnerships, emotionalLines, triangles, pageNotes, functionalIndicatorDefinitions } = current;
  const allowNewPeople = options.allowNewPeople ?? true;
  const alignAllAnchors = options.alignAllAnchors ?? ((list: Person[]) => list);
  if (!Array.isArray(data.people) || !Array.isArray(data.partnerships) || !Array.isArray(data.emotionalLines)) {
    throw new Error('Invalid file format');
  }

  const incomingDefs: FunctionalIndicatorDefinition[] = Array.isArray(data.functionalIndicatorDefinitions)
    ? data.functionalIndicatorDefinitions
    : [];
  const definitionById = new Map(functionalIndicatorDefinitions.map((def) => [def.id, def]));
  incomingDefs.forEach((def) => {
    if (def?.id && !definitionById.has(def.id)) {
      definitionById.set(def.id, def);
    }
  });
  const mergedDefinitions = [...definitionById.values()];

  const cleaned = removeOrphanedMiscarriages(data.people, data.partnerships);
  const normalizedLines = normalizeEmotionalLines(data.emotionalLines);
  const normalizedTriangles = normalizeTriangles(Array.isArray(data.triangles) ? data.triangles : []);
  const incomingPeople = attachEventClassToEntities(cleaned.people, 'individual');
  const incomingPartnerships = attachFamilyEventsToPartnerships(
    attachEventClassToEntities(cleaned.partnerships, 'relationship')
  );
  const incomingLines = attachEventClassToEntities(normalizedLines, 'emotional-pattern');

  const usedPersonIds = new Set(people.map((p) => p.id));
  const usedPartnershipIds = new Set(partnerships.map((p) => p.id));
  const usedLineIds = new Set(emotionalLines.map((line) => line.id));
  const usedTriangleIds = new Set(triangles.map((triangle) => triangle.id));

  const personIdMap = new Map<string, string>();
  const skippedPeopleNames: string[] = [];
  let droppedPartnerships = 0;
  let droppedLines = 0;
  let droppedTriangles = 0;
  const existingPersonIds = new Set(people.map((p) => p.id));
  // An incoming person reference resolves to the person it was merged into or
  // added as, or to an existing diagram person with that id. Anything else is
  // a person this merge skipped: return undefined so references to them are
  // dropped instead of being stored pointing at no one.
  const resolvePersonId = (id: string | undefined): string | undefined => {
    if (!id) return undefined;
    const mapped = personIdMap.get(id);
    if (mapped) return mapped;
    return existingPersonIds.has(id) ? id : undefined;
  };
  const resolveChildIds = (ids: string[] | undefined) =>
    (ids || []).map(resolvePersonId).filter((id): id is string => Boolean(id));
  const partnershipIdMap = new Map<string, string>();
  const lineIdMap = new Map<string, string>();

  const nextUniqueId = (preferred: string | undefined, used: Set<string>) => {
    if (preferred && !used.has(preferred)) {
      used.add(preferred);
      return preferred;
    }
    let next = nanoid();
    while (used.has(next)) {
      next = nanoid();
    }
    used.add(next);
    return next;
  };

  const normalizeNameKey = (person: Pick<Person, 'name' | 'firstName' | 'lastName'>) => {
    const combined = [person.firstName, person.lastName].filter(Boolean).join(' ').trim();
    const base = (combined || person.name || '').trim().toLowerCase();
    return base.replace(/[^a-z0-9]+/g, ' ').trim();
  };
  const normalizeFirstName = (person: Pick<Person, 'name' | 'firstName'>) => {
    const first = (person.firstName || person.name || '').trim().split(/\s+/)[0] || '';
    return first.toLowerCase();
  };
  const normalizeLastName = (person: Pick<Person, 'name' | 'lastName'>) => {
    const fromField = (person.lastName || '').trim();
    if (fromField) return fromField.toLowerCase();
    const tokens = (person.name || '').trim().split(/\s+/).filter(Boolean);
    return tokens.length > 1 ? tokens[tokens.length - 1].toLowerCase() : '';
  };

  const mergeEvents = (
    current?: EmotionalProcessEvent[],
    incoming?: EmotionalProcessEvent[]
  ): EmotionalProcessEvent[] | undefined => {
    const merged = [...(current || [])];
    const seen = new Set(merged.map((event) => event.id));
    (incoming || []).forEach((event) => {
      if (!seen.has(event.id)) {
        merged.push(event);
        seen.add(event.id);
      }
    });
    return merged.length ? merged : undefined;
  };

  const mergeIndicators = (
    current?: Person['functionalIndicators'],
    incoming?: Person['functionalIndicators']
  ): Person['functionalIndicators'] => {
    const merged = [...(current || [])];
    const seen = new Set(merged.map((entry) => `${entry.definitionId}:${entry.status}`));
    (incoming || []).forEach((entry) => {
      const key = `${entry.definitionId}:${entry.status}`;
      if (!seen.has(key)) {
        merged.push(entry);
        seen.add(key);
      }
    });
    return merged.length ? merged : undefined;
  };

  const existingPersonByNameKey = new Map<string, Person>();
  const existingPersonByFirst = new Map<string, Person[]>();
  people.forEach((person) => {
    const key = normalizeNameKey(person);
    if (key && !existingPersonByNameKey.has(key)) {
      existingPersonByNameKey.set(key, person);
    }
    const first = normalizeFirstName(person);
    if (first) {
      const bucket = existingPersonByFirst.get(first) || [];
      bucket.push(person);
      existingPersonByFirst.set(first, bucket);
    }
  });

  const updatedPeopleById = new Map<string, Person>(people.map((person) => [person.id, person]));
  const newPeople: Person[] = [];

  incomingPeople.forEach((incomingPerson) => {
    const key = normalizeNameKey(incomingPerson);
    const incomingFirst = normalizeFirstName(incomingPerson);
    const incomingLast = normalizeLastName(incomingPerson);
    let existingMatch = key ? existingPersonByNameKey.get(key) : undefined;
    if (!existingMatch && incomingFirst) {
      const candidates = existingPersonByFirst.get(incomingFirst) || [];
      if (incomingLast) {
        existingMatch = candidates.find(
          (candidate) => normalizeLastName(candidate) === incomingLast
        );
      } else if (candidates.length === 1) {
        // If incoming record is single-name (e.g., "Donald"), attach to the unique existing first-name match.
        existingMatch = candidates[0];
      }
    }
    if (existingMatch) {
      personIdMap.set(incomingPerson.id, existingMatch.id);
      const mergedPerson: Person = {
        ...existingMatch,
        firstName: existingMatch.firstName || incomingPerson.firstName,
        lastName: existingMatch.lastName || incomingPerson.lastName,
        maidenName: existingMatch.maidenName || incomingPerson.maidenName,
        birthDate: existingMatch.birthDate || incomingPerson.birthDate,
        deathDate: existingMatch.deathDate || incomingPerson.deathDate,
        gender: existingMatch.gender || incomingPerson.gender,
        notes:
          existingMatch.notes && incomingPerson.notes
            ? existingMatch.notes.includes(incomingPerson.notes)
              ? existingMatch.notes
              : `${existingMatch.notes}\n${incomingPerson.notes}`
            : existingMatch.notes || incomingPerson.notes,
        lifeStatus: existingMatch.lifeStatus || incomingPerson.lifeStatus,
        adoptionStatus: existingMatch.adoptionStatus || incomingPerson.adoptionStatus,
        parentConnectionPattern:
          existingMatch.parentConnectionPattern || incomingPerson.parentConnectionPattern,
        functionalIndicators: mergeIndicators(
          existingMatch.functionalIndicators,
          incomingPerson.functionalIndicators
        ),
        events: mergeEvents(existingMatch.events, incomingPerson.events),
      };
      updatedPeopleById.set(existingMatch.id, mergedPerson);
      return;
    }

    if (!allowNewPeople) {
      // Facts-mode merge: ignore unmatched names instead of creating noisy/duplicate people.
      skippedPeopleNames.push(incomingPerson.name || incomingPerson.id);
      return;
    }

    const newId = nextUniqueId(incomingPerson.id, usedPersonIds);
    personIdMap.set(incomingPerson.id, newId);
    const nextPerson: Person = {
      ...incomingPerson,
      id: newId,
      partnerships: [],
    };
    newPeople.push(nextPerson);
    if (key) {
      existingPersonByNameKey.set(key, nextPerson);
    }
    const first = normalizeFirstName(nextPerson);
    if (first) {
      const bucket = existingPersonByFirst.get(first) || [];
      bucket.push(nextPerson);
      existingPersonByFirst.set(first, bucket);
    }
  });

  const basePeopleMerged = [...updatedPeopleById.values(), ...newPeople];

  const partnershipPairKey = (partner1: string, partner2: string) =>
    [partner1, partner2].sort().join('::');

  const existingPartnershipByPair = new Map<string, Partnership>();
  partnerships.forEach((partnership) => {
    existingPartnershipByPair.set(
      partnershipPairKey(partnership.partner1_id, partnership.partner2_id),
      partnership
    );
  });

  const mergedPartnerships = [...partnerships];
  const addedPartnershipIds = new Set<string>();
  incomingPartnerships.forEach((partnership) => {
    const partner1 = resolvePersonId(partnership.partner1_id);
    const partner2 = resolvePersonId(partnership.partner2_id);
    if (!partner1 || !partner2) {
      droppedPartnerships += 1;
      return;
    }
    const pairKey = partnershipPairKey(partner1, partner2);
    const existingMatch = existingPartnershipByPair.get(pairKey);
    if (existingMatch) {
      partnershipIdMap.set(partnership.id, existingMatch.id);
      const mergedChildren = [
        ...new Set([
          ...(existingMatch.children || []),
          ...resolveChildIds(partnership.children),
        ]),
      ];
      const merged: Partnership = {
        ...existingMatch,
        relationshipType:
          existingMatch.relationshipType === 'dating' ? partnership.relationshipType : existingMatch.relationshipType,
        relationshipStatus:
          existingMatch.relationshipStatus === 'married' && partnership.relationshipStatus !== 'married'
            ? partnership.relationshipStatus
            : existingMatch.relationshipStatus,
        relationshipStartDate: existingMatch.relationshipStartDate || partnership.relationshipStartDate,
        marriedStartDate: existingMatch.marriedStartDate || partnership.marriedStartDate,
        separationDate: existingMatch.separationDate || partnership.separationDate,
        divorceDate: existingMatch.divorceDate || partnership.divorceDate,
        statusDates: {
          ...(existingMatch.statusDates || {}),
          ...(partnership.statusDates || {}),
        },
        notes:
          existingMatch.notes && partnership.notes
            ? existingMatch.notes.includes(partnership.notes)
              ? existingMatch.notes
              : `${existingMatch.notes}\n${partnership.notes}`
            : existingMatch.notes || partnership.notes,
        children: mergedChildren,
        events: mergeEvents(existingMatch.events, partnership.events),
      };
      const index = mergedPartnerships.findIndex((candidate) => candidate.id === existingMatch.id);
      if (index >= 0) mergedPartnerships[index] = merged;
      return;
    }

    const newId = nextUniqueId(partnership.id, usedPartnershipIds);
    partnershipIdMap.set(partnership.id, newId);
    const added: Partnership = {
      ...partnership,
      id: newId,
      partner1_id: partner1,
      partner2_id: partner2,
      children: resolveChildIds(partnership.children),
    };
    mergedPartnerships.push(added);
    addedPartnershipIds.add(newId);
    existingPartnershipByPair.set(pairKey, added);
  });

  const lineKey = (line: EmotionalLine) =>
    [
      ...[line.person1_id, line.person2_id].sort(),
      line.relationshipType,
      line.lineStyle,
      line.lineEnding,
    ].join('::');

  const existingLineByKey = new Map<string, EmotionalLine>();
  emotionalLines.forEach((line) => {
    existingLineByKey.set(lineKey(line), line);
  });

  const mergedLines = [...emotionalLines];
  incomingLines.forEach((line) => {
    const person1 = resolvePersonId(line.person1_id);
    const person2 = resolvePersonId(line.person2_id);
    if (!person1 || !person2) {
      droppedLines += 1;
      return;
    }
    const remappedLine: EmotionalLine = { ...line, person1_id: person1, person2_id: person2 };
    const key = lineKey(remappedLine);
    const existingMatch = existingLineByKey.get(key);
    if (existingMatch) {
      lineIdMap.set(line.id, existingMatch.id);
      const merged: EmotionalLine = {
        ...existingMatch,
        status: existingMatch.status || remappedLine.status,
        startDate: existingMatch.startDate || remappedLine.startDate,
        endDate: existingMatch.endDate || remappedLine.endDate,
        notes:
          existingMatch.notes && remappedLine.notes
            ? existingMatch.notes.includes(remappedLine.notes)
              ? existingMatch.notes
              : `${existingMatch.notes}\n${remappedLine.notes}`
            : existingMatch.notes || remappedLine.notes,
        events: mergeEvents(existingMatch.events, remappedLine.events),
      };
      const index = mergedLines.findIndex((candidate) => candidate.id === existingMatch.id);
      if (index >= 0) mergedLines[index] = merged;
      return;
    }
    const newId = nextUniqueId(line.id, usedLineIds);
    lineIdMap.set(line.id, newId);
    const added = { ...remappedLine, id: newId };
    mergedLines.push(added);
    existingLineByKey.set(key, added);
  });

  const triangleKey = (triangle: Triangle) =>
    [triangle.person1_id, triangle.person2_id, triangle.person3_id].sort().join('::');

  const existingTriangleByKey = new Map<string, Triangle>();
  triangles.forEach((triangle) => {
    existingTriangleByKey.set(triangleKey(triangle), triangle);
  });

  const mergedTriangles = [...triangles];
  normalizedTriangles.forEach((triangle) => {
    const trianglePeople = [triangle.person1_id, triangle.person2_id, triangle.person3_id].map(resolvePersonId);
    if (trianglePeople.some((id) => !id)) {
      droppedTriangles += 1;
      return;
    }
    const remappedTriangle: Triangle = {
      ...triangle,
      person1_id: trianglePeople[0] as string,
      person2_id: trianglePeople[1] as string,
      person3_id: trianglePeople[2] as string,
    };
    const uniquePeople = new Set([
      remappedTriangle.person1_id,
      remappedTriangle.person2_id,
      remappedTriangle.person3_id,
    ]);
    if (uniquePeople.size !== 3) {
      // Two of its people merged into one existing person: not a triangle.
      droppedTriangles += 1;
      return;
    }
    const key = triangleKey(remappedTriangle);
    const existingMatch = existingTriangleByKey.get(key);
    if (existingMatch) {
      const index = mergedTriangles.findIndex((candidate) => candidate.id === existingMatch.id);
      if (index >= 0) {
        mergedTriangles[index] = {
          ...existingMatch,
          color: existingMatch.color || remappedTriangle.color,
          intensity: existingMatch.intensity || remappedTriangle.intensity || 'medium',
        };
      }
      return;
    }
    const newId = nextUniqueId(triangle.id, usedTriangleIds);
    const added = { ...remappedTriangle, id: newId };
    mergedTriangles.push(added);
    existingTriangleByKey.set(key, added);
  });

  const newPersonIds = new Set(newPeople.map((person) => person.id));
  const peopleWithLinks: Person[] = basePeopleMerged.map((person) => {
    const personPartnerships = mergedPartnerships
      .filter((partnership) => partnership.partner1_id === person.id || partnership.partner2_id === person.id)
      .map((partnership) => partnership.id);
    const remappedParent = person.parentPartnership
      ? partnershipIdMap.get(person.parentPartnership) ?? person.parentPartnership
      : undefined;
    const remappedBirthParent = person.birthParentPartnership
      ? partnershipIdMap.get(person.birthParentPartnership) ?? person.birthParentPartnership
      : undefined;
    const parentExists = remappedParent
      ? mergedPartnerships.some((partnership) => partnership.id === remappedParent)
      : false;
    const birthParentExists = remappedBirthParent
      ? mergedPartnerships.some((partnership) => partnership.id === remappedBirthParent)
      : false;
    // A new person whose parent partnership was not merged (e.g. it named a
    // skipped person) gets no parent link rather than a dangling id.
    const isNew = newPersonIds.has(person.id);
    return {
      ...person,
      parentPartnership: parentExists ? remappedParent : isNew ? undefined : person.parentPartnership,
      birthParentPartnership: birthParentExists
        ? remappedBirthParent
        : isNew
          ? undefined
          : person.birthParentPartnership,
      partnerships: [...new Set([...(person.partnerships || []), ...personPartnerships])],
    };
  });

  // Lay out only what this merge added. Running the normalizer over the whole
  // merged diagram re-spaced and resized the user's existing families.
  const layout = normalizeImportedChildLayout(
    peopleWithLinks.filter((person) => newPersonIds.has(person.id)),
    mergedPartnerships.filter((partnership) => addedPartnershipIds.has(partnership.id)),
    { expandParentSpan: true, autoResizeDenseFamilies: true }
  );
  const laidOutPeopleById = new Map(layout.people.map((person) => [person.id, person]));
  const laidOutPartnershipById = new Map(layout.partnerships.map((partnership) => [partnership.id, partnership]));
  const finalPartnerships = mergedPartnerships.map(
    (partnership) => laidOutPartnershipById.get(partnership.id) || partnership
  );
  // The layout above only covers new couples. A new child of a couple that
  // already existed would otherwise keep the import file's coordinates (from a
  // different drawing): put it in that couple's child row, after the existing
  // children, or centred under the couple if it is their first. Existing
  // people do not move.
  const placedNewChildren = new Map<string, Person>();
  const personById = new Map(peopleWithLinks.map((person) => [person.id, person]));
  for (const fam of finalPartnerships) {
    if (addedPartnershipIds.has(fam.id)) continue;
    const newKids = peopleWithLinks.filter(
      (person) => newPersonIds.has(person.id) && person.parentPartnership === fam.id
    );
    if (!newKids.length) continue;
    const existingKids = peopleWithLinks.filter(
      (person) => !newPersonIds.has(person.id) && person.parentPartnership === fam.id
    );
    let rowY: number;
    let startX: number;
    if (existingKids.length) {
      rowY = Math.max(...existingKids.map((kid) => kid.y));
      startX = Math.max(...existingKids.map((kid) => kid.x)) + NEW_CHILD_SPACING;
    } else {
      const partnerA = personById.get(fam.partner1_id);
      const partnerB = personById.get(fam.partner2_id);
      if (!partnerA || !partnerB) continue;
      rowY = fam.horizontalConnectorY + CHILD_ROW_BELOW_CONNECTOR;
      startX = (partnerA.x + partnerB.x) / 2 - ((newKids.length - 1) * NEW_CHILD_SPACING) / 2;
    }
    // Step right past anyone already standing in that row (another family's
    // child, a person placed earlier in this loop), so a new child is never
    // drawn on top of someone.
    const isOccupied = (x: number) =>
      [...peopleWithLinks.filter((person) => !newPersonIds.has(person.id)), ...placedNewChildren.values()].some(
        (other) =>
          Math.abs(other.x - x) < NEW_CHILD_SPACING / 2 &&
          Math.abs(other.y - rowY) < ROW_COLLISION_HEIGHT
      );
    let nextX = startX;
    newKids.forEach((kid) => {
      while (isOccupied(nextX)) nextX += NEW_CHILD_SPACING;
      placedNewChildren.set(kid.id, { ...kid, x: nextX, y: rowY });
      nextX += NEW_CHILD_SPACING;
    });
  }

  const alignedPeople = alignAllAnchors(
    peopleWithLinks.map(
      (person) => placedNewChildren.get(person.id) || laidOutPeopleById.get(person.id) || person
    ),
    finalPartnerships
  );
  const sanitizedPeople = sanitizePeopleIndicators(alignedPeople, mergedDefinitions);
  const importedPageNotes = Array.isArray(data.pageNotes) ? data.pageNotes : [];
  const mergedPageNotes = (() => {
    const usedNoteIds = new Set(pageNotes.map((note) => note.id));
    return [
      ...pageNotes,
      ...importedPageNotes.map((note) => ({
        ...note,
        id: nextUniqueId(note.id, usedNoteIds),
      })),
    ];
  })();

  return {
    people: sanitizedPeople,
    partnerships: finalPartnerships,
    emotionalLines: mergedLines,
    triangles: mergedTriangles,
    pageNotes: mergedPageNotes,
    functionalIndicatorDefinitions: mergedDefinitions,
    skippedPeopleNames,
    droppedPartnerships,
    droppedLines,
    droppedTriangles,
  };
};
