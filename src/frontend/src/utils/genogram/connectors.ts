/**
 * Connector detection + partnership / parent-child inference.
 *
 * After symbols are detected, we want to know who is partnered with whom
 * and who their children are. We rely on the connector lines that were
 * erased in M2 — but instead of throwing them away there, we re-detect
 * them on the original binary and match them to the symbol centroids.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M8
 */

import { loadCv } from '../cvLoader';
import type { CvMat } from './preprocess';
import type { SymbolRecord } from './symbolRecord';
import type { Partnership, Person } from '../../types';
import { nanoid } from 'nanoid';

export type ConnectorOrientation = 'horizontal' | 'vertical';

export type Connector = {
  orientation: ConnectorOrientation;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type InferredPartnership = {
  id: string;
  partner1: SymbolRecord;
  partner2: SymbolRecord;
  childrenIds: string[];
  horizontalConnectorY: number;
};

/**
 * Find connector line segments by running HoughLinesP on the binary
 * input and bucketing by orientation.
 *
 * Spec: M8.A.1
 */
export async function detectConnectors(binary: CvMat): Promise<Connector[]> {
  const cv = (await loadCv()) as unknown as ConnectorsCv;
  const lines = new cv.Mat();
  const minLen = 30;
  cv.HoughLinesP(binary, lines, 1, Math.PI / 180, 40, minLen, 6);

  const result: Connector[] = [];
  const data = lines.data32S as Int32Array | undefined;
  if (data) {
    for (let i = 0; i < data.length; i += 4) {
      const x1 = data[i];
      const y1 = data[i + 1];
      const x2 = data[i + 2];
      const y2 = data[i + 3];
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      // Horizontal: y stays roughly constant. Vertical: x stays roughly constant.
      if (dx > 5 * dy && dx >= minLen) {
        result.push({ orientation: 'horizontal', x1, y1, x2, y2 });
      } else if (dy > 5 * dx && dy >= minLen) {
        result.push({ orientation: 'vertical', x1, y1, x2, y2 });
      }
    }
  }
  lines.delete();
  return result;
}

/**
 * Match horizontal connectors to symbol pairs (couple lines) and vertical
 * connectors to parent → child drops.
 *
 * Spec: M8.A.2
 */
export function inferPartnerships(
  symbols: SymbolRecord[],
  connectors: Connector[]
): InferredPartnership[] {
  const horiz = connectors.filter((c) => c.orientation === 'horizontal');
  const vert = connectors.filter((c) => c.orientation === 'vertical');

  const partnerships: InferredPartnership[] = [];
  // Track (partner1, partner2) pairs we've already used so we don't emit
  // duplicate partnerships when Hough returns multiple line segments along
  // the same couple line (very common with hand-drawn double-strokes).
  const seenPairs = new Set<string>();
  horiz.forEach((line) => {
    const lineY = (line.y1 + line.y2) / 2;
    const minX = Math.min(line.x1, line.x2);
    const maxX = Math.max(line.x1, line.x2);

    // Closest symbol to each endpoint.
    const left = closestSymbolToPoint(symbols, { x: minX, y: lineY }, lineY);
    const right = closestSymbolToPoint(symbols, { x: maxX, y: lineY }, lineY);
    if (!left || !right || left.id === right.id) return;

    // Dedupe by unordered partner pair.
    const pairKey = [left.id, right.id].sort().join('|');
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);

    // Require the line to actually reach close to both symbols' centroids
    // (within 50px on the y axis). Otherwise it's probably a free-standing
    // line, not a couple connector.
    const leftCy = left.bbox.y + left.bbox.h / 2;
    const rightCy = right.bbox.y + right.bbox.h / 2;
    if (Math.abs(leftCy - lineY) > 50 || Math.abs(rightCy - lineY) > 50) return;

    // Children: vertical lines whose top touches this horizontal line, then
    // find the symbol whose centroid is closest to the bottom of each drop.
    const childIds: string[] = [];
    vert.forEach((vline) => {
      const vTopY = Math.min(vline.y1, vline.y2);
      const vBotY = Math.max(vline.y1, vline.y2);
      const vX = (vline.x1 + vline.x2) / 2;
      const topClose = Math.abs(vTopY - lineY) < 10;
      const overUnion = vX >= minX - 10 && vX <= maxX + 10;
      if (!topClose || !overUnion) return;

      const child = closestSymbolToPoint(symbols, { x: vX, y: vBotY + 5 }, vBotY + 5);
      if (child && child.id !== left.id && child.id !== right.id) {
        if (!childIds.includes(child.id)) childIds.push(child.id);
      }
    });

    partnerships.push({
      id: `partner-${partnerships.length + 1}`,
      partner1: left,
      partner2: right,
      childrenIds: childIds,
      horizontalConnectorY: lineY,
    });
  });

  return partnerships;
}

