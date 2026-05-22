/**
 * Convert extracted diagram data to Person and Partnership objects.
 */

import type { Person, Partnership } from '../types';
import { sentenceCaseName } from './dataNormalization';

export type ReviewedDiagramData = {
  persons: Array<{
    id: string;
    name: string;
    gender: 'male' | 'female' | 'unknown';
    notes?: string;
    removed?: boolean;
  }>;
  relationships: Array<{
    id: string;
    person1Id: string;
    person2Id: string;
    type: 'married' | 'affair' | 'dating' | 'unknown';
    children: string[];
    removed?: boolean;
  }>;
};

export function convertExtractedToDiagram(reviewed: ReviewedDiagramData): {
  people: Person[];
  partnerships: Partnership[];
} {
  // Filter out removed items
  const activePersons = reviewed.persons.filter((p) => !p.removed);
  const activeRels = reviewed.relationships.filter((r) => !r.removed);

  // Create Person objects
  const people: Person[] = activePersons.map((person) => {
    const birthSex = person.gender === 'male' ? 'male' : person.gender === 'female' ? 'female' : 'male';
    const genderIdentity = person.gender === 'male' ? 'masculine' : person.gender === 'female' ? 'feminine' : 'nonbinary';

    return {
      id: person.id,
      x: 0, // Will be set by auto-layout
      y: 0,
      name: sentenceCaseName(person.name),
      firstName: sentenceCaseName(person.name),
      lastName: '',
      birthSex,
      birthDate: '',
      deathDate: '',
      adoptionDate: '',
      genderIdentity,
      genderDate: '',
      notes: person.notes || '',
      notesEnabled: !!person.notes,
      notesPosition: { x: 0, y: 0 },
      notesSize: { width: 200, height: 150 },
      partnerships: [], // Will be populated by partnerships below
      lifeStatus: 'alive',
      adoptionStatus: 'biological',
      size: 45,
      paperoScores: {},
    };
  });

  // Populate partnerships list on each person
  const partnershipMap = new Map<string, string>();

  // Create Partnership objects
  const partnerships: Partnership[] = activeRels
    .filter((rel) => {
      // Only create partnerships for valid person references
      return (
        activePersons.some((p) => p.id === rel.person1Id) &&
        activePersons.some((p) => p.id === rel.person2Id)
      );
    })
    .map((rel) => {
      // Map extracted relationship type to our partnership types
      let relationshipType: Partnership['relationshipType'] = 'dating';
      if (rel.type === 'married') relationshipType = 'married';
      else if (rel.type === 'affair') relationshipType = 'affair';
      else if (rel.type === 'dating') relationshipType = 'dating';

      const children = rel.children.filter((childId) =>
        activePersons.some((p) => p.id === childId)
      );

      // Track partnerships for each person
      partnershipMap.set(rel.person1Id, rel.id);
      partnershipMap.set(rel.person2Id, rel.id);

      return {
        id: rel.id,
        partner1_id: rel.person1Id,
        partner2_id: rel.person2Id,
        horizontalConnectorY: 0, // Will be set by layout
        relationshipType,
        relationshipStatus: 'married',
        relationshipStartDate: '',
        notes: '',
        notesEnabled: false,
        notesPosition: { x: 0, y: 0 },
        notesSize: { width: 200, height: 150 },
        familyNotes: '',
        familyNotesEnabled: false,
        familyNotesPosition: { x: 0, y: 0 },
        familyNotesSize: { width: 200, height: 150 },
        children,
      };
    });

  // Update each person's partnerships list
  people.forEach((person) => {
    person.partnerships = [];
    partnerships.forEach((p) => {
      if (p.partner1_id === person.id || p.partner2_id === person.id) {
        person.partnerships.push(p.id);
      }
    });
  });

  return { people, partnerships };
}
