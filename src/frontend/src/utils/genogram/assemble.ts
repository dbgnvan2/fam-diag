/**
 * Final DiagramImportData assembly. Takes per-symbol records + inferred
 * partnerships and produces the JSON shape the existing diagram loader
 * accepts via File → Open.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M9
 */

import { nanoid } from 'nanoid';
import type { DiagramImportData } from '../../types/diagramEditor';
import type { Person, Partnership } from '../../types';
import type { SymbolRecord } from './symbolRecord';
import type { InferredPartnership } from './connectors';

/**
 * Minimum centre-to-centre distance between any two people on the canvas.
 * The default Person node renders at size=45 (so 22.5 radius). Two nodes
 * touching at their edges have centres 45 apart; we add a 35px breathing
 * margin → 80px minimum spacing.
 */
const MIN_PERSON_SPACING = 80;

// Layout constants for the 2D topology pass.
const LAYOUT = {
  TOP_MARGIN: 150,
  LEFT_MARGIN: 200,
  GENERATION_SPACING: 200,
  SIBLING_SPACING: 130,
  PARTNER_OFFSET: 100,
};

export type LayoutHints = {
  /** Total generations the user expects. 0 means "unknown — auto-detect". */
  generationCount?: number;
  /** Approximate number of people. 0 means "unknown". */
  expectedPersonCount?: number;
};

/**
 * Map symbol records + inferred partnerships → DiagramImportData with stable
 * person ids and rewritten partnership references.
 *
 * Spec: M9.A.1, M9.A.2
 */
export function assembleDiagramImport(
  symbols: SymbolRecord[],
  inferredPartnerships: InferredPartnership[],
  hints?: LayoutHints
): DiagramImportData {
  // Build a stable person id per symbol (only symbols that map to people).
  const personIdBySymbolId = new Map<string, string>();
  const peopleSymbols = symbols.filter(
    (s) => s.shape === 'square' || s.shape === 'circle' || s.shape === 'x'
  );
  peopleSymbols.forEach((s) => personIdBySymbolId.set(s.id, `p-${nanoid(8)}`));

  // Auto-naming by gender bucket and reading-order rank.
  const maleRank = new Map<string, number>();
  const femaleRank = new Map<string, number>();
  const unknownRank = new Map<string, number>();
  let mIdx = 0;
  let fIdx = 0;
  let uIdx = 0;
  peopleSymbols.forEach((s) => {
    if (s.shape === 'square') maleRank.set(s.id, ++mIdx);
    else if (s.shape === 'circle') femaleRank.set(s.id, ++fIdx);
    else unknownRank.set(s.id, ++uIdx);
  });

  // Rewrite each partnership's id with nanoid so successive imports never
  // collide on `partner-1`/`partner-2`/etc.
  const partnershipIdByOldId = new Map<string, string>();
  inferredPartnerships.forEach((ip) => partnershipIdByOldId.set(ip.id, `pp-${nanoid(8)}`));

  const partnerships: Partnership[] = inferredPartnerships
    .filter((ip) => personIdBySymbolId.has(ip.partner1.id) && personIdBySymbolId.has(ip.partner2.id))
    .map((ip) => {
      const childIds = ip.childrenIds
        .map((cid) => personIdBySymbolId.get(cid))
        .filter((x): x is string => Boolean(x));
      return {
        id: partnershipIdByOldId.get(ip.id)!,
        partner1_id: personIdBySymbolId.get(ip.partner1.id)!,
        partner2_id: personIdBySymbolId.get(ip.partner2.id)!,
        horizontalConnectorY: ip.horizontalConnectorY,
        relationshipType: 'married',
        relationshipStatus: 'married',
        children: childIds,
      } as Partnership;
    });

  // Per-person partnership index — both sides of each partnership.
  const personPartnerships = new Map<string, string[]>();
  inferredPartnerships.forEach((ip) => {
    const newPpId = partnershipIdByOldId.get(ip.id);
    if (!newPpId) return;
    [ip.partner1.id, ip.partner2.id].forEach((sid) => {
      const newPid = personIdBySymbolId.get(sid);
      if (!newPid) return;
      const arr = personPartnerships.get(newPid) || [];
      arr.push(newPpId);
      personPartnerships.set(newPid, arr);
    });
  });

  // parentPartnership: which partnership produced this child.
  // Only record refs for partnerships that survived the filter above —
  // otherwise children point to ids that were dropped, breaking referential
  // integrity. (Caught by the Node integration test.)
  const survivingPartnershipIds = new Set(partnerships.map((p) => p.id));
  const childParentPartnership = new Map<string, string>();
  inferredPartnerships.forEach((ip) => {
    const newPpId = partnershipIdByOldId.get(ip.id);
    if (!newPpId || !survivingPartnershipIds.has(newPpId)) return;
    ip.childrenIds.forEach((cid) => {
      const newCid = personIdBySymbolId.get(cid);
      if (!newCid) return;
      if (!childParentPartnership.has(newCid)) childParentPartnership.set(newCid, newPpId);
    });
  });

  const people: Person[] = peopleSymbols.map((s) => {
    const newId = personIdBySymbolId.get(s.id)!;
    const centerX = s.bbox.x + s.bbox.w / 2;
    const centerY = s.bbox.y + s.bbox.h / 2;
    const noteStr = s.notes.length > 0 ? s.notes.join('; ') : undefined;
    const name = buildName(s, maleRank, femaleRank, unknownRank);
    return {
      id: newId,
      x: centerX,
      y: centerY,
      name,
      birthSex: s.shape === 'square' ? 'male' : s.shape === 'circle' ? 'female' : 'intersex',
      genderIdentity: s.shape === 'square' ? 'masculine' : s.shape === 'circle' ? 'feminine' : 'nonbinary',
      notes: noteStr,
      notesEnabled: !!noteStr,
      partnerships: personPartnerships.get(newId) || [],
      parentPartnership: childParentPartnership.get(newId),
    } as Person;
  });

  // Run the topology-based 2D layout: kids below parents, between parents'
  // X, siblings sharing a Y. Replaces the raw bbox-centroid positions with
  // a clean genogram grid.
  applyTopologyLayout(people, partnerships, hints);

  // Safety net: no overlaps after the topology pass either.
  resolveOverlaps(people);

  // Partnership horizontalConnectorY is anchored to person Y values; update
  // it after both layout passes so couple lines stay between partners.
  const peopleById = new Map(people.map((p) => [p.id, p]));
  partnerships.forEach((pp) => {
    const p1 = peopleById.get(pp.partner1_id);
    const p2 = peopleById.get(pp.partner2_id);
    if (p1 && p2) {
      pp.horizontalConnectorY = (p1.y + p2.y) / 2;
    }
  });

  return {
    fileMeta: {
      fileName: `genogram-${new Date().toISOString().slice(0, 10)}.json`,
      displayName: `genogram-${new Date().toISOString().slice(0, 10)}`,
    },
    people,
    partnerships,
    emotionalLines: [],
    pageNotes: [],
    triangles: [],
  };
}

