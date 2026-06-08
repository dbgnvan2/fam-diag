/**
 * Tests for connectors.ts — pure inference functions over synthetic
 * symbol records and connector geometries.
 *
 * Spec: docs/implementation_plan_2026-06-07c.md#M8
 */

import { describe, it, expect, vi } from 'vitest';
import {
  inferPartnerships,
  inferredPartnershipsToPartnerships,
  type Connector,
} from './connectors';
import type { SymbolRecord } from './symbolRecord';

// detectConnectors needs cv — we don't test that here (the data parsing is
// covered by the M4 Hough tests). We test the inference logic, which is
// pure.

function MockMat() {}
vi.mock('@techstark/opencv-js', () => ({ default: { Mat: MockMat } }));

function sym(id: string, x: number, y: number, shape: 'square' | 'circle' = 'square'): SymbolRecord {
  return {
    id,
    bbox: { x: x - 20, y: y - 20, w: 40, h: 40 },
    shape,
    inferred_sex: shape === 'square' ? 'male' : 'female',
    is_dead: false,
    x_detected: true,
    letter: id,
    letter_confidence: 0.9,
    letter_source: 'tesseract',
    overall_confidence: 'high',
    notes: [],
  };
}

describe('inferPartnerships', () => {
  it('test_m8a2_pairs_partners_and_attaches_children', () => {
    const dad = sym('dad', 100, 100);
    const mum = sym('mum', 300, 100, 'circle');
    const c1 = sym('c1', 150, 250);
    const c2 = sym('c2', 250, 250);

    // One horizontal connector spanning dad → mum at y=100.
    // Two vertical connectors going down to c1 and c2 starting near y=100.
    const connectors: Connector[] = [
      { orientation: 'horizontal', x1: 100, y1: 100, x2: 300, y2: 100 },
      { orientation: 'vertical', x1: 150, y1: 100, x2: 150, y2: 230 },
      { orientation: 'vertical', x1: 250, y1: 100, x2: 250, y2: 230 },
    ];
    const out = inferPartnerships([dad, mum, c1, c2], connectors);
    expect(out).toHaveLength(1);
    expect(new Set([out[0].partner1.id, out[0].partner2.id])).toEqual(new Set(['dad', 'mum']));
    expect(new Set(out[0].childrenIds)).toEqual(new Set(['c1', 'c2']));
    expect(out[0].horizontalConnectorY).toBe(100);
  });

  it('drops a partnership when its endpoints map to the same symbol', () => {
    const a = sym('a', 100, 100);
    const connectors: Connector[] = [
      { orientation: 'horizontal', x1: 90, y1: 100, x2: 110, y2: 100 },
    ];
    expect(inferPartnerships([a], connectors)).toHaveLength(0);
  });
});

describe('inferredPartnershipsToPartnerships', () => {
  it('test_m8a3_partnership_shape', () => {
    const partnership = inferredPartnershipsToPartnerships([
      {
        id: 'partner-1',
        partner1: sym('dad', 100, 100),
        partner2: sym('mum', 300, 100, 'circle'),
        childrenIds: ['c1'],
        horizontalConnectorY: 100,
      },
    ]);
    expect(partnership).toHaveLength(1);
    expect(partnership[0]).toMatchObject({
      id: 'partner-1',
      partner1_id: 'dad',
      partner2_id: 'mum',
      relationshipType: 'married',
      relationshipStatus: 'married',
      children: ['c1'],
      horizontalConnectorY: 100,
    });
  });
});
