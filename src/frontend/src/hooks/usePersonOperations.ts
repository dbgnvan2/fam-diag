import type { Dispatch, SetStateAction } from 'react';
import { nanoid } from 'nanoid';
import type { Person, Partnership, EmotionalLine, Triangle } from '../types';
import type { AddFamilyDraft } from '../types/diagramEditor';

interface UsePersonOperationsProps {
  people: Person[];
  partnerships: Partnership[];
  selectedPeopleIds: string[];
  propertiesPanelItem: Person | Partnership | EmotionalLine | null;
  setPeople: Dispatch<SetStateAction<Person[]>>;
  setPeopleAligned: (updater: (prev: Person[]) => Person[]) => void;
  alignAllAnchors: (list: Person[], partnershipSource?: Partnership[]) => Person[];
  setPartnerships: Dispatch<SetStateAction<Partnership[]>>;
  setEmotionalLines: Dispatch<SetStateAction<EmotionalLine[]>>;
  setTriangles: Dispatch<SetStateAction<Triangle[]>>;
  setSelectedPeopleIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPartnershipId: Dispatch<SetStateAction<string | null>>;
  setSelectedEmotionalLineId: Dispatch<SetStateAction<string | null>>;
  setSelectedChildId: Dispatch<SetStateAction<string | null>>;
  setPropertiesPanelItem: Dispatch<SetStateAction<Person | Partnership | EmotionalLine | null>>;
  setContextMenu: Dispatch<SetStateAction<{ x: number; y: number; items: any[] } | null>>;
}

