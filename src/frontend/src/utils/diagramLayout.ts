/**
 * Auto-layout for extracted diagrams — arranges persons in hierarchical generations.
 *
 * Spec: docs/implementation_plan_2026-06-06.md (M1.A.2, M3.A.1, M3.A.2)
 */

import type { Person, Partnership } from '../types';

export type LayoutPositions = {
  [personId: string]: { x: number; y: number };
};

const GENERATION_SPACING = 200;
const HORIZONTAL_SPACING = 180;
const PARTNER_OFFSET = 220; // each partner is positioned this far from the children's centroid x
const CONNECTOR_Y_OFFSET = 30;

export function autoLayoutExtractedDiagram(
  people: Person[],
  partnerships: Partnership[]
): LayoutPositions {
  const result: LayoutPositions = {};
  if (people.length === 0) return result;

  // Build adjacency: parent → children and child → parents.
  const parentsByChild = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();
  partnerships.forEach((p) => {
    p.children.forEach((childId) => {
      const existing = parentsByChild.get(childId) || [];
      existing.push(p.partner1_id, p.partner2_id);
      parentsByChild.set(childId, existing);

      const c1 = childrenByParent.get(p.partner1_id) || [];
      c1.push(childId);
      childrenByParent.set(p.partner1_id, c1);

      const c2 = childrenByParent.get(p.partner2_id) || [];
      c2.push(childId);
      childrenByParent.set(p.partner2_id, c2);
    });
  });

  // Generation assignment: BFS from roots (people with no parents).
  const generation = new Map<string, number>();
  const queue: string[] = [];
  people.forEach((p) => {
    if (!parentsByChild.has(p.id)) {
      generation.set(p.id, 0);
      queue.push(p.id);
    }
  });

  while (queue.length > 0) {
    const personId = queue.shift()!;
    const currentGen = generation.get(personId) ?? 0;
    (childrenByParent.get(personId) || []).forEach((childId) => {
      if (!generation.has(childId)) {
        generation.set(childId, currentGen + 1);
        queue.push(childId);
      }
    });
  }
  // Isolated nodes fall to generation 0.
  people.forEach((p) => {
    if (!generation.has(p.id)) generation.set(p.id, 0);
  });

  // Group by generation and assign initial x along the generation row.
  const generationGroups = new Map<number, string[]>();
  generation.forEach((gen, personId) => {
    const list = generationGroups.get(gen) || [];
    list.push(personId);
    generationGroups.set(gen, list);
  });

  generationGroups.forEach((personIds, gen) => {
    const y = gen * GENERATION_SPACING + 100;
    personIds.forEach((personId, index) => {
      result[personId] = { x: 100 + index * HORIZONTAL_SPACING, y };
    });
  });

  // Parent-centering pass: when a partnership has children, position the two
  // partners flanking the centroid x of their children's positions. This
  // overrides the initial uniform-row x assigned above.
  partnerships.forEach((p) => {
    if (p.children.length === 0) return;
    const childXs = p.children
      .map((cid) => result[cid]?.x)
      .filter((x): x is number => typeof x === 'number');
    if (childXs.length === 0) return;
    const centroid = (Math.min(...childXs) + Math.max(...childXs)) / 2;
    const partner1Pos = result[p.partner1_id];
    const partner2Pos = result[p.partner2_id];
    if (partner1Pos) {
      result[p.partner1_id] = { x: centroid - PARTNER_OFFSET, y: partner1Pos.y };
    }
    if (partner2Pos) {
      result[p.partner2_id] = { x: centroid + PARTNER_OFFSET, y: partner2Pos.y };
    }
  });

  return result;
}

/**
 * Compute horizontalConnectorY for each partnership based on the two partners'
 * post-layout y values. Returns a new partnership list — does not mutate.
 *
 * Spec: M1.A.2
 */
export function applyHorizontalConnectorY(
  people: Person[],
  partnerships: Partnership[]
): Partnership[] {
  const yById = new Map<string, number>();
  people.forEach((p) => {
    if (typeof p.y === 'number') yById.set(p.id, p.y);
  });
  return partnerships.map((partnership) => {
    const y1 = yById.get(partnership.partner1_id);
    const y2 = yById.get(partnership.partner2_id);
    if (typeof y1 !== 'number' || typeof y2 !== 'number') return partnership;
    return {
      ...partnership,
      horizontalConnectorY: (y1 + y2) / 2 + CONNECTOR_Y_OFFSET,
    };
  });
}