/**
 * Convert `InferredPartnership[]` to the final `Partnership[]` shape used
 * by the diagram file format. Defaults to married/married since affair and
 * dating-line detection is out of scope for Phase 1.
 *
 * Spec: M8.A.3
 */
export function inferredPartnershipsToPartnerships(
  inferred: InferredPartnership[]
): Partnership[] {
  return inferred.map((ip) => ({
    id: ip.id,
    partner1_id: ip.partner1.id,
    partner2_id: ip.partner2.id,
    horizontalConnectorY: ip.horizontalConnectorY,
    relationshipType: 'married',
    relationshipStatus: 'married',
    children: ip.childrenIds,
  }));
}

/**
 * Convert symbol records to Person objects. Children get their
 * parentPartnership wired here too.
 */
export function symbolsToPeople(
  symbols: SymbolRecord[],
  inferredPartnerships: InferredPartnership[]
): Person[] {
  const personPartnerships = new Map<string, string[]>();
  const childToPartnership = new Map<string, string>();
  inferredPartnerships.forEach((ip) => {
    addToBucket(personPartnerships, ip.partner1.id, ip.id);
    addToBucket(personPartnerships, ip.partner2.id, ip.id);
    ip.childrenIds.forEach((cid) => {
      if (!childToPartnership.has(cid)) childToPartnership.set(cid, ip.id);
    });
  });

  // Re-id each symbol with nanoid so the diagram persists with stable, unique
  // ids regardless of how many times the user re-imports.
  const idMap = new Map<string, string>();
  symbols.forEach((s) => idMap.set(s.id, `p-${nanoid(8)}`));

  return symbols
    // Triangles, miscarriage stars, and "x" (unknown) won't appear as people.
    // Only square, circle map to person entries; "x" is a person with unknown sex.
    .filter((s) => s.shape === 'square' || s.shape === 'circle' || s.shape === 'x')
    .map((s) => {
      const newId = idMap.get(s.id)!;
      const centerX = s.bbox.x + s.bbox.w / 2;
      const centerY = s.bbox.y + s.bbox.h / 2;
      const name = buildName(s, symbols);

      const partnershipIds = personPartnerships.get(s.id) || [];
      const parentPart = childToPartnership.get(s.id);

      const notes = s.notes.length > 0 ? s.notes.join('; ') : undefined;
      return {
        id: newId,
        x: centerX,
        y: centerY,
        name,
        birthSex: s.inferred_sex === 'female' ? 'female' : s.inferred_sex === 'male' ? 'male' : 'intersex',
        genderIdentity: s.inferred_sex === 'female' ? 'feminine' : s.inferred_sex === 'male' ? 'masculine' : 'nonbinary',
        notes,
        notesEnabled: !!notes,
        partnerships: partnershipIds.map((origId) => `${origId}`), // ids preserved
        parentPartnership: parentPart,
      } as Person;
    })
    // Note: id rewriting from symbol-id → person-id is handled by
    // assembleDiagramImport (M9). symbolsToPeople intentionally keeps
    // symbol-id-based partnership references in place.
    .map((person) => person);
}

function addToBucket(map: Map<string, string[]>, key: string, value: string): void {
  const arr = map.get(key) || [];
  arr.push(value);
  map.set(key, arr);
}

function closestSymbolToPoint(
  symbols: SymbolRecord[],
  point: { x: number; y: number },
  preferredY: number
): SymbolRecord | undefined {
  let best: SymbolRecord | undefined;
  let bestDist = Infinity;
  symbols.forEach((s) => {
    const cx = s.bbox.x + s.bbox.w / 2;
    const cy = s.bbox.y + s.bbox.h / 2;
    const d = Math.hypot(cx - point.x, cy - point.y) + Math.abs(cy - preferredY) * 0.2;
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  });
  return best;
}

function buildName(s: SymbolRecord, all: SymbolRecord[]): string {
  if (s.letter && s.letter.trim() !== '') return s.letter;
  // Auto-name unlabeled symbols by their gender bucket and reading-order rank.
  const bucket = s.inferred_sex === 'male'
    ? all.filter((x) => x.inferred_sex === 'male')
    : s.inferred_sex === 'female'
      ? all.filter((x) => x.inferred_sex === 'female')
      : all.filter((x) => x.inferred_sex === 'unknown');
  const rank = bucket.findIndex((x) => x.id === s.id) + 1;
  if (s.inferred_sex === 'male') return `Male ${rank}`;
  if (s.inferred_sex === 'female') return `Female ${rank}`;
  return `Unknown ${rank}`;
}

interface ConnectorsCv {
  Mat: { new (): CvMat & { data32S?: Int32Array } };
  HoughLinesP(
    src: CvMat,
    lines: CvMat,
    rho: number,
    theta: number,
    threshold: number,
    minLineLength: number,
    maxLineGap: number
  ): void;
}