export function usePersonOperations({
  people,
  partnerships,
  selectedPeopleIds,
  propertiesPanelItem,
  setPeople,
  setPeopleAligned,
  alignAllAnchors,
  setPartnerships,
  setEmotionalLines,
  setTriangles,
  setSelectedPeopleIds,
  setSelectedPartnershipId,
  setSelectedEmotionalLineId,
  setSelectedChildId,
  setPropertiesPanelItem,
  setContextMenu,
}: UsePersonOperationsProps) {
  const addPerson = (x: number, y: number, overrides: Partial<Person> = {}) => {
    const newPerson: Person = {
      id: overrides.id ?? nanoid(),
      name: overrides.name ?? 'New Person',
      x,
      y,
      gender: overrides.gender ?? 'female',
      partnerships: overrides.partnerships ?? [],
      parentPartnership: overrides.parentPartnership,
      birthParentPartnership: overrides.birthParentPartnership,
      lifeStatus: overrides.lifeStatus ?? 'alive',
      connectionAnchorX: overrides.connectionAnchorX,
      multipleBirthGroupId: overrides.multipleBirthGroupId,
      notes: overrides.notes,
      notesPosition: overrides.notesPosition,
      notesEnabled: overrides.notesEnabled,
      isCoach: overrides.isCoach ?? false,
      events: overrides.events ?? [],
    };
    setPeopleAligned(prev => [...prev, newPerson]);
    return newPerson;
  };

  const addCoach = (x: number, y: number) => {
    const coachCount = people.filter((person) => /^Coach(?:\s+\d+)?$/i.test(person.name || '')).length;
    const coachName = coachCount === 0 ? 'Coach' : `Coach ${coachCount + 1}`;
    return addPerson(x, y, { name: coachName, isCoach: true });
  };

  const addAIAgent = (x: number, y: number) => {
    const agentCount = people.filter((person) => /^AI Agent(?:\s+\d+)?$/i.test(person.name || '')).length;
    const agentName = agentCount === 0 ? 'AI Agent' : `AI Agent ${agentCount + 1}`;
    return addPerson(x, y, {
      name: agentName,
      gender: 'ai-agent',
      birthSex: 'ai-agent',
      genderIdentity: 'nonbinary',
      genderSymbol: 'ai_agent',
    });
  };

  const addParentsForPerson = (
    person: Person,
    options?: { forceBirthParents?: boolean; parentLabelPrefix?: string; parentSize?: number }
  ) => {
    if (person.birthParentPartnership && person.parentPartnership && options?.forceBirthParents) {
      alert('This person already has a birth-parent linkage.');
      return;
    }
    const verticalOffset = 170;
    const horizontalOffset = 90;
    const fatherX = person.x - horizontalOffset;
    const motherX = person.x + horizontalOffset;
    const parentY = person.y - verticalOffset;
    const partnershipId = nanoid();
    const fatherId = nanoid();
    const motherId = nanoid();
    const prefix = options?.parentLabelPrefix ? `${options.parentLabelPrefix} ` : '';
    const fatherName = `${prefix}Birth Father`.trim();
    const motherName = `${prefix}Birth Mother`.trim();
    const parentPartnership: Partnership = {
      id: partnershipId,
      partner1_id: fatherId,
      partner2_id: motherId,
      horizontalConnectorY: parentY + 70,
      relationshipType: 'dating',
      relationshipStatus: 'ongoing',
      children: [person.id],
      events: [],
    };
    const father: Person = {
      id: fatherId,
      name: fatherName,
      x: fatherX,
      y: parentY,
      gender: 'male',
      size: options?.parentSize,
      partnerships: [partnershipId],
      events: [],
    };
    const mother: Person = {
      id: motherId,
      name: motherName,
      x: motherX,
      y: parentY,
      gender: 'female',
      size: options?.parentSize,
      partnerships: [partnershipId],
      events: [],
    };
    setPartnerships((prev) => [...prev, parentPartnership]);
    setPeopleAligned((prev) =>
      prev
        .map((entry) => {
          if (entry.id !== person.id) return entry;
          const next = { ...entry };
          if (options?.forceBirthParents || !!entry.parentPartnership) {
            next.birthParentPartnership = partnershipId;
            next.adoptionStatus = 'adopted';
          } else {
            next.parentPartnership = partnershipId;
          }
          return next;
        })
        .concat([father, mother])
    );
    setSelectedPeopleIds([fatherId, motherId]);
    setSelectedPartnershipId(partnershipId);
    setSelectedEmotionalLineId(null);
    setSelectedChildId(null);
    setPropertiesPanelItem(parentPartnership);
  };

  const createChildrenForPartnership = (
    partnershipId: string,
    variant: 'male' | 'female' | 'twins' | 'triplets' | 'miscarriage' | 'stillbirth'
  ) => {
    const partnership = partnerships.find(p => p.id === partnershipId);
    if (!partnership) return;
    const partner1 = people.find(person => person.id === partnership.partner1_id);
    const partner2 = people.find(person => person.id === partnership.partner2_id);
    if (!partner1 || !partner2) return;

    const anchorX = (partner1.x + partner2.x) / 2;
    const baseY = partnership.horizontalConnectorY + 120;
    let count = 1;
    let baseName = 'Child';
    let lifeStatus: Person['lifeStatus'] | undefined = 'alive';

    switch (variant) {
      case 'male':
        baseName = 'Son';
        break;
      case 'female':
        baseName = 'Daughter';
        break;
      case 'twins':
        count = 2;
        baseName = 'Twin';
        break;
      case 'triplets':
        count = 3;
        baseName = 'Triplet';
        break;
      case 'miscarriage':
        baseName = 'Miscarriage';
        lifeStatus = 'miscarriage';
        break;
      case 'stillbirth':
        baseName = 'Stillbirth';
        lifeStatus = 'stillbirth';
        break;
    }

    const spacing = 50;
    const startX = anchorX - ((count - 1) * spacing) / 2;
    const multipleBirthGroupId = count > 1 ? nanoid() : undefined;

    const newChildren: Person[] = Array.from({ length: count }, (_, idx) => ({
      id: nanoid(),
      name: count > 1 ? `${baseName} ${idx + 1}` : baseName,
      x: startX + idx * spacing,
      y: baseY,
      gender:
        variant === 'male'
          ? 'male'
          : variant === 'female'
          ? 'female'
          : idx % 2 === 0
          ? 'female'
          : 'male',
      partnerships: [],
      parentPartnership: partnershipId,
      connectionAnchorX: multipleBirthGroupId ? anchorX : undefined,
      multipleBirthGroupId,
      lifeStatus,
      events: [],
    }));

    const childIds = newChildren.map(child => child.id);
    setPeopleAligned(prev => [...prev, ...newChildren]);
    setPartnerships(prev =>
      prev.map(p => (p.id === partnershipId ? { ...p, children: [...p.children, ...childIds] } : p))
    );
  };

  const createAdoptedChildForPartnership = (partnershipId: string) => {
    const partnership = partnerships.find((p) => p.id === partnershipId);
    if (!partnership) return;
    const partner1 = people.find((person) => person.id === partnership.partner1_id);
    const partner2 = people.find((person) => person.id === partnership.partner2_id);
    if (!partner1 || !partner2) return;
    const anchorX = (partner1.x + partner2.x) / 2;
    const baseY = partnership.horizontalConnectorY + 120;
    const child: Person = {
      id: nanoid(),
      name: 'Adopted Child',
      x: anchorX,
      y: baseY,
      gender: 'female',
      partnerships: [],
      parentPartnership: partnershipId,
      adoptionStatus: 'adopted',
      events: [],
    };
    setPeopleAligned((prev) => [...prev, child]);
    setPartnerships((prev) =>
      prev.map((p) =>
        p.id === partnershipId ? { ...p, children: [...p.children, child.id] } : p
      )
    );
    addParentsForPerson(child, { forceBirthParents: true, parentSize: 30 });
  };

  const removePartnership = (partnershipId: string) => {
    const partnershipToRemove = partnerships.find(p => p.id === partnershipId);
    if (!partnershipToRemove) return;

    setPartnerships(partnerships.filter(p => p.id !== partnershipId));

    setPeopleAligned(prev =>
      prev.map(p => {
        if (p.id === partnershipToRemove.partner1_id || p.id === partnershipToRemove.partner2_id) {
          return { ...p, partnerships: p.partnerships.filter(pid => pid !== partnershipId) };
        }
        if (partnershipToRemove.children.includes(p.id)) {
          const newP = { ...p };
          if (newP.parentPartnership === partnershipId) {
            delete newP.parentPartnership;
            delete newP.connectionAnchorX;
          }
          if (newP.birthParentPartnership === partnershipId) {
            delete newP.birthParentPartnership;
          }
          return newP;
        }
        return p;
      })
    );
    setContextMenu(null);
  };

  const removePerson = (personId: string) => {
    const personToRemove = people.find(p => p.id === personId);
    if (!personToRemove) return;

    const partnershipsToRemove = partnerships.filter(
      (p) => p.partner1_id === personId || p.partner2_id === personId
    ).map((p) => p.id);

    setPartnerships((prev) =>
      prev
        .filter((p) => p.partner1_id !== personId && p.partner2_id !== personId)
        .map((p) => ({ ...p, children: p.children.filter((id) => id !== personId) }))
    );

    const childrenNeedingCleanup = new Set(partnershipsToRemove);
    setPeople((prev) =>
      alignAllAnchors(
        prev
          .filter((p) => p.id !== personId)
          .map((p) => {
            if (p.parentPartnership && childrenNeedingCleanup.has(p.parentPartnership)) {
              const copy = { ...p };
              delete copy.parentPartnership;
              delete copy.connectionAnchorX;
              if (copy.birthParentPartnership && childrenNeedingCleanup.has(copy.birthParentPartnership)) {
                delete copy.birthParentPartnership;
              }
              return copy;
            }
            if (p.birthParentPartnership && childrenNeedingCleanup.has(p.birthParentPartnership)) {
              const copy = { ...p };
              delete copy.birthParentPartnership;
              return copy;
            }
            return p;
          })
      )
    );

    setEmotionalLines((prev) =>
      prev.filter((line) => line.person1_id !== personId && line.person2_id !== personId)
    );
    setTriangles((prev) =>
      prev.filter(
        (triangle) =>
          triangle.person1_id !== personId &&
          triangle.person2_id !== personId &&
          triangle.person3_id !== personId
      )
    );

    if (selectedPeopleIds.includes(personId)) {
      setSelectedPeopleIds(selectedPeopleIds.filter((id) => id !== personId));
    }
    if (propertiesPanelItem?.id === personId) {
      setPropertiesPanelItem(null);
    }
    setContextMenu(null);
  };

  const removeChildFromPartnership = (childId: string, partnershipId: string) => {
    setPartnerships(partnerships.map(p => {
        if (p.id === partnershipId) {
            return { ...p, children: p.children.filter(id => id !== childId) };
        }
        return p;
    }));

    setPeopleAligned(prev =>
      prev.map(p => {
        if (p.id === childId) {
          const newP = { ...p };
          if (newP.parentPartnership === partnershipId) {
            delete newP.parentPartnership;
            delete newP.connectionAnchorX;
          }
          if (newP.birthParentPartnership === partnershipId) {
            delete newP.birthParentPartnership;
          }
          return newP;
        }
        return p;
      })
    );
    setContextMenu(null);
  };

  const createFamilyFromDraft = (draft: AddFamilyDraft, position: { x: number; y: number }) => {
    const parentSpacing = 150;
    const parent1X = position.x;
    const parent2X = position.x + parentSpacing;
    const parentY = position.y;

    const parent1Id = nanoid();
    const parent2Id = nanoid();
    const partnershipId = nanoid();

    const parent1Name = draft.familySurname
      ? `${draft.parent1.firstName} ${draft.familySurname}`
      : draft.parent1.firstName;
    const parent2Name = draft.familySurname
      ? `${draft.parent2.firstName} ${draft.familySurname}`
      : draft.parent2.firstName;

    const parent1: Person = {
      id: parent1Id,
      name: parent1Name,
      x: parent1X,
      y: parentY,
      gender: draft.parent1.sex,
      birthSex: draft.parent1.sex,
      size: 45,
      partnerships: [partnershipId],
      lifeStatus: 'alive',
      events: [],
      ...(draft.parent1.birthDate && { birthDate: draft.parent1.birthDate }),
    };

    const parent2: Person = {
      id: parent2Id,
      name: parent2Name,
      x: parent2X,
      y: parentY,
      gender: draft.parent2.sex,
      birthSex: draft.parent2.sex,
      size: 45,
      partnerships: [partnershipId],
      lifeStatus: 'alive',
      events: [],
      ...(draft.parent2.birthDate && { birthDate: draft.parent2.birthDate }),
    };

    const childIds: string[] = [];
    const children: Person[] = [];

    const anchorX = (parent1X + parent2X) / 2;
    const childBaseY = parentY + 170;
    const childSpacing = 50;
    const startX = anchorX - ((draft.children.length - 1) * childSpacing) / 2;

    draft.children.forEach((childDraft, index) => {
      const childId = nanoid();
      childIds.push(childId);
      const childName = draft.familySurname
        ? `${childDraft.firstName} ${draft.familySurname}`
        : childDraft.firstName;

      const child: Person = {
        id: childId,
        name: childName,
        x: startX + index * childSpacing,
        y: childBaseY,
        gender: childDraft.sex,
        birthSex: childDraft.sex,
        size: 45,
        partnerships: [],
        parentPartnership: partnershipId,
        lifeStatus: 'alive',
        events: [],
        ...(childDraft.birthDate && { birthDate: childDraft.birthDate }),
      };
      children.push(child);
    });

    const partnership: Partnership = {
      id: partnershipId,
      partner1_id: parent1Id,
      partner2_id: parent2Id,
      relationshipType: 'married',
      relationshipStatus: 'ongoing',
      horizontalConnectorY: parentY,
      children: childIds,
      events: [],
    };

    setPeopleAligned(prev => [...prev, parent1, parent2, ...children]);
    setPartnerships(prev => [...prev, partnership]);
  };

  return {
    addPerson,
    addCoach,
    addAIAgent,
    addParentsForPerson,
    createChildrenForPartnership,
    createAdoptedChildForPartnership,
    removePartnership,
    removePerson,
    removeChildFromPartnership,
    createFamilyFromDraft,
  };
}
