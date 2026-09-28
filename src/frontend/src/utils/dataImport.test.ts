/**
 * Tests for factsToDiagramImportData — the converter that turns VLM-extracted
 * FactsImportData into a loadable DiagramImportData. Focuses on the image-import
 * path (facts.people present): sex/date/coordinate mapping and layout rules
 * R13/R16/R17. Previously untested.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { factsToDiagramImportData, parseTranscriptToDraftDiagram } from './dataImport';
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

    it('marks deceased-with-unknown-year as deceased without inventing a death date', () => {
      // Regression: this used to write deathDate '1900-01-01', a made-up value
      // that dated deaths before births and misplaced people on the timeline.
      // deathDateKnown is the model's "deceased, date unknown" flag and still
      // draws the X (PersonNode renderDeathOverlay).
      const facts: FactsImportData = {
        people: [{ name: 'Charlie Cole', sex: 'male', deceased: true, deathYear: null, birthYear: 1950 }],
      };
      const { people } = factsToDiagramImportData(facts);
      const charlie = find(people, 'Charlie Cole');
      expect(charlie.deathDate).toBeUndefined();
      expect(charlie.deathDateKnown).toBe(true);
      expect(charlie.birthDate).toBe('1950-01-01');
    });

    it('leaves gender unset for sex="unknown" instead of defaulting to female', () => {
      const facts: FactsImportData = {
        people: [
          { name: 'Ghost', sex: 'unknown' },
          // A name on the gender-override list must not override an explicit unknown.
          { name: 'Mary', sex: 'unknown' },
        ],
      };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Ghost').gender).toBeUndefined();
      expect(find(people, 'Mary').gender).toBeUndefined();
    });

    it('leaves gender unset when sex is absent and the name gives no evidence', () => {
      const facts: FactsImportData = { people: [{ name: 'Quinlan' }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Quinlan').gender).toBeUndefined();
    });

    it('does not set a death date for a living person', () => {
      const facts: FactsImportData = { people: [{ name: 'Wayne Adams', sex: 'male' }] };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'Wayne Adams').deathDate).toBeUndefined();
    });

    it('uses image X percentage as left-to-right order, not absolute pixels (R12)', () => {
      // For image imports BOTH axes are layout-determined: Y by generation, X by the
      // packed family layout (R19). The image x% only fixes the drawn L-R ORDER, so a
      // person drawn further left ends up left of one drawn further right.
      const facts: FactsImportData = {
        people: [
          { name: 'Pa', sex: 'male' },
          { name: 'Ma', sex: 'female' },
          { name: 'LeftKid', sex: 'male', x: 20, y: 60 },
          { name: 'RightKid', sex: 'female', x: 80, y: 60 },
        ],
        relationships: [{ a: 'Pa', b: 'Ma', children: ['LeftKid', 'RightKid'] }],
      };
      const { people } = factsToDiagramImportData(facts);
      expect(find(people, 'LeftKid').x).toBeLessThan(find(people, 'RightKid').x);
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

  it('does not place a childless married-in spouse on top of a sibling (Rose vs Craig)', () => {
    const { people } = factsToDiagramImportData(jennieFacts());
    const rose = find(people, 'Rose');
    // Rose married into a full sibling row (Ben/Craig/Wayne/Brian) — she must not
    // land exactly on any of them.
    for (const sib of ['Ben', 'Craig', 'Wayne', 'Brian']) {
      expect(find(people, sib).x).not.toBe(rose.x);
    }
  });

  it('gives every person a unique position on their generation row', () => {
    const { people } = factsToDiagramImportData(jennieFacts());
    const byRow = new Map<number, number[]>();
    for (const p of people) {
      const row = Math.round(p.y);
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row)!.push(Math.round(p.x));
    }
    for (const xs of byRow.values()) {
      expect(new Set(xs).size).toBe(xs.length); // no two people share an (x,y)
    }
  });

  it('brackets every couple wider than its RESIDENT children row (R19, R20)', () => {
    const { people, partnerships } = factsToDiagramImportData(jennieFacts());
    const byId = new Map(people.map((p) => [p.id, p]));
    // A child who is themselves a parent in another family may have married out
    // (R20) and moved next to their spouse, so a couple need only bracket the
    // children that still reside in its row.
    const isParentElsewhere = (id: string) =>
      partnerships.some((pt) => (pt.partner1_id === id || pt.partner2_id === id) && pt.children.length > 0);
    for (const pt of partnerships) {
      const residentKids = pt.children.filter((id) => !isParentElsewhere(id));
      if (residentKids.length === 0) continue;
      const kidsX = residentKids.map((id) => byId.get(id)!.x);
      const p1 = byId.get(pt.partner1_id)!;
      const p2 = byId.get(pt.partner2_id)!;
      expect(Math.min(p1.x, p2.x)).toBeLessThan(Math.min(...kidsX)); // left partner left of resident kids
      expect(Math.max(p1.x, p2.x)).toBeGreaterThan(Math.max(...kidsX)); // right partner right of them
    }
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

describe('factsToDiagramImportData — R20 married-in mate anchoring', () => {
  // Family A (3 kids) is larger than Family B (2 kids). A child of each marries the
  // other. R20 keeps the couple in A's row (anchor) and marks B's child married-in,
  // so B's couple is NOT stretched to reach the child who moved to their spouse.
  const crossLineageFacts = (): FactsImportData => ({
    people: [
      { name: 'Amom', sex: 'female', x: 10 },
      { name: 'Adad', sex: 'male', x: 20 },
      { name: 'AsibL', sex: 'female', x: 5, y: 40 },
      { name: 'AsibR', sex: 'male', x: 15, y: 40 },
      { name: 'Amarry', sex: 'female', x: 25, y: 40 },
      { name: 'Bmom', sex: 'female', x: 80 },
      { name: 'Bdad', sex: 'male', x: 90 },
      { name: 'Bsib', sex: 'female', x: 75, y: 40 },
      { name: 'Bmarry', sex: 'male', x: 85, y: 40 },
      { name: 'GC1', sex: 'male', x: 45, y: 70 },
      { name: 'GC2', sex: 'female', x: 55, y: 70 },
    ],
    relationships: [
      { a: 'Amom', b: 'Adad', children: ['AsibL', 'AsibR', 'Amarry'] },
      { a: 'Bmom', b: 'Bdad', children: ['Bsib', 'Bmarry'] },
      { a: 'Amarry', b: 'Bmarry', children: ['GC1', 'GC2'] },
    ],
  });

  it('does not stretch the married-in partner’s birth family to reach them', () => {
    const { people } = factsToDiagramImportData(crossLineageFacts());
    const x = (n: string) => find(people, n).x;
    // Family B brackets its RESIDENT child (Bsib) ...
    expect(Math.min(x('Bmom'), x('Bdad'))).toBeLessThan(x('Bsib'));
    expect(Math.max(x('Bmom'), x('Bdad'))).toBeGreaterThan(x('Bsib'));
    // ... and Bmarry (married out) is NOT inside Family B's couple span — the couple
    // stays compact and a longer parent-child connector reaches Bmarry instead.
    const bLeft = Math.min(x('Bmom'), x('Bdad'));
    const bRight = Math.max(x('Bmom'), x('Bdad'));
    expect(x('Bmarry') < bLeft || x('Bmarry') > bRight).toBe(true);
  });

  it('still brackets the married couple over their own children', () => {
    const { people } = factsToDiagramImportData(crossLineageFacts());
    const x = (n: string) => find(people, n).x;
    const kidMin = Math.min(x('GC1'), x('GC2'));
    const kidMax = Math.max(x('GC1'), x('GC2'));
    expect(Math.min(x('Amarry'), x('Bmarry'))).toBeLessThan(kidMin);
    expect(Math.max(x('Amarry'), x('Bmarry'))).toBeGreaterThan(kidMax);
  });
});

describe('factsToDiagramImportData — R19 packed family X layout', () => {
  it('places a couple’s Partner Relationship Line wider than its children row', () => {
    const facts: FactsImportData = {
      people: [
        { name: 'Pa', sex: 'male', x: 40 },
        { name: 'Ma', sex: 'female', x: 60 },
        { name: 'A', sex: 'male', x: 30, y: 60 },
        { name: 'B', sex: 'female', x: 50, y: 60 },
        { name: 'C', sex: 'male', x: 70, y: 60 },
      ],
      relationships: [{ a: 'Pa', b: 'Ma', children: ['A', 'B', 'C'] }],
    };
    const { people } = factsToDiagramImportData(facts);
    const x = (n: string) => find(people, n).x;
    const kidMin = Math.min(x('A'), x('B'), x('C'));
    const kidMax = Math.max(x('A'), x('B'), x('C'));
    expect(Math.min(x('Pa'), x('Ma'))).toBeLessThan(kidMin);
    expect(Math.max(x('Pa'), x('Ma'))).toBeGreaterThan(kidMax);
  });

  it('keeps two sibling families from overlapping on X', () => {
    const facts: FactsImportData = {
      people: [
        { name: 'GpaA', sex: 'male', x: 20 },
        { name: 'GmaA', sex: 'female', x: 25 },
        { name: 'GpaB', sex: 'male', x: 70 },
        { name: 'GmaB', sex: 'female', x: 75 },
        { name: 'A1', sex: 'male', x: 18, y: 60 },
        { name: 'A2', sex: 'female', x: 27, y: 60 },
        { name: 'B1', sex: 'male', x: 68, y: 60 },
        { name: 'B2', sex: 'female', x: 77, y: 60 },
      ],
      relationships: [
        { a: 'GpaA', b: 'GmaA', children: ['A1', 'A2'] },
        { a: 'GpaB', b: 'GmaB', children: ['B1', 'B2'] },
      ],
    };
    const { people } = factsToDiagramImportData(facts);
    const x = (n: string) => find(people, n).x;
    // Family A's whole X-extent must sit entirely left of family B's — no interleaving.
    const familyAmax = Math.max(x('GpaA'), x('GmaA'), x('A1'), x('A2'));
    const familyBmin = Math.min(x('GpaB'), x('GmaB'), x('B1'), x('B2'));
    expect(familyAmax).toBeLessThan(familyBmin);
  });

  it('assigns a distinct X to every person in a generation (no exact collisions)', () => {
    const { people } = factsToDiagramImportData({
      people: [
        { name: 'P1', sex: 'male' },
        { name: 'P2', sex: 'female' },
        { name: 'K1', sex: 'male', x: 30, y: 60 },
        { name: 'K2', sex: 'female', x: 50, y: 60 },
        { name: 'K3', sex: 'male', x: 70, y: 60 },
      ],
      relationships: [{ a: 'P1', b: 'P2', children: ['K1', 'K2', 'K3'] }],
    });
    const kidXs = ['K1', 'K2', 'K3'].map((n) => find(people, n).x);
    expect(new Set(kidXs).size).toBe(3);
  });
});

describe('factsToDiagramImportData — R21 Reingold-Tilford centering', () => {
  it('centers a parent couple over its children', () => {
    const facts: FactsImportData = {
      people: [
        { name: 'Dad', sex: 'male', x: 40, y: 20 },
        { name: 'Mom', sex: 'female', x: 60, y: 20 },
        { name: 'C1', sex: 'male', x: 30, y: 60 },
        { name: 'C2', sex: 'female', x: 50, y: 60 },
        { name: 'C3', sex: 'male', x: 70, y: 60 },
      ],
      relationships: [{ a: 'Dad', b: 'Mom', children: ['C1', 'C2', 'C3'] }],
    };
    const { people } = factsToDiagramImportData(facts);
    const x = (n: string) => find(people, n).x;
    const coupleCenter = (x('Dad') + x('Mom')) / 2;
    const childrenCenter = (Math.min(x('C1'), x('C2'), x('C3')) + Math.max(x('C1'), x('C2'), x('C3'))) / 2;
    expect(Math.abs(coupleCenter - childrenCenter)).toBeLessThan(1);
  });

  it('preserves sibling order even when one sibling has a wide subtree', () => {
    // BigKid heads a family (so its layout mutates X during placement). Sibling order
    // must still follow the drawn order — the regression the drawn-order snapshot fixes.
    const facts: FactsImportData = {
      people: [
        { name: 'GA', sex: 'male', x: 40, y: 20 },
        { name: 'GB', sex: 'female', x: 60, y: 20 },
        { name: 'BigKid', sex: 'female', x: 30, y: 50 },
        { name: 'MidKid', sex: 'male', x: 55, y: 50 },
        { name: 'SmallKid', sex: 'male', x: 80, y: 50 },
        { name: 'Sp', sex: 'male', x: 20, y: 50 },
        { name: 'g1', sex: 'male', x: 20, y: 80 },
        { name: 'g2', sex: 'female', x: 30, y: 80 },
        { name: 'g3', sex: 'male', x: 40, y: 80 },
      ],
      relationships: [
        { a: 'GA', b: 'GB', children: ['BigKid', 'MidKid', 'SmallKid'] },
        { a: 'BigKid', b: 'Sp', children: ['g1', 'g2', 'g3'] },
      ],
    };
    const { people } = factsToDiagramImportData(facts);
    const x = (n: string) => find(people, n).x;
    expect(x('BigKid')).toBeLessThan(x('MidKid'));
    expect(x('MidKid')).toBeLessThan(x('SmallKid'));
  });
});

describe('factsToDiagramImportData — facts (non-image) path does not fabricate', () => {
  it('homicide_suicide event without a year marks deceased but invents no date', () => {
    // Regression: this used to write deathDate '1973-01-01' when no year was given.
    const facts: FactsImportData = {
      family: { parents: ['Anna Ray', 'Bert Ray'] },
      clinical: { events: [{ person: 'Anna Ray', type: 'homicide_suicide' }] },
    };
    const { people } = factsToDiagramImportData(facts);
    const anna = find(people, 'Anna Ray');
    expect(anna.deathDate).toBeUndefined();
    expect(anna.deathDateKnown).toBe(true);
  });

  it('homicide_suicide event with a year uses that year', () => {
    const facts: FactsImportData = {
      family: { parents: ['Anna Ray', 'Bert Ray'] },
      clinical: { events: [{ person: 'Anna Ray', type: 'homicide_suicide', year: 1981 }] },
    };
    const { people } = factsToDiagramImportData(facts);
    expect(find(people, 'Anna Ray').deathDate).toBe('1981-01-01');
  });

  it('does not assign a sex to people whose names give no evidence', () => {
    const facts: FactsImportData = {
      relationships: [{ a: 'Quinlan Ray', b: 'Don Ray', type: 'married' }],
    };
    const { people } = factsToDiagramImportData(facts);
    expect(find(people, 'Quinlan Ray').gender).toBeUndefined();
    // Name-override evidence still applies.
    expect(find(people, 'Don Ray').gender).toBe('male');
  });
});

describe('parseTranscriptToDraftDiagram — does not fabricate', () => {
  it('a killed-then-suicide mention marks both deceased without inventing 1973', () => {
    // Regression: both people used to get deathDate '1973-01-01'.
    const transcript = 'Quinlan killed Tavi and then killed himself.';
    const { people } = parseTranscriptToDraftDiagram(transcript, 't.txt');
    for (const name of ['Quinlan', 'Tavi']) {
      const person = find(people, name);
      expect(person.deathDate).toBeUndefined();
      expect(person.deathDateKnown).toBe(true);
    }
  });

  it('keeps a real death year from the transcript', () => {
    const { people } = parseTranscriptToDraftDiagram('Quinlan died 1990.', 't.txt');
    expect(find(people, 'Quinlan').deathDate).toBe('1990-01-01');
    expect(find(people, 'Quinlan').deathDateKnown).toBeUndefined();
  });

  it('does not default unknown names to female', () => {
    const { people } = parseTranscriptToDraftDiagram('Quinlan and Tavi married in 1980.', 't.txt');
    expect(find(people, 'Quinlan').gender).toBeUndefined();
    expect(find(people, 'Tavi').gender).toBeUndefined();
  });

  it('placeholder children from a child count get no invented sex', () => {
    const { people } = parseTranscriptToDraftDiagram(
      'Quinlan and Tavi married in 1980. Quinlan and Tavi have two children.',
      't.txt'
    );
    const placeholders = people.filter((p) => / Child \d+$/.test(p.name));
    expect(placeholders).toHaveLength(2);
    placeholders.forEach((child) => expect(child.gender).toBeUndefined());
  });
});

describe('parseTranscriptToDraftDiagram — only names become people', () => {
  const names = (transcript: string) =>
    parseTranscriptToDraftDiagram(transcript, 't.txt').people.map((p) => p.name).sort();

  it('does not turn pronouns or role words into people (regression: the `i` flag)', () => {
    // With /gi, [A-Z][a-z]+ matched any word: this produced Mother, Father and She.
    expect(names('My mother and father got married in 1950. She died 1980.')).toEqual([]);
  });

  it('skips capitalised role words and sentence starters', () => {
    expect(names('Mother and Father married in 1950.')).toEqual([]);
    expect(names('She and Tom argued all the time.')).toEqual([]);
    expect(names('The family had 3 children.')).toEqual([]);
  });

  it('still finds real names in every pattern it supports', () => {
    const transcript = [
      'Tom and Ann married in 1970.',
      'Tom and Ann had 2 children.',
      'Bob Smith was born 1960.',
      'Ann died 1995.',
      'Tom and Bob argued constantly.',
      'Ann was cut off from her sister Joy.',
    ].join(' ');
    const result = parseTranscriptToDraftDiagram(transcript, 't.txt');
    const byName = (n: string) => result.people.find((p) => p.name === n);
    expect(byName('Tom')).toBeDefined();
    expect(byName('Ann')?.deathDate).toBe('1995-01-01');
    expect(byName('Bob Smith')?.birthDate).toBe('1960-01-01');
    expect(byName('Joy')).toBeDefined();
    expect(result.partnerships).toHaveLength(1);
    expect(result.partnerships[0].relationshipStartDate).toBe('1970-01-01');
    const types = result.emotionalLines.map((l) => l.relationshipType).sort();
    expect(types).toEqual(['conflict', 'cutoff']);
  });

  it('accepts a capitalised diagnosis keyword', () => {
    const result = parseTranscriptToDraftDiagram(
      'Tom and Joy married in 1970. Joy was Diagnosed with Schizophrenia in 1990.',
      't.txt'
    );
    expect(result.people.find((p) => p.name === 'Joy')?.functionalIndicators?.[0]?.definitionId).toBe(
      'indicator-schizophrenia-spectrum'
    );
  });
});

describe('factsToDiagramImportData — image import keeps distinct labels distinct', () => {
  it('does not merge "M" and "M (b.1968)" into one person', () => {
    // The VLM prompt requires a unique label per person and disambiguates
    // repeated letters with a suffix. The fuzzy prefix match used for
    // transcripts merged them, making the daughter her own mother's child.
    const facts: FactsImportData = {
      people: [
        { name: 'M', sex: 'female', birthYear: 1940 },
        { name: 'D', sex: 'male', birthYear: 1938 },
        { name: 'M (b.1968)', sex: 'female', birthYear: 1968 },
      ],
      relationships: [{ a: 'D', b: 'M', type: 'married', children: ['M (b.1968)'] }],
    };
    const { people, partnerships } = factsToDiagramImportData(facts);
    expect(people.map((p) => p.name).sort()).toEqual(['D', 'M', 'M (b.1968)']);
    const daughter = find(people, 'M (b.1968)');
    expect(daughter.birthDate).toBe('1968-01-01');
    expect(daughter.parentPartnership).toBe(partnerships[0].id);
    expect(find(people, 'M').parentPartnership).toBeUndefined();
  });

  it('keeps "Mary" and "Mary Jones" distinct in an image import', () => {
    const facts: FactsImportData = {
      people: [{ name: 'Mary', sex: 'female' }, { name: 'Mary Jones', sex: 'female' }],
    };
    expect(factsToDiagramImportData(facts).people).toHaveLength(2);
  });

  it('still matches a first name to a full name in a non-image facts import', () => {
    const facts: FactsImportData = {
      family: { parents: ['Mary Jones', 'Tom Jones'], childrenMentionedByName: [] },
      relationships: [{ a: 'Mary', b: 'Tom Jones', type: 'married' }],
    };
    expect(factsToDiagramImportData(facts).people).toHaveLength(2);
  });
});
