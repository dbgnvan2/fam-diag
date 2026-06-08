/**
 * Tests for diagramLayout.ts
 *
 * Spec: docs/implementation_plan_2026-06-06.md — M1.A.2, M3.A.1, M3.A.2
 */

import { describe, it, expect } from 'vitest';
import { autoLayoutExtractedDiagram, applyHorizontalConnectorY } from './diagramLayout';
import type { Person, Partnership } from '../types';

function person(id: string, overrides: Partial<Person> = {}): Person {
  return {
    id,
    name: id,
    x: 0,
    y: 0,
    partnerships: [],
    ...overrides,
  };
}

function partnership(id: string, p1: string, p2: string, children: string[] = []): Partnership {
  return {
    id,
    partner1_id: p1,
    partner2_id: p2,
    horizontalConnectorY: 0,
    relationshipType: 'married',
    relationshipStatus: 'married',
    children,
  };
}

describe('autoLayoutExtractedDiagram', () => {
  it('test_m3a1_no_node_overlap', () => {
    const people = ['dad', 'mum', 'c1', 'c2', 'c3', 'c4', 'c5'].map((id) => person(id));
    const partnerships = [partnership('r1', 'dad', 'mum', ['c1', 'c2', 'c3', 'c4', 'c5'])];

    const positions = autoLayoutExtractedDiagram(people, partnerships);
    const childXs = ['c1', 'c2', 'c3', 'c4', 'c5'].map((id) => positions[id].x).sort((a, b) => a - b);

    for (let i = 1; i < childXs.length; i++) {
      // Each pair of adjacent children must be separated by ≥ 100px.
      expect(childXs[i] - childXs[i - 1]).toBeGreaterThanOrEqual(100);
    }
  });

  it('test_m3a2_parents_centered_over_children', () => {
    const people = ['dad', 'mum', 'c1', 'c2', 'c3'].map((id) => person(id));
    const partnerships = [partnership('r1', 'dad', 'mum', ['c1', 'c2', 'c3'])];

    const positions = autoLayoutExtractedDiagram(people, partnerships);
    const minChildX = Math.min(positions.c1.x, positions.c2.x, positions.c3.x);
    const maxChildX = Math.max(positions.c1.x, positions.c2.x, positions.c3.x);

    expect(positions.dad.x).toBeLessThan(minChildX);
    expect(positions.mum.x).toBeGreaterThan(maxChildX);
  });
});

describe('applyHorizontalConnectorY', () => {
  it('test_m1a2_horizontalConnectorY_set', () => {
    const people = [
      person('dad', { x: 100, y: 100 }),
      person('mum', { x: 300, y: 100 }),
    ];
    const partnerships = [partnership('r1', 'dad', 'mum')];

    const updated = applyHorizontalConnectorY(people, partnerships);
    // (100 + 100) / 2 + 30 = 130
    expect(updated[0].horizontalConnectorY).toBe(130);
    expect(updated[0].horizontalConnectorY).toBeGreaterThan(0);
  });

  it('returns new objects (does not mutate)', () => {
    const partnerships = [partnership('r1', 'dad', 'mum')];
    const updated = applyHorizontalConnectorY(
      [person('dad', { x: 0, y: 50 }), person('mum', { x: 0, y: 100 })],
      partnerships
    );
    expect(updated[0]).not.toBe(partnerships[0]);
    expect(partnerships[0].horizontalConnectorY).toBe(0);
  });
});
