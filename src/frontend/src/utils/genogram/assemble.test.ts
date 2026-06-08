/**
 * Tests for assemble.ts — verifies the final DiagramImportData shape
 * matches what File → Open accepts.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M9
 */

import { describe, it, expect } from 'vitest';
import { assembleDiagramImport, resolveOverlaps, applyTopologyLayout } from './assemble';
import type { SymbolRecord } from './symbolRecord';
import type { InferredPartnership } from './connectors';
import type { Person, Partnership } from '../../types';

function sym(id: string, x: number, y: number, shape: 'square' | 'circle', letter?: string): SymbolRecord {
  return {
    id,
    bbox: { x: x - 20, y: y - 20, w: 40, h: 40 },
    shape,
    inferred_sex: shape === 'square' ? 'male' : 'female',
    is_dead: false,
    x_detected: true,
    letter: letter ?? null,
    letter_confidence: letter ? 0.9 : 0,
    letter_source: letter ? 'tesseract' : 'none',
    overall_confidence: 'high',
    notes: [],
  };
}

describe('assembleDiagramImport', () => {
  it('test_m9a1_diagram_import_shape_matches_jennies_boy_reference', () => {
    const dad = sym('dad', 100, 100, 'square', 'D');
    const mum = sym('mum', 300, 100, 'circle', 'M');
    const kid = sym('kid', 200, 250, 'circle', 'K');
    const partnership: InferredPartnership = {
      id: 'partner-1',
      partner1: dad,
      partner2: mum,
      childrenIds: ['kid'],
      horizontalConnectorY: 130,
    };
    const out = assembleDiagramImport([dad, mum, kid], [partnership]);

    // Top-level keys match the reference diagram.
    expect(out).toHaveProperty('people');
    expect(out).toHaveProperty('partnerships');
    expect(out).toHaveProperty('emotionalLines');
    expect(out).toHaveProperty('pageNotes');
    expect(out).toHaveProperty('triangles');

    expect(out.people).toHaveLength(3);
    expect(out.partnerships).toHaveLength(1);
    expect(out.emotionalLines).toEqual([]);
  });

  it('test_m9a2_partnership_horizontalConnectorY_set', () => {
    const dad = sym('dad', 100, 100, 'square');
    const mum = sym('mum', 300, 100, 'circle');
    const out = assembleDiagramImport(
      [dad, mum],
      [{
        id: 'partner-1',
        partner1: dad,
        partner2: mum,
        childrenIds: [],
        horizontalConnectorY: 130,
      }]
    );
    // After the topology layout pass, both partners are snapped to the
    // generation-0 row (Y = TOP_MARGIN = 150), so horizontalConnectorY = 150.
    expect(out.partnerships![0].horizontalConnectorY).toBe(150);
  });

  it('rewrites partnership and person ids with nanoid so re-imports do not collide', () => {
    const dad = sym('dad', 100, 100, 'square');
    const mum = sym('mum', 300, 100, 'circle');
    const out = assembleDiagramImport(
      [dad, mum],
      [{ id: 'partner-1', partner1: dad, partner2: mum, childrenIds: [], horizontalConnectorY: 100 }]
    );
    expect(out.people![0].id.startsWith('p-')).toBe(true);
    expect(out.partnerships![0].id.startsWith('pp-')).toBe(true);
    // Cross-references stay consistent.
    expect(out.partnerships![0].partner1_id).toBe(out.people!.find((p) => p.name === 'Male 1')?.id);
  });

  it('auto-names unlabeled symbols by gender bucket and reading order', () => {
    const a = sym('a', 100, 100, 'square');
    const b = sym('b', 200, 100, 'square');
    const c = sym('c', 300, 100, 'circle');
    const out = assembleDiagramImport([a, b, c], []);
    const names = out.people!.map((p) => p.name);
    expect(names).toContain('Male 1');
    expect(names).toContain('Male 2');
    expect(names).toContain('Female 1');
  });

  it('keeps the user-supplied letter as the person name', () => {
    const dad = sym('dad', 100, 100, 'square', 'D');
    const out = assembleDiagramImport([dad], []);
    expect(out.people![0].name).toBe('D');
  });

  it('no two output people are closer than MIN_PERSON_SPACING', () => {
    // Three overlapping squares: centres at (100,100), (110,100), (120,100).
    const a = sym('a', 100, 100, 'square');
    const b = sym('b', 110, 100, 'square');
    const c = sym('c', 120, 100, 'square');
    const out = assembleDiagramImport([a, b, c], []);
    const positions = out.people!.map((p) => ({ x: p.x, y: p.y }));
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const d = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
        expect(d).toBeGreaterThanOrEqual(79); // 80 minus float slack
      }
    }
  });
});