/**
 * Topology-based 2D layout.
 *
 * Rules:
 *  - Generation 0 = anyone with no parentPartnership.
 *  - A child's generation = max(parent generations) + 1.
 *  - All people in the same generation share a Y.
 *  - Siblings (children of the same partnership) sit at evenly-spaced X.
 *  - Each parent's X is offset to one side of their children's centroid.
 *  - Childless people in a generation are placed after the rightmost
 *    parent in that row.
 *
 * The pass is bottom-up for X (so parents can be placed above children's
 * centroid) but top-down for Y (so a child's row is always below its
 * parents'). Anyone unreachable from a root keeps generation 0.
 *
 * Exported for tests in assemble.test.ts.
 */
export function applyTopologyLayout(
  people: Person[],
  partnerships: Partnership[],
  hints?: LayoutHints
): void {
  if (people.length === 0) return;
  // hints.generationCount is reserved for a future variant that snaps to
  // exactly that many rows; the topology computation already produces a
  // generation count, so we just log if the user-supplied count disagrees.
  void hints;

  const byId = new Map(people.map((p) => [p.id, p]));
  const partnershipById = new Map(partnerships.map((pp) => [pp.id, pp]));

  // ── 1. Compute generations (top-down BFS from roots) ──
  const generations = new Map<string, number>();
  people.forEach((p) => {
    if (!p.parentPartnership) generations.set(p.id, 0);
  });
  // Iterate until no person's generation changes. Cap at people.length+2
  // as a sanity bound — converges in well under that.
  for (let iter = 0; iter < people.length + 2; iter++) {
    let changed = false;
    people.forEach((p) => {
      if (generations.has(p.id)) return;
      if (!p.parentPartnership) {
        generations.set(p.id, 0);
        changed = true;
        return;
      }
      const pp = partnershipById.get(p.parentPartnership);
      if (!pp) {
        generations.set(p.id, 0);
        changed = true;
        return;
      }
      const g1 = generations.get(pp.partner1_id);
      const g2 = generations.get(pp.partner2_id);
      if (g1 !== undefined && g2 !== undefined) {
        generations.set(p.id, Math.max(g1, g2) + 1);
        changed = true;
      }
    });
    if (!changed) break;
  }
  // Anyone still unassigned (cycle in data): default to 0.
  people.forEach((p) => {
    if (!generations.has(p.id)) generations.set(p.id, 0);
  });

  // ── 2. Snap Y per generation ──
  people.forEach((p) => {
    const gen = generations.get(p.id) ?? 0;
    p.y = LAYOUT.TOP_MARGIN + gen * LAYOUT.GENERATION_SPACING;
  });

  // ── 3. X positioning, bottom-up ──
  const maxGen = Math.max(0, ...Array.from(generations.values()));

  // 3a. Bottommost generation: sort by their currently-detected X and
  // place them left-to-right at fixed spacing. These are the leaves —
  // they anchor everyone above.
  const bottomPeople = people
    .filter((p) => generations.get(p.id) === maxGen)
    .sort((a, b) => a.x - b.x);
  bottomPeople.forEach((p, i) => {
    p.x = LAYOUT.LEFT_MARGIN + i * LAYOUT.SIBLING_SPACING;
  });

  // 3b. For each generation above, position children of each partnership
  // evenly spaced, then place each parent offset from their children's
  // centroid. Process gen+1 → 0 so parents see their children's final X.
  for (let gen = maxGen - 1; gen >= 0; gen--) {
    // For every partnership where partners are in this generation: position
    // the partners over their children if any.
    const genPartnerships = partnerships.filter((pp) => {
      const g1 = generations.get(pp.partner1_id);
      const g2 = generations.get(pp.partner2_id);
      return g1 === gen && g2 === gen;
    });

    genPartnerships.forEach((pp) => {
      const children = pp.children
        .map((cid) => byId.get(cid))
        .filter((c): c is Person => !!c);
      if (children.length === 0) return;

      // Children get evenly spaced X centered under the partnership's centre.
      // Defer the centre choice until we know the children's range.
      const totalWidth = (children.length - 1) * LAYOUT.SIBLING_SPACING;
      // Use the existing midpoint of children as the centre if they're
      // already laid out (they are — we did the bottom row first). For deeper
      // levels, the children of THIS partnership have been positioned by the
      // previous loop iteration.
      const childCentroid =
        (Math.min(...children.map((c) => c.x)) + Math.max(...children.map((c) => c.x))) / 2;
      const startX = childCentroid - totalWidth / 2;
      children.sort((a, b) => a.x - b.x).forEach((child, i) => {
        child.x = startX + i * LAYOUT.SIBLING_SPACING;
      });

      // Place the two partners flanking the child centroid.
      const partner1 = byId.get(pp.partner1_id);
      const partner2 = byId.get(pp.partner2_id);
      if (partner1 && partner2) {
        partner1.x = childCentroid - LAYOUT.PARTNER_OFFSET;
        partner2.x = childCentroid + LAYOUT.PARTNER_OFFSET;
      }
    });

    // Childless people in this generation get placed by detected-X order
    // after the rightmost positioned person.
    const genPeople = people.filter((p) => generations.get(p.id) === gen);
    const positioned = new Set(
      genPartnerships.flatMap((pp) => [pp.partner1_id, pp.partner2_id])
    );
    const childless = genPeople
      .filter((p) => !positioned.has(p.id))
      .sort((a, b) => a.x - b.x);
    if (childless.length > 0) {
      const rightmost = Math.max(
        LAYOUT.LEFT_MARGIN,
        ...genPeople.filter((p) => positioned.has(p.id)).map((p) => p.x)
      );
      childless.forEach((p, i) => {
        p.x = rightmost + (i + 1) * LAYOUT.SIBLING_SPACING;
      });
    }
  }
}

