/**
 * Tests for factsToDiagramImportData — the converter that turns VLM-extracted
 * FactsImportData into a loadable DiagramImportData. Focuses on the image-import
 * path (facts.people present): sex/date/coordinate mapping and layout rules
 * R13/R16/R17. Previously untested.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { factsToDiagramImportData } from './dataImport';
import type { FactsImportData } from '../types/diagramEditor';
import type { Person } from '../types';

const find = (people: Person[], name: string) => {
  const p = people.find((person) => person.name === name);
  if (!p) throw new Error(`person "${name}" not found in [${people.map((x) => x.name).join(', ')}]`);
  return p;
};

describe('factsToDiagramImportData — VLM image-import path', () => {
  describe('per-person metadata mapping', () => {
    it('maps sex → gender', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Wayne Adams', sex: 'male' },
          { name: 'Jennie Boyd', sex: 'female' },
        ],
      };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Wayne Adams').gender).toBe('male');
      expect(find(people, 'Jennie Boyd').gender).toBe('female');
    });

    it('maps birthYear → birthDate (Jan 1 of that year)', () => {
      const facts: FactsImportData = { people: [{ name: 'Wayne Adams', sex: 'male', birthYear: 1968 }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Wayne Adams').birthDate).toBe('1968-01-01');
    });

    it('maps deceased + deathYear → deathDate', () => {
      const facts: FactsImportData = {
        people: [{ name: 'Charlie Cole', sex: 'male', deceased: true, deathYear: 2014 }],
      };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Charlie Cole').deathDate).toBe('2014-01-01');
    });

    it('marks deceased-with-unknown-year using a placeholder death date', () => {
      const facts: FactsImportData = {
        people: [{ name: 'Charlie Cole', sex: 'male', deceased: true, deathYear: null }],
      };
      const { people } = factsToDiagramImportData(facts);
      // Placeholder so the person renders as deceased; user can correct the year.
      expect(find(people, 'Charlie Cole').deathDate).toBe('1900-01-01');
    });

    it('does not set a death date for a living person', () => {
      const facts: FactsImportData = { people: [{ name: 'Wayne Adams', sex: 'male' }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Wayne Adams').deathDate).toBeUndefined();
    });

    it('converts an image X percentage to a canvas X pixel', () => {
      // CANVAS width 1200, padding 100 → x%=50 → 100 + 0.5*(1200-200) = 600.
      // NOTE: Y is intentionally NOT asserted here — for image imports the layout
      // rules (R7–R10) re-snap Y by generation after this conversion, so only the
      // horizontal position from the image survives (R12 preserve X sequence).
      const facts: FactsImportData = { people: [{ name: 'Wayne Adams', sex: 'male', x: 50, y: 50 }] };
      const { people } = factsToDiagramImportData(facts);
      const wayne = find(people, 'Wayne Adams');
      expect(wayne.x).toBe(600);
      expect(Number.isFinite(wayne.y)).toBe(true);
    });
  });

  describe('relationships → partnerships', () => {
    it('creates a partnership and links explicit children via parentPartnership', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Wayne Adams', sex: 'male' },
          { name: 'Jennie Boyd', sex: 'female' },
          { name: 'Kid One', sex: 'male' },
        ],
        relationships: [{ a: 'Wayne Adams', b: 'Jennie Boyd', type: 'married', children: ['Kid One'] }],
      };
      const { people, partnerships } = factsToDiagramImportData(facts);
      expect(partnerships).toHaveLength(1);
      const kid = find(people, 'Kid One');
      expect(kid.parentPartnership).toBe(partnerships[0].id);
      expect(partnerships[0].children).toContain(kid.id);
    });
  });

  describe('R16 — unknown-sex symbols render smaller, but never below the 30px floor', () => {
    it('sets size to 30 for an unknown-sex person (rule 3 floor)', () => {
      const facts: FactsImportData = { people: [{ name: 'Mystery X', sex: 'unknown' }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Mystery X').size).toBe(30);
    });

    it('never sizes any imported person below 30 points', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Mystery X', sex: 'unknown' },
          { name: 'Baby X', sex: 'unknown', deceased: true, notes: 'stillbirth' },
        ],
      };
      const { people } = factsToDiagramImportData(facts);
      for (const p of people) {
        if (p.size !== undefined) expect(p.size).toBeGreaterThanOrEqual(30);
      }
    });

    it('does not shrink a known-sex person', () => {
      const facts: FactsImportData = { people: [{ name: 'Wayne Adams', sex: 'male' }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Wayne Adams').size).toBeUndefined();
    });
  });

  describe('R17 — stillbirth detection', () => {
    it('flags lifeStatus=stillbirth when notes contain "stillbirth"', () => {
      const facts: FactsImportData = {
        people: [{ name: 'Baby X', sex: 'unknown', deceased: true, notes: 'small X — stillbirth' }],
      };
      const { people } = factsToDiagramImportData(facts);
      const baby = find(people, 'Baby X');
      expect(baby.lifeStatus).toBe('stillbirth');
      expect(baby.size).toBe(30);
    });

    it('infers stillbirth from unknown-sex + deceased + no birth year + child of a partnership', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Wayne Adams', sex: 'male' },
          { name: 'Jennie Boyd', sex: 'female' },
          { name: 'Baby X', sex: 'unknown', deceased: true, birthYear: null },
        ],
        relationships: [{ a: 'Wayne Adams', b: 'Jennie Boyd', children: ['Baby X'] }],
      };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Baby X').lifeStatus).toBe('stillbirth');
    });

    it('does not flag a living unknown-sex person as stillbirth', () => {
      const facts: FactsImportData = { people: [{ name: 'Mystery X', sex: 'unknown' }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Mystery X').lifeStatus).toBeUndefined();
    });
  });

  describe('rule 2 — no positional inference of parent-child links', () => {
    it('leaves a person unattached when no line links them to a couple, even directly below', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Wayne Adams', sex: 'male', x: 30, y: 20 },
          { name: 'Jennie Boyd', sex: 'female', x: 50, y: 20 },
          { name: 'Orphan Below', sex: 'male', x: 40, y: 70 }, // sits under the couple, but NO children link
        ],
        relationships: [{ a: 'Wayne Adams', b: 'Jennie Boyd', children: [] }],
      };
      const { people, partnerships } = factsToDiagramImportData(facts);
      const orphan = find(people, 'Orphan Below');
      expect(orphan.parentPartnership).toBeUndefined();
      expect(partnerships.every((p) => !p.children.includes(orphan.id))).toBe(true);
    });

    it('still attaches a child that IS explicitly linked (rule 1)', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Wayne Adams', sex: 'male' },
          { name: 'Jennie Boyd', sex: 'female' },
          { name: 'Linked Kid', sex: 'female' },
        ],
        relationships: [{ a: 'Wayne Adams', b: 'Jennie Boyd', children: ['Linked Kid'] }],
      };
      const { people, partnerships } = factsToDiagramImportData(facts);
      const kid = find(people, 'Linked Kid');
      expect(kid.parentPartnership).toBe(partnerships[0].id);
      expect(partnerships[0].children).toContain(kid.id);
    });
  });

  describe('R18 — twins / multiple births', () => {
    const twinFacts = (): FactsImportData => ({
      people: [
        { name: 'Wayne Adams', sex: 'male', x: 30 },
        { name: 'Jennie Boyd', sex: 'female', x: 50 },
        { name: 'Twin A', sex: 'female', x: 38, twinGroup: 't1' },
        { name: 'Twin B', sex: 'male', x: 46, twinGroup: 't1' },
      ],
      relationships: [{ a: 'Wayne Adams', b: 'Jennie Boyd', children: ['Twin A', 'Twin B'] }],
    });

    it('gives twins a shared multipleBirthGroupId and a shared connectionAnchorX', () => {
      const { people } = factsToDiagramImportData(twinFacts());
      const a = find(people, 'Twin A');
      const b = find(people, 'Twin B');
      expect(a.multipleBirthGroupId).toBeDefined();
      expect(a.multipleBirthGroupId).toBe(b.multipleBirthGroupId);
      expect(a.connectionAnchorX).toBe(b.connectionAnchorX);
    });

    it('does not group an ordinary sibling that has no twinGroup', () => {
      const facts = twinFacts();
      facts.people!.push({ name: 'Solo Sib', sex: 'male' });
      facts.relationships![0].children!.push('Solo Sib');
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Solo Sib').multipleBirthGroupId).toBeUndefined();
    });

    it('does not create a multiple-birth group from a single twinGroup member', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Wayne Adams', sex: 'male' },
          { name: 'Jennie Boyd', sex: 'female' },
          { name: 'Lonely Twin', sex: 'female', twinGroup: 't1' },
        ],
        relationships: [{ a: 'Wayne Adams', b: 'Jennie Boyd', children: ['Lonely Twin'] }],
      };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Lonely Twin').multipleBirthGroupId).toBeUndefined();
    });
  });

  describe('backward compatibility — non-image facts (no people[])', () => {
    it('still builds people and a partnership from family.parents without applying R16/R17', () => {
      const facts: FactsImportData = {
        family: { parents: ['Wayne Adams', 'Jennie Boyd'], childrenMentionedByName: ['Kid One'] },
      };
      const { people, partnerships } = factsToDiagramImportData(facts);
      expect(people.map((p) => p.name).sort()).toEqual(['Jennie Boyd', 'Kid One', 'Wayne Adams']);
      expect(partnerships).toHaveLength(1);
      // R17 (stillbirth) is image-import only — nobody is flagged here.
      // (size is NOT asserted: the non-image path runs normalizeImportedChildLayout,
      // which may legitimately set a size for dense-family auto-resize.)
      expect(people.every((p) => p.lifeStatus === undefined)).toBe(true);
    });
  });
});

/**
 * Regression suite for the generation-assignment fix, driven by the real
 * "Jennie's Boy" hand-drawn diagram. The old first-arrival BFS collapsed the
 * tree and put Wayne (a great-grandchild) in the top generation because his
 * wife Rose has no drawn parents. Longest-path assignment must place Wayne with
 * his own siblings and below his parents. Corrected reference fixture:
 * repo-root "Jennies Boy Corrected.json".
 */
