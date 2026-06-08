/**
 * Convert extracted diagram data to Person and Partnership objects.
 *
 * Spec: docs/implementation_plan_2026-06-06.md (M1.A.1, M1.A.3, M1.A.5, M2.A.2, M2.A.3, M2.A.4, M2.A.5)
 */

import type { Person, Partnership, BirthSex, GenderIdentity } from '../types';
import { sentenceCaseName } from './dataNormalization';

type Gender = 'male' | 'female' | 'unknown';
type RelType = 'married' | 'affair' | 'dating' | 'unknown';

const NOTES_POSITION_OFFSET = 90;

export type ReviewedDiagramData = {
  persons: Array<{
    id: string;
    name: string;
    gender: Gender;
    notes?: string;
    symbols?: string[];
    removed?: boolean;
  }>;
  relationships: Array<{
    id: string;
    person1Id: string;
    person2Id: string;
    type: RelType;
    children: string[];
    notes?: string;
    speculative?: boolean;
    removed?: boolean;
  }>;
};

function placeholderName(name: string, gender: Gender): string {
  const trimmed = (name || '').trim();
  if (trimmed === '' || trimmed === '?') {
    if (gender === 'female') return 'Unknown Female';
    if (gender === 'male') return 'Unknown Male';
    return 'Unknown Person';
  }
  return sentenceCaseName(trimmed);
}

function birthSexFor(gender: Gender): BirthSex {
  if (gender === 'female') return 'female';
  if (gender === 'male') return 'male';
  return 'intersex';
}

function genderIdentityFor(gender: Gender): GenderIdentity {
  if (gender === 'female') return 'feminine';
  if (gender === 'male') return 'masculine';
  return 'nonbinary';
}

function relationshipStatusFor(type: RelType): string {
  if (type === 'married') return 'married';
  return 'ongoing';
}

function appendNote(existing: string | undefined, addition: string): string {
  const base = (existing || '').trim();
  if (!base) return addition;
  return `${base} ${addition}`;
}

function synthesizePersonNotes(
  rawNotes: string | undefined,
  symbols: string[] | undefined,
  speculativeFromPartnership: boolean
): string {
  let notes = (rawNotes || '').trim();
  if (symbols && symbols.includes('X')) {
    notes = appendNote(notes, '(deceased)');
  }
  if (speculativeFromPartnership) {
    notes = appendNote(notes, 'Speculative lineage');
  }
  return notes;
}

export function convertExtractedToDiagram(reviewed: ReviewedDiagramData): {
  people: Person[];
  partnerships: Partnership[];
} {
  const activePersons = reviewed.persons.filter((p) => !p.removed);
  const activeRels = reviewed.relationships.filter((r) => !r.removed);
  const activePersonIds = new Set(activePersons.map((p) => p.id));

  // Identify which children inherit "speculative" from their partnership so we
  // can synthesise notes correctly during person construction.
  const speculativeChildIds = new Set<string>();
  activeRels.forEach((rel) => {
    if (rel.speculative) {
      rel.children.forEach((cid) => speculativeChildIds.add(cid));
    }
  });

  // Pre-compute partnership membership so we can populate Person.partnerships
  // without traversing the partnership list twice.
  const partnershipsByPersonId = new Map<string, string[]>();
  activeRels.forEach((rel) => {
    if (!activePersonIds.has(rel.person1Id) || !activePersonIds.has(rel.person2Id)) {
      return;
    }
    [rel.person1Id, rel.person2Id].forEach((pid) => {
      const list = partnershipsByPersonId.get(pid) || [];
      list.push(rel.id);
      partnershipsByPersonId.set(pid, list);
    });
  });

  // parentPartnership mapping: each child gets the id of the partnership
  // that lists them. If a child appears in multiple partnerships we take
  // the first encountered (real diagrams shouldn't produce duplicates).
  const parentPartnershipByChildId = new Map<string, string>();
  activeRels.forEach((rel) => {
    rel.children.forEach((cid) => {
      if (!parentPartnershipByChildId.has(cid) && activePersonIds.has(cid)) {
        parentPartnershipByChildId.set(cid, rel.id);
      }
    });
  });

  const people: Person[] = activePersons.map((person) => {
    const synthesised = synthesizePersonNotes(
      person.notes,
      person.symbols,
      speculativeChildIds.has(person.id)
    );
    const hasNotes = synthesised.length > 0;
    return {
      id: person.id,
      x: 0,
      y: 0,
      name: placeholderName(person.name, person.gender),
      birthSex: birthSexFor(person.gender),
      genderIdentity: genderIdentityFor(person.gender),
      notes: synthesised,
      notesEnabled: hasNotes,
      // notesPosition is finalised after auto-layout writes x/y back; we seed
      // a zero placeholder here and applyNotesPositions() updates it.
      notesPosition: { x: 0, y: 0 },
      partnerships: partnershipsByPersonId.get(person.id) || [],
      parentPartnership: parentPartnershipByChildId.get(person.id),
    };
  });

  const partnerships: Partnership[] = activeRels
    .filter((rel) => activePersonIds.has(rel.person1Id) && activePersonIds.has(rel.person2Id))
    .map((rel) => {
      const relationshipType = rel.type === 'unknown' ? 'dating' : rel.type;
      const children = rel.children.filter((cid) => activePersonIds.has(cid));
      return {
        id: rel.id,
        partner1_id: rel.person1Id,
        partner2_id: rel.person2Id,
        horizontalConnectorY: 0, // set by auto-layout
        relationshipType,
        relationshipStatus: relationshipStatusFor(rel.type),
        notes: rel.notes || '',
        children,
      };
    });

  return { people, partnerships };
}

/**
 * Finalise notesPosition on every Person that has notes, based on the
 * post-layout (x, y). Call after autoLayoutExtractedDiagram applies positions.
 */
export function applyNotesPositions(people: Person[]): Person[] {
  return people.map((person) => {
    if (!person.notes || person.notes.trim() === '') {
      return person;
    }
    return {
      ...person,
      notesPosition: {
        x: (person.x ?? 0) + NOTES_POSITION_OFFSET,
        y: (person.y ?? 0) - NOTES_POSITION_OFFSET,
      },
    };
  });
}
