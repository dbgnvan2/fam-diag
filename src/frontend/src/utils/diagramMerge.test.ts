import { describe, it, expect } from 'vitest';
import type { EmotionalLine, Partnership, Person, Triangle } from '../types';
import type { DiagramImportData } from '../types/diagramEditor';
import { mergeDiagramData, type DiagramMergeCurrent } from './diagramMerge';

const person = (id: string, name: string, x: number, y: number, extra: Partial<Person> = {}): Person => ({
  id,
  name,
  x,
  y,
  partnerships: [],
  ...extra,
});

const partnership = (
  id: string,
  partner1_id: string,
  partner2_id: string,
  children: string[] = [],
  extra: Partial<Partnership> = {}
): Partnership => ({
  id,
  partner1_id,
  partner2_id,
  horizontalConnectorY: 200,
  relationshipType: 'married',
  relationshipStatus: 'married',
  children,
  ...extra,
});

/** An existing diagram the user has laid out by hand: one couple, three children. */
const existingDiagram = (): DiagramMergeCurrent => {
  const kids = ['k1', 'k2', 'k3'];
  return {
    people: [
      person('dad', 'Adam Stone', 100, 100, { partnerships: ['fam'] }),
      person('mom', 'Beth Stone', 400, 100, { partnerships: ['fam'] }),
      person('k1', 'Cara Stone', 120, 320, { parentPartnership: 'fam' }),
      person('k2', 'Dan Stone', 250, 330, { parentPartnership: 'fam' }),
      person('k3', 'Eve Stone', 390, 310, { parentPartnership: 'fam' }),
    ],
    partnerships: [partnership('fam', 'dad', 'mom', kids, { horizontalConnectorY: 180 })],
    emotionalLines: [],
    triangles: [],
    pageNotes: [],
    functionalIndicatorDefinitions: [],
  };
};

const line = (id: string, a: string, b: string): EmotionalLine =>
  ({
    id,
    person1_id: a,
    person2_id: b,
    relationshipType: 'conflict',
    lineStyle: 'conflict-dotted-wide',
    lineEnding: 'none',
    startDate: '2020-01-01',
  }) as EmotionalLine;

describe('mergeDiagramData — facts mode (allowNewPeople: false)', () => {
  const incoming = (): DiagramImportData => ({
    people: [
      person('in-dad', 'Adam Stone', 0, 0),
      person('in-stranger', 'Zed Unknown', 0, 0),
      person('in-kid', 'Newkid Stone', 0, 0, { parentPartnership: 'in-fam2' }),
    ],
    partnerships: [
      // Partner matches nobody in the diagram: must not be stored.
      partnership('in-fam2', 'in-dad', 'in-stranger', ['in-kid']),
    ],
    emotionalLines: [line('in-line', 'in-dad', 'in-stranger')],
    triangles: [
      { id: 'in-tri', person1_id: 'in-dad', person2_id: 'in-stranger', person3_id: 'mom' } as Triangle,
    ],
  });

  it('does not add partnerships, lines or triangles that reference a skipped person', () => {
    const result = mergeDiagramData(existingDiagram(), incoming(), { allowNewPeople: false });
    const ids = new Set(result.people.map((p) => p.id));

    for (const p of result.partnerships) {
      expect(ids.has(p.partner1_id)).toBe(true);
      expect(ids.has(p.partner2_id)).toBe(true);
      p.children.forEach((child) => expect(ids.has(child)).toBe(true));
    }
    for (const l of result.emotionalLines) {
      expect(ids.has(l.person1_id) && ids.has(l.person2_id)).toBe(true);
    }
    for (const t of result.triangles) {
      expect([t.person1_id, t.person2_id, t.person3_id].every((id) => ids.has(id))).toBe(true);
    }
    expect(result.partnerships).toHaveLength(1);
    expect(result.emotionalLines).toHaveLength(0);
    expect(result.triangles).toHaveLength(0);
  });

  it('reports what it skipped and dropped', () => {
    const result = mergeDiagramData(existingDiagram(), incoming(), { allowNewPeople: false });
    expect(result.skippedPeopleNames).toEqual(['Zed Unknown', 'Newkid Stone']);
    expect(result.droppedPartnerships).toBe(1);
    expect(result.droppedLines).toBe(1);
    expect(result.droppedTriangles).toBe(1);
  });

  it('still merges data onto a matched person', () => {
    const data = incoming();
    data.people![0] = person('in-dad', 'Adam Stone', 0, 0, { birthDate: '1950-03-04' });
    const result = mergeDiagramData(existingDiagram(), data, { allowNewPeople: false });
    expect(result.people.find((p) => p.id === 'dad')?.birthDate).toBe('1950-03-04');
  });
});

