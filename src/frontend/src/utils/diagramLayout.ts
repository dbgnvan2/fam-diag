/**
 * Auto-layout for extracted diagrams — arranges persons in hierarchical generations.
 */

import type { Person, Partnership } from '../types';

export type LayoutPositions = {
  [personId: string]: { x: number; y: number };
};

export function autoLayoutExtractedDiagram(
  people: Person[],
  partnerships: Partnership[]
): LayoutPositions {
  const result: LayoutPositions = {};

  if (people.length === 0) return result;

  // Build adjacency: who are the parents of each person
  const parentsByChild = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();

  partnerships.forEach((p) => {
    p.children.forEach((childId: string) => {
      if (!parentsByChild.has(childId)) {
        parentsByChild.set(childId, []);
      }
      parentsByChild.get(childId)!.push(p.partner1_id, p.partner2_id);

      if (!childrenByParent.has(p.partner1_id)) {
        childrenByParent.set(p.partner1_id, []);
      }
      childrenByParent.get(p.partner1_id)!.push(childId);

      if (!childrenByParent.has(p.partner2_id)) {
        childrenByParent.set(p.partner2_id, []);
      }
      childrenByParent.get(p.partner2_id)!.push(childId);
    });
  });

  // Assign generations: work from roots (people with no parents) down
  const generation = new Map<string, number>();
  const unvisited = new Set(people.map((p) => p.id));

  // Find roots (people with no parents)
  const roots = people.filter((p) => !parentsByChild.has(p.id));

  // BFS to assign generations
  const queue: string[] = roots.map((p) => p.id);
  roots.forEach((p) => {
    generation.set(p.id, 0);
    unvisited.delete(p.id);
  });

  while (queue.length > 0) {
    const personId = queue.shift()!;
    const currentGen = generation.get(personId) || 0;
    const children = childrenByParent.get(personId) || [];

    children.forEach((childId) => {
      if (!generation.has(childId)) {
        generation.set(childId, currentGen + 1);
        queue.push(childId);
        unvisited.delete(childId);
      }
    });
  }

  // Assign any remaining unvisited to generation 0 (isolated nodes)
  unvisited.forEach((personId) => {
    generation.set(personId, 0);
  });

  // Group by generation
  const generationGroups = new Map<number, string[]>();
  generation.forEach((gen, personId) => {
    if (!generationGroups.has(gen)) {
      generationGroups.set(gen, []);
    }
    generationGroups.get(gen)!.push(personId);
  });

  // Layout parameters
  const GENERATION_SPACING = 150;
  const HORIZONTAL_SPACING = 100;

  // Position each person
  generationGroups.forEach((personIds, gen) => {
    const y = gen * GENERATION_SPACING + 100;
    const totalWidth = personIds.length * HORIZONTAL_SPACING;
    const startX = Math.max(50, -totalWidth / 2 + 200);

    personIds.forEach((personId, index) => {
      const x = startX + index * HORIZONTAL_SPACING;
      result[personId] = { x, y };
    });
  });

  return result;
}