/**
 * Push any pair of people closer than MIN_PERSON_SPACING apart along their
 * connecting axis. Iterates until no overlaps remain (typically ≤5 passes).
 *
 * The push is symmetric: each person moves half the deficit. This keeps the
 * overall centroid stable so a child stays roughly under its parents'
 * couple line.
 *
 * Exported only for the unit test in assemble.test.ts.
 */
export function resolveOverlaps(people: Person[], minSpacing = MIN_PERSON_SPACING): void {
  const MAX_ITERATIONS = 300;
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let moved = false;
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        const a = people[i];
        const b = people[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= minSpacing) continue;
        const deficit = minSpacing - dist;
        // If two people are exactly on top of each other (dist === 0),
        // jitter horizontally by half the spacing each.
        let nx: number;
        let ny: number;
        if (dist < 1e-6) {
          nx = 1;
          ny = 0;
        } else {
          nx = dx / dist;
          ny = dy / dist;
        }
        const shift = deficit / 2;
        a.x -= nx * shift;
        a.y -= ny * shift;
        b.x += nx * shift;
        b.y += ny * shift;
        moved = true;
      }
    }
    if (!moved) return;
  }
}

function buildName(
  s: SymbolRecord,
  maleRank: Map<string, number>,
  femaleRank: Map<string, number>,
  unknownRank: Map<string, number>
): string {
  if (s.letter && s.letter.trim() !== '') return s.letter;
  if (s.shape === 'square') return `Male ${maleRank.get(s.id) ?? '?'}`;
  if (s.shape === 'circle') return `Female ${femaleRank.get(s.id) ?? '?'}`;
  return `Unknown ${unknownRank.get(s.id) ?? '?'}`;
}