describe('mergeDiagramData — normal merge', () => {
  it('leaves the existing, hand-laid-out people exactly where they were', () => {
    // Regression: the layout normalizer ran over the whole merged diagram and
    // re-spaced the existing children evenly between their parents.
    const current = existingDiagram();
    const before = current.people.map((p) => ({ id: p.id, x: p.x, y: p.y, size: p.size }));
    const data: DiagramImportData = {
      people: [
        person('n1', 'Gus Field', 900, 100, { partnerships: ['nf'] }),
        person('n2', 'Hana Field', 1100, 100, { partnerships: ['nf'] }),
        person('n3', 'Ivo Field', 1000, 300, { parentPartnership: 'nf' }),
      ],
      partnerships: [partnership('nf', 'n1', 'n2', ['n3'])],
      emotionalLines: [],
    };
    const result = mergeDiagramData(current, data);
    const after = result.people
      .filter((p) => before.some((b) => b.id === p.id))
      .map((p) => ({ id: p.id, x: p.x, y: p.y, size: p.size }));
    expect(after).toEqual(before);
    expect(result.partnerships.find((p) => p.id === 'fam')?.horizontalConnectorY).toBe(180);
    // The new family is present and linked.
    expect(result.people.find((p) => p.id === 'n3')?.parentPartnership).toBe('nf');
  });

  it('does not modify the current state objects', () => {
    const current = existingDiagram();
    const snapshot = structuredClone(current);
    const data: DiagramImportData = {
      people: [person('n1', 'Gus Field', 900, 100), person('n2', 'Hana Field', 1100, 100)],
      partnerships: [partnership('nf', 'n1', 'n2', [], { notes: 'met at school' })],
      emotionalLines: [line('nl', 'n1', 'dad')],
    };
    mergeDiagramData(current, data);
    expect(current).toEqual(snapshot);
  });

  it('keeps references to existing diagram people that the import uses by id', () => {
    const data: DiagramImportData = {
      people: [person('n1', 'Gus Field', 900, 100)],
      partnerships: [],
      emotionalLines: [line('nl', 'n1', 'dad')],
    };
    const result = mergeDiagramData(existingDiagram(), data);
    expect(result.emotionalLines).toHaveLength(1);
    expect(result.emotionalLines[0].person2_id).toBe('dad');
    expect(result.droppedLines).toBe(0);
  });

  it('matches an incoming person to an existing one by name and remaps references', () => {
    const data: DiagramImportData = {
      people: [person('x-beth', 'Beth Stone', 0, 0), person('n1', 'Gus Field', 900, 100)],
      partnerships: [],
      emotionalLines: [line('nl', 'n1', 'x-beth')],
    };
    const result = mergeDiagramData(existingDiagram(), data);
    expect(result.people.filter((p) => p.name === 'Beth Stone')).toHaveLength(1);
    expect(result.emotionalLines[0].person2_id).toBe('mom');
  });
});

describe('mergeDiagramData — new child of an existing couple', () => {
  const importNewChild = (): DiagramImportData => ({
    // The couple matches Adam and Beth Stone by name, so this partnership
    // merges into the existing 'fam'; the child is new. The import file's
    // coordinates are from a different drawing.
    people: [
      person('x-dad', 'Adam Stone', 5000, 5000, { partnerships: ['x-fam'] }),
      person('x-mom', 'Beth Stone', 5200, 5000, { partnerships: ['x-fam'] }),
      person('x-kid', 'Fay Stone', 5100, 5300, { parentPartnership: 'x-fam' }),
    ],
    partnerships: [partnership('x-fam', 'x-dad', 'x-mom', ['x-kid'])],
    emotionalLines: [],
  });

  it('places the child in the couple\'s child row, after the existing children (regression: kept import coordinates)', () => {
    const current = existingDiagram();
    const result = mergeDiagramData(current, importNewChild());
    const fay = result.people.find((p) => p.name === 'Fay Stone')!;
    expect(fay.parentPartnership).toBe('fam');
    const existingKids = current.people.filter((p) => p.parentPartnership === 'fam');
    expect(fay.y).toBe(Math.max(...existingKids.map((k) => k.y)));
    expect(fay.x).toBeGreaterThan(Math.max(...existingKids.map((k) => k.x)));
    expect(fay.x).toBeLessThan(1000);
  });

  it('centres a first child under a couple that had none, below their line', () => {
    const current = existingDiagram();
    current.people = current.people.filter((p) => !p.parentPartnership);
    current.partnerships = [{ ...current.partnerships[0], children: [] }];
    const result = mergeDiagramData(current, importNewChild());
    const fay = result.people.find((p) => p.name === 'Fay Stone')!;
    expect(fay.x).toBe(250); // midway between Adam (100) and Beth (400)
    expect(fay.y).toBeGreaterThan(180); // below the couple's connector line
  });

  it('still leaves the existing people where they were', () => {
    const current = existingDiagram();
    const before = current.people.map((p) => ({ id: p.id, x: p.x, y: p.y }));
    const result = mergeDiagramData(current, importNewChild());
    expect(
      result.people.filter((p) => before.some((b) => b.id === p.id)).map((p) => ({ id: p.id, x: p.x, y: p.y }))
    ).toEqual(before);
  });
});

describe('mergeDiagramData — collapsed triangles are counted', () => {
  it('counts a triangle whose people merge into fewer than three (regression: dropped silently)', () => {
    // Two incoming people both match Adam Stone, so the triangle has only two
    // distinct people after remapping and cannot be kept.
    const data: DiagramImportData = {
      people: [person('x1', 'Adam Stone', 0, 0), person('x2', 'adam stone', 0, 0), person('x3', 'Beth Stone', 0, 0)],
      partnerships: [],
      emotionalLines: [],
      triangles: [{ id: 'tri', person1_id: 'x1', person2_id: 'x2', person3_id: 'x3' } as Triangle],
    };
    const result = mergeDiagramData(existingDiagram(), data);
    expect(result.triangles).toHaveLength(0);
    expect(result.droppedTriangles).toBe(1);
  });
});