describe('applyTopologyLayout', () => {
  function person(id: string, parentPartnership?: string): Person {
    return { id, name: id, x: Math.random() * 1000, y: Math.random() * 1000, partnerships: [], parentPartnership };
  }
  function partnership(id: string, p1: string, p2: string, children: string[] = []): Partnership {
    return {
      id, partner1_id: p1, partner2_id: p2, horizontalConnectorY: 0,
      relationshipType: 'married', relationshipStatus: 'married', children,
    };
  }

  it('siblings share a Y, parents share a Y above', () => {
    const dad = person('dad');
    const mum = person('mum');
    const k1 = person('k1', 'r1');
    const k2 = person('k2', 'r1');
    const k3 = person('k3', 'r1');
    const r1 = partnership('r1', 'dad', 'mum', ['k1', 'k2', 'k3']);

    applyTopologyLayout([dad, mum, k1, k2, k3], [r1]);

    expect(dad.y).toBe(mum.y);
    expect(k1.y).toBe(k2.y);
    expect(k2.y).toBe(k3.y);
    expect(k1.y).toBeGreaterThan(dad.y); // kids below parents
  });

  it("children's X falls within parents' X span (centered)", () => {
    const dad = person('dad');
    const mum = person('mum');
    const k1 = person('k1', 'r1');
    const k2 = person('k2', 'r1');
    const r1 = partnership('r1', 'dad', 'mum', ['k1', 'k2']);

    applyTopologyLayout([dad, mum, k1, k2], [r1]);

    const minParentX = Math.min(dad.x, mum.x);
    const maxParentX = Math.max(dad.x, mum.x);
    const minChildX = Math.min(k1.x, k2.x);
    const maxChildX = Math.max(k1.x, k2.x);

    const childCentroid = (minChildX + maxChildX) / 2;
    const parentCentroid = (minParentX + maxParentX) / 2;
    expect(Math.abs(childCentroid - parentCentroid)).toBeLessThan(1);
  });

  it('three generations get three distinct Y values', () => {
    const gp1 = person('gp1');
    const gp2 = person('gp2');
    const p = person('p', 'r1'); // child of gp1+gp2
    const partner = person('partner');
    const child = person('child', 'r2'); // child of p+partner
    const r1 = partnership('r1', 'gp1', 'gp2', ['p']);
    const r2 = partnership('r2', 'p', 'partner', ['child']);

    applyTopologyLayout([gp1, gp2, p, partner, child], [r1, r2]);

    const ys = new Set([gp1.y, p.y, child.y]);
    expect(ys.size).toBe(3);
    expect(p.y).toBeGreaterThan(gp1.y);
    expect(child.y).toBeGreaterThan(p.y);
  });
});

describe('resolveOverlaps', () => {
  it('separates two coincident people', () => {
    const people: Person[] = [
      { id: 'a', name: 'A', x: 100, y: 100, partnerships: [] },
      { id: 'b', name: 'B', x: 100, y: 100, partnerships: [] },
    ];
    resolveOverlaps(people, 80);
    const d = Math.hypot(people[0].x - people[1].x, people[0].y - people[1].y);
    expect(d).toBeGreaterThanOrEqual(80);
  });

  it('preserves order when people are already well-spaced', () => {
    const people: Person[] = [
      { id: 'a', name: 'A', x: 0, y: 0, partnerships: [] },
      { id: 'b', name: 'B', x: 200, y: 0, partnerships: [] },
    ];
    resolveOverlaps(people, 80);
    expect(people[0].x).toBe(0);
    expect(people[1].x).toBe(200);
  });
});
