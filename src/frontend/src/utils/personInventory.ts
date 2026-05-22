/**
 * Person Inventory generation — creates a structured list of persons for review.
 */

import type { ExtractedDiagramData, ExtractedPerson } from '../types/imageAnalysis';

export type PersonInventoryItem = {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'unknown';
  symbol?: string;
  notes?: string;
  extractedConfidence: number;
  relationshipCount: number;
  childrenCount: number;
};

export function generatePersonInventory(extracted: ExtractedDiagramData): PersonInventoryItem[] {
  const relationshipCountMap = new Map<string, number>();
  const childrenCountMap = new Map<string, number>();

  // Count relationships for each person
  extracted.relationships.forEach((rel) => {
    relationshipCountMap.set(rel.person1Id, (relationshipCountMap.get(rel.person1Id) || 0) + 1);
    relationshipCountMap.set(rel.person2Id, (relationshipCountMap.get(rel.person2Id) || 0) + 1);
    rel.children.forEach((childId) => {
      childrenCountMap.set(childId, (childrenCountMap.get(childId) || 0) + 1);
    });
  });

  // Build inventory
  return extracted.persons.map((person: ExtractedPerson): PersonInventoryItem => {
    const symbolStr = person.symbols?.join(', ') || '';
    const relCount = relationshipCountMap.get(person.id) || 0;
    const childCount = childrenCountMap.get(person.id) || 0;

    return {
      id: person.id,
      name: person.extractedName,
      gender: person.gender,
      symbol: symbolStr,
      notes: person.notes,
      extractedConfidence: person.confidence,
      relationshipCount: relCount,
      childrenCount: childCount,
    };
  });
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.85) return '#2e7d32'; // green
  if (confidence >= 0.7) return '#f57c00'; // orange
  return '#d32f2f'; // red
}

export function getConfidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}% confident`;
}
