/**
 * Tests for extractedDataToDiagram.ts
 *
 * Spec: docs/implementation_plan_2026-06-06.md — M1.A.1, M1.A.3, M1.A.4, M1.A.5,
 *       M2.A.2, M2.A.3, M2.A.4, M2.A.5
 */

import { describe, it, expect } from 'vitest';
import { convertExtractedToDiagram, applyNotesPositions } from './extractedDataToDiagram';
import type { ReviewedDiagramData } from './extractedDataToDiagram';

function buildReviewed(overrides: Partial<ReviewedDiagramData> = {}): ReviewedDiagramData {
  return {
    persons: [],
    relationships: [],
    ...overrides,
  };
}

describe('convertExtractedToDiagram', () => {
  it('test_m1a1_children_have_parentPartnership', () => {
    const reviewed = buildReviewed({
      persons: [
        { id: 'mum', name: 'Mum', gender: 'female' },
        { id: 'dad', name: 'Dad', gender: 'male' },
        { id: 'kid1', name: 'Kid 1', gender: 'female' },
        { id: 'kid2', name: 'Kid 2', gender: 'male' },
      ],
      relationships: [
        { id: 'r1', person1Id: 'mum', person2Id: 'dad', type: 'married', children: ['kid1', 'kid2'] },
      ],
    });
    const { people } = convertExtractedToDiagram(reviewed);

    expect(people.find((p) => p.id === 'kid1')?.parentPartnership).toBe('r1');
    expect(people.find((p) => p.id === 'kid2')?.parentPartnership).toBe('r1');
    // Partners themselves are not children — should not have parentPartnership.
    expect(people.find((p) => p.id === 'mum')?.parentPartnership).toBeUndefined();
    expect(people.find((p) => p.id === 'dad')?.parentPartnership).toBeUndefined();
  });

  it('test_m1a3_notesPosition_offset', () => {
    const reviewed = buildReviewed({
      persons: [{ id: 'p1', name: 'Helen', gender: 'female', notes: 'died young' }],
    });
    const { people } = convertExtractedToDiagram(reviewed);
    // Notes position is finalised by applyNotesPositions after layout writes x/y.
    const positioned = applyNotesPositions(people.map((p) => ({ ...p, x: 200, y: 200 })));
    const helen = positioned.find((p) => p.id === 'p1');
    expect(helen?.notesPosition?.x).not.toBe(0);
    expect(helen?.notesPosition?.y).not.toBe(0);
    expect(helen?.notesPosition?.x).toBe(290);
    expect(helen?.notesPosition?.y).toBe(110);
  });

  it('test_m1a4_partnership_notes_piped', () => {
    const reviewed = buildReviewed({
      persons: [
        { id: 'a', name: 'Ned', gender: 'male' },
        { id: 'b', name: 'Lucy', gender: 'female' },
      ],
      relationships: [
        {
          id: 'r1',
          person1Id: 'a',
          person2Id: 'b',
          type: 'married',
          children: [],
          notes: 'Ned (farmer) and Lucy (talkative)',
        },
      ],
    });
    const { partnerships } = convertExtractedToDiagram(reviewed);
    expect(partnerships[0].notes).toBe('Ned (farmer) and Lucy (talkative)');
  });

  it('test_m1a5_status_matches_type', () => {
    const cases: Array<{ type: 'married' | 'dating' | 'affair' | 'unknown'; expectedStatus: string; expectedType: string }> = [
      { type: 'married', expectedStatus: 'married', expectedType: 'married' },
      { type: 'dating', expectedStatus: 'ongoing', expectedType: 'dating' },
      { type: 'affair', expectedStatus: 'ongoing', expectedType: 'affair' },
      // unknown → falls back to 'dating' type but status 'ongoing'
      { type: 'unknown', expectedStatus: 'ongoing', expectedType: 'dating' },
    ];
    cases.forEach(({ type, expectedStatus, expectedType }) => {
      const reviewed = buildReviewed({
        persons: [
          { id: 'a', name: 'A', gender: 'male' },
          { id: 'b', name: 'B', gender: 'female' },
        ],
        relationships: [{ id: 'r1', person1Id: 'a', person2Id: 'b', type, children: [] }],
      });
      const { partnerships } = convertExtractedToDiagram(reviewed);
      expect(partnerships[0].relationshipStatus).toBe(expectedStatus);
      expect(partnerships[0].relationshipType).toBe(expectedType);
    });
  });

  it('test_m2a2_deceased_in_notes', () => {
    const reviewed = buildReviewed({
      persons: [
        { id: 'p1', name: 'A', gender: 'male', symbols: ['X'] },
        { id: 'p2', name: 'B', gender: 'male', symbols: ['X'], notes: 'Farmer' },
        { id: 'p3', name: 'C', gender: 'female', notes: 'Talkative' }, // no X
      ],
    });
    const { people } = convertExtractedToDiagram(reviewed);
    expect(people.find((p) => p.id === 'p1')?.notes).toBe('(deceased)');
    expect(people.find((p) => p.id === 'p2')?.notes).toBe('Farmer (deceased)');
    expect(people.find((p) => p.id === 'p3')?.notes).toBe('Talkative');
  });

  it('test_m2a3_speculative_lineage', () => {
    const reviewed = buildReviewed({
      persons: [
        { id: 'a', name: 'A', gender: 'male' },
        { id: 'b', name: 'B', gender: 'female' },
        { id: 'c', name: 'C', gender: 'male' },
      ],
      relationships: [
        {
          id: 'r1',
          person1Id: 'a',
          person2Id: 'b',
          type: 'married',
          children: ['c'],
          speculative: true,
        },
      ],
    });
    const { people } = convertExtractedToDiagram(reviewed);
    expect(people.find((p) => p.id === 'c')?.notes).toBe('Speculative lineage');
  });

  it('test_m2a4_unnamed_placeholders', () => {
    const reviewed = buildReviewed({
      persons: [
        { id: 'p1', name: '', gender: 'female' },
        { id: 'p2', name: '?', gender: 'male' },
        { id: 'p3', name: '', gender: 'unknown' },
      ],
    });
    const { people } = convertExtractedToDiagram(reviewed);
    expect(people.find((p) => p.id === 'p1')?.name).toBe('Unknown Female');
    expect(people.find((p) => p.id === 'p2')?.name).toBe('Unknown Male');
    expect(people.find((p) => p.id === 'p3')?.name).toBe('Unknown Person');
  });

  it('test_m2a5_unknown_gender_not_male', () => {
    const reviewed = buildReviewed({
      persons: [{ id: 'p1', name: 'X', gender: 'unknown' }],
    });
    const { people } = convertExtractedToDiagram(reviewed);
    const person = people.find((p) => p.id === 'p1');
    expect(person?.birthSex).not.toBe('male');
    expect(person?.birthSex).toBe('intersex');
    expect(person?.genderIdentity).toBe('nonbinary');
  });
});