describe("factsToDiagramImportData — Jennie's Boy generation layout", () => {
  // Manual VLM-equivalent extraction of the photographed diagram (no birth years
  // are written on it, so this exercises the STRUCTURAL fix, not the age tiers).
  const jennieFacts = (): FactsImportData => ({
    people: [
      { name: 'Grandfather', sex: 'male', deceased: true },
      { name: 'Grandmother', sex: 'female', deceased: true },
      { name: 'Died@7yrs', sex: 'female', deceased: true },
      { name: 'Helen', sex: 'female', deceased: true },
      { name: 'Eileen', sex: 'female', deceased: true },
      { name: 'Lucy', sex: 'female' },
      { name: 'Ned', sex: 'male' },
      { name: 'Charlie', sex: 'male', deceased: true },
      { name: 'Mae White', sex: 'female', deceased: true },
      { name: 'John', sex: 'male' },
      { name: 'Gerald', sex: 'male' },
      { name: 'Dennis', sex: 'male', deceased: true, twinGroup: 'dl' },
      { name: 'Leonard', sex: 'male', twinGroup: 'dl' },
      { name: 'Unnamed circle', sex: 'female' },
      { name: 'Gordon', sex: 'male' },
      { name: 'Art', sex: 'male' },
      { name: 'Jennie', sex: 'female' },
      { name: 'Ben', sex: 'male' },
      { name: 'Craig', sex: 'male' },
      { name: 'Wayne', sex: 'male' },
      { name: 'Brian', sex: 'male' },
      { name: 'Rose', sex: 'female' },
    ],
    relationships: [
      { a: 'Grandfather', b: 'Grandmother', children: ['Died@7yrs', 'Helen', 'Eileen', 'Lucy'] },
      { a: 'Ned', b: 'Lucy', children: ['John', 'Gerald', 'Dennis', 'Leonard', 'Unnamed circle', 'Jennie'] },
      { a: 'Charlie', b: 'Mae White', children: ['Gordon', 'Art'] },
      { a: 'Art', b: 'Jennie', children: ['Ben', 'Craig', 'Wayne', 'Brian'] },
      { a: 'Wayne', b: 'Rose', children: [] },
    ],
  });

  it('places Wayne in the SAME generation row as his siblings (not the top)', () => {
    const { people } = factsToDiagramImportData(jennieFacts());
    const wayne = find(people, 'Wayne');
    for (const sib of ['Ben', 'Craig', 'Brian']) {
      expect(find(people, sib).y).toBe(wayne.y);
    }
    // The old bug parked Wayne at the topmost generation — assert he is NOT there.
    const topY = Math.min(...people.map((p) => p.y));
    expect(wayne.y).toBeGreaterThan(topY);
  });

  it('keeps every child strictly below the deeper of its two parents', () => {
    const { people } = factsToDiagramImportData(jennieFacts());
    const y = (n: string) => find(people, n).y;
    // Wayne below both parents
    expect(y('Wayne')).toBeGreaterThan(y('Art'));
    expect(y('Wayne')).toBeGreaterThan(y('Jennie'));
    // Bug B: Ned/Lucy's children sit below Lucy (a grandparents' child), not level with Ned.
    expect(y('Jennie')).toBeGreaterThan(y('Lucy'));
    expect(y('Jennie')).toBeGreaterThan(y('Ned'));
    // Grandparents are the topmost row.
    expect(y('Grandfather')).toBe(Math.min(...people.map((p) => p.y)));
  });

  it('lets a married-in spouse with no drawn parents inherit their partner’s generation', () => {
    const { people } = factsToDiagramImportData(jennieFacts());
    // Rose has no parents drawn; she must sit with Wayne, not be treated as a top-gen root.
    expect(find(people, 'Rose').y).toBe(find(people, 'Wayne').y);
  });

  it('produces the expected four generation bands', () => {
    const { people } = factsToDiagramImportData(jennieFacts());
    const bands = [...new Set(people.map((p) => p.y))].sort((a, b) => a - b);
    expect(bands).toHaveLength(4); // grandparents → their kids → John/Jennie/Art gen → Wayne gen
  });

  it('matches the corrected reference on family count', () => {
    const ref = JSON.parse(readFileSync(join(__dirname, '../../../../Jennies Boy Corrected.json'), 'utf8'));
    const { partnerships } = factsToDiagramImportData(jennieFacts());
    expect(partnerships).toHaveLength(ref.partnerships.length); // both have 5 families
  });
});

describe('factsToDiagramImportData — age as a soft generation check', () => {
  it('nudges a fully-disconnected dated person into the nearest-age generation band', () => {
    const facts: FactsImportData = {
      people: [
        { name: 'Grandpa', sex: 'male', birthYear: 1900 },
        { name: 'Grandma', sex: 'female', birthYear: 1905 },
        { name: 'Parent A', sex: 'male', birthYear: 1930 },
        { name: 'Parent B', sex: 'female', birthYear: 1932 },
        { name: 'Kid', sex: 'male', birthYear: 1960 },
        { name: 'Floater', sex: 'female', birthYear: 1958 }, // isolated, but same era as Kid
      ],
      relationships: [
        { a: 'Grandpa', b: 'Grandma', children: ['Parent A'] },
        { a: 'Parent A', b: 'Parent B', children: ['Kid'] },
      ],
    };
    const { people } = factsToDiagramImportData(facts);
    // Floater has no lines, so structure alone would leave her at the top gen (y minimum).
    // The age nudge should drop her onto Kid's row instead.
    expect(find(people, 'Floater').y).toBe(find(people, 'Kid').y);
  });

  it('flags an age-impossible drawn parent→child link but keeps the drawn line', () => {
    const facts: FactsImportData = {
      people: [
        { name: 'Young Parent', sex: 'male', birthYear: 1990 },
        { name: 'Other Parent', sex: 'female', birthYear: 1992 },
        { name: 'Older Child', sex: 'male', birthYear: 1980 }, // born BEFORE the parents
      ],
      relationships: [{ a: 'Young Parent', b: 'Other Parent', children: ['Older Child'] }],
    };
    const result = factsToDiagramImportData(facts);
    // Age raises a hand (surfaced via ideasText) ...
    expect(result.ideasText).toMatch(/Age check/i);
    // ... but never grabs the wheel: the drawn parent-child link is preserved.
    const child = find(result.people, 'Older Child');
    expect(child.parentPartnership).toBe(result.partnerships[0].id);
    expect(result.partnerships[0].children).toContain(child.id);
  });
});
